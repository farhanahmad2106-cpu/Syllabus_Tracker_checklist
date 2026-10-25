"""Automated tests for FastAPI endpoints."""

import io
import pytest
from backend.app.database import save_syllabus


def test_health_check_endpoint(client):
    """Verify GET /api/health returns health status and ollama diagnostics."""
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert "ollama" in data
    assert "database" in data


def test_list_and_get_syllabus_lifecycle(client, db_session, sample_syllabus):
    """Verify listing and retrieving syllabus."""
    # Initially empty
    res = client.get("/api/syllabi")
    assert res.status_code == 200
    assert len(res.json()) == 0

    # Save syllabus directly
    save_syllabus(db_session, sample_syllabus)
    db_session.commit()

    # Now list returns 1
    res = client.get("/api/syllabi")
    assert res.status_code == 200
    summaries = res.json()
    assert len(summaries) == 1
    assert summaries[0]["id"] == sample_syllabus.id

    # Retrieve syllabus
    res = client.get(f"/api/syllabus/{sample_syllabus.id}")
    assert res.status_code == 200
    data = res.json()
    assert data["syllabus"]["id"] == sample_syllabus.id
    assert len(data["completed_leaf_ids"]) == 0
    assert data["progress"]["total_leaves"] == 4


def test_get_unknown_syllabus_returns_404(client):
    """Verify GET /api/syllabus/{unknown_id} returns 404."""
    res = client.get("/api/syllabus/non_existent_syl")
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()


def test_upload_txt_syllabus_success(client):
    """Verify uploading a plain text syllabus."""
    content = (
        "Bachelor of Science in Computer Science\n"
        "Academic Year 1\n"
        "Semester 1\n"
        "Course: Python Programming\n"
        "- Control Flow and Conditionals\n"
        "- Functions and Recursion\n"
    )
    files = {"file": ("syllabus.txt", content.encode("utf-8"), "text/plain")}
    res = client.post("/api/upload", files=files)
    assert res.status_code == 201
    data = res.json()
    assert data["syllabus"]["title"] == "Bachelor of Science in Computer Science"
    assert data["progress"]["total_leaves"] == 2
    assert len(data["completed_leaf_ids"]) == 0


def test_upload_invalid_file_extension(client):
    """Verify rejecting unsupported file format."""
    files = {"file": ("script.sh", b"echo hello", "text/x-shellscript")}
    res = client.post("/api/upload", files=files)
    assert res.status_code == 400
    assert "Unsupported file format" in res.json()["detail"]


def test_toggle_leaf_endpoint(client, db_session, sample_syllabus):
    """Verify PATCH /api/syllabus/{id}/toggle-leaf."""
    save_syllabus(db_session, sample_syllabus)
    db_session.commit()

    # Complete sub_arr
    res = client.patch(
        f"/api/syllabus/{sample_syllabus.id}/toggle-leaf",
        json={"leaf_id": "sub_arr", "is_completed": True},
    )
    assert res.status_code == 200
    data = res.json()
    assert "sub_arr" in data["completed_leaf_ids"]
    assert data["progress"]["completed_leaves"] == 1
    assert data["progress"]["progress_percent"] == 25.0

    # Uncomplete sub_arr
    res = client.patch(
        f"/api/syllabus/{sample_syllabus.id}/toggle-leaf",
        json={"leaf_id": "sub_arr", "is_completed": False},
    )
    assert res.status_code == 200
    data = res.json()
    assert "sub_arr" not in data["completed_leaf_ids"]
    assert data["progress"]["completed_leaves"] == 0


def test_toggle_leaf_invalid_id_returns_422(client, db_session, sample_syllabus):
    """Verify attempting to complete invalid leaf returns 422."""
    save_syllabus(db_session, sample_syllabus)
    db_session.commit()

    res = client.patch(
        f"/api/syllabus/{sample_syllabus.id}/toggle-leaf",
        json={"leaf_id": "invalid_leaf", "is_completed": True},
    )
    assert res.status_code == 422


def test_bulk_toggle_branch_endpoint(client, db_session, sample_syllabus):
    """Verify PATCH /api/syllabus/{id}/bulk-toggle."""
    save_syllabus(db_session, sample_syllabus)
    db_session.commit()

    # Toggle whole topic top_algo (has sub_arr and sub_stack)
    res = client.patch(
        f"/api/syllabus/{sample_syllabus.id}/bulk-toggle",
        json={"node_id": "top_algo", "is_completed": True},
    )
    assert res.status_code == 200
    data = res.json()
    assert "sub_arr" in data["completed_leaf_ids"]
    assert "sub_stack" in data["completed_leaf_ids"]
    assert data["progress"]["completed_leaves"] == 2


def test_rename_syllabus_endpoint(client, db_session, sample_syllabus):
    """Verify PATCH /api/syllabus/{id} renames syllabus."""
    save_syllabus(db_session, sample_syllabus)
    db_session.commit()

    res = client.patch(
        f"/api/syllabus/{sample_syllabus.id}",
        json={"title": "Master of Science in CS"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["syllabus"]["title"] == "Master of Science in CS"


def test_delete_syllabus_endpoint(client, db_session, sample_syllabus):
    """Verify DELETE /api/syllabus/{id} removes syllabus."""
    save_syllabus(db_session, sample_syllabus)
    db_session.commit()

    res = client.delete(f"/api/syllabus/{sample_syllabus.id}")
    assert res.status_code == 204

    # Verify 404 now
    res = client.get(f"/api/syllabus/{sample_syllabus.id}")
    assert res.status_code == 404
