"""Unit tests for JobManager: concurrency, monotonicity, stage transitions, and cancellation."""

import time
import pytest
from backend.app.services.job_manager import JobManager, JobProgress


def test_job_manager_create_and_get():
    """Verify job registration and immutable snapshot retrieval."""
    jm = JobManager()
    job = jm.create_job(initial_message="Initial queue")
    assert job.job_id is not None
    assert job.stage == "queued"
    assert job.percent == 0

    retrieved = jm.get(job.job_id)
    assert retrieved is not None
    assert retrieved.job_id == job.job_id

    # Verify immutability: mutating retrieved copy does not mutate internal job
    retrieved.percent = 99
    fresh = jm.get(job.job_id)
    assert fresh.percent == 0


def test_job_manager_monotonic_progress():
    """Verify that job progress percent can never decrease."""
    jm = JobManager()
    job = jm.create_job()

    jm.update(job.job_id, stage="parsing", percent=25)
    assert jm.get(job.job_id).percent == 25

    # Attempt to decrease to 10
    jm.update(job.job_id, percent=10)
    assert jm.get(job.job_id).percent == 25

    # Increase to 60
    jm.update(job.job_id, percent=60)
    assert jm.get(job.job_id).percent == 60


def test_job_manager_terminal_immutability():
    """Verify that a job in a terminal stage cannot transition back to active stages."""
    jm = JobManager()
    job = jm.create_job()

    jm.mark_completed(job.job_id, result={"syllabus": "done"})
    assert jm.get(job.job_id).stage == "completed"
    assert jm.get(job.job_id).percent == 100

    # Attempt to update completed job
    jm.update(job.job_id, stage="parsing", percent=10)
    assert jm.get(job.job_id).stage == "completed"
    assert jm.get(job.job_id).percent == 100


def test_job_manager_cancellation():
    """Verify requesting cancellation marks cancel_requested and mark_cancelled transitions."""
    jm = JobManager()
    job = jm.create_job()

    assert not jm.is_cancel_requested(job.job_id)
    assert jm.request_cancel(job.job_id) is True
    assert jm.is_cancel_requested(job.job_id) is True

    jm.mark_cancelled(job.job_id, "User cancelled")
    snapshot = jm.get(job.job_id)
    assert snapshot.stage == "cancelled"
    assert "User cancelled" in snapshot.message
