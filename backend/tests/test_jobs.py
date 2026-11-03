"""Unit tests for asynchronous job lifecycle and progress management."""

import pytest
from backend.app.services.job_manager import JobManager, JobProgress


def test_job_lifecycle_monotonic_progress():
    """Verify that job progress increases monotonically and never regresses."""
    jm = JobManager()
    job = jm.create_job()

    assert job.stage == "queued"
    assert job.percent == 0

    # Advance to validating 10%
    s1 = jm.update(job.job_id, stage="validating", percent=10, message="Validating")
    assert s1 is not None
    assert s1.percent == 10

    # Attempt to regress percent to 5% -> should be ignored, remain 10%
    s2 = jm.update(job.job_id, stage="parsing", percent=5, message="Parsing")
    assert s2 is not None
    assert s2.percent == 10
    assert s2.stage == "parsing"

    # Advance to extracting 50%
    s3 = jm.update(job.job_id, stage="extracting", percent=50, message="Extracting")
    assert s3 is not None
    assert s3.percent == 50


def test_terminal_state_immutability():
    """Verify that terminal states (completed, failed, cancelled) cannot be overwritten."""
    jm = JobManager()
    job = jm.create_job()

    jm.mark_completed(job.job_id, result={"syllabus_id": "syl_123"}, message="Done")
    completed = jm.get(job.job_id)
    assert completed is not None
    assert completed.stage == "completed"
    assert completed.percent == 100

    # Attempt to update after completed -> should return current completed snapshot without mutation
    attempt = jm.update(job.job_id, stage="validating", percent=20)
    assert attempt is not None
    assert attempt.stage == "completed"
    assert attempt.percent == 100


def test_cooperative_cancellation():
    """Verify cancellation request tracking and transition to cancelled."""
    jm = JobManager()
    job = jm.create_job()

    assert jm.is_cancel_requested(job.job_id) is False
    success = jm.request_cancel(job.job_id)
    assert success is True
    assert jm.is_cancel_requested(job.job_id) is True

    jm.mark_cancelled(job.job_id, "User aborted upload")
    cancelled = jm.get(job.job_id)
    assert cancelled is not None
    assert cancelled.stage == "cancelled"

