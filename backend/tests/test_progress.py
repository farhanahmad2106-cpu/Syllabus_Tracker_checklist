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


def test_five_level_hierarchy_descendant_traversal():
    """Verify descendant leaf ID resolution across all 5 tiers: Year -> Semester -> Subject -> Module -> Topic."""
    from backend.app.schemas import (
        AcademicYear,
        HierarchicalSyllabus,
        Module,
        Semester,
        Subject,
        Subtopic,
    )

    syl = HierarchicalSyllabus(
        id="syl_5tier",
        title="B.Tech AI & Data Science",
        source_filename="syllabus_5tier.pdf",
        years=[
            AcademicYear(
                id="yr_1",
                title="Year 1",
                semesters=[
                    Semester(
                        id="sem_1",
                        title="Semester 1",
                        subjects=[
                            Subject(
                                id="sub_cs101",
                                code="CS101",
                                title="Data Structures",
                                modules=[
                                    Module(
                                        id="mod_1",
                                        module_number="Module 1",
                                        title="Linear Structures",
                                        topics=[
                                            Subtopic(id="top_1", title="Arrays", source_text="Arrays"),
                                            Subtopic(id="top_2", title="Linked Lists", source_text="Linked Lists"),
                                        ],
                                    ),
                                    Module(
                                        id="mod_2",
                                        module_number="Module 2",
                                        title="Non-Linear Structures",
                                        topics=[
                                            Subtopic(id="top_3", title="Trees", source_text="Trees"),
                                        ],
                                    ),
                                ],
                            ),
                        ],
                    ),
                    Semester(
                        id="sem_2",
                        title="Semester 2",
                        subjects=[
                            Subject(
                                id="sub_cs102",
                                code="CS102",
                                title="Algorithms",
                                modules=[
                                    Module(
                                        id="mod_3",
                                        module_number="Module 1",
                                        title="Sorting",
                                        topics=[
                                            Subtopic(id="top_4", title="Quicksort", source_text="Quicksort"),
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

    # 1. Year level
    yr_leaves = get_node_descendant_leaf_ids(syl, "yr_1")
    assert yr_leaves == ["top_1", "top_2", "top_3", "top_4"]

    # 2. Semester level
    sem1_leaves = get_node_descendant_leaf_ids(syl, "sem_1")
    assert sem1_leaves == ["top_1", "top_2", "top_3"]

    # 3. Subject level
    subj_leaves = get_node_descendant_leaf_ids(syl, "sub_cs101")
    assert subj_leaves == ["top_1", "top_2", "top_3"]

    # 4. Module level
    mod1_leaves = get_node_descendant_leaf_ids(syl, "mod_1")
    assert mod1_leaves == ["top_1", "top_2"]
    mod2_leaves = get_node_descendant_leaf_ids(syl, "mod_2")
    assert mod2_leaves == ["top_3"]

    # 5. Topic leaf itself
    top_leaf = get_node_descendant_leaf_ids(syl, "top_1")
    assert top_leaf == ["top_1"]

    # 6. Invalid ID returns empty list
    assert get_node_descendant_leaf_ids(syl, "non_existent_id") == []

    # 7. Progress calculation across 5 tiers
    prog, node_prog = calculate_syllabus_progress(syl, {"top_1", "top_2"})
    assert prog.completed_leaves == 2
    assert prog.total_leaves == 4
    assert prog.progress_percent == 50.0

    # Module 1: 2/2 -> 100%
    assert node_prog["mod_1"].completed_leaves == 2
    assert node_prog["mod_1"].progress_percent == 100.0
    # Module 2: 0/1 -> 0%
    assert node_prog["mod_2"].completed_leaves == 0
    assert node_prog["mod_2"].progress_percent == 0.0
    # Subject: 2/3 -> 66.7%
    assert node_prog["sub_cs101"].completed_leaves == 2
    assert node_prog["sub_cs101"].progress_percent == 66.7
    # Semester 1: 2/3 -> 66.7%
    assert node_prog["sem_1"].completed_leaves == 2
    assert node_prog["sem_1"].progress_percent == 66.7
    # Year 1: 2/4 -> 50%
    assert node_prog["yr_1"].completed_leaves == 2
    assert node_prog["yr_1"].progress_percent == 50.0

