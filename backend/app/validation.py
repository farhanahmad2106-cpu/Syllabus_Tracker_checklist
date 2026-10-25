"""Deterministic validation, grounding verification, and hierarchy canonicalization."""

import math
import re
from typing import List, Optional, Set, Tuple

from backend.app.exceptions import HierarchyValidationError
from backend.app.schemas import (
    AcademicYear,
    ExtractedCurriculum,
    HierarchicalSyllabus,
    Semester,
    Subtopic,
    Topic,
)


def normalize_whitespace(text: str) -> str:
    """Normalize text for grounding comparison while collapsing excessive whitespace."""
    if not text:
        return ""
    # Normalize unicode spaces, newlines, and tabs
    collapsed = re.sub(r"\s+", " ", text.strip())
    return collapsed.lower()


def verify_grounding(snippet: str, source_text: str) -> bool:
    """
    Verify that an extracted evidence snippet actually exists within the source document text.
    Conservative normalization: removes whitespace differences and compares case-insensitively.
    """
    if not snippet or not source_text:
        return False
    norm_snippet = normalize_whitespace(snippet)
    norm_source = normalize_whitespace(source_text)
    return norm_snippet in norm_source


def derive_academic_year_number(semester_title: str, semester_number: Optional[int]) -> Optional[int]:
    """
    Derive academic year from sequential semester numbering:
    academic_year = (semester_number + 1) // 2
    Valid only for sequential semester numbering like 'Semester 1', 'Semester 2', 'Sem 3', etc.
    Does not apply to ambiguous seasonal labels like 'Spring', 'Fall', 'Semester A'.
    """
    if semester_number is not None and semester_number > 0:
        return (semester_number + 1) // 2

    # Try extracting numeric semester from title like "Semester 3" or "Sem 4"
    match = re.search(r"\b(?:semester|sem)\s*#?\s*(\d+)\b", semester_title, re.IGNORECASE)
    if match:
        sem_num = int(match.group(1))
        if sem_num > 0:
            return (sem_num + 1) // 2

    return None


def canonicalize_extracted_curriculum(
    extracted: ExtractedCurriculum,
    source_filename: str,
    source_document_text: str,
    syllabus_id: str,
) -> Tuple[HierarchicalSyllabus, List[str]]:
    """
    Transforms extracted curriculum into canonical 5-level HierarchicalSyllabus.
    Validates source grounding, unique IDs, positive page numbers, and structural completeness.
    """
    warnings: List[str] = []
    seen_ids: Set[str] = set()

    # Program title
    raw_title = extracted.program_title.strip() if extracted.program_title else ""
    if not raw_title:
        title = "Untitled Syllabus"
        warnings.append("Program/Course title was not found in document; defaulted to 'Untitled Syllabus'.")
    else:
        title = raw_title

    canonical_years: List[AcademicYear] = []
    year_index = 0

    # If the LLM returned years, process them.
    # If the LLM returned semesters directly or didn't populate years, group them.
    for y_idx, ext_year in enumerate(extracted.years):
        year_title = ext_year.title.strip() if ext_year.title else f"Academic Year {y_idx + 1}"
        year_id = f"year_{y_idx + 1}"
        if year_id in seen_ids:
            year_id = f"year_{y_idx + 1}_{year_index}"
        seen_ids.add(year_id)

        canonical_semesters: List[Semester] = []
        for s_idx, ext_sem in enumerate(ext_year.semesters):
            sem_title = ext_sem.title.strip() if ext_sem.title else f"Semester {s_idx + 1}"
            sem_id = f"{year_id}_sem_{s_idx + 1}"
            seen_ids.add(sem_id)

            canonical_topics: List[Topic] = []
            for t_idx, ext_top in enumerate(ext_sem.topics):
                top_title = ext_top.title.strip() if ext_top.title else f"Topic {t_idx + 1}"
                top_id = f"{sem_id}_topic_{t_idx + 1}"
                seen_ids.add(top_id)

                canonical_subtopics: List[Subtopic] = []
                for sub_idx, ext_sub in enumerate(ext_top.subtopics):
                    sub_title = ext_sub.title.strip() if ext_sub.title else f"Subtopic {sub_idx + 1}"
                    sub_id = f"{top_id}_sub_{sub_idx + 1}"
                    seen_ids.add(sub_id)

                    evidence = ext_sub.source_text.strip()
                    if not evidence:
                        evidence = sub_title

                    # Check source grounding
                    evidence_status = "verified"
                    if source_document_text:
                        is_grounded = verify_grounding(evidence, source_document_text)
                        if not is_grounded:
                            # Try matching sub_title as fallback
                            if verify_grounding(sub_title, source_document_text):
                                evidence = sub_title
                            else:
                                evidence_status = "needs_review"
                                warnings.append(
                                    f"Evidence for subtopic '{sub_title}' was not found verbatim in source document."
                                )

                    page = ext_sub.source_page
                    if page is not None and page < 1:
                        page = None

                    subtopic = Subtopic(
                        id=sub_id,
                        title=sub_title,
                        source_text=evidence,
                        source_page=page,
                        source_location=ext_sub.source_location,
                        source_document_id=syllabus_id,
                        evidence_status=evidence_status,
                        grounding_status=evidence_status,
                        order_index=sub_idx,
                    )
                    canonical_subtopics.append(subtopic)

                if canonical_subtopics:
                    canonical_topics.append(
                        Topic(
                            id=top_id,
                            title=top_title,
                            subtopics=canonical_subtopics,
                            order_index=t_idx,
                        )
                    )

            if canonical_topics:
                canonical_semesters.append(
                    Semester(
                        id=sem_id,
                        title=sem_title,
                        topics=canonical_topics,
                        order_index=s_idx,
                    )
                )

        if canonical_semesters:
            canonical_years.append(
                AcademicYear(
                    id=year_id,
                    title=year_title,
                    semesters=canonical_semesters,
                    order_index=year_index,
                )
            )
            year_index += 1

    # Check for empty hierarchy
    total_leaves = sum(
        len(top.subtopics)
        for yr in canonical_years
        for sem in yr.semesters
        for top in sem.topics
    )

    if total_leaves == 0:
        raise HierarchyValidationError(
            "Extracted syllabus contains no valid checklist subtopics. "
            "A document without reliably extractable subtopics cannot be populated as a syllabus."
        )

    syllabus = HierarchicalSyllabus(
        id=syllabus_id,
        title=title,
        years=canonical_years,
        source_filename=source_filename,
        schema_version=1,
    )

    validate_canonical_syllabus(syllabus)
    return syllabus, warnings


def validate_canonical_syllabus(syllabus: HierarchicalSyllabus) -> None:
    """Validate that a canonical syllabus satisfies all structural and domain invariants."""
    if not syllabus.id or not syllabus.id.strip():
        raise HierarchyValidationError("Syllabus ID must be a non-blank string.")
    if not syllabus.title or not syllabus.title.strip():
        raise HierarchyValidationError("Syllabus title must be a non-blank string.")

    seen_ids: Set[str] = {syllabus.id}
    leaf_count = 0

    for yr in syllabus.years:
        if yr.id in seen_ids:
            raise HierarchyValidationError(f"Duplicate node ID detected: {yr.id}")
        seen_ids.add(yr.id)
        if not yr.title or not yr.title.strip():
            raise HierarchyValidationError(f"Academic Year {yr.id} has a blank title.")

        for sem in yr.semesters:
            if sem.id in seen_ids:
                raise HierarchyValidationError(f"Duplicate node ID detected: {sem.id}")
            seen_ids.add(sem.id)
            if not sem.title or not sem.title.strip():
                raise HierarchyValidationError(f"Semester {sem.id} has a blank title.")

            for top in sem.topics:
                if top.id in seen_ids:
                    raise HierarchyValidationError(f"Duplicate node ID detected: {top.id}")
                seen_ids.add(top.id)
                if not top.title or not top.title.strip():
                    raise HierarchyValidationError(f"Topic {top.id} has a blank title.")

                for sub in top.subtopics:
                    if sub.id in seen_ids:
                        raise HierarchyValidationError(f"Duplicate node ID detected: {sub.id}")
                    seen_ids.add(sub.id)
                    if not sub.title or not sub.title.strip():
                        raise HierarchyValidationError(f"Subtopic {sub.id} has a blank title.")
                    if not sub.source_text or not sub.source_text.strip():
                        raise HierarchyValidationError(f"Subtopic {sub.id} has empty source evidence.")
                    if sub.source_page is not None and sub.source_page < 1:
                        raise HierarchyValidationError(
                            f"Subtopic {sub.id} has invalid non-positive page: {sub.source_page}"
                        )
                    leaf_count += 1

    if leaf_count == 0:
        raise HierarchyValidationError("Syllabus contains zero leaf subtopics.")
