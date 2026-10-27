"""Deterministic validation, grounding verification, and hierarchy canonicalization."""

import math
import re
from typing import List, Optional, Set, Tuple

from backend.app.exceptions import HierarchyValidationError
from backend.app.schemas import (
    AcademicYear,
    ExtractedCurriculum,
    HierarchicalSyllabus,
    Module,
    Semester,
    Subject,
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
    Transforms extracted curriculum into canonical 5-level HierarchicalSyllabus:
    Document Root -> Academic Year -> Semester -> Subject -> Module -> Topic.
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

            canonical_subjects: List[Subject] = []
            # Check subjects (with backward compatibility fallback to topics)
            raw_subjects = ext_sem.subjects
            if not raw_subjects and hasattr(ext_sem, "topics") and ext_sem.topics:
                # Legacy format: each topic becomes a subject with a single module
                raw_subjects = [
                    Subject(
                        id=f"{sem_id}_subj_{t_idx + 1}",
                        title=t.title,
                        modules=[
                            Module(
                                id=f"{sem_id}_mod_{t_idx + 1}",
                                module_number=str(t_idx + 1),
                                title=f"Module: {t.title}",
                                topics=t.subtopics if hasattr(t, "subtopics") else t.topics,
                            )
                        ],
                    )
                    for t_idx, t in enumerate(ext_sem.topics)
                ]

            for subj_idx, ext_subj in enumerate(raw_subjects):
                subj_title = ext_subj.title.strip() if ext_subj.title else f"Subject {subj_idx + 1}"
                subj_id = f"{sem_id}_subj_{subj_idx + 1}"
                seen_ids.add(subj_id)

                canonical_modules: List[Module] = []
                for mod_idx, ext_mod in enumerate(ext_subj.modules):
                    mod_title = ext_mod.title.strip() if ext_mod.title else f"Module {mod_idx + 1}"
                    mod_id = f"{subj_id}_mod_{mod_idx + 1}"
                    seen_ids.add(mod_id)

                    canonical_topics: List[Subtopic] = []
                    mod_topics = ext_mod.topics if hasattr(ext_mod, "topics") else getattr(ext_mod, "subtopics", [])
                    for top_idx, ext_sub in enumerate(mod_topics):
                        top_title = ext_sub.title.strip() if ext_sub.title else f"Topic {top_idx + 1}"
                        top_id = f"{mod_id}_topic_{top_idx + 1}"
                        seen_ids.add(top_id)

                        evidence = ext_sub.source_text.strip() if hasattr(ext_sub, "source_text") and ext_sub.source_text else ""
                        if not evidence:
                            evidence = top_title

                        # Grounding verification against original source text
                        evidence_status = "verified"
                        if source_document_text:
                            is_grounded = verify_grounding(evidence, source_document_text)
                            if not is_grounded:
                                if verify_grounding(top_title, source_document_text):
                                    evidence = top_title
                                else:
                                    evidence_status = "needs_review"
                                    warnings.append(
                                        f"Evidence for topic '{top_title}' was not found verbatim in source document."
                                    )

                        page = getattr(ext_sub, "source_page", None)
                        if page is not None and page < 1:
                            page = None

                        subtopic = Subtopic(
                            id=top_id,
                            title=top_title,
                            source_text=evidence,
                            source_page=page,
                            source_location=getattr(ext_sub, "source_location", None),
                            source_document_id=syllabus_id,
                            evidence_status=evidence_status,
                            grounding_status=evidence_status,
                            order_index=top_idx,
                        )
                        canonical_topics.append(subtopic)

                    if canonical_topics:
                        canonical_modules.append(
                            Module(
                                id=mod_id,
                                module_number=getattr(ext_mod, "module_number", None),
                                title=mod_title,
                                topics=canonical_topics,
                                order_index=mod_idx,
                            )
                        )

                if canonical_modules:
                    canonical_subjects.append(
                        Subject(
                            id=subj_id,
                            code=getattr(ext_subj, "code", None),
                            title=subj_title,
                            modules=canonical_modules,
                            order_index=subj_idx,
                        )
                    )

            if canonical_subjects:
                canonical_semesters.append(
                    Semester(
                        id=sem_id,
                        title=sem_title,
                        subjects=canonical_subjects,
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
        len(mod.topics)
        for yr in canonical_years
        for sem in yr.semesters
        for subj in sem.subjects
        for mod in subj.modules
    )

    if total_leaves == 0:
        raise HierarchyValidationError(
            "Extracted syllabus contains no valid checklist subtopics. "
            "A document without reliably extractable topics cannot be populated as a syllabus."
        )

    syllabus = HierarchicalSyllabus(
        id=syllabus_id,
        title=title,
        years=canonical_years,
        source_filename=source_filename,
        schema_version=2,
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

            for subj in sem.subjects:
                if subj.id in seen_ids:
                    raise HierarchyValidationError(f"Duplicate node ID detected: {subj.id}")
                seen_ids.add(subj.id)
                if not subj.title or not subj.title.strip():
                    raise HierarchyValidationError(f"Subject {subj.id} has a blank title.")

                for mod in subj.modules:
                    if mod.id in seen_ids:
                        raise HierarchyValidationError(f"Duplicate node ID detected: {mod.id}")
                    seen_ids.add(mod.id)
                    if not mod.title or not mod.title.strip():
                        raise HierarchyValidationError(f"Module {mod.id} has a blank title.")

                    for top in mod.topics:
                        if top.id in seen_ids:
                            raise HierarchyValidationError(f"Duplicate node ID detected: {top.id}")
                        seen_ids.add(top.id)
                        if not top.title or not top.title.strip():
                            raise HierarchyValidationError(f"Topic {top.id} has a blank title.")
                        if not top.source_text or not top.source_text.strip():
                            raise HierarchyValidationError(f"Topic {top.id} has empty source evidence.")
                        if top.source_page is not None and top.source_page < 1:
                            raise HierarchyValidationError(
                                f"Topic {top.id} has invalid non-positive page: {top.source_page}"
                            )
                        leaf_count += 1

    if leaf_count == 0:
        raise HierarchyValidationError("Syllabus contains zero leaf topics.")
