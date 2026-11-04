"""Pure mathematical pacing engine and study velocity calculator.

Guarantees:
- Fully deterministic and pure: independent of FastAPI and database sessions.
- Mathematical isolation: never modifies canonical completion or leaf weights.
- Enrollment boundaries: non-enrolled electives contribute zero workload.
- Proportional contact-hour aggregation at Module granularity.
- Five-state pacing state machine: completed, not_set, behind, at_risk, on_track.
"""

from datetime import date, datetime
from typing import Any, Dict, Iterable, List, Optional, Set, Tuple, Union

from backend.app.progress import is_subject_enrolled
from backend.app.schemas import HierarchicalSyllabus, Module, PacingMetrics, Semester, Subject


def _parse_date(d: Optional[Union[date, str]]) -> Optional[date]:
    """Coerce string or date to date object safely."""
    if d is None:
        return None
    if isinstance(d, date) and not isinstance(d, datetime):
        return d
    if isinstance(d, datetime):
        return d.date()
    if isinstance(d, str):
        return date.fromisoformat(d.strip())
    raise ValueError(f"Invalid date format: {d}")


def _collect_module_metrics(
    module: Module,
    completed_set: Set[str],
) -> Tuple[int, int, float]:
    """
    Calculate (module_total_leaves, module_completed_leaves, module_remaining_contact_hours)
    for a single module.
    """
    topic_ids = [t.id for t in getattr(module, "topics", [])]
    unique_ids = list(dict.fromkeys(topic_ids))
    module_total = len(unique_ids)
    module_completed = len([tid for tid in unique_ids if tid in completed_set])

    raw_hours = getattr(module, "contact_hours", None)
    contact_hours = max(0.0, float(raw_hours)) if raw_hours is not None else 0.0

    if module_total == 0:
        remaining_ratio = 0.0
    else:
        remaining_ratio = (module_total - module_completed) / float(module_total)

    remaining_hours = contact_hours * remaining_ratio
    return module_total, module_completed, remaining_hours


def calculate_node_pacing(
    node: Union[Subject, Semester],
    completed_leaf_ids: Iterable[str],
    target_date: Optional[Union[date, str]] = None,
    reference_date: Optional[Union[date, str]] = None,
) -> PacingMetrics:
    """
    Calculate deterministic pacing metrics for a Subject or Semester node.

    Args:
        node: Tier 3 Subject or Tier 2 Semester.
        completed_leaf_ids: Set or list of canonical completed Tier 5 leaf IDs.
        target_date: Target deadline date (or ISO string), optional.
        reference_date: Anchor date for calculations (defaults to today).

    Returns:
        PacingMetrics with velocity and state machine status.
    """
    completed_set = set(completed_leaf_ids)
    parsed_target = _parse_date(target_date)
    ref_date = _parse_date(reference_date) or date.today()

    node_id = getattr(node, "id", "")

    # 1. Enrolled leaf aggregation & module contact-hour collection
    all_enrolled_leaf_ids: List[str] = []
    total_remaining_contact_hours = 0.0

    if isinstance(node, Subject):
        if is_subject_enrolled(node):
            for mod in getattr(node, "modules", []):
                m_total, m_comp, m_rem_hours = _collect_module_metrics(mod, completed_set)
                for t in getattr(mod, "topics", []):
                    all_enrolled_leaf_ids.append(t.id)
                total_remaining_contact_hours += m_rem_hours

    elif isinstance(node, Semester):
        subjects: List[Subject] = []
        if hasattr(node, "subjects") and node.subjects:
            subjects = node.subjects
        for subj in subjects:
            if is_subject_enrolled(subj):
                for mod in getattr(subj, "modules", []):
                    m_total, m_comp, m_rem_hours = _collect_module_metrics(mod, completed_set)
                    for t in getattr(mod, "topics", []):
                        all_enrolled_leaf_ids.append(t.id)
                    total_remaining_contact_hours += m_rem_hours
    else:
        raise ValueError(f"Unsupported node type for pacing calculation: {type(node)}")

    # Unique leaves for this node (prevents double-counting in semester aggregation)
    unique_leaf_ids = set(all_enrolled_leaf_ids)
    total_leaves = len(unique_leaf_ids)
    completed_leaves = len(unique_leaf_ids & completed_set)
    remaining_leaves = max(0, total_leaves - completed_leaves)

    if remaining_leaves == 0:
        total_remaining_contact_hours = 0.0

    rounded_remaining_contact_hours = round(total_remaining_contact_hours, 1)

    # 2. Calendar calculations
    days_remaining: Optional[int] = None
    delta_weeks: Optional[float] = None

    if parsed_target is not None:
        days_remaining = (parsed_target - ref_date).days
        delta_weeks = max(1.0 / 7.0, days_remaining / 7.0)

    # 3. Topic & Contact-hour velocities
    topics_per_week = 0.0
    hours_per_week = 0.0

    if remaining_leaves == 0:
        topics_per_week = 0.0
        hours_per_week = 0.0
    elif parsed_target is not None and days_remaining is not None and delta_weeks is not None:
        if days_remaining <= 0:
            topics_per_week = float(remaining_leaves)
            hours_per_week = rounded_remaining_contact_hours
        else:
            topics_per_week = round(remaining_leaves / delta_weeks, 1)
            hours_per_week = round(rounded_remaining_contact_hours / delta_weeks, 1)

    # 4. Pacing State Machine
    # Precedence:
    # 1. completed (total_leaves > 0 and remaining_leaves == 0)
    # 2. not_set (parsed_target is None)
    # 3. behind (days_remaining < 0 and remaining_leaves > 0)
    # 4. at_risk (0 <= days_remaining <= 7 and remaining_leaves / total_leaves > 0.30)
    # 5. on_track (all other valid configurations)
    if total_leaves == 0:
        # Empty node behavior
        status = "on_track" if parsed_target is not None else "not_set"
    elif remaining_leaves == 0:
        status = "completed"
    elif parsed_target is None:
        status = "not_set"
    elif days_remaining is not None and days_remaining < 0:
        status = "behind"
    elif (
        days_remaining is not None
        and 0 <= days_remaining <= 7
        and (remaining_leaves / float(total_leaves)) > 0.30
    ):
        status = "at_risk"
    else:
        status = "on_track"

    return PacingMetrics(
        node_id=node_id,
        target_date=parsed_target,
        days_remaining=days_remaining,
        total_leaves=total_leaves,
        completed_leaves=completed_leaves,
        remaining_leaves=remaining_leaves,
        remaining_contact_hours=rounded_remaining_contact_hours,
        topics_per_week=topics_per_week,
        hours_per_week=hours_per_week,
        status=status,
    )


def find_node_in_syllabus(
    syllabus: HierarchicalSyllabus,
    node_id: str,
) -> Optional[Tuple[Union[Subject, Semester], str]]:
    """
    Locate a Subject or Semester node in a syllabus hierarchy.
    Returns (node_object, "subject" | "semester") or None if not found.
    """
    for yr in syllabus.years:
        for sem in yr.semesters:
            if sem.id == node_id:
                return sem, "semester"
            for subj in sem.subjects:
                if subj.id == node_id:
                    return subj, "subject"
    return None

