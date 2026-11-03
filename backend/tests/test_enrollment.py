"""Unit and integration tests for elective onboarding and enrollment workflows."""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.database import (
    finalize_syllabus_enrollment,
    get_completed_leaf_ids,
    get_syllabus_record,
    get_syllabus_review,
    save_syllabus,
    update_leaf_completion,
)
from backend.app.exceptions import HierarchyValidationError
from backend.app.models import Base
from backend.app.progress import calculate_syllabus_progress
from backend.app.schemas import (
    AcademicYear,
    HierarchicalSyllabus,
    Module,
    Semester,
    Subject,
    Subtopic,
)


@pytest.fixture
def db_session():
    """Isolated in-memory SQLite database session."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


def make_test_syllabus_with_electives(syllabus_id: str = "syl_electives_test") -> HierarchicalSyllabus:
    """Construct a test syllabus with 1 mandatory subject and 2 elective subjects in a group."""
    mod_core = Module(
        id="mod_core",
        title="Core Module",
        topics=[Subtopic(id="leaf_core_1", title="Core Topic 1", source_text="Core Topic 1")],
    )
    subj_core = Subject(
        id="subj_core",
        title="Data Structures (Core)",
        is_elective=False,
        is_enrolled=True,
        enrollment_status="mandatory",
        modules=[mod_core],
    )

    mod_elec_a = Module(
        id="mod_elec_a",
        title="AI Module",
        topics=[Subtopic(id="leaf_ai_1", title="AI Topic 1", source_text="AI Topic 1")],
    )
    subj_elec_a = Subject(
        id="subj_elec_a",
        title="Artificial Intelligence (Elective)",
        is_elective=True,
        elective_group="Elective Group 1",
        is_enrolled=False,
        enrollment_status="pending",
        modules=[mod_elec_a],
    )

    mod_elec_b = Module(
        id="mod_elec_b",
        title="Crypto Module",
        topics=[Subtopic(id="leaf_sec_1", title="Crypto Topic 1", source_text="Crypto Topic 1")],
    )
    subj_elec_b = Subject(
        id="subj_elec_b",
        title="Cryptography (Elective)",
        is_elective=True,
        elective_group="Elective Group 1",
        is_enrolled=False,
        enrollment_status="pending",
        modules=[mod_elec_b],
    )

    sem = Semester(
        id="sem_1",
        title="Semester 5",
        semester_number=5,
        subjects=[subj_core, subj_elec_a, subj_elec_b],
    )
    year = AcademicYear(
        id="yr_3",
        title="Year 3",
        year_number=3,
        semesters=[sem],
    )
    return HierarchicalSyllabus(
        id=syllabus_id,
        title="Computer Science B.Tech",
        source_filename="cs_curriculum.pdf",
        requires_enrollment_confirmation=True,
        years=[year],
    )


def test_parse_review_response(db_session):
    """Verify get_syllabus_review returns detected electives and elective groups."""
    syllabus = make_test_syllabus_with_electives()
    save_syllabus(db_session, syllabus)

    review = get_syllabus_review(db_session, syllabus.id)
    assert review.syllabus_id == syllabus.id
    assert review.requires_enrollment_confirmation is True
    assert len(review.detected_electives) == 2
    assert "Elective Group 1" in review.elective_groups
    assert len(review.elective_groups["Elective Group 1"]) == 2


def test_finalize_enrollment_success(db_session):
    """Verify selecting an elective updates enrollment status and active leaf progress."""
    syllabus = make_test_syllabus_with_electives()
    save_syllabus(db_session, syllabus)

    # Student chooses Artificial Intelligence (subj_elec_a)
    updated = finalize_syllabus_enrollment(
        session=db_session,
        syllabus_id=syllabus.id,
        enrolled_subject_ids=["subj_elec_a"],
    )

    assert updated.requires_enrollment_confirmation is False

    subj_map = {
        s.id: s
        for yr in updated.years
        for sem in yr.semesters
        for s in sem.subjects
    }

    # Core remains enrolled
    assert subj_map["subj_core"].is_enrolled is True
    assert subj_map["subj_core"].enrollment_status == "mandatory"

    # AI is selected
    assert subj_map["subj_elec_a"].is_enrolled is True
    assert subj_map["subj_elec_a"].enrollment_status == "selected"

    # Crypto is excluded
    assert subj_map["subj_elec_b"].is_enrolled is False
    assert subj_map["subj_elec_b"].enrollment_status == "excluded"

    # Progress calculation should have exactly 2 active enrolled leaves (Core 1 + AI 1), not Crypto 1
    completed_ids = get_completed_leaf_ids(db_session, syllabus.id)
    prog, _ = calculate_syllabus_progress(updated, completed_ids)
    assert prog.total_leaves == 2
    assert prog.completed_leaves == 0


def test_finalize_enrollment_rejects_foreign_subject_id(db_session):
    """Verify finalize_syllabus_enrollment raises HierarchyValidationError on unknown subject ID."""
    syllabus = make_test_syllabus_with_electives()
    save_syllabus(db_session, syllabus)

    with pytest.raises(HierarchyValidationError) as exc:
        finalize_syllabus_enrollment(
            session=db_session,
            syllabus_id=syllabus.id,
            enrolled_subject_ids=["non_existent_subject_id"],
        )
    assert "non_existent_subject_id" in str(exc.value)


def test_enrollment_changes_preserve_completed_leaf_records(db_session):
    """
    Verify changing elective enrollment does not erase historical leaf completions.
    If an elective is excluded and later re-selected, its completions survive.
    """
    syllabus = make_test_syllabus_with_electives()
    save_syllabus(db_session, syllabus)

    # 1. Enroll in AI
    updated1 = finalize_syllabus_enrollment(
        session=db_session,
        syllabus_id=syllabus.id,
        enrolled_subject_ids=["subj_elec_a"],
    )
    # Check off AI topic
    update_leaf_completion(db_session, updated1, "leaf_ai_1", is_completed=True)
    assert "leaf_ai_1" in get_completed_leaf_ids(db_session, syllabus.id)

    # 2. Switch enrollment to Cryptography instead
    updated2 = finalize_syllabus_enrollment(
        session=db_session,
        syllabus_id=syllabus.id,
        enrolled_subject_ids=["subj_elec_b"],
    )

    # AI leaf completion is still preserved in the database table
    assert "leaf_ai_1" in get_completed_leaf_ids(db_session, syllabus.id)

    # But active progress does NOT count excluded AI
    completed_ids = get_completed_leaf_ids(db_session, syllabus.id)
    prog, _ = calculate_syllabus_progress(updated2, completed_ids)
    assert prog.total_leaves == 2  # Core 1 + Crypto 1
    assert prog.completed_leaves == 0  # Neither Core 1 nor Crypto 1 is complete

    # 3. Re-enroll in AI
    updated3 = finalize_syllabus_enrollment(
        session=db_session,
        syllabus_id=syllabus.id,
        enrolled_subject_ids=["subj_elec_a"],
    )
    prog3, _ = calculate_syllabus_progress(updated3, completed_ids)
    assert prog3.total_leaves == 2  # Core 1 + AI 1
    assert prog3.completed_leaves == 1  # AI 1 was preserved!
    assert prog3.progress_percent == 50.0

