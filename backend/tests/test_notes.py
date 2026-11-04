"""Integration tests for Topic Notes API endpoints and persistence."""

from datetime import datetime, timezone
import pytest
from sqlalchemy import select

from backend.app.database import (
    delete_syllabus,
    get_completed_leaf_ids,
    get_topic_note,
    save_syllabus,
)
from backend.app.models import TopicNote
from backend.app.schemas import (
    AcademicYear,
    HierarchicalSyllabus,
    Module,
    Semester,
    Subject,
    Subtopic,
)
from backend.app.progress import calculate_syllabus_progress


@pytest.fixture
def sample_syllabus() -> HierarchicalSyllabus:
    return HierarchicalSyllabus(
        id="syl_notes_test",
        title="Notes Test Syllabus",
        source_filename="notes_test.pdf",
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
                                title="Algorithms",
                                is_enrolled=True,
                                enrollment_status="mandatory",
                                modules=[
                                    Module(
                                        id="mod_1",
                                        title="Sorting",
                                        contact_hours=10,
                                        topics=[
                                            Subtopic(
                                                id="top_quicksort",
                                                title="QuickSort Implementation",
                                                source_text="Quicksort partition algorithm",
                                            ),
                                            Subtopic(
                                                id="top_mergesort",
                                                title="MergeSort Implementation",
                                                source_text="Mergesort divide and conquer",
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


def test_note_crud_lifecycle(client, db_session, sample_syllabus):
    save_syllabus(db_session, sample_syllabus)
    db_session.commit()

    # 1. Non-existent note returns 404
    resp = client.get(f"/api/syllabus/{sample_syllabus.id}/notes/top_quicksort")
    assert resp.status_code == 404

    # 2. Save note (create)
    save_payload = {"content": "## QuickSort Cheat Sheet\n\n- Pivot selection: median-of-three\n- Time: O(n log n) average"}
    resp = client.put(f"/api/syllabus/{sample_syllabus.id}/notes/top_quicksort", json=save_payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["leaf_id"] == "top_quicksort"
    assert "QuickSort Cheat Sheet" in data["content"]
    assert data["updated_at"] is not None

    # 3. Retrieve note (GET)
    resp = client.get(f"/api/syllabus/{sample_syllabus.id}/notes/top_quicksort")
    assert resp.status_code == 200
    assert resp.json()["content"] == save_payload["content"]

    # 4. Update note
    update_payload = {"content": "Updated content with partition formula"}
    resp = client.put(f"/api/syllabus/{sample_syllabus.id}/notes/top_quicksort", json=update_payload)
    assert resp.status_code == 200
    assert resp.json()["content"] == update_payload["content"]

    # Verify db record
    note_rec = get_topic_note(db_session, sample_syllabus.id, "top_quicksort")
    assert note_rec is not None
    assert note_rec.content == update_payload["content"]

    # 5. Get all notes for syllabus
    resp = client.get(f"/api/syllabus/{sample_syllabus.id}/notes")
    assert resp.status_code == 200
    notes_list = resp.json()
    assert len(notes_list) == 1
    assert notes_list[0]["leaf_id"] == "top_quicksort"

    # 6. Delete note
    resp = client.delete(f"/api/syllabus/{sample_syllabus.id}/notes/top_quicksort")
    assert resp.status_code == 200
    assert resp.json()["status"] == "deleted"

    # 7. Verify deletion
    resp = client.get(f"/api/syllabus/{sample_syllabus.id}/notes/top_quicksort")
    assert resp.status_code == 404


def test_note_validation_and_errors(client, db_session, sample_syllabus):
    save_syllabus(db_session, sample_syllabus)
    db_session.commit()

    # Invalid leaf ID
    resp = client.get(f"/api/syllabus/{sample_syllabus.id}/notes/non_existent_leaf")
    assert resp.status_code == 422 or resp.status_code == 404

    resp = client.put(
        f"/api/syllabus/{sample_syllabus.id}/notes/non_existent_leaf",
        json={"content": "Sample"},
    )
    assert resp.status_code == 422 or resp.status_code == 404

    # Content length exceeds 50,000 characters
    oversized = "a" * 50001
    resp = client.put(
        f"/api/syllabus/{sample_syllabus.id}/notes/top_quicksort",
        json={"content": oversized},
    )
    assert resp.status_code == 422

    # Non-existent syllabus
    resp = client.get("/api/syllabus/ghost_syl/notes/top_quicksort")
    assert resp.status_code == 404


def test_note_does_not_affect_completion_progress(client, db_session, sample_syllabus):
    save_syllabus(db_session, sample_syllabus)
    db_session.commit()

    prog_before, _ = calculate_syllabus_progress(sample_syllabus, set())
    assert prog_before.progress_percent == 0.0

    # Add a note
    client.put(
        f"/api/syllabus/{sample_syllabus.id}/notes/top_quicksort",
        json={"content": "Key formula: sum = n(n+1)/2"},
    )

    completed_ids = get_completed_leaf_ids(db_session, sample_syllabus.id)
    assert len(completed_ids) == 0

    prog_after, _ = calculate_syllabus_progress(sample_syllabus, completed_ids)
    assert prog_after.progress_percent == 0.0
    assert prog_after.completed_leaves == 0


def test_note_cascade_deletion(client, db_session, sample_syllabus):
    save_syllabus(db_session, sample_syllabus)
    db_session.commit()

    client.put(
        f"/api/syllabus/{sample_syllabus.id}/notes/top_quicksort",
        json={"content": "Important note to be deleted with syllabus"},
    )

    notes = db_session.scalars(
        select(TopicNote).where(TopicNote.syllabus_id == sample_syllabus.id)
    ).all()
    assert len(notes) == 1

    # Delete syllabus
    delete_syllabus(db_session, sample_syllabus.id)
    db_session.commit()

    notes_after = db_session.scalars(
        select(TopicNote).where(TopicNote.syllabus_id == sample_syllabus.id)
    ).all()
    assert len(notes_after) == 0
