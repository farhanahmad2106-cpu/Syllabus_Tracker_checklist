"""Automated tests for domain models, validation, and grounding verification."""

import pytest
from pydantic import ValidationError

from backend.app.exceptions import HierarchyValidationError
from backend.app.schemas import (
    AcademicYear,
    ExtractedCurriculum,
    ExtractedSemester,
    ExtractedSubtopic,
    ExtractedTopic,
    ExtractedYear,
    HierarchicalSyllabus,
    Semester,
    Subtopic,
    Topic,
)
from backend.app.validation import (
    canonicalize_extracted_curriculum,
    derive_academic_year_number,
    normalize_whitespace,
    validate_canonical_syllabus,
    verify_grounding,
)


def test_subtopic_validation_success():
    """Verify valid subtopic model creation."""
    sub = Subtopic(
        id="sub_1",
        title="Binary Trees",
        source_text="Binary trees and BST properties",
        source_page=12,
        source_location="Section 4",
        order_index=0,
    )
    assert sub.id == "sub_1"
    assert sub.source_page == 12


def test_subtopic_rejects_blank_fields():
    """Verify blank IDs, titles, and evidence are rejected."""
    with pytest.raises(ValidationError):
        Subtopic(id="   ", title="Title", source_text="evidence")

    with pytest.raises(ValidationError):
        Subtopic(id="sub_1", title="", source_text="evidence")

    with pytest.raises(ValidationError):
        Subtopic(id="sub_1", title="Title", source_text="   ")


def test_subtopic_rejects_negative_page():
    """Verify negative or zero page numbers are rejected."""
    with pytest.raises(ValidationError):
        Subtopic(id="sub_1", title="Title", source_text="evidence", source_page=0)

    with pytest.raises(ValidationError):
        Subtopic(id="sub_1", title="Title", source_text="evidence", source_page=-3)


def test_hierarchy_validation_rejects_duplicates(sample_syllabus):
    """Verify duplicate IDs across different levels are caught."""
    # Duplicate subtopic ID
    sample_syllabus.years[0].semesters[0].topics[0].subtopics.append(
        Subtopic(
            id="sub_arr",  # Already exists!
            title="Duplicate Subtopic",
            source_text="Some evidence",
        )
    )
    with pytest.raises(HierarchyValidationError, match="Duplicate node ID"):
        validate_canonical_syllabus(sample_syllabus)


def test_grounding_verification_handles_whitespace_and_newlines():
    """Verify source grounding comparison is resilient to newlines and whitespace differences."""
    source_doc = (
        "Course Overview:\n"
        "In this module, students will study arrays and singly\n"
        "linked lists in detail.\n"
        "Further topics include hash tables."
    )
    # Exact snippet with single line
    assert verify_grounding("arrays and singly linked lists", source_doc) is True

    # Snippet with differing newlines/spaces
    assert verify_grounding("arrays\n  and\tsingly\nlinked lists", source_doc) is True

    # Hallucinated snippet
    assert verify_grounding("quantum computing principles", source_doc) is False


def test_semester_to_year_derivation():
    """Verify sequential semester to academic year derivation."""
    # Explicit sequential numbering
    assert derive_academic_year_number("Semester 1", 1) == 1
    assert derive_academic_year_number("Semester 2", 2) == 1
    assert derive_academic_year_number("Semester 3", 3) == 2
    assert derive_academic_year_number("Semester 4", 4) == 2
    assert derive_academic_year_number("Semester 5", 5) == 3
    assert derive_academic_year_number("Semester 6", 6) == 3

    # Parsed from string title
    assert derive_academic_year_number("Sem 3: Advanced Computing", None) == 2
    assert derive_academic_year_number("Semester 4", None) == 2

    # Ambiguous names without sequential number should return None
    assert derive_academic_year_number("Spring Term", None) is None
    assert derive_academic_year_number("Odd Semester", None) is None


def test_canonicalize_empty_curriculum_raises_error():
    """Verify empty curriculum extraction without leaves is rejected."""
    empty_extracted = ExtractedCurriculum(program_title="Empty Course", years=[])
    with pytest.raises(HierarchyValidationError, match="no valid checklist subtopics"):
        canonicalize_extracted_curriculum(
            extracted=empty_extracted,
            source_filename="empty.txt",
            source_document_text="",
            syllabus_id="syl_empty",
        )


def test_source_offsets_calculation():
    """Verify find_source_offsets returns exact start and end char indices."""
    from backend.app.validation import find_source_offsets

    doc = "Welcome to Computer Science.\nUnit 1: Data Structures and Algorithms.\nRecursion and Sorting."
    start, end = find_source_offsets("Data Structures", doc)
    assert start is not None and end is not None
    assert doc[start:end] == "Data Structures"

    # Not found returns (None, None)
    assert find_source_offsets("Non-existent concept", doc) == (None, None)


def test_contextual_lab_and_elective_detection():
    """Verify heuristic contextual detection for labs and electives."""
    from backend.app.validation import detect_lab_course, detect_elective_course

    # Labs
    assert detect_lab_course("Compiler Design Laboratory", "CS501") is True
    assert detect_lab_course("Hardware Workshop", "CS102") is True
    assert detect_lab_course("Advanced Programming", "CS201L") is True
    assert detect_lab_course("Operating Systems", "CS301") is False

    # Electives
    is_elec, grp = detect_elective_course("Professional Elective I: Cloud Computing")
    assert is_elec is True
    assert grp == "Elective I"

    is_elec2, grp2 = detect_elective_course("Open Elective: Cyber Security")
    assert is_elec2 is True
    assert "Elective" in grp2

    is_elec3, grp3 = detect_elective_course("Data Structures & Algorithms")
    assert is_elec3 is False
    assert grp3 is None

