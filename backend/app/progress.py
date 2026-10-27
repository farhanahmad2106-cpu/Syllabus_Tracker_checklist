"""Pure progress calculation and cascading checklist engine."""

from typing import Dict, List, Literal, Set, Tuple
from backend.app.schemas import (
    AcademicYear,
    HierarchicalSyllabus,
    Module,
    ProgressSummary,
    Semester,
    Subject,
    Subtopic,
    Topic,
)

CheckboxState = Literal["checked", "unchecked", "indeterminate"]


def compute_progress_summary(completed: int, total: int) -> ProgressSummary:
    """Calculate progress percentage using integer counts without division by zero."""
    if total <= 0:
        return ProgressSummary(
            total_leaves=0,
            completed_leaves=0,
            progress_percent=0.0,
        )
    # Clamp completed to [0, total]
    c = max(0, min(completed, total))
    percent = round((c / total) * 100.0, 1)
    return ProgressSummary(
        total_leaves=total,
        completed_leaves=c,
        progress_percent=percent,
    )


def get_all_leaf_ids(syllabus: HierarchicalSyllabus) -> List[str]:
    """Return all leaf subtopic/topic IDs in document order without duplicates."""
    leaf_ids: List[str] = []
    for yr in syllabus.years:
        for sem in yr.semesters:
            for subj in sem.subjects:
                for mod in subj.modules:
                    for top in mod.topics:
                        leaf_ids.append(top.id)
    return list(dict.fromkeys(leaf_ids))


def get_node_descendant_leaf_ids(
    syllabus: HierarchicalSyllabus, node_id: str
) -> List[str]:
    """Find all descendant leaf topic IDs for any node ID (syllabus, year, semester, subject, module, or topic leaf)."""
    # 1. If node is root syllabus ID
    if node_id == syllabus.id:
        return get_all_leaf_ids(syllabus)

    # 2. Year level
    for yr in syllabus.years:
        if yr.id == node_id:
            leaves: List[str] = []
            for sem in yr.semesters:
                for subj in sem.subjects:
                    for mod in subj.modules:
                        for top in mod.topics:
                            leaves.append(top.id)
            return list(dict.fromkeys(leaves))

        # 3. Semester level
        for sem in yr.semesters:
            if sem.id == node_id:
                leaves = []
                for subj in sem.subjects:
                    for mod in subj.modules:
                        for top in mod.topics:
                            leaves.append(top.id)
                return list(dict.fromkeys(leaves))

            # 4. Subject level
            for subj in sem.subjects:
                if subj.id == node_id:
                    leaves = []
                    for mod in subj.modules:
                        for top in mod.topics:
                            leaves.append(top.id)
                    return list(dict.fromkeys(leaves))

                # 5. Module level
                for mod in subj.modules:
                    if mod.id == node_id:
                        return list(dict.fromkeys([top.id for top in mod.topics]))

                    # 6. Topic leaf level
                    for top in mod.topics:
                        if top.id == node_id:
                            return [top.id]

    return []


def node_exists_in_syllabus(syllabus: HierarchicalSyllabus, node_id: str) -> bool:
    """Check if node_id exists anywhere in the syllabus hierarchy."""
    if node_id == syllabus.id:
        return True
    for yr in syllabus.years:
        if yr.id == node_id:
            return True
        for sem in yr.semesters:
            if sem.id == node_id:
                return True
            for subj in sem.subjects:
                if subj.id == node_id:
                    return True
                for mod in subj.modules:
                    if mod.id == node_id:
                        return True
                    for top in mod.topics:
                        if top.id == node_id:
                            return True
    return False


def is_leaf_id(syllabus: HierarchicalSyllabus, leaf_id: str) -> bool:
    """Return True if leaf_id corresponds to a leaf subtopic."""
    for yr in syllabus.years:
        for sem in yr.semesters:
            for subj in sem.subjects:
                for mod in subj.modules:
                    for top in mod.topics:
                        if top.id == leaf_id:
                            return True
    return False


def derive_checkbox_state(
    descendant_leaf_ids: List[str], completed_leaf_ids: Set[str]
) -> CheckboxState:
    """Derive checked, unchecked, or indeterminate state from descendant leaves."""
    if not descendant_leaf_ids:
        return "unchecked"

    completed_count = sum(1 for lid in descendant_leaf_ids if lid in completed_leaf_ids)

    if completed_count == 0:
        return "unchecked"
    elif completed_count == len(descendant_leaf_ids):
        return "checked"
    else:
        return "indeterminate"


def calculate_syllabus_progress(
    syllabus: HierarchicalSyllabus,
    completed_leaf_ids: Set[str],
) -> Tuple[ProgressSummary, Dict[str, ProgressSummary]]:
    """Compute overall progress and per-node progress for every level in the syllabus."""
    node_progress: Dict[str, ProgressSummary] = {}

    all_leaves = get_all_leaf_ids(syllabus)
    total_completed = sum(1 for lid in all_leaves if lid in completed_leaf_ids)
    global_progress = compute_progress_summary(total_completed, len(all_leaves))
    node_progress[syllabus.id] = global_progress

    for yr in syllabus.years:
        yr_leaves: List[str] = []
        for sem in yr.semesters:
            sem_leaves: List[str] = []
            for subj in sem.subjects:
                subj_leaves: List[str] = []
                for mod in subj.modules:
                    mod_leaves = [top.id for top in mod.topics]
                    mod_completed = sum(1 for lid in mod_leaves if lid in completed_leaf_ids)
                    mod_prog = compute_progress_summary(mod_completed, len(mod_leaves))
                    node_progress[mod.id] = mod_prog
                    subj_leaves.extend(mod_leaves)

                    # Subtopic/Topic leaf level progress (0 or 100%)
                    for top in mod.topics:
                        is_done = 1 if top.id in completed_leaf_ids else 0
                        node_progress[top.id] = compute_progress_summary(is_done, 1)

                subj_completed = sum(1 for lid in subj_leaves if lid in completed_leaf_ids)
                subj_prog = compute_progress_summary(subj_completed, len(subj_leaves))
                node_progress[subj.id] = subj_prog
                sem_leaves.extend(subj_leaves)

            sem_completed = sum(1 for lid in sem_leaves if lid in completed_leaf_ids)
            sem_prog = compute_progress_summary(sem_completed, len(sem_leaves))
            node_progress[sem.id] = sem_prog
            yr_leaves.extend(sem_leaves)

        yr_completed = sum(1 for lid in yr_leaves if lid in completed_leaf_ids)
        yr_prog = compute_progress_summary(yr_completed, len(yr_leaves))
        node_progress[yr.id] = yr_prog

    return global_progress, node_progress


def determine_bulk_toggle_action(
    descendant_leaf_ids: List[str],
    current_completed_ids: Set[str],
    explicit_target_state: bool | None = None,
) -> Tuple[Set[str], bool]:
    """
    Determine target leaves and desired completed status.
    If explicit_target_state is provided, use it.
    Otherwise, if all descendant leaves are completed, uncheck all (is_completed=False).
    If not all completed, check all (is_completed=True).
    """
    target_set = set(descendant_leaf_ids)
    if explicit_target_state is not None:
        return target_set, explicit_target_state

    if not target_set:
        return set(), False

    all_completed = target_set.issubset(current_completed_ids)
    # If all are completed, toggle to incomplete; otherwise toggle to complete
    return target_set, not all_completed
