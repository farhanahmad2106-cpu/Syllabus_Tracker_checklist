"""Unit and integration tests for Phase 12 Study Analytics & Spaced-Repetition Revision Scheduler."""

from datetime import date, datetime, timedelta, timezone
import pytest
from sqlalchemy import select

from backend.app.database import (
    get_completed_leaf_ids,
    save_syllabus,
    update_leaf_completion,
    update_bulk_completion,
    upsert_target_deadline,
)
from backend.app.models import (
    CompletionEvent,
    LeafCompletionRecord,
    RevisionEvent,
    RevisionSchedule,
    TargetDeadline,
)
from backend.app.schemas import (
    AcademicYear,
    HierarchicalSyllabus,
    Module,
    Semester,
    Subject,
    Subtopic,
)
from backend.app.services.analytics import (
    calculate_next_revision,
    compute_syllabus_analytics,
    deterministic_round,
    get_due_revisions,
    record_revision_review,
)


@pytest.fixture
def analytics_syllabus() -> HierarchicalSyllabus:
    """Fixture providing a 5-tier syllabus with mandatory and elective subjects."""
    return HierarchicalSyllabus(
        id="syl_analytics_test",
        title="B.Sc. Data Engineering",
        source_filename="data_engineering.pdf",
        schema_version=2,
        years=[
            AcademicYear(
                id="yr_1",
                title="Year 1",
                order_index=0,
                semesters=[
                    Semester(
                        id="sem_1",
                        title="Semester 1",
                        order_index=0,
                        subjects=[
                            Subject(
                                id="subj_db",
                                code="CS101",
                                title="Database Systems",
                                is_enrolled=True,
                                enrollment_status="mandatory",
                                modules=[
                                    Module(
                                        id="mod_sql",
                                        title="Relational Modeling",
                                        topics=[
                                            Subtopic(
                                                id="top_sql_ddl",
                                                title="DDL and Schema Design",
                                                source_text="DDL schemas",
                                            ),
                                            Subtopic(
                                                id="top_sql_dml",
                                                title="DML and Index Optimization",
                                                source_text="DML queries",
                                            ),
                                        ],
                                    ),
                                ],
                            ),
                            Subject(
                                id="subj_elective_ai",
                                code="CS102",
                                title="Intro to AI (Excluded Elective)",
                                is_enrolled=False,
                                enrollment_status="excluded",
                                modules=[
                                    Module(
                                        id="mod_search",
                                        title="Search Algorithms",
                                        topics=[
                                            Subtopic(
                                                id="top_astar",
                                                title="A* Pathfinding",
                                                source_text="A* search",
                                            ),
                                        ],
                                    ),
                                ],
                            ),
                        ],
                    ),
                ],
            ),
        ],
    )


def test_deterministic_round():
    """Verify half-up deterministic rounding behavior."""
    assert deterministic_round(2.5) == 3
    assert deterministic_round(2.49) == 2
    assert deterministic_round(1.0) == 1
    assert deterministic_round(0.5) == 1
    assert deterministic_round(0.4) == 0


def test_completion_event_creation_and_immutability(db_session, analytics_syllabus):
    """Verify CompletionEvent is recorded on toggle and no duplicate events are created on no-op."""
    save_syllabus(db_session, analytics_syllabus)

    # 1. Complete leaf
    update_leaf_completion(
        session=db_session,
        syllabus=analytics_syllabus,
        leaf_id="top_sql_ddl",
        is_completed=True,
    )
    db_session.commit()

    events = list(
        db_session.scalars(
            select(CompletionEvent).where(CompletionEvent.syllabus_id == analytics_syllabus.id)
        ).all()
    )
    assert len(events) == 1
    assert events[0].leaf_id == "top_sql_ddl"
    assert events[0].action == "completed"

    # 2. Idempotent toggle: calling is_completed=True again must NOT create a duplicate event
    update_leaf_completion(
        session=db_session,
        syllabus=analytics_syllabus,
        leaf_id="top_sql_ddl",
        is_completed=True,
    )
    db_session.commit()

    events_after_noop = list(
        db_session.scalars(
            select(CompletionEvent).where(CompletionEvent.syllabus_id == analytics_syllabus.id)
        ).all()
    )
    assert len(events_after_noop) == 1

    # 3. Uncomplete leaf
    update_leaf_completion(
        session=db_session,
        syllabus=analytics_syllabus,
        leaf_id="top_sql_ddl",
        is_completed=False,
    )
    db_session.commit()

    events_after_uncomp = list(
        db_session.scalars(
            select(CompletionEvent)
            .where(CompletionEvent.syllabus_id == analytics_syllabus.id)
            .order_by(CompletionEvent.id.asc())
        ).all()
    )
    assert len(events_after_uncomp) == 2
    assert events_after_uncomp[1].action == "uncompleted"


def test_revision_schedule_initialization_and_suspension(db_session, analytics_syllabus):
    """Verify revision schedule auto-creation, suspension on uncomplete, and reactivation."""
    save_syllabus(db_session, analytics_syllabus)

    # Complete topic -> schedule initialized
    update_leaf_completion(
        session=db_session,
        syllabus=analytics_syllabus,
        leaf_id="top_sql_ddl",
        is_completed=True,
    )
    db_session.commit()

    sched = db_session.scalars(
        select(RevisionSchedule).where(
            RevisionSchedule.syllabus_id == analytics_syllabus.id,
            RevisionSchedule.leaf_id == "top_sql_ddl",
        )
    ).first()
    assert sched is not None
    assert sched.is_suspended is False
    assert sched.algorithm_version == "sm2-v1"
    assert sched.ease_factor == 2.5
    assert sched.interval_days == 1
    assert sched.repetition_count == 0
    assert sched.next_review_date == date.today() + timedelta(days=1)

    # Uncomplete topic -> schedule suspended
    update_leaf_completion(
        session=db_session,
        syllabus=analytics_syllabus,
        leaf_id="top_sql_ddl",
        is_completed=False,
    )
    db_session.commit()

    db_session.refresh(sched)
    assert sched.is_suspended is True

    # Recomplete topic -> schedule reactivated
    update_leaf_completion(
        session=db_session,
        syllabus=analytics_syllabus,
        leaf_id="top_sql_ddl",
        is_completed=True,
    )
    db_session.commit()

    db_session.refresh(sched)
    assert sched.is_suspended is False


def test_sm2_v1_transitions():
    """Verify SM-2-v1 interval and ease-factor transitions for all quality ratings 1-4."""
    today = date(2026, 11, 18)

    # Base schedule
    sched = RevisionSchedule(
        syllabus_id="test",
        leaf_id="leaf_1",
        algorithm_version="sm2-v1",
        repetition_count=2,
        ease_factor=2.5,
        interval_days=6,
        next_review_date=today,
    )

    # Quality 1 (Again): Repetition reset to 0, interval 1d, ease factor -0.20
    reps, interval, old_ef, new_ef, next_date = calculate_next_revision(sched, 1, today)
    assert reps == 0
    assert interval == 1
    assert new_ef == 2.30
    assert next_date == today + timedelta(days=1)

    # Quality 2 (Hard): Repetition preserved, interval * 1.2, ease factor -0.15
    reps, interval, old_ef, new_ef, next_date = calculate_next_revision(sched, 2, today)
    assert reps == 2
    assert interval == 7  # 6 * 1.2 = 7.2 -> 7
    assert new_ef == 2.35
    assert next_date == today + timedelta(days=7)

    # Quality 3 (Good): Repetition + 1, interval * EF, ease factor retained
    reps, interval, old_ef, new_ef, next_date = calculate_next_revision(sched, 3, today)
    assert reps == 3
    assert interval == 15  # 6 * 2.5 = 15
    assert new_ef == 2.50
    assert next_date == today + timedelta(days=15)

    # Quality 4 (Easy): Repetition + 1, interval * EF * 1.3, ease factor +0.15
    reps, interval, old_ef, new_ef, next_date = calculate_next_revision(sched, 4, today)
    assert reps == 3
    assert interval == 20  # 6 * 2.5 * 1.3 = 19.5 -> 20
    assert new_ef == 2.65
    assert next_date == today + timedelta(days=20)

    # Test Ease Factor lower bound floor (minimum 1.3)
    sched_low_ef = RevisionSchedule(
        syllabus_id="test",
        leaf_id="leaf_2",
        repetition_count=1,
        ease_factor=1.4,
        interval_days=1,
        next_review_date=today,
    )
    _, _, _, floored_ef, _ = calculate_next_revision(sched_low_ef, 1, today)
    assert floored_ef == 1.3  # clamped to minimum 1.3, not 1.2


def test_bulk_toggle_event_logging(db_session, analytics_syllabus):
    """Verify bulk completion logs events and creates revision schedules for all descendant leaves."""
    save_syllabus(db_session, analytics_syllabus)

    target_leaves = {"top_sql_ddl", "top_sql_dml"}
    update_bulk_completion(
        session=db_session,
        syllabus=analytics_syllabus,
        target_leaf_ids=target_leaves,
        is_completed=True,
    )
    db_session.commit()

    events = list(
        db_session.scalars(
            select(CompletionEvent).where(CompletionEvent.syllabus_id == analytics_syllabus.id)
        ).all()
    )
    assert len(events) == 2
    for ev in events:
        assert ev.action == "completed"

    schedules = list(
        db_session.scalars(
            select(RevisionSchedule).where(RevisionSchedule.syllabus_id == analytics_syllabus.id)
        ).all()
    )
    assert len(schedules) == 2


def test_study_analytics_calculation(db_session, analytics_syllabus):
    """Verify compute_syllabus_analytics calculates velocity, streaks, and subject coverage."""
    save_syllabus(db_session, analytics_syllabus)

    # Complete one leaf
    update_leaf_completion(
        session=db_session,
        syllabus=analytics_syllabus,
        leaf_id="top_sql_ddl",
        is_completed=True,
    )
    db_session.commit()

    ref_date = date.today()
    analytics = compute_syllabus_analytics(db_session, analytics_syllabus, reference_date=ref_date)

    assert analytics.syllabus_id == analytics_syllabus.id
    assert analytics.total_eligible_leaves == 2  # Excluded elective leaves not counted!
    assert analytics.completed_eligible_leaves == 1
    assert analytics.remaining_eligible_leaves == 1
    assert analytics.overall_completion_percentage == 50.0

    # Streak
    assert analytics.streak.current_streak >= 1
    assert analytics.streak.is_active_today is True

    # 14-day velocity
    assert len(analytics.velocity_14d) == 14
    today_entry = analytics.velocity_14d[-1]
    assert today_entry.completed_count == 1
    assert today_entry.net_change == 1

    # Subject coverage
    assert len(analytics.subject_coverage) == 1  # Only CS101 enrolled
    assert analytics.subject_coverage[0].subject_code == "CS101"
    assert analytics.subject_coverage[0].completed_leaves == 1
    assert analytics.subject_coverage[0].completion_percentage == 50.0


def test_rest_api_analytics_and_due_revisions(client, db_session, analytics_syllabus):
    """Verify GET /analytics and GET /revisions/due REST API endpoints."""
    save_syllabus(db_session, analytics_syllabus)

    # Complete leaf to schedule revision
    update_leaf_completion(
        session=db_session,
        syllabus=analytics_syllabus,
        leaf_id="top_sql_ddl",
        is_completed=True,
    )
    db_session.commit()

    # Make scheduled item due by setting next_review_date to today
    sched = db_session.scalars(
        select(RevisionSchedule).where(
            RevisionSchedule.syllabus_id == analytics_syllabus.id,
            RevisionSchedule.leaf_id == "top_sql_ddl",
        )
    ).first()
    sched.next_review_date = date.today()
    db_session.commit()

    # 1. Test GET /analytics
    res_analytics = client.get(f"/api/syllabus/{analytics_syllabus.id}/analytics")
    assert res_analytics.status_code == 200
    data = res_analytics.json()
    assert data["syllabus_id"] == analytics_syllabus.id
    assert data["overall_completion_percentage"] == 50.0
    assert data["revision_queue"]["due_today_count"] == 1

    # 2. Test GET /revisions/due
    res_due = client.get(f"/api/syllabus/{analytics_syllabus.id}/revisions/due")
    assert res_due.status_code == 200
    due_data = res_due.json()
    assert due_data["total_due"] == 1
    assert len(due_data["items"]) == 1
    item = due_data["items"][0]
    assert item["leaf_id"] == "top_sql_ddl"
    assert item["subject_code"] == "CS101"
    assert item["semester_title"] == "Semester 1"


def test_rest_api_submit_revision_review(client, db_session, analytics_syllabus):
    """Verify POST /revisions/{leaf_id}/review endpoint, history logging, and idempotency."""
    save_syllabus(db_session, analytics_syllabus)

    update_leaf_completion(
        session=db_session,
        syllabus=analytics_syllabus,
        leaf_id="top_sql_ddl",
        is_completed=True,
    )
    db_session.commit()

    # Submit review with rating 3 (Good)
    idempotency_key = "idemp_test_rev_1"
    res = client.post(
        f"/api/syllabus/{analytics_syllabus.id}/revisions/top_sql_ddl/review",
        json={"quality": 3, "idempotency_key": idempotency_key},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["quality"] == 3
    assert data["repetition_count"] == 1
    assert data["interval_days"] == 6

    # Verify RevisionEvent persisted
    rev_events = list(
        db_session.scalars(
            select(RevisionEvent).where(RevisionEvent.syllabus_id == analytics_syllabus.id)
        ).all()
    )
    assert len(rev_events) == 1
    assert rev_events[0].quality == 3
    assert rev_events[0].idempotency_key == idempotency_key

    # Idempotent re-submission returns previous result without creating duplicate revision event
    res_idemp = client.post(
        f"/api/syllabus/{analytics_syllabus.id}/revisions/top_sql_ddl/review",
        json={"quality": 3, "idempotency_key": idempotency_key},
    )
    assert res_idemp.status_code == 200
    rev_events_after = list(
        db_session.scalars(
            select(RevisionEvent).where(RevisionEvent.syllabus_id == analytics_syllabus.id)
        ).all()
    )
    assert len(rev_events_after) == 1
