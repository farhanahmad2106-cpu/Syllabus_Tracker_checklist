"""Integration tests for Deadline & Study Pacing REST API endpoints (Section 14)."""

from datetime import date, datetime, timezone
import pytest
from sqlalchemy import select

from backend.app.database import (
    get_completed_leaf_ids,
    get_target_deadlines,
    save_syllabus,
    update_leaf_completion,
)
from backend.app.models import TargetDeadline
from backend.app.schemas import (
    AcademicYear,
    HierarchicalSyllabus,
    Module,
    Semester,
    Subject,
    Subtopic,
)


@pytest.fixture
def detailed_syllabus() -> HierarchicalSyllabus:
    """Fixture providing a canonical 5-tier syllabus with mandatory and elective courses."""
    return HierarchicalSyllabus(
        id="syl_adv_cs",
        title="B.Sc. Advanced Computer Science",
        source_filename="adv_cs.pdf",
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
                                id="subj_algo",
                                title="Algorithms & Complexity",
                                is_enrolled=True,
                                enrollment_status="mandatory",
                                modules=[
                                    Module(
                                        id="mod_algo_1",
                                        title="Sorting & Searching",
                                        contact_hours=20,
                                        topics=[
                                            Subtopic(
                                                id="top_sort",
                                                title="QuickSort & MergeSort",
                                                source_text="Study sorting algorithms in depth",
                                                source_page=1,
                                            ),
                                            Subtopic(
                                                id="top_search",
                                                title="Binary Search Trees",
                                                source_text="Study balanced BSTs",
                                                source_page=2,
                                            ),
                                        ],
                                    ),
                                    Module(
                                        id="mod_algo_2",
                                        title="Dynamic Programming",
                                        contact_hours=10,
                                        topics=[
                                            Subtopic(
                                                id="top_dp",
                                                title="Knapsack & Shortest Path",
                                                source_text="Study dynamic programming paradigms",
                                                source_page=3,
                                            ),
                                        ],
                                    ),
                                ],
                            ),
                            Subject(
                                id="subj_elec_ai",
                                title="Elective: Intro to AI",
                                is_elective=True,
                                is_enrolled=False,
                                enrollment_status="excluded",
                                modules=[
                                    Module(
                                        id="mod_ai_1",
                                        title="Heuristics",
                                        contact_hours=15,
                                        topics=[
                                            Subtopic(
                                                id="top_astar",
                                                title="A* Search",
                                                source_text="Study heuristic search",
                                                source_page=4,
                                            ),
                                        ],
                                    ),
                                ],
                            ),
                        ],
                    ),
                    Semester(
                        id="sem_2",
                        title="Semester 2",
                        order_index=1,
                        subjects=[
                            Subject(
                                id="subj_db",
                                title="Distributed Databases",
                                is_enrolled=True,
                                enrollment_status="mandatory",
                                modules=[
                                    Module(
                                        id="mod_db_1",
                                        title="Replication",
                                        contact_hours=25,
                                        topics=[
                                            Subtopic(
                                                id="top_raft",
                                                title="Raft Consensus",
                                                source_text="Consensus protocols",
                                                source_page=5,
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


# -----------------------------------------------------------------------------
# Tests
# -----------------------------------------------------------------------------

def test_pacing_lifecycle_endpoints(client, db_session, detailed_syllabus):
    """Verify setting, updating, retrieving summary, and clearing deadlines."""
    save_syllabus(db_session, detailed_syllabus)
    db_session.commit()
    s_id = detailed_syllabus.id

    # 1. Summary starts empty
    res = client.get(f"/api/syllabus/{s_id}/pacing")
    assert res.status_code == 200
    data = res.json()
    assert data["syllabus_id"] == s_id
    assert data["deadlines"] == {}

    # 2. Set Subject deadline
    res_sub = client.post(
        f"/api/syllabus/{s_id}/deadline",
        json={"node_id": "subj_algo", "node_type": "subject", "target_date": "2026-12-01"},
    )
    assert res_sub.status_code == 200
    metrics_sub = res_sub.json()
    assert metrics_sub["node_id"] == "subj_algo"
    assert metrics_sub["target_date"] == "2026-12-01"
    assert metrics_sub["total_leaves"] == 3
    assert metrics_sub["completed_leaves"] == 0
    assert metrics_sub["remaining_leaves"] == 3
    assert metrics_sub["remaining_contact_hours"] == 30.0

    # 3. Set Semester deadline
    res_sem = client.post(
        f"/api/syllabus/{s_id}/deadline",
        json={"node_id": "sem_1", "node_type": "semester", "target_date": "2026-12-15"},
    )
    assert res_sem.status_code == 200
    metrics_sem = res_sem.json()
    assert metrics_sem["node_id"] == "sem_1"
    # sem_1 has 3 leaves from subj_algo (excluded elective subj_elec_ai contributes 0)
    assert metrics_sem["total_leaves"] == 3
    assert metrics_sem["remaining_contact_hours"] == 30.0

    # 4. Summary now has both deadlines
    res_summary = client.get(f"/api/syllabus/{s_id}/pacing")
    assert res_summary.status_code == 200
    summary_data = res_summary.json()
    assert len(summary_data["deadlines"]) == 2
    assert "subj_algo" in summary_data["deadlines"]
    assert "sem_1" in summary_data["deadlines"]

    # 5. Update deadline via upsert (same node_id)
    res_update = client.post(
        f"/api/syllabus/{s_id}/deadline",
        json={"node_id": "subj_algo", "node_type": "subject", "target_date": "2026-12-25"},
    )
    assert res_update.status_code == 200
    assert res_update.json()["target_date"] == "2026-12-25"

    # Verify no duplicate rows in DB
    deadlines = db_session.scalars(
        select(TargetDeadline).where(TargetDeadline.syllabus_id == s_id, TargetDeadline.node_id == "subj_algo")
    ).all()
    assert len(deadlines) == 1

    # 6. Clear deadline
    res_clear = client.delete(f"/api/syllabus/{s_id}/deadline/subj_algo")
    assert res_clear.status_code == 200
    assert res_clear.json() == {"status": "cleared", "node_id": "subj_algo"}

    # Summary has only sem_1 now
    res_after_clear = client.get(f"/api/syllabus/{s_id}/pacing")
    assert "subj_algo" not in res_after_clear.json()["deadlines"]
    assert "sem_1" in res_after_clear.json()["deadlines"]

    # 7. Clear already absent deadline is idempotent
    res_clear_again = client.delete(f"/api/syllabus/{s_id}/deadline/subj_algo")
    assert res_clear_again.status_code == 200
    assert res_clear_again.json() == {"status": "cleared", "node_id": "subj_algo"}


def test_api_validations_and_rejections(client, db_session, detailed_syllabus):
    """Verify input validation and failure contract."""
    save_syllabus(db_session, detailed_syllabus)
    db_session.commit()
    s_id = detailed_syllabus.id

    # 8. Reject invalid date input (422)
    res = client.post(
        f"/api/syllabus/{s_id}/deadline",
        json={"node_id": "subj_algo", "node_type": "subject", "target_date": "not-a-date"},
    )
    assert res.status_code == 422

    # 9. Reject unsupported node type (422)
    res = client.post(
        f"/api/syllabus/{s_id}/deadline",
        json={"node_id": "mod_algo_1", "node_type": "module", "target_date": "2026-12-01"},
    )
    assert res.status_code == 422

    # 10. Reject nonexistent node ID (404)
    res = client.post(
        f"/api/syllabus/{s_id}/deadline",
        json={"node_id": "nonexistent_node", "node_type": "subject", "target_date": "2026-12-01"},
    )
    assert res.status_code == 404

    # 11. Reject node-type mismatch (422) - sem_1 is semester, not subject
    res = client.post(
        f"/api/syllabus/{s_id}/deadline",
        json={"node_id": "sem_1", "node_type": "subject", "target_date": "2026-12-01"},
    )
    assert res.status_code == 422
    assert "mismatch" in res.json()["detail"].lower()

    # 12. Reject excluded elective target (422)
    res = client.post(
        f"/api/syllabus/{s_id}/deadline",
        json={"node_id": "subj_elec_ai", "node_type": "subject", "target_date": "2026-12-01"},
    )
    assert res.status_code == 422
    assert "excluded" in res.json()["detail"].lower()

    # 13. Nonexistent syllabus (404)
    res = client.get("/api/syllabus/unknown_syl/pacing")
    assert res.status_code == 404

    res = client.post(
        "/api/syllabus/unknown_syl/deadline",
        json={"node_id": "subj_algo", "node_type": "subject", "target_date": "2026-12-01"},
    )
    assert res.status_code == 404

    res = client.delete("/api/syllabus/unknown_syl/deadline/subj_algo")
    assert res.status_code == 404


def test_cross_syllabus_isolation(client, db_session, detailed_syllabus, sample_syllabus):
    """Verify that deadlines for different syllabi are strictly isolated."""
    save_syllabus(db_session, detailed_syllabus)
    save_syllabus(db_session, sample_syllabus)
    db_session.commit()

    # Set deadline on detailed_syllabus
    client.post(
        f"/api/syllabus/{detailed_syllabus.id}/deadline",
        json={"node_id": "subj_algo", "node_type": "subject", "target_date": "2026-12-01"},
    )

    # Cross-syllabus node identifier: trying to set subj_algo on sample_syllabus fails with 404
    res = client.post(
        f"/api/syllabus/{sample_syllabus.id}/deadline",
        json={"node_id": "subj_algo", "node_type": "subject", "target_date": "2026-12-01"},
    )
    assert res.status_code == 404

    # Sample syllabus pacing summary does not see detailed syllabus deadlines
    res_samp = client.get(f"/api/syllabus/{sample_syllabus.id}/pacing")
    assert res_samp.status_code == 200
    assert res_samp.json()["deadlines"] == {}


def test_syllabus_cascade_deletion_removes_deadlines(client, db_session, detailed_syllabus):
    """Verify deleting a syllabus cascades to its deadline records in SQLite."""
    save_syllabus(db_session, detailed_syllabus)
    db_session.commit()
    s_id = detailed_syllabus.id

    client.post(
        f"/api/syllabus/{s_id}/deadline",
        json={"node_id": "subj_algo", "node_type": "subject", "target_date": "2026-12-01"},
    )

    # Verify deadline exists
    deadlines = db_session.scalars(
        select(TargetDeadline).where(TargetDeadline.syllabus_id == s_id)
    ).all()
    assert len(deadlines) == 1

    # Delete syllabus
    res = client.delete(f"/api/syllabus/{s_id}")
    assert res.status_code == 204

    # Verify deadline rows were completely removed
    deadlines_after = db_session.scalars(
        select(TargetDeadline).where(TargetDeadline.syllabus_id == s_id)
    ).all()
    assert len(deadlines_after) == 0


def test_canonical_completion_and_progress_isolation(client, db_session, detailed_syllabus):
    """Verify deadlines NEVER alter canonical completion counts or progress percentages."""
    save_syllabus(db_session, detailed_syllabus)
    db_session.commit()
    s_id = detailed_syllabus.id

    # Retrieve initial syllabus response
    res_init = client.get(f"/api/syllabus/{s_id}")
    prog_init = res_init.json()["progress"]
    assert prog_init["completed_leaves"] == 0
    assert prog_init["progress_percent"] == 0.0

    # Add deadlines
    client.post(
        f"/api/syllabus/{s_id}/deadline",
        json={"node_id": "subj_algo", "node_type": "subject", "target_date": "2026-12-01"},
    )
    client.post(
        f"/api/syllabus/{s_id}/deadline",
        json={"node_id": "sem_1", "node_type": "semester", "target_date": "2026-12-15"},
    )

    # Canonical syllabus progress remains strictly 0.0%
    res_after_deadline = client.get(f"/api/syllabus/{s_id}")
    prog_after = res_after_deadline.json()["progress"]
    assert prog_after["completed_leaves"] == 0
    assert prog_after["progress_percent"] == 0.0

    # Toggle one leaf: top_sort
    res_toggle_call = client.patch(
        f"/api/syllabus/{s_id}/toggle-leaf",
        json={"leaf_id": "top_sort", "is_completed": True},
    )
    assert res_toggle_call.status_code == 200

    # Canonical syllabus progress updated
    res_after_toggle = client.get(f"/api/syllabus/{s_id}")
    prog_toggle = res_after_toggle.json()["progress"]
    assert prog_toggle["completed_leaves"] == 1

    # Pacing summary dynamically reflects updated completion
    res_pacing = client.get(f"/api/syllabus/{s_id}/pacing")
    pacing_data = res_pacing.json()
    algo_metrics = pacing_data["deadlines"]["subj_algo"]
    assert algo_metrics["completed_leaves"] == 1
    assert algo_metrics["remaining_leaves"] == 2
    # mod_algo_1 had 2 leaves, 1 completed (50% done) -> 10 hrs remaining
    # mod_algo_2 has 1 leaf, 0 completed -> 10 hrs remaining
    # total remaining contact hours = 20.0
    assert algo_metrics["remaining_contact_hours"] == 20.0
