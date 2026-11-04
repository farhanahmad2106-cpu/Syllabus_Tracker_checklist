"""Integration tests for Backup Restoration endpoint and transactional integrity."""

from datetime import date
import json
import pytest
from sqlalchemy import select

from backend.app.database import (
    get_completed_leaf_ids,
    get_syllabus_record,
    get_target_deadlines,
    get_topic_note,
    get_topic_resources,
    save_syllabus,
    update_leaf_completion,
)
from backend.app.schemas import (
    AcademicYear,
    HierarchicalSyllabus,
    Module,
    Semester,
    Subject,
    Subtopic,
)


@pytest.fixture
def base_syllabus() -> HierarchicalSyllabus:
    return HierarchicalSyllabus(
        id="syl_original",
        title="Original Robotics Syllabus",
        source_filename="robotics.pdf",
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
                                id="subj_kinematics",
                                title="Forward Kinematics",
                                code="ROB101",
                                is_enrolled=True,
                                enrollment_status="mandatory",
                                modules=[
                                    Module(
                                        id="mod_dh",
                                        title="DH Parameters",
                                        contact_hours=10,
                                        topics=[
                                            Subtopic(
                                                id="top_dh_matrix",
                                                title="DH Transformation Matrix",
                                                source_text="Compute homogeneous transform",
                                            ),
                                            Subtopic(
                                                id="top_jacobian",
                                                title="Velocity Kinematics & Jacobian",
                                                source_text="Jacobian singular configurations",
                                            ),
                                        ],
                                    )
                                ],
                            )
                        ],
                    )
                ],
            )
        ],
    )


def test_restore_backup_clone_mode(client, db_session, base_syllabus):
    save_syllabus(db_session, base_syllabus)
    db_session.commit()

    # Generate a backup payload
    backup_envelope = {
        "schema_version": "2.1",
        "application": "Hierarchical Syllabus Checklist & Progress Tracker",
        "exported_at": "2026-11-04T00:00:00Z",
        "syllabus": base_syllabus.model_dump(),
        "completed_leaves": ["top_dh_matrix"],
        "notes": {
            "top_dh_matrix": "Matrix form: Rot(z, theta) * Trans(z, d) * Trans(x, a) * Rot(x, alpha)"
        },
        "resources": [
            {
                "node_id": "top_dh_matrix",
                "node_type": "subtopic",
                "title": "DH Parameters Tutorial",
                "url": "https://www.youtube.com/watch?v=rA9tm0gTln8",
                "resource_type": "youtube",
            }
        ],
        "deadlines": {
            "subj_kinematics": {
                "node_type": "subject",
                "target_date": "2026-12-15",
            }
        },
    }

    # Execute clone restore
    resp = client.post(
        "/api/syllabus/restore-backup",
        json={"backup_data": backup_envelope, "mode": "clone"},
    )
    assert resp.status_code == 200
    res_data = resp.json()
    assert res_data["success"] is True
    cloned_id = res_data["syllabus_id"]
    assert cloned_id != base_syllabus.id
    assert res_data["restored_completed_leaves"] == 1
    assert res_data["restored_notes"] == 1
    assert res_data["restored_resources"] == 1
    assert res_data["restored_deadlines"] == 1

    # Verify cloned syllabus exists in DB
    cloned_rec = get_syllabus_record(db_session, cloned_id)
    assert cloned_rec is not None
    assert "Restored" in cloned_rec.title

    # Verify completion under cloned ID
    cloned_completed = get_completed_leaf_ids(db_session, cloned_id)
    assert "top_dh_matrix" in cloned_completed

    # Verify note under cloned ID
    note = get_topic_note(db_session, cloned_id, "top_dh_matrix")
    assert note is not None
    assert "Matrix form" in note.content

    # Verify resource under cloned ID
    resources = get_topic_resources(db_session, cloned_id)
    assert len(resources) == 1
    assert resources[0].title == "DH Parameters Tutorial"

    # Verify deadline under cloned ID
    deadlines = get_target_deadlines(db_session, cloned_id)
    assert len(deadlines) == 1
    assert deadlines[0].target_date == date(2026, 12, 15)


def test_restore_backup_replace_mode(client, db_session, base_syllabus):
    save_syllabus(db_session, base_syllabus)
    # Pre-populate with old completion that should be replaced
    update_leaf_completion(db_session, base_syllabus, "top_jacobian", True)
    db_session.commit()

    backup_envelope = {
        "schema_version": "2.1",
        "syllabus": base_syllabus.model_dump(),
        "completed_leaves": ["top_dh_matrix"],
        "notes": {"top_dh_matrix": "Replaced notes"},
        "resources": [],
        "deadlines": {},
    }

    resp = client.post(
        "/api/syllabus/restore-backup",
        json={
            "backup_data": backup_envelope,
            "mode": "replace",
            "target_syllabus_id": base_syllabus.id,
        },
    )
    assert resp.status_code == 200
    res_data = resp.json()
    assert res_data["syllabus_id"] == base_syllabus.id

    # Verify old completion (top_jacobian) is gone and new completion (top_dh_matrix) is present
    completed = get_completed_leaf_ids(db_session, base_syllabus.id)
    assert "top_dh_matrix" in completed
    assert "top_jacobian" not in completed

    # Verify note replaced
    note = get_topic_note(db_session, base_syllabus.id, "top_dh_matrix")
    assert note is not None
    assert note.content == "Replaced notes"


def test_restore_backup_validations_and_orphan_handling(client, db_session, base_syllabus):
    save_syllabus(db_session, base_syllabus)
    db_session.commit()

    # 1. Invalid replace target
    resp = client.post(
        "/api/syllabus/restore-backup",
        json={
            "backup_data": {"schema_version": "2.1", "syllabus": base_syllabus.model_dump()},
            "mode": "replace",
            "target_syllabus_id": "non_existent_syl",
        },
    )
    assert resp.status_code == 422 or resp.status_code == 404

    # 2. Missing target_syllabus_id in replace mode
    resp = client.post(
        "/api/syllabus/restore-backup",
        json={
            "backup_data": {"schema_version": "2.1", "syllabus": base_syllabus.model_dump()},
            "mode": "replace",
        },
    )
    assert resp.status_code == 422

    # 3. Payload with orphan leaves and unsafe URL
    backup_with_orphans = {
        "schema_version": "2.1",
        "syllabus": base_syllabus.model_dump(),
        "completed_leaves": ["top_dh_matrix", "orphan_ghost_leaf"],
        "notes": {
            "top_dh_matrix": "Valid note",
            "orphan_ghost_leaf": "Orphan note",
        },
        "resources": [
            {
                "node_id": "top_dh_matrix",
                "node_type": "subtopic",
                "title": "Bad Link",
                "url": "javascript:alert(1)",
                "resource_type": "link",
            }
        ],
    }

    resp = client.post(
        "/api/syllabus/restore-backup",
        json={"backup_data": backup_with_orphans, "mode": "clone"},
    )
    assert resp.status_code == 200
    res_data = resp.json()
    assert res_data["restored_completed_leaves"] == 1  # orphan skipped
    assert res_data["restored_notes"] == 1  # orphan skipped
    assert res_data["restored_resources"] == 0  # unsafe URL skipped
    assert len(res_data["warnings"]) >= 3

