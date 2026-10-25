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


def test_upload_txt_syllabus_success(client, monkeypatch):
    """Verify uploading a plain text syllabus."""
    from backend.app.extractor import extract_curriculum_rule_based
    monkeypatch.setattr("backend.app.services.ingestion.extract_curriculum", lambda doc, **kwargs: extract_curriculum_rule_based(doc))

    content = (
        "Bachelor of Science in Computer Science\n"
        "Academic Year 1\n"
        "Semester 1\n"
        "Course: Python Programming\n"
        "- Control Flow and Conditionals\n"
        "- Functions and Recursion\n"
    )
    files = {"file": ("syllabus.txt", content.encode("utf-8"), "text/plain")}
    res = client.post("/api/upload?sync=true", files=files)
    assert res.status_code == 201
    data = res.json()
    assert data["syllabus"]["title"] == "Bachelor of Science in Computer Science"
    assert data["progress"]["total_leaves"] == 2
    assert len(data["completed_leaf_ids"]) == 0


def test_upload_invalid_file_extension(client):
    """Verify rejecting unsupported file format."""
    files = {"file": ("script.sh", b"echo hello", "text/x-shellscript")}
    res = client.post("/api/upload", files=files)
    assert res.status_code == 415
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


def test_upload_oversized_file_returns_413(client, monkeypatch):
    """Verify upload exceeding MAX_UPLOAD_SIZE_BYTES returns HTTP 413."""
    from backend.app.config import settings
    monkeypatch.setattr(settings, "MAX_UPLOAD_SIZE_BYTES", 50)
    files = {"file": ("big.txt", b"A" * 100, "text/plain")}
    res = client.post("/api/upload", files=files)
    assert res.status_code == 413
    assert "exceeds maximum" in res.json()["detail"].lower()


def test_upload_processing_timeout_returns_504(client, monkeypatch):
    """Verify timeout produces clean HTTP 504 with structured error response."""
    import asyncio

    def mock_hang(*args, **kwargs):
        raise asyncio.TimeoutError("Extraction timed out")

    monkeypatch.setattr("backend.app.main.asyncio.to_thread", lambda *args, **kwargs: mock_hang())
    files = {"file": ("syllabus.txt", b"CS101 Topics\n- Intro", "text/plain")}
    res = client.post("/api/upload?sync=true", files=files)
    assert res.status_code == 504
    data = res.json()
    assert data["code"] == "DOCUMENT_PROCESSING_TIMEOUT"
    assert data["retryable"] is True


def test_upload_oserror_resource_exhausted_returns_503(client, monkeypatch):
    """Verify OSError [WinError 1450] produces clean HTTP 503 rather than unhandled crash."""
    def mock_resource_error(*args, **kwargs):
        raise OSError(1450, "Insufficient system resources exist to complete the requested service")

    monkeypatch.setattr("backend.app.main.ingest_syllabus_document", mock_resource_error)
    files = {"file": ("syllabus.txt", b"CS101 Topics\n- Intro", "text/plain")}
    res = client.post("/api/upload?sync=true", files=files)
    assert res.status_code == 503
    data = res.json()
    assert data["code"] == "SYSTEM_RESOURCE_EXHAUSTED"
    assert data["retryable"] is True


def test_upload_async_job_and_polling(client, monkeypatch):
    """Verify POST /api/upload returns 202 Accepted with job_id and GET /api/upload/jobs/{id} returns status."""
    from backend.app.extractor import extract_curriculum_rule_based
    monkeypatch.setattr("backend.app.services.ingestion.extract_curriculum", lambda doc, **kwargs: extract_curriculum_rule_based(doc))

    content = "Computer Science\nYear 1\nSemester 1\nCourse 101\n- Topic A\n- Topic B\n"
    files = {"file": ("async_syllabus.txt", content.encode("utf-8"), "text/plain")}
    res = client.post("/api/upload", files=files)
    assert res.status_code == 202
    data = res.json()
    assert "job_id" in data
    assert data["stage"] == "queued"
    assert data["percent"] == 0

    job_id = data["job_id"]
    # Poll job status
    poll_res = client.get(f"/api/upload/jobs/{job_id}")
    assert poll_res.status_code == 200
    poll_data = poll_res.json()
    assert poll_data["job_id"] == job_id
    assert poll_data["stage"] in [
        "queued", "validating", "parsing", "chunking", "extracting",
        "validating_result", "persisting", "completed"
    ]


def test_upload_job_cancellation_endpoint(client, monkeypatch):
    """Verify POST /api/upload/jobs/{id}/cancel requests cancellation."""
    from backend.app.extractor import extract_curriculum_rule_based
    monkeypatch.setattr("backend.app.services.ingestion.extract_curriculum", lambda doc, **kwargs: extract_curriculum_rule_based(doc))

    content = "Mathematics\nYear 1\nSemester 1\nCalculus\n- Limits\n"
    files = {"file": ("math.txt", content.encode("utf-8"), "text/plain")}
    res = client.post("/api/upload", files=files)
    assert res.status_code == 202
    job_id = res.json()["job_id"]

    cancel_res = client.post(f"/api/upload/jobs/{job_id}/cancel")
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] in ["cancellation_requested", "already_terminal"]


def test_upload_unknown_job_returns_404(client):
    """Verify 404 for nonexistent job IDs."""
    res = client.get("/api/upload/jobs/00000000-0000-0000-0000-000000000000")
    assert res.status_code == 404

    res2 = client.get("/api/upload/progress/00000000-0000-0000-0000-000000000000")
    assert res2.status_code == 404

    res3 = client.post("/api/upload/jobs/00000000-0000-0000-0000-000000000000/cancel")
    assert res3.status_code == 404


def test_upload_progress_sse_stream_initial_event(client):
    """Verify SSE endpoint streams initial progress event with valid framing."""
    from backend.app.services.job_manager import job_manager
    job = job_manager.create_job(initial_message="Initial test queue.")
    job_manager.mark_completed(job.job_id, result={}, message="Completed test.")

    with client.stream("GET", f"/api/upload/progress/{job.job_id}") as response:
        assert response.status_code == 200
        assert "text/event-stream" in response.headers["content-type"]
        first_line = next(response.iter_lines())
        assert first_line.startswith("id: ")


