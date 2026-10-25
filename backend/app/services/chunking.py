"""Semantic chunking and curriculum extraction pipeline for large multi-page syllabus documents.

Splits multi-semester/course documents (>15,000 characters) into bounded semantic chunks,
extracts each chunk with provenance tracking, applies bounded retries and cancellation checks,
and deterministically merges chunk outputs into a unified ExtractedCurriculum.
"""

import logging
import re
from dataclasses import dataclass, field
from typing import Callable, List, Optional, Tuple

from backend.app.config import settings
from backend.app.exceptions import ExtractionError
from backend.app.extractor import extract_curriculum
from backend.app.parser import ParsedDocument
from backend.app.schemas import (
    ExtractedCurriculum,
    ExtractedSemester,
    ExtractedSubtopic,
    ExtractedTopic,
    ExtractedYear,
)

logger = logging.getLogger(__name__)

# Threshold in characters to trigger semantic chunking
CHUNK_CHAR_THRESHOLD = 15000


@dataclass
class SemanticChunk:
    """Represents a bounded section of a syllabus document."""
    chunk_index: int
    total_chunks: int
    title: str
    text: str
    page_start: Optional[int] = None
    page_end: Optional[int] = None


SEMESTER_HEADER_PATTERN = re.compile(
    r"(?i)(?:^|\n)\s*(?:[#*=-]+\s*)?(?:"
    r"(?:academic\s+year\s+[1-4]|year\s+[1-4]|first\s+year|second\s+year|third\s+year|fourth\s+year)|"
    r"(?:semester\s+[ivx\d]+|sem\s+[ivx\d]+|first\s+semester|second\s+semester|third\s+semester|"
    r"fourth\s+semester|fifth\s+semester|sixth\s+semester|seventh\s+semester|eighth\s+semester)"
    r")(?:\s*[:\-–—]\s*|\s*[\n\r])",
    re.MULTILINE,
)


def detect_semantic_chunks(parsed_doc: ParsedDocument) -> List[SemanticChunk]:
    """
    Partition document into bounded semantic chunks based on semester/year boundaries.
    
    If document text is under the threshold (15,000 chars) and has at most one detected section,
    returns a single chunk representing the whole document.
    """
    text = parsed_doc.text
    if not text.strip():
        return []

    # If document is small and doesn't exceed threshold, keep as 1 chunk
    if len(text) <= CHUNK_CHAR_THRESHOLD:
        return [
            SemanticChunk(
                chunk_index=1,
                total_chunks=1,
                title="Full Syllabus",
                text=text,
                page_start=parsed_doc.pages[0][0] if parsed_doc.pages else None,
                page_end=parsed_doc.pages[-1][0] if parsed_doc.pages else None,
            )
        ]

    # Find candidate boundary matches
    matches = list(SEMESTER_HEADER_PATTERN.finditer(text))

    # If no clear semester headers found, split by page groups or size blocks
    if not matches:
        return _split_into_sized_chunks(parsed_doc)

    chunks: List[SemanticChunk] = []
    # If there is preamble before first match, include it in first chunk or as overview
    start_pos = 0
    section_titles: List[str] = []
    section_spans: List[Tuple[int, int]] = []

    for i, match in enumerate(matches):
        match_start = match.start()
        header_text = match.group(0).strip().replace("#", "").replace("*", "").strip()

        if i == 0 and match_start > 0:
            # Preamble included in first chunk
            pass

        if i > 0:
            section_spans.append((start_pos, match_start))

        start_pos = match_start
        section_titles.append(header_text)

    # Add final section
    section_spans.append((start_pos, len(text)))

    # Construct SemanticChunk items
    total_sections = len(section_spans)
    for idx, (s_start, s_end) in enumerate(section_spans):
        chunk_text = text[s_start:s_end].strip()
        if not chunk_text:
            continue
        title = section_titles[idx] if idx < len(section_titles) else f"Section {idx + 1}"
        chunks.append(
            SemanticChunk(
                chunk_index=len(chunks) + 1,
                total_chunks=total_sections,
                title=title,
                text=chunk_text,
            )
        )

    # Re-index total_chunks
    total = len(chunks)
    for c in chunks:
        c.total_chunks = total

    return chunks if chunks else _split_into_sized_chunks(parsed_doc)


def _split_into_sized_chunks(parsed_doc: ParsedDocument, chunk_size: int = 12000) -> List[SemanticChunk]:
    """Fallback chunker splitting long documents along paragraph boundaries."""
    text = parsed_doc.text
    paragraphs = text.split("\n\n")
    chunks: List[SemanticChunk] = []
    curr_paras: List[str] = []
    curr_len = 0

    for para in paragraphs:
        if curr_len + len(para) > chunk_size and curr_paras:
            chunk_body = "\n\n".join(curr_paras)
            chunks.append(
                SemanticChunk(
                    chunk_index=len(chunks) + 1,
                    total_chunks=1,
                    title=f"Section {len(chunks) + 1}",
                    text=chunk_body,
                )
            )
            curr_paras = [para]
            curr_len = len(para)
        else:
            curr_paras.append(para)
            curr_len += len(para)

    if curr_paras:
        chunks.append(
            SemanticChunk(
                chunk_index=len(chunks) + 1,
                total_chunks=1,
                title=f"Section {len(chunks) + 1}",
                text="\n\n".join(curr_paras),
            )
        )

    total = len(chunks)
    for c in chunks:
        c.total_chunks = total

    return chunks


def merge_extracted_curricula(
    chunk_results: List[ExtractedCurriculum],
    fallback_title: str = "Academic Syllabus",
) -> ExtractedCurriculum:
    """
    Deterministically merge extracted curricula from multiple chunks into a unified tree.
    
    Preserves:
    - Root title from first non-empty program title.
    - Year and semester groupings without duplicate containers.
    - Sibling topic and subtopic order.
    - Verbatim source evidence.
    """
    if not chunk_results:
        return ExtractedCurriculum(program_title=fallback_title, years=[])

    program_title = fallback_title
    for cr in chunk_results:
        if cr.program_title and cr.program_title.strip() and cr.program_title != "Academic Syllabus":
            program_title = cr.program_title.strip()
            break

    # Merge by Year -> Semester -> Topic
    years_by_title: dict[str, ExtractedYear] = {}

    for cr in chunk_results:
        for yr in cr.years:
            yr_key = yr.title.strip().lower()
            if yr_key not in years_by_title:
                years_by_title[yr_key] = ExtractedYear(
                    title=yr.title.strip(),
                    year_number=yr.year_number,
                    semesters=[],
                )
            target_year = years_by_title[yr_key]

            # Merge Semesters
            sem_by_title = {s.title.strip().lower(): s for s in target_year.semesters}
            for sem in yr.semesters:
                sem_key = sem.title.strip().lower()
                if sem_key not in sem_by_title:
                    new_sem = ExtractedSemester(
                        title=sem.title.strip(),
                        semester_number=sem.semester_number,
                        topics=[],
                    )
                    target_year.semesters.append(new_sem)
                    sem_by_title[sem_key] = new_sem
                target_sem = sem_by_title[sem_key]

                # Merge Topics
                top_by_title = {t.title.strip().lower(): t for t in target_sem.topics}
                for top in sem.topics:
                    top_key = top.title.strip().lower()
                    if top_key not in top_by_title:
                        new_top = ExtractedTopic(
                            title=top.title.strip(),
                            subtopics=[],
                        )
                        target_sem.topics.append(new_top)
                        top_by_title[top_key] = new_top
                    target_top = top_by_title[top_key]

                    # Append subtopics
                    for sub in top.subtopics:
                        target_top.subtopics.append(sub)

    return ExtractedCurriculum(
        program_title=program_title,
        years=list(years_by_title.values()),
    )


def process_chunks_with_progress(
    chunks: List[SemanticChunk],
    source_filename: str,
    on_progress: Optional[Callable[[int, str], None]] = None,
    is_cancelled: Optional[Callable[[], bool]] = None,
    allow_fallback: bool = True,
    model_override: Optional[str] = None,
    extract_fn: Optional[Callable] = None,
) -> ExtractedCurriculum:
    """
    Extracts curriculum from chunks sequentially, publishing real-time weighted progress:
    P = 40 + 45 * (completed_chunks / total_chunks)
    
    Checks cancellation before and after each chunk.
    """
    if not chunks:
        raise ExtractionError(f"No parseable content chunks extracted from '{source_filename}'.")

    total_chunks = len(chunks)
    extracted_chunks: List[ExtractedCurriculum] = []

    for idx, ch in enumerate(chunks):
        if is_cancelled and is_cancelled():
            logger.info("chunking.cancelled_before_chunk idx=%d total=%d", idx + 1, total_chunks)
            raise ExtractionError("Processing cancelled by user.")

        chunk_num = idx + 1
        msg = f"Extracting {ch.title}: chunk {chunk_num} of {total_chunks}."
        # Progress calculation: 40% base + 45% scaled by chunk progress
        current_percent = 40 + int(45 * (idx / total_chunks))
        if on_progress:
            on_progress(current_percent, msg)

        # Create virtual ParsedDocument for this chunk
        chunk_doc = ParsedDocument(
            text=ch.text,
            pages=[(ch.page_start or 1, ch.text)],
            has_reliable_pages=ch.page_start is not None,
            source_filename=source_filename,
        )

        try:
            fn = extract_fn or extract_curriculum
            curr_extracted = fn(
                chunk_doc,
                allow_fallback=allow_fallback,
                model_override=model_override,
            )
            extracted_chunks.append(curr_extracted)
        except Exception as e:
            logger.warning("chunking.chunk_failed idx=%d total=%d err=%s", chunk_num, total_chunks, e)
            if not allow_fallback:
                raise
            # Try deterministic outline fallback for this chunk
            from backend.app.extractor import extract_curriculum_rule_based
            curr_extracted = extract_curriculum_rule_based(chunk_doc)
            extracted_chunks.append(curr_extracted)

        # End of chunk progress
        completed_percent = 40 + int(45 * (chunk_num / total_chunks))
        if on_progress:
            on_progress(completed_percent, f"Completed {ch.title} (chunk {chunk_num} of {total_chunks}).")

        if is_cancelled and is_cancelled():
            logger.info("chunking.cancelled_after_chunk idx=%d total=%d", chunk_num, total_chunks)
            raise ExtractionError("Processing cancelled by user.")

    # Merge all chunk extractions
    merged = merge_extracted_curricula(extracted_chunks, fallback_title=source_filename)
    return merged
