"""Automated tests for progress calculations and cascading tri-state checklist engine."""

import pytest
from backend.app.progress import (
    calculate_syllabus_progress,
    compute_progress_summary,
    derive_checkbox_state,
    determine_bulk_toggle_action,
    get_all_leaf_ids,
    get_node_descendant_leaf_ids,
)


def test_compute_progress_summary():
    """Verify exact counts and percentage rounding."""
    p0 = compute_progress_summary(0, 4)
    assert p0.total_leaves == 4
    assert p0.completed_leaves == 0
    assert p0.progress_percent == 0.0

    p1 = compute_progress_summary(1, 4)
    assert p1.total_leaves == 4
    assert p1.completed_leaves == 1
    assert p1.progress_percent == 25.0

    p_one_third = compute_progress_summary(1, 3)
    assert p_one_third.progress_percent == 33.3

    # Division by zero safety
    p_empty = compute_progress_summary(0, 0)
    assert p_empty.total_leaves == 0
    assert p_empty.completed_leaves == 0
    assert p_empty.progress_percent == 0.0


def test_derive_checkbox_state():
    """Verify checked, unchecked, and indeterminate states."""
    leaves = ["sub_1", "sub_2", "sub_3"]

    # None completed
    assert derive_checkbox_state(leaves, set()) == "unchecked"

    # Some completed -> indeterminate
    assert derive_checkbox_state(leaves, {"sub_1"}) == "indeterminate"
    assert derive_checkbox_state(leaves, {"sub_1", "sub_2"}) == "indeterminate"

    # All completed -> checked
    assert derive_checkbox_state(leaves, {"sub_1", "sub_2", "sub_3"}) == "checked"

    # Extra unrelated completed IDs do not interfere
    assert derive_checkbox_state(leaves, {"sub_1", "sub_2", "sub_3", "other"}) == "checked"

    # Empty branch is unchecked
    assert derive_checkbox_state([], set()) == "unchecked"
    assert derive_checkbox_state([], {"some_id"}) == "unchecked"


def test_syllabus_progress_calculation(sample_syllabus):
    """Verify hierarchical progress computation across all levels."""
    # sample_syllabus has 4 subtopics:
    # sub_arr, sub_stack (under top_algo)
    # sub_sql (under top_db)
    # sub_proc (under top_os in sem_2)
    all_leaves = get_all_leaf_ids(sample_syllabus)
    assert len(all_leaves) == 4

    # 1. 0 completed
    prog, node_prog = calculate_syllabus_progress(sample_syllabus, set())
    assert prog.total_leaves == 4
    assert prog.completed_leaves == 0
    assert prog.progress_percent == 0.0

    # 2. 1 completed in top_algo
    prog, node_prog = calculate_syllabus_progress(sample_syllabus, {"sub_arr"})
    assert prog.completed_leaves == 1
    assert prog.progress_percent == 25.0
    assert node_prog["top_algo"].completed_leaves == 1
    assert node_prog["top_algo"].total_leaves == 2
    assert node_prog["top_algo"].progress_percent == 50.0
    assert node_prog["sem_1"].completed_leaves == 1
    assert node_prog["sem_1"].total_leaves == 3
    assert node_prog["sem_1"].progress_percent == 33.3

    # 3. All completed
    prog, node_prog = calculate_syllabus_progress(sample_syllabus, set(all_leaves))
    assert prog.completed_leaves == 4
    assert prog.progress_percent == 100.0
    assert node_prog["yr_1"].progress_percent == 100.0


def test_bulk_toggle_action_cascading(sample_syllabus):
    """Verify branch toggle calculation."""
    algo_leaves = get_node_descendant_leaf_ids(sample_syllabus, "top_algo")
    assert set(algo_leaves) == {"sub_arr", "sub_stack"}

    # When 0 completed, toggle targets all to complete
    targets, target_state = determine_bulk_toggle_action(algo_leaves, set())
    assert targets == {"sub_arr", "sub_stack"}
    assert target_state is True

    # When partially completed, toggle targets all to complete
    targets, target_state = determine_bulk_toggle_action(algo_leaves, {"sub_arr"})
    assert target_state is True

    # When all completed, toggle targets all to incomplete
    targets, target_state = determine_bulk_toggle_action(
        algo_leaves, {"sub_arr", "sub_stack"}
    )
    assert target_state is False


def test_explicit_target_state_is_idempotent(sample_syllabus):
    """Verify that applying explicit target state repeatedly yields identical result."""
    algo_leaves = get_node_descendant_leaf_ids(sample_syllabus, "top_algo")

    # Explicit True repeatedly
    t1, s1 = determine_bulk_toggle_action(algo_leaves, set(), explicit_target_state=True)
    assert s1 is True
    t2, s2 = determine_bulk_toggle_action(
        algo_leaves, {"sub_arr", "sub_stack"}, explicit_target_state=True
    )
    assert s2 is True

    # Explicit False repeatedly
    t3, s3 = determine_bulk_toggle_action(
        algo_leaves, {"sub_arr", "sub_stack"}, explicit_target_state=False
    )
    assert s3 is False
