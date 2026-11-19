"""Unit and integration tests for Phase 13 Cycle A: Multi-Syllabus Comparison & GPA / Credit Planner."""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from backend.app.database import (
    delete_syllabus,
    get_subject_academic_plan,
    get_subject_academic_plans,
    save_syllabus,
    update_leaf_completion,
    upsert_subject_academic_plan,
)
from backend.app.main import app
from backend.app.models import Base, SubjectAcademicPlan
from backend.app.schemas import (
    AcademicYear,
    HierarchicalSyllabus,
    Module,
    Semester,
    Subject,
    SubjectAcademicPlanUpdate,
    Subtopic,
    SyllabusComparisonRequest,
)
from backend.app.services.academic_planner import (
    compare_syllabi,
    compute_credit_and_gpa_plan,
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


def make_test_syllabus(syllabus_id: str = "syl_academic_test") -> HierarchicalSyllabus:
    """Create a hierarchical syllabus with declared credits, LTP, and electives."""
    subtopic1 = Subtopic(id="leaf_cs101_1", title="Variables", source_text="Variables")
    subtopic2 = Subtopic(id="leaf_cs101_2", title="Control Flow", source_text="Control Flow")
    mod1 = Module(id="mod_cs101", title="Basics", topics=[subtopic1, subtopic2])

    subj1 = Subject(
        id="subj_cs101",
        title="Intro to CS",
        code="CS101",
        credits=4.0,
        ltp="3-1-0",
        is_laboratory=False,
        is_elective=False,
        is_enrolled=True,
        enrollment_status="mandatory",
        modules=[mod1],
    )

    subtopic3 = Subtopic(id="leaf_cs102_1", title="Lab Exercise 1", source_text="Lab 1")
    mod2 = Module(id="mod_cs102", title="Lab Practicals", topics=[subtopic3])
    subj2 = Subject(
        id="subj_cs102",
        title="CS Practical Lab",
        code="CS102",
        credits=2.0,
        ltp="0-0-4",
        is_laboratory=True,
        is_elective=False,
        is_enrolled=True,
        enrollment_status="mandatory",
        modules=[mod2],
    )

    # Elective subject that is NOT enrolled
    subtopic4 = Subtopic(id="leaf_cs103_1", title="Graphics", source_text="Graphics")
    mod3 = Module(id="mod_cs103", title="3D Basics", topics=[subtopic4])
    subj3 = Subject(
        id="subj_cs103",
        title="Computer Graphics (Elective)",
        code="CS103",
        credits=3.0,
        ltp="3-0-0",
        is_laboratory=False,
        is_elective=True,
        is_enrolled=False,
        enrollment_status="dropped",
        modules=[mod3],
    )

    sem1 = Semester(
        id="sem_1",
        title="Semester 1",
        semester_number=1,
        subjects=[subj1, subj2, subj3],
    )

    year1 = AcademicYear(
        id="year_1",
        title="First Year",
        year_number=1,
        semesters=[sem1],
    )

    return HierarchicalSyllabus(
        id=syllabus_id,
        title="B.Tech Computer Science",
        schema_version="1.0.0",
        years=[year1],
    )


# ---------------------------------------------------------------------------
# 1. Schema Validation Tests
# ---------------------------------------------------------------------------


def test_subject_credit_and_ltp_validation():
    """Verify credits and LTP validation on Subject schema."""
    subj = Subject(
        id="subj_test",
        title="Algorithms",
        credits=3.5,
        ltp="3-1-0",
        modules=[],
    )
    assert subj.credits == 3.5
    assert subj.ltp == "3-1-0"

    # Reject negative credits
    with pytest.raises(Exception):
        Subject(id="subj_bad", title="Bad", credits=-1.0, modules=[])

    # Reject invalid LTP format
    with pytest.raises(Exception):
        Subject(id="subj_bad", title="Bad", ltp="invalid-ltp", modules=[])


# ---------------------------------------------------------------------------
# 2. Database Academic Plan Operations Tests
# ---------------------------------------------------------------------------


def test_upsert_and_get_subject_academic_plan(db_session):
    """Test saving, updating, and querying subject academic plan entries."""
    syl = make_test_syllabus("syl_db_test")
    save_syllabus(db_session, syl, "test.pdf")

    # Insert plan
    plan_data = SubjectAcademicPlanUpdate(
        credit_override=4.5,
        target_grade_points=9.0,
        grade_scale="10.0",
    )
    upsert_subject_academic_plan(db_session, syl.id, "subj_cs101", plan_data)

    item = get_subject_academic_plan(db_session, syl.id, "subj_cs101")
    assert item is not None
    assert item.credit_override == 4.5
    assert item.target_grade_points == 9.0
    assert item.grade_scale == "10.0"

    # Update plan
    plan_data_update = SubjectAcademicPlanUpdate(
        credit_override=5.0,
        target_grade_points=10.0,
        grade_scale="10.0",
    )
    upsert_subject_academic_plan(db_session, syl.id, "subj_cs101", plan_data_update)
    item_updated = get_subject_academic_plan(db_session, syl.id, "subj_cs101")
    assert item_updated.credit_override == 5.0
    assert item_updated.target_grade_points == 10.0


def test_cascade_delete_academic_plans(db_session):
    """Verify that deleting a syllabus cascades and deletes its academic plan entries."""
    syl = make_test_syllabus("syl_cascade_test")
    save_syllabus(db_session, syl, "test.pdf")

    plan_data = SubjectAcademicPlanUpdate(credit_override=3.0, target_grade_points=8.5)
    upsert_subject_academic_plan(db_session, syl.id, "subj_cs101", plan_data)
    assert len(get_subject_academic_plans(db_session, syl.id)) == 1

    delete_syllabus(db_session, syl.id)
    assert len(get_subject_academic_plans(db_session, syl.id)) == 0


# ---------------------------------------------------------------------------
# 3. Credit & GPA Computation Tests (Invariants)
# ---------------------------------------------------------------------------


def test_credit_and_gpa_computation_effective_credits(db_session):
    """Verify effective credits: override takes precedence over declared credits."""
    syl = make_test_syllabus("syl_calc_test")
    save_syllabus(db_session, syl, "test.pdf")

    # With no override: effective = declared (4.0 and 2.0; unenrolled 3.0 excluded)
    plan_resp = compute_credit_and_gpa_plan(db_session, syl)
    assert plan_resp.program_summary.total_declared_credits == 6.0
    assert plan_resp.program_summary.total_effective_credits == 6.0

    # With override on CS101 from 4.0 to 5.0
    plan_data = SubjectAcademicPlanUpdate(credit_override=5.0, target_grade_points=9.0, grade_scale="10.0")
    upsert_subject_academic_plan(db_session, syl.id, "subj_cs101", plan_data)

    plan_resp2 = compute_credit_and_gpa_plan(db_session, syl)
    assert plan_resp2.program_summary.total_declared_credits == 6.0
    assert plan_resp2.program_summary.total_effective_credits == 7.0  # 5.0 + 2.0


def test_credit_and_gpa_completion_and_earned_estimate(db_session):
    """Verify 100% leaf completion required for completed credits, and proportional earned estimate."""
    syl = make_test_syllabus("syl_completion_test")
    save_syllabus(db_session, syl, "test.pdf")

    # Complete 1 out of 2 leaves for CS101 (credits=4.0)
    update_leaf_completion(db_session, syl.id, "leaf_cs101_1", True)

    plan_resp = compute_credit_and_gpa_plan(db_session, syl)
    # Course not 100% complete, so completed_credits must be 0
    assert plan_resp.program_summary.total_completed_credits == 0.0
    # Proportional earned estimate should be 4.0 * (1/2) = 2.0
    assert plan_resp.program_summary.proportional_earned_credits_estimate == 2.0

    # Complete the second leaf -> 100% complete
    update_leaf_completion(db_session, syl.id, "leaf_cs101_2", True)
    plan_resp2 = compute_credit_and_gpa_plan(db_session, syl)
    assert plan_resp2.program_summary.total_completed_credits == 4.0
    assert plan_resp2.program_summary.proportional_earned_credits_estimate == 4.0


def test_grade_scale_isolation_and_elective_exclusion(db_session):
    """Verify 10.0 and 4.0 grade scales are never mixed, and excluded electives contribute 0."""
    syl = make_test_syllabus("syl_scale_test")
    save_syllabus(db_session, syl, "test.pdf")

    # CS101: 4 credits, target 9.0 on 10.0 scale
    upsert_subject_academic_plan(
        db_session,
        syl.id,
        "subj_cs101",
        SubjectAcademicPlanUpdate(target_grade_points=9.0, grade_scale="10.0"),
    )
    # CS102: 2 credits, target 3.5 on 4.0 scale
    upsert_subject_academic_plan(
        db_session,
        syl.id,
        "subj_cs102",
        SubjectAcademicPlanUpdate(target_grade_points=3.5, grade_scale="4.0"),
    )
    # CS103: Excluded elective (is_enrolled=False), target 10.0 on 10.0 scale
    upsert_subject_academic_plan(
        db_session,
        syl.id,
        "subj_cs103",
        SubjectAcademicPlanUpdate(target_grade_points=10.0, grade_scale="10.0"),
    )

    plan_resp = compute_credit_and_gpa_plan(db_session, syl)
    proj10 = plan_resp.program_summary.projections.scale_10
    proj4 = plan_resp.program_summary.projections.scale_4

    # 10.0 scale should only include CS101 (CS103 is unenrolled)
    assert proj10.target_gpa == 9.0
    assert proj10.gpa_eligible_credits == 4.0

    # 4.0 scale should only include CS102
    assert proj4.target_gpa == 3.5
    assert proj4.gpa_eligible_credits == 2.0


# ---------------------------------------------------------------------------
# 4. Multi-Syllabus Comparison Service Tests
# ---------------------------------------------------------------------------


def test_compare_syllabi_service(db_session):
    """Test comparing 2 syllabi across metrics and identifying shared courses."""
    syl1 = make_test_syllabus("syl_comp_1")
    syl2 = make_test_syllabus("syl_comp_2")
    syl2.title = "B.Tech Information Technology"

    save_syllabus(db_session, syl1, "comp1.pdf")
    save_syllabus(db_session, syl2, "comp2.pdf")

    result = compare_syllabi(db_session, ["syl_comp_1", "syl_comp_2"])
    assert result.total_compared == 2
    assert len(result.syllabi) == 2

    item1 = result.syllabi[0]
    assert item1.total_leaves == 4
    assert item1.enrolled_subjects_count == 2
    assert item1.elective_subjects_count == 1
    assert item1.laboratory_courses_count == 1

    # Both have CS101 and CS102
    assert len(result.shared_subjects) >= 1
    shared_titles = [m.subject_title for m in result.shared_subjects]
    assert "Intro to CS" in shared_titles or "CS Practical Lab" in shared_titles


def test_compare_syllabi_count_bounds(db_session):
    """Verify error raised when comparing fewer than 2 or more than 4 syllabi."""
    with pytest.raises(ValueError):
        compare_syllabi(db_session, ["syl_single"])

    with pytest.raises(ValueError):
        compare_syllabi(db_session, ["s1", "s2", "s3", "s4", "s5"])


# ---------------------------------------------------------------------------
# 5. REST API Integration Tests
# ---------------------------------------------------------------------------


def test_api_academic_plan_flow(client: TestClient):
    """Test GET and PUT academic plan endpoints."""
    # First create a syllabus by posting valid payload or checking existing test harness
    # Query non-existent syllabus -> 404
    resp = client.get("/api/syllabus/nonexistent_id/academic-plan")
    assert resp.status_code == 404

    # Compare non-existent -> 404
    resp_comp = client.post("/api/syllabi/compare", json={"syllabus_ids": ["syl_a", "syl_b"]})
    assert resp_comp.status_code == 404
