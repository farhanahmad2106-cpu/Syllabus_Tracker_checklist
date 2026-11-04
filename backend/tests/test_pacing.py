"""Unit tests for the pure mathematical pacing engine (Section 13)."""

from datetime import date
import pytest

from backend.app.schemas import Module, Semester, Subject, Subtopic
from backend.app.services.pacing import calculate_node_pacing, find_node_in_syllabus


def make_subtopic(id: str, title: str = "Topic") -> Subtopic:
    return Subtopic(
        id=id,
        title=title,
        source_text="Sample verbatim text",
    )


def make_module(id: str, contact_hours: float | None, subtopics: list[Subtopic]) -> Module:
    return Module(
        id=id,
        title=f"Module {id}",
        contact_hours=contact_hours,
        topics=subtopics,
    )


def make_subject(
    id: str,
    modules: list[Module],
    is_enrolled: bool = True,
    enrollment_status: str = "mandatory",
) -> Subject:
    return Subject(
        id=id,
        title=f"Subject {id}",
        is_enrolled=is_enrolled,
        enrollment_status=enrollment_status,
        modules=modules,
    )


def make_semester(id: str, subjects: list[Subject]) -> Semester:
    return Semester(
        id=id,
        title=f"Semester {id}",
        subjects=subjects,
    )


# -----------------------------------------------------------------------------
# 13.1 Calendar tests
# -----------------------------------------------------------------------------

def test_calendar_days_and_weeks():
    ref = date(2026, 11, 4)
    subj = make_subject("s1", [make_module("m1", 10, [make_subtopic("t1")])])

    # Today
    p_today = calculate_node_pacing(subj, [], target_date=ref, reference_date=ref)
    assert p_today.days_remaining == 0

    # Tomorrow
    p_tomorrow = calculate_node_pacing(subj, [], target_date=date(2026, 11, 5), reference_date=ref)
    assert p_tomorrow.days_remaining == 1

    # Yesterday
    p_yesterday = calculate_node_pacing(subj, [], target_date=date(2026, 11, 3), reference_date=ref)
    assert p_yesterday.days_remaining == -1

    # 7 days remaining
    p_7d = calculate_node_pacing(subj, [], target_date=date(2026, 11, 11), reference_date=ref)
    assert p_7d.days_remaining == 7

    # 8 days remaining
    p_8d = calculate_node_pacing(subj, [], target_date=date(2026, 11, 12), reference_date=ref)
    assert p_8d.days_remaining == 8

    # Leap year boundary (e.g. 2028-02-28 to 2028-03-01 is 2 days)
    p_leap = calculate_node_pacing(subj, [], target_date=date(2028, 3, 1), reference_date=date(2028, 2, 28))
    assert p_leap.days_remaining == 2

    # Month/year boundary (2026-12-31 to 2027-01-01 is 1 day)
    p_year_end = calculate_node_pacing(subj, [], target_date=date(2027, 1, 1), reference_date=date(2026, 12, 31))
    assert p_year_end.days_remaining == 1


# -----------------------------------------------------------------------------
# 13.2 Leaf aggregation tests
# -----------------------------------------------------------------------------

def test_leaf_aggregation_enrolled_and_uniques():
    # Enrolled subject
    m1 = make_module("m1", 10, [make_subtopic("t1"), make_subtopic("t2")])
    s_enrolled = make_subject("s_enr", [m1], is_enrolled=True)

    # Excluded elective
    m2 = make_module("m2", 10, [make_subtopic("t3"), make_subtopic("t4")])
    s_excluded = make_subject("s_exc", [m2], is_enrolled=False, enrollment_status="excluded")

    # Excluded subject directly returns zero workload
    p_exc = calculate_node_pacing(s_excluded, ["t3"], target_date=date(2026, 12, 1), reference_date=date(2026, 11, 1))
    assert p_exc.total_leaves == 0
    assert p_exc.completed_leaves == 0
    assert p_exc.remaining_leaves == 0
    assert p_exc.remaining_contact_hours == 0.0

    # Semester aggregates enrolled only and ignores excluded
    sem = make_semester("sem1", [s_enrolled, s_excluded])
    p_sem = calculate_node_pacing(sem, ["t1", "t3"], target_date=date(2026, 12, 1), reference_date=date(2026, 11, 1))
    # only t1 and t2 from s_enrolled are counted; t3 is from excluded elective and ignored
    assert p_sem.total_leaves == 2
    assert p_sem.completed_leaves == 1
    assert p_sem.remaining_leaves == 1

    # Duplicate completed IDs do not inflate counts
    p_dup = calculate_node_pacing(s_enrolled, ["t1", "t1", "t1", "unknown_t"], target_date=date(2026, 12, 1), reference_date=date(2026, 11, 1))
    assert p_dup.total_leaves == 2
    assert p_dup.completed_leaves == 1
    assert p_dup.remaining_leaves == 1


def test_empty_subject_and_semester_do_not_crash():
    empty_subj = make_subject("s_empty", [])
    p_sub_no_target = calculate_node_pacing(empty_subj, [])
    assert p_sub_no_target.total_leaves == 0
    assert p_sub_no_target.status == "not_set"

    p_sub_target = calculate_node_pacing(empty_subj, [], target_date=date(2026, 12, 1), reference_date=date(2026, 11, 1))
    assert p_sub_target.total_leaves == 0
    assert p_sub_target.status == "on_track"

    empty_sem = make_semester("sem_empty", [])
    p_sem = calculate_node_pacing(empty_sem, [], target_date=date(2026, 12, 1), reference_date=date(2026, 11, 1))
    assert p_sem.total_leaves == 0
    assert p_sem.status == "on_track"


# -----------------------------------------------------------------------------
# 13.3 Proportional contact-hour aggregation tests
# -----------------------------------------------------------------------------

def test_proportional_contact_hours_aggregation():
    # Module A: 20 contact hours, 10 eligible leaves, 5 completed leaves -> remaining: 10 hrs
    subtopics_a = [make_subtopic(f"ta_{i}") for i in range(10)]
    mod_a = make_module("ma", 20, subtopics_a)

    # Module B: 12 contact hours, 4 eligible leaves, 1 completed leaf -> remaining: 9 hrs
    subtopics_b = [make_subtopic(f"tb_{i}") for i in range(4)]
    mod_b = make_module("mb", 12, subtopics_b)

    # Module C: missing contact hours -> 0.0 hrs
    mod_c = make_module("mc", None, [make_subtopic("tc_1")])

    # Module D: 0 eligible leaves -> 0.0 hrs
    mod_d = make_module("md", 15, [])

    subj = make_subject("subj_ab", [mod_a, mod_b, mod_c, mod_d])

    completed = {f"ta_{i}" for i in range(5)} | {"tb_0"}
    metrics = calculate_node_pacing(subj, completed, target_date=date(2026, 12, 1), reference_date=date(2026, 11, 1))

    # Total remaining contact hours = 10.0 + 9.0 + 0.0 + 0.0 = 19.0
    assert metrics.remaining_contact_hours == 19.0
    assert metrics.total_leaves == 15
    assert metrics.completed_leaves == 6
    assert metrics.remaining_leaves == 9


def test_fully_completed_modules_contribute_zero_hours():
    mod = make_module("m1", 20, [make_subtopic("t1"), make_subtopic("t2")])
    subj = make_subject("s1", [mod])

    metrics = calculate_node_pacing(subj, ["t1", "t2"], target_date=date(2026, 12, 1), reference_date=date(2026, 11, 1))
    assert metrics.remaining_contact_hours == 0.0
    assert metrics.remaining_leaves == 0
    assert metrics.status == "completed"


# -----------------------------------------------------------------------------
# 13.4 Velocity tests
# -----------------------------------------------------------------------------

def test_velocities_and_rounding():
    ref = date(2026, 11, 1)

    # 14 days remaining = 2 weeks
    # 10 remaining leaves, 19.0 contact hours
    subtopics = [make_subtopic(f"t_{i}") for i in range(10)]
    mod = make_module("m", 19, subtopics)
    subj = make_subject("s", [mod])

    metrics = calculate_node_pacing(subj, [], target_date=date(2026, 11, 15), reference_date=ref)
    assert metrics.days_remaining == 14
    # delta_weeks = 14 / 7.0 = 2.0
    # topics_per_week = 10 / 2.0 = 5.0
    # hours_per_week = 19.0 / 2.0 = 9.5
    assert metrics.topics_per_week == 5.0
    assert metrics.hours_per_week == 9.5

    # Today's deadline (days_remaining = 0)
    metrics_today = calculate_node_pacing(subj, [], target_date=ref, reference_date=ref)
    assert metrics_today.days_remaining == 0
    assert metrics_today.topics_per_week == 10.0
    assert metrics_today.hours_per_week == 19.0

    # Overdue deadline (days_remaining = -5)
    metrics_overdue = calculate_node_pacing(subj, [], target_date=date(2026, 10, 27), reference_date=ref)
    assert metrics_overdue.days_remaining == -5
    assert metrics_overdue.topics_per_week == 10.0
    assert metrics_overdue.hours_per_week == 19.0

    # Zero remaining leaves produces zero velocity
    metrics_done = calculate_node_pacing(subj, [f"t_{i}" for i in range(10)], target_date=date(2026, 11, 15), reference_date=ref)
    assert metrics_done.topics_per_week == 0.0
    assert metrics_done.hours_per_week == 0.0


# -----------------------------------------------------------------------------
# 13.5 State machine tests
# -----------------------------------------------------------------------------

def test_state_machine_precedence_and_boundaries():
    ref = date(2026, 11, 1)
    # 10 total leaves
    subtopics = [make_subtopic(f"t_{i}") for i in range(10)]
    mod = make_module("m", 10, subtopics)
    subj = make_subject("s", [mod])

    # 1. No deadline set
    p = calculate_node_pacing(subj, [], target_date=None, reference_date=ref)
    assert p.status == "not_set"

    # 2. Behind (overdue with unfinished leaves)
    p = calculate_node_pacing(subj, ["t_0"], target_date=date(2026, 10, 31), reference_date=ref)
    assert p.days_remaining == -1
    assert p.status == "behind"

    # 3. Completed takes precedence even if overdue
    p = calculate_node_pacing(subj, [f"t_{i}" for i in range(10)], target_date=date(2026, 10, 31), reference_date=ref)
    assert p.days_remaining == -1
    assert p.status == "completed"

    # 4. Completed takes precedence even if no deadline set
    p = calculate_node_pacing(subj, [f"t_{i}" for i in range(10)], target_date=None, reference_date=ref)
    assert p.status == "completed"

    # 5. At risk boundary: exactly 7 days remaining
    # More than 30% remaining: 4 leaves remaining out of 10 = 40% > 30%
    completed_6 = [f"t_{i}" for i in range(6)]
    p = calculate_node_pacing(subj, completed_6, target_date=date(2026, 11, 8), reference_date=ref)
    assert p.days_remaining == 7
    assert p.status == "at_risk"

    # Exactly 30% remaining: 3 leaves remaining out of 10 = 30% -> NOT at risk -> on_track
    completed_7 = [f"t_{i}" for i in range(7)]
    p = calculate_node_pacing(subj, completed_7, target_date=date(2026, 11, 8), reference_date=ref)
    assert p.days_remaining == 7
    assert p.status == "on_track"

    # 8 days remaining: more than 30% remaining -> days > 7 -> on_track
    p = calculate_node_pacing(subj, completed_6, target_date=date(2026, 11, 9), reference_date=ref)
    assert p.days_remaining == 8
    assert p.status == "on_track"

    # Today (days_remaining = 0) with 40% remaining -> at_risk
    p = calculate_node_pacing(subj, completed_6, target_date=ref, reference_date=ref)
    assert p.days_remaining == 0
    assert p.status == "at_risk"

    # Normal future on_track (14 days, 50% remaining)
    completed_5 = [f"t_{i}" for i in range(5)]
    p = calculate_node_pacing(subj, completed_5, target_date=date(2026, 11, 15), reference_date=ref)
    assert p.days_remaining == 14
    assert p.status == "on_track"
