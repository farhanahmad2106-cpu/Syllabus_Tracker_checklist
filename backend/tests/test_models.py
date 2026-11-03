"""Unit tests for canonical domain schemas and persistence models."""

import pytest
from pydantic import ValidationError
from backend.app.schemas import (
    AcademicYear,
    HierarchicalSyllabus,
    Module,
    Semester,
    Subject,
    Subtopic,
)
from backend.app.models import LeafCompletionRecord, SyllabusRecord


def test_five_tier_canonical_hierarchy():
    """Verify that the domain schemas strictly model the 5-tier academic hierarchy beneath the root."""
    subtopic = Subtopic(
        id="sub_1",
        title="Limits and Continuity",
        source_text="Limits and Continuity",
        source_page=1,
        grounding_status="verified",
        source_start_offset=10,
        source_end_offset=31,
    )
    module = Module(
        id="mod_1",
        module_number="1",
        title="Differential Calculus",
        contact_hours=12,
        topics=[subtopic],
    )
    subject = Subject(
        id="subj_1",
        code="MATH101",
        title="Calculus I",
        is_lab=False,
        is_elective=False,
        is_enrolled=True,
        enrollment_status="mandatory",
        modules=[module],
    )
    semester = Semester(
        id="sem_1",
        title="Semester 1",
        semester_number=1,
        subjects=[subject],
    )
    year = AcademicYear(
        id="yr_1",
        title="Year 1",
        year_number=1,
        semesters=[semester],
    )
    syllabus = HierarchicalSyllabus(
        id="syl_1",
        title="B.Tech Computer Science",
        source_filename="syllabus.pdf",
        source_file_hash="abc123hash",
        source_file_type="pdf",
        extraction_status="completed",
        requires_enrollment_confirmation=False,
        years=[year],
    )

    assert syllabus.id == "syl_1"
    assert len(syllabus.years) == 1
    assert syllabus.years[0].title == "Year 1"
    assert len(syllabus.years[0].semesters) == 1
    assert syllabus.years[0].semesters[0].title == "Semester 1"
    assert len(syllabus.years[0].semesters[0].subjects) == 1
    assert syllabus.years[0].semesters[0].subjects[0].code == "MATH101"
    assert len(syllabus.years[0].semesters[0].subjects[0].modules) == 1
    assert syllabus.years[0].semesters[0].subjects[0].modules[0].contact_hours == 12
    assert len(syllabus.years[0].semesters[0].subjects[0].modules[0].topics) == 1
    assert syllabus.years[0].semesters[0].subjects[0].modules[0].topics[0].grounding_status == "verified"


def test_subtopic_validation():
    """Verify validation rules for Subtopic leaf entities."""
    # Blank ID rejected
    with pytest.raises(ValidationError):
        Subtopic(id="", title="Title", source_text="evidence")

    # Blank title rejected
    with pytest.raises(ValidationError):
        Subtopic(id="sub_1", title="   ", source_text="evidence")

    # Blank source_text rejected
    with pytest.raises(ValidationError):
        Subtopic(id="sub_1", title="Title", source_text="")

    # Non-positive page number rejected
    with pytest.raises(ValidationError):
        Subtopic(id="sub_1", title="Title", source_text="evidence", source_page=0)

    # Valid subtopic with null page (for DOCX/TXT)
    sub = Subtopic(id="sub_1", title="Title", source_text="evidence", source_page=None)
    assert sub.source_page is None
    assert sub.grounding_status == "verified"


def test_module_contact_hours_validation():
    """Verify non-negative constraint on module contact hours."""
    # Negative contact hours rejected
    with pytest.raises(ValidationError):
        Module(id="mod_1", title="Module 1", contact_hours=-5)

    # None allowed
    mod_none = Module(id="mod_1", title="Module 1", contact_hours=None)
    assert mod_none.contact_hours is None

    # Valid positive contact hours accepted
    mod_valid = Module(id="mod_1", title="Module 1", contact_hours=6)
    assert mod_valid.contact_hours == 6


def test_subject_elective_and_lab_attributes():
    """Verify default values and custom classifications on Subject entities."""
    subj_mandatory = Subject(id="s1", title="Algorithms")
    assert subj_mandatory.is_lab is False
    assert subj_mandatory.is_elective is False
    assert subj_mandatory.is_enrolled is True
    assert subj_mandatory.enrollment_status == "mandatory"

    subj_lab = Subject(id="s2", title="Hardware Lab", is_lab=True)
    assert subj_lab.is_lab is True

    subj_elective = Subject(
        id="s3",
        title="Cloud Computing",
        is_elective=True,
        elective_group="Professional Elective II",
        is_enrolled=False,
        enrollment_status="pending",
    )
    assert subj_elective.is_elective is True
    assert subj_elective.elective_group == "Professional Elective II"
    assert subj_elective.is_enrolled is False
    assert subj_elective.enrollment_status == "pending"


def test_leaf_completion_persistence_model():
    """Verify SQLAlchemy persistence model for leaf completions."""
    rec = LeafCompletionRecord(syllabus_id="syl_1", leaf_id="leaf_42")
    assert rec.syllabus_id == "syl_1"
    assert rec.leaf_id == "leaf_42"

