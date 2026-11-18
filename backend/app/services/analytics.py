"""Study analytics aggregator and deterministic spaced-repetition revision engine.

Guarantees:
- SM-2-v1: Deterministic, versioned interval and ease-factor transitions.
- Read-only progress authority: leaf_completions remains the sole source of truth for completion.
- Non-enrolled electives contribute zero workload, revision queue items, or analytics metrics.
- Historical event integrity: completion_events and revision_events are immutable logs.
- Zero synthetic data: missing history is reported honestly without artificial interpolation.
"""

from datetime import date, datetime, timedelta, timezone
import math
from typing import Any, Dict, List, Optional, Set, Tuple

from fastapi import HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from backend.app.database import get_completed_leaf_ids, get_syllabus_record
from backend.app.models import (
    CompletionEvent,
    LeafCompletionRecord,
    RevisionEvent,
    RevisionSchedule,
    SyllabusRecord,
    TargetDeadline,
    TopicNote,
    TopicResource,
)
from backend.app.progress import (
    get_all_leaf_ids,
    get_enrolled_leaf_ids,
    get_node_descendant_leaf_ids,
    is_subject_enrolled,
)
from backend.app.schemas import (
    CompletionVelocityDay,
    DueRevisionItem,
    DueRevisionsResponse,
    ExamRiskItem,
    HierarchicalSyllabus,
    ReviewRatingResponse,
    RevisionQueueMetrics,
    StreakMetrics,
    SubjectCoverageItem,
    SyllabusAnalyticsResponse,
)


def deterministic_round(val: float) -> int:
    """Half-up deterministic rounding (e.g. 2.5 -> 3, 2.49 -> 2)."""
    return int(math.floor(val + 0.5))


def calculate_next_revision(
    schedule: RevisionSchedule,
    quality: int,
    review_date: date,
) -> Tuple[int, int, float, float, date]:
    """
    Calculate deterministic SM-2-v1 schedule transitions.

    Args:
        schedule: Current RevisionSchedule.
        quality: Recall score (1: Again, 2: Hard, 3: Good, 4: Easy).
        review_date: Anchor date for scheduling.

    Returns:
        (new_repetition_count, new_interval_days, old_ease_factor, new_ease_factor, next_review_date)
    """
    if quality not in (1, 2, 3, 4):
        raise ValueError(f"Quality rating must be between 1 and 4, got: {quality}")

    old_interval = schedule.interval_days
    old_ef = round(schedule.ease_factor, 2)
    reps = schedule.repetition_count

    if quality == 1:
        # Again: Complete failure / blackout
        new_reps = 0
        new_interval = 1
        new_ef = max(1.3, round(old_ef - 0.20, 2))
    elif quality == 2:
        # Hard: Recalled with serious hesitation
        new_reps = reps
        new_interval = max(1, deterministic_round(old_interval * 1.2))
        new_ef = max(1.3, round(old_ef - 0.15, 2))
    elif quality == 3:
        # Good: Correct recall with normal effort
        if reps == 0:
            new_interval = 1
        elif reps == 1:
            new_interval = 6
        else:
            new_interval = max(1, deterministic_round(old_interval * old_ef))
        new_reps = reps + 1
        new_ef = round(old_ef, 2)
    elif quality == 4:
        # Easy: Effortless recall
        if reps == 0:
            new_interval = 4
        else:
            new_interval = max(1, deterministic_round(old_interval * old_ef * 1.3))
        new_reps = reps + 1
        new_ef = round(old_ef + 0.15, 2)

    next_date = review_date + timedelta(days=new_interval)
    return new_reps, new_interval, old_ef, new_ef, next_date


def record_revision_review(
    session: Session,
    syllabus_id: str,
    leaf_id: str,
    quality: int,
    idempotency_key: Optional[str] = None,
    client_review_date: Optional[date] = None,
) -> ReviewRatingResponse:
    """Record a recall quality rating for a topic revision and advance the schedule."""
    # 1. Idempotency check: if already recorded with same key, return existing record
    if idempotency_key:
        existing_event = session.scalars(
            select(RevisionEvent).where(
                RevisionEvent.syllabus_id == syllabus_id,
                RevisionEvent.idempotency_key == idempotency_key,
            )
        ).first()
        if existing_event:
            sched = session.scalars(
                select(RevisionSchedule).where(
                    RevisionSchedule.syllabus_id == syllabus_id,
                    RevisionSchedule.leaf_id == leaf_id,
                )
            ).first()
            return ReviewRatingResponse(
                schedule_id=sched.id if sched else 0,
                syllabus_id=syllabus_id,
                leaf_id=leaf_id,
                repetition_count=sched.repetition_count if sched else 0,
                interval_days=existing_event.interval_after,
                ease_factor=existing_event.ease_factor_after,
                next_review_date=sched.next_review_date.isoformat() if sched else date.today().isoformat(),
                quality=existing_event.quality,
                reviewed_at=existing_event.reviewed_at.isoformat(),
            )

    sched = session.scalars(
        select(RevisionSchedule).where(
            RevisionSchedule.syllabus_id == syllabus_id,
            RevisionSchedule.leaf_id == leaf_id,
        )
    ).first()
    if not sched:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Revision schedule not found for topic: {leaf_id}",
        )

    now = datetime.now(timezone.utc)
    rev_date = client_review_date or now.date()

    old_interval = sched.interval_days
    new_reps, new_interval, old_ef, new_ef, next_date = calculate_next_revision(
        schedule=sched,
        quality=quality,
        review_date=rev_date,
    )

    sched.repetition_count = new_reps
    sched.interval_days = new_interval
    sched.ease_factor = new_ef
    sched.next_review_date = next_date
    sched.last_reviewed_at = now
    sched.last_quality = quality
    sched.is_suspended = False
    sched.updated_at = now

    rev_event = RevisionEvent(
        syllabus_id=syllabus_id,
        leaf_id=leaf_id,
        quality=quality,
        interval_before=old_interval,
        interval_after=new_interval,
        ease_factor_before=old_ef,
        ease_factor_after=new_ef,
        algorithm_version=sched.algorithm_version,
        reviewed_at=now,
        idempotency_key=idempotency_key,
    )
    session.add(rev_event)
    session.flush()

    return ReviewRatingResponse(
        schedule_id=sched.id,
        syllabus_id=syllabus_id,
        leaf_id=leaf_id,
        repetition_count=new_reps,
        interval_days=new_interval,
        ease_factor=new_ef,
        next_review_date=next_date.isoformat(),
        quality=quality,
        reviewed_at=now.isoformat(),
    )


def build_enrolled_leaf_metadata_map(
    syllabus: HierarchicalSyllabus,
) -> Dict[str, Dict[str, Any]]:
    """Map enrolled leaf IDs to their hierarchical breadcrumb context."""
    leaf_map: Dict[str, Dict[str, Any]] = {}
    for yr in syllabus.years:
        for sem in yr.semesters:
            for subj in sem.subjects:
                if not is_subject_enrolled(subj):
                    continue
                for mod in subj.modules:
                    for top in mod.topics:
                        leaf_map[top.id] = {
                            "leaf_title": top.title,
                            "module_id": mod.id,
                            "module_title": mod.title,
                            "subject_id": subj.id,
                            "subject_code": subj.code,
                            "subject_title": subj.title,
                            "semester_id": sem.id,
                            "semester_title": sem.title,
                        }
    return leaf_map


def get_due_revisions(
    session: Session,
    syllabus: HierarchicalSyllabus,
    include_upcoming: bool = False,
    limit: int = 50,
    reference_date: Optional[date] = None,
) -> DueRevisionsResponse:
    """Retrieve scheduled topics due for revision, sorted by overdue urgency."""
    ref_date = reference_date or date.today()
    leaf_meta_map = build_enrolled_leaf_metadata_map(syllabus)
    enrolled_leaf_ids = list(leaf_meta_map.keys())

    if not enrolled_leaf_ids:
        return DueRevisionsResponse(syllabus_id=syllabus.id, total_due=0, items=[])

    cutoff_date = ref_date + timedelta(days=7) if include_upcoming else ref_date

    # Query active schedules
    stmt = (
        select(RevisionSchedule)
        .where(
            RevisionSchedule.syllabus_id == syllabus.id,
            RevisionSchedule.is_suspended == False,
            RevisionSchedule.next_review_date <= cutoff_date,
            RevisionSchedule.leaf_id.in_(enrolled_leaf_ids),
        )
    )
    schedules = list(session.scalars(stmt).all())

    # Topic notes presence map
    notes_stmt = select(TopicNote.leaf_id).where(TopicNote.syllabus_id == syllabus.id)
    notes_leaves = set(session.scalars(notes_stmt).all())

    # Topic resources count map
    res_stmt = (
        select(TopicResource.node_id, func.count(TopicResource.id))
        .where(TopicResource.syllabus_id == syllabus.id)
        .group_by(TopicResource.node_id)
    )
    res_counts = dict(session.execute(res_stmt).all())

    items: List[DueRevisionItem] = []
    for s in schedules:
        meta = leaf_meta_map.get(s.leaf_id)
        if not meta:
            continue

        days_diff = (ref_date - s.next_review_date).days
        is_overdue = s.next_review_date < ref_date
        days_overdue = max(0, days_diff)

        has_notes = s.leaf_id in notes_leaves
        resource_count = res_counts.get(s.leaf_id, 0) + res_counts.get(meta["module_id"], 0)

        items.append(
            DueRevisionItem(
                schedule_id=s.id,
                leaf_id=s.leaf_id,
                leaf_title=meta["leaf_title"],
                module_id=meta["module_id"],
                module_title=meta["module_title"],
                subject_id=meta["subject_id"],
                subject_code=meta["subject_code"],
                subject_title=meta["subject_title"],
                semester_id=meta["semester_id"],
                semester_title=meta["semester_title"],
                due_date=s.next_review_date.isoformat(),
                days_overdue=days_overdue,
                is_overdue=is_overdue,
                repetition_count=s.repetition_count,
                interval_days=s.interval_days,
                ease_factor=s.ease_factor,
                last_reviewed_at=s.last_reviewed_at.isoformat() if s.last_reviewed_at else None,
                has_notes=has_notes,
                resource_count=resource_count,
            )
        )

    # Sort items: overdue first (highest days_overdue first), then by next_review_date, then leaf_id
    items.sort(
        key=lambda x: (
            not x.is_overdue,
            -x.days_overdue,
            x.due_date,
            x.leaf_id,
        )
    )

    total_due = sum(1 for it in items if it.due_date <= ref_date.isoformat())
    bounded_items = items[:limit]

    return DueRevisionsResponse(
        syllabus_id=syllabus.id,
        total_due=total_due,
        items=bounded_items,
    )


def compute_syllabus_analytics(
    session: Session,
    syllabus: HierarchicalSyllabus,
    reference_date: Optional[date] = None,
) -> SyllabusAnalyticsResponse:
    """Aggregate comprehensive study metrics and revision intelligence."""
    ref_date = reference_date or date.today()

    # 1. Overall canonical completion
    enrolled_leaves = get_all_leaf_ids(syllabus, enrolled_only=True)
    all_completed = get_completed_leaf_ids(session, syllabus.id)
    completed_enrolled = set(enrolled_leaves) & all_completed

    total_eligible = len(enrolled_leaves)
    completed_eligible = len(completed_enrolled)
    remaining_eligible = max(0, total_eligible - completed_eligible)
    overall_pct = (
        round((completed_eligible / total_eligible) * 100.0, 1)
        if total_eligible > 0
        else 0.0
    )

    # 2. 14-day completion velocity
    # Pull completion events for this syllabus
    ce_stmt = (
        select(CompletionEvent)
        .where(CompletionEvent.syllabus_id == syllabus.id)
        .order_by(CompletionEvent.recorded_at.asc())
    )
    all_events = list(session.scalars(ce_stmt).all())

    # Build date-wise counts
    daily_completed: Dict[date, int] = {}
    daily_uncompleted: Dict[date, int] = {}
    active_dates: Set[date] = set()

    for ev in all_events:
        ev_date = ev.recorded_at.date()
        if ev.action == "completed":
            daily_completed[ev_date] = daily_completed.get(ev_date, 0) + 1
            active_dates.add(ev_date)
        elif ev.action == "uncompleted":
            daily_uncompleted[ev_date] = daily_uncompleted.get(ev_date, 0) + 1

    # Generate 14-day window [ref_date - 13 days ... ref_date]
    day_list: List[date] = [ref_date - timedelta(days=i) for i in reversed(range(14))]

    # Calculate net diffs for each day in window
    window_net_diffs = [
        daily_completed.get(d, 0) - daily_uncompleted.get(d, 0)
        for d in day_list
    ]

    # Calculate cumulative counts backwards from today's completed total
    cum_values: List[int] = [0] * 14
    running_cum = completed_eligible
    for i in reversed(range(14)):
        cum_values[i] = max(0, running_cum)
        running_cum -= window_net_diffs[i]

    velocity_14d: List[CompletionVelocityDay] = []
    for i, d in enumerate(day_list):
        comp = daily_completed.get(d, 0)
        uncomp = daily_uncompleted.get(d, 0)
        net = comp - uncomp
        velocity_14d.append(
            CompletionVelocityDay(
                date=d.isoformat(),
                completed_count=comp,
                uncompleted_count=uncomp,
                net_change=net,
                cumulative_completed=cum_values[i],
            )
        )

    # 3. Study Streak
    sorted_active_dates = sorted(active_dates)
    is_active_today = ref_date in active_dates
    last_act_date = sorted_active_dates[-1].isoformat() if sorted_active_dates else None

    # Calculate current streak
    current_streak = 0
    streak_anchor = ref_date if is_active_today else (ref_date - timedelta(days=1))
    cur_check = streak_anchor
    while cur_check in active_dates:
        current_streak += 1
        cur_check -= timedelta(days=1)

    # Calculate longest streak
    longest_streak = 0
    if sorted_active_dates:
        cur_run = 1
        for i in range(1, len(sorted_active_dates)):
            if sorted_active_dates[i] == sorted_active_dates[i - 1] + timedelta(days=1):
                cur_run += 1
            else:
                longest_streak = max(longest_streak, cur_run)
                cur_run = 1
        longest_streak = max(longest_streak, cur_run)

    streak_metrics = StreakMetrics(
        current_streak=current_streak,
        longest_streak=longest_streak,
        last_activity_date=last_act_date,
        is_active_today=is_active_today,
    )

    # 4. Subject Coverage
    subject_coverage: List[SubjectCoverageItem] = []
    for yr in syllabus.years:
        for sem in yr.semesters:
            for subj in sem.subjects:
                if not is_subject_enrolled(subj):
                    continue
                subj_leaves: List[str] = []
                for mod in subj.modules:
                    for top in mod.topics:
                        subj_leaves.append(top.id)
                unique_subj_leaves = list(dict.fromkeys(subj_leaves))
                subj_total = len(unique_subj_leaves)
                subj_comp = sum(1 for lid in unique_subj_leaves if lid in completed_enrolled)
                subj_pct = (
                    round((subj_comp / subj_total) * 100.0, 1) if subj_total > 0 else 0.0
                )
                is_lab = (
                    getattr(subj, "is_lab", False)
                    or "lab" in subj.title.lower()
                    or "practical" in subj.title.lower()
                )
                subject_coverage.append(
                    SubjectCoverageItem(
                        subject_id=subj.id,
                        subject_code=subj.code,
                        subject_title=subj.title,
                        is_lab=is_lab,
                        total_leaves=subj_total,
                        completed_leaves=subj_comp,
                        completion_percentage=subj_pct,
                    )
                )

    # 5. Revision Queue Metrics
    sched_stmt = (
        select(RevisionSchedule)
        .where(
            RevisionSchedule.syllabus_id == syllabus.id,
            RevisionSchedule.is_suspended == False,
            RevisionSchedule.leaf_id.in_(enrolled_leaves),
        )
    )
    all_schedules = list(session.scalars(sched_stmt).all())

    due_today_count = sum(1 for s in all_schedules if s.next_review_date == ref_date)
    overdue_count = sum(1 for s in all_schedules if s.next_review_date < ref_date)
    upcoming_7d_count = sum(
        1 for s in all_schedules if ref_date < s.next_review_date <= ref_date + timedelta(days=7)
    )
    mastered_count = sum(
        1 for s in all_schedules if s.repetition_count >= 3 or s.interval_days >= 21
    )
    total_scheduled = len(all_schedules)

    revision_metrics = RevisionQueueMetrics(
        due_today_count=due_today_count,
        overdue_count=overdue_count,
        upcoming_7d_count=upcoming_7d_count,
        mastered_count=mastered_count,
        total_scheduled=total_scheduled,
    )

    # 6. Upcoming Exam Risks
    deadlines_stmt = select(TargetDeadline).where(TargetDeadline.syllabus_id == syllabus.id)
    deadlines = list(session.scalars(deadlines_stmt).all())

    recent_14d_completed = sum(v.completed_count for v in velocity_14d)
    current_velocity = round(recent_14d_completed / 14.0, 2)

    exam_risks: List[ExamRiskItem] = []
    for dl in deadlines:
        node_leaves = get_node_descendant_leaf_ids(syllabus, dl.node_id, enrolled_only=True)
        if not node_leaves:
            continue

        node_total = len(node_leaves)
        node_comp = sum(1 for lid in node_leaves if lid in completed_enrolled)
        node_incomp = max(0, node_total - node_comp)
        node_pct = round((node_comp / node_total) * 100.0, 1) if node_total > 0 else 0.0

        days_remaining = (dl.target_date - ref_date).days
        req_velocity = (
            round(node_incomp / max(1, days_remaining), 2)
            if days_remaining > 0
            else float(node_incomp)
        )

        # Title resolution
        node_title = dl.node_id
        for yr in syllabus.years:
            for sem in yr.semesters:
                if sem.id == dl.node_id:
                    node_title = sem.title
                for subj in sem.subjects:
                    if subj.id == dl.node_id:
                        node_title = f"{subj.code} - {subj.title}"

        # Risk classification
        if node_incomp == 0:
            risk_level = "Low"
            risk_reason = "All topics completed ahead of target deadline"
        elif days_remaining < 0:
            risk_level = "Critical"
            risk_reason = f"Target deadline expired {abs(days_remaining)} days ago with {node_incomp} topics remaining"
        elif days_remaining <= 7:
            risk_level = "Critical"
            risk_reason = f"Only {days_remaining} days left to complete {node_incomp} topics ({req_velocity} topics/day required)"
        elif current_velocity < req_velocity * 0.5:
            risk_level = "High"
            risk_reason = f"Current velocity ({current_velocity}/day) is under 50% of required velocity ({req_velocity}/day)"
        elif current_velocity < req_velocity * 0.8:
            risk_level = "Moderate"
            risk_reason = f"Current velocity ({current_velocity}/day) lags required velocity ({req_velocity}/day)"
        else:
            risk_level = "Low"
            risk_reason = f"Pacing on track to meet deadline ({req_velocity} topics/day required)"

        exam_risks.append(
            ExamRiskItem(
                node_id=dl.node_id,
                node_type=dl.node_type,
                title=node_title,
                target_date=dl.target_date.isoformat(),
                days_remaining=days_remaining,
                total_leaves=node_total,
                completed_leaves=node_comp,
                incomplete_leaves=node_incomp,
                completion_percentage=node_pct,
                required_velocity_per_day=req_velocity,
                current_velocity_per_day=current_velocity,
                risk_level=risk_level,
                risk_reason=risk_reason,
            )
        )

    # Sort exam risks by urgency (Critical, High, Moderate, Low), then by days_remaining
    risk_order = {"Critical": 0, "High": 1, "Moderate": 2, "Low": 3}
    exam_risks.sort(key=lambda r: (risk_order.get(r.risk_level, 4), r.days_remaining))

    return SyllabusAnalyticsResponse(
        syllabus_id=syllabus.id,
        overall_completion_percentage=overall_pct,
        total_eligible_leaves=total_eligible,
        completed_eligible_leaves=completed_eligible,
        remaining_eligible_leaves=remaining_eligible,
        streak=streak_metrics,
        velocity_14d=velocity_14d,
        subject_coverage=subject_coverage,
        revision_queue=revision_metrics,
        exam_risks=exam_risks,
    )
