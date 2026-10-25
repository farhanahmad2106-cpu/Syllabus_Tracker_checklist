"""Background Ingestion Job Manager providing thread-safe state tracking,
monitored stage transitions, monotonic progress reporting, and SSE event dispatch.
"""

import asyncio
import logging
import os
import shutil
import threading
import time
import uuid
from typing import Any, Callable, Dict, List, Optional, Set
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# Valid operational stages in sequential order
VALID_STAGES: Set[str] = {
    "queued",
    "validating",
    "parsing",
    "chunking",
    "extracting",
    "validating_result",
    "persisting",
    "completed",
    "failed",
    "cancelled",
}

TERMINAL_STAGES: Set[str] = {"completed", "failed", "cancelled"}


class JobProgress(BaseModel):
    """Immutable state snapshot for an upload ingestion job."""
    job_id: str
    stage: str = "queued"
    percent: int = Field(default=0, ge=0, le=100)
    message: str = "Waiting for processing."
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    created_at: float = Field(default_factory=time.time)
    updated_at: float = Field(default_factory=time.time)
    cancel_requested: bool = False
    staging_file_path: Optional[str] = None
    staging_dir_path: Optional[str] = None


class JobManager:
    """
    Thread-safe and async-aware Ingestion Job Manager.
    
    Guarantees:
    - Atomicity of state mutations.
    - Monotonic progress (percent never decreases).
    - Immutability of terminal states (completed, failed, cancelled).
    - Event queues for pushing real-time Server-Sent Events (SSE).
    - Safe cleanup of staged files upon terminal states.
    """

    def __init__(self, max_concurrent_jobs: int = 2, default_retention_seconds: int = 3600):
        self._lock = threading.RLock()
        self._jobs: Dict[str, JobProgress] = {}
        self._subscribers: Dict[str, List[asyncio.Queue]] = {}
        self._max_concurrent = max_concurrent_jobs
        self._retention_seconds = default_retention_seconds

    def create_job(
        self,
        staging_file_path: Optional[str] = None,
        staging_dir_path: Optional[str] = None,
        initial_message: str = "Upload accepted. Waiting for document processing.",
    ) -> JobProgress:
        """Register a new ingestion job with initial 'queued' state."""
        with self._lock:
            job_id = str(uuid.uuid4())
            now = time.time()
            job = JobProgress(
                job_id=job_id,
                stage="queued",
                percent=0,
                message=initial_message,
                created_at=now,
                updated_at=now,
                cancel_requested=False,
                staging_file_path=staging_file_path,
                staging_dir_path=staging_dir_path,
            )
            self._jobs[job_id] = job
            self._subscribers[job_id] = []
            logger.info("job_manager.job_created job_id=%s stage=queued", job_id)
            return job.model_copy()

    def get(self, job_id: str) -> Optional[JobProgress]:
        """Retrieve an immutable snapshot of current job progress."""
        with self._lock:
            job = self._jobs.get(job_id)
            return job.model_copy() if job else None

    def update(
        self,
        job_id: str,
        stage: Optional[str] = None,
        percent: Optional[int] = None,
        message: Optional[str] = None,
        result: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None,
    ) -> Optional[JobProgress]:
        """
        Atomically update job progress.
        
        Enforces:
        - Valid stages.
        - Terminal immutability.
        - Monotonic percent (cannot decrease).
        - Clamping percent between 0 and 100.
        """
        subscribers_to_notify = []
        with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                logger.warning("job_manager.update_not_found job_id=%s", job_id)
                return None

            if job.stage in TERMINAL_STAGES:
                logger.debug(
                    "job_manager.update_ignored_terminal job_id=%s current_stage=%s attempted_stage=%s",
                    job_id,
                    job.stage,
                    stage,
                )
                return job.model_copy()

            if stage is not None:
                if stage not in VALID_STAGES:
                    raise ValueError(f"Invalid job stage '{stage}'. Must be one of {VALID_STAGES}")
                job.stage = stage

            if percent is not None:
                clamped = max(0, min(100, int(percent)))
                # Monotonic rule: percent must never decrease
                if clamped >= job.percent:
                    job.percent = clamped

            if message is not None:
                job.message = message

            if result is not None:
                job.result = result

            if error is not None:
                job.error = error

            job.updated_at = time.time()
            snapshot = job.model_copy()

            # Copy subscribers to notify outside lock
            subscribers_to_notify = list(self._subscribers.get(job_id, []))

        # Push to async SSE queues
        self._dispatch_to_subscribers(subscribers_to_notify, snapshot)
        return snapshot

    def mark_completed(self, job_id: str, result: Dict[str, Any], message: str = "Syllabus processed and saved successfully.") -> Optional[JobProgress]:
        """Transition job to completed terminal state."""
        snapshot = self.update(
            job_id=job_id,
            stage="completed",
            percent=100,
            message=message,
            result=result,
        )
        self._cleanup_staging(job_id)
        return snapshot

    def mark_failed(self, job_id: str, error: str, message: Optional[str] = None) -> Optional[JobProgress]:
        """Transition job to failed terminal state."""
        msg = message or f"Processing failed: {error}"
        snapshot = self.update(
            job_id=job_id,
            stage="failed",
            message=msg,
            error=error,
        )
        self._cleanup_staging(job_id)
        return snapshot

    def request_cancel(self, job_id: str) -> bool:
        """Mark cancellation requested for a job."""
        with self._lock:
            job = self._jobs.get(job_id)
            if not job or job.stage in TERMINAL_STAGES:
                return False
            job.cancel_requested = True
            job.message = "Cancellation requested. Cleaning up..."
            job.updated_at = time.time()
            snapshot = job.model_copy()
            subscribers = list(self._subscribers.get(job_id, []))

        self._dispatch_to_subscribers(subscribers, snapshot)
        logger.info("job_manager.cancel_requested job_id=%s", job_id)
        return True

    def mark_cancelled(self, job_id: str, message: str = "Processing cancelled by user.") -> Optional[JobProgress]:
        """Transition job to cancelled terminal state."""
        snapshot = self.update(
            job_id=job_id,
            stage="cancelled",
            message=message,
        )
        self._cleanup_staging(job_id)
        return snapshot

    def is_cancel_requested(self, job_id: str) -> bool:
        """Check if cancellation was requested for a job."""
        with self._lock:
            job = self._jobs.get(job_id)
            return job.cancel_requested if job else False

    def subscribe(self, job_id: str) -> Optional[asyncio.Queue]:
        """Register an async SSE listener queue for a job."""
        with self._lock:
            if job_id not in self._jobs:
                return None
            queue: asyncio.Queue = asyncio.Queue()
            self._subscribers.setdefault(job_id, []).append(queue)
            return queue

    def unsubscribe(self, job_id: str, queue: asyncio.Queue) -> None:
        """Remove an async SSE listener queue for a job."""
        with self._lock:
            if job_id in self._subscribers and queue in self._subscribers[job_id]:
                self._subscribers[job_id].remove(queue)

    def _dispatch_to_subscribers(self, subscribers: List[asyncio.Queue], snapshot: JobProgress) -> None:
        """Put snapshot into subscriber queues safely."""
        for q in subscribers:
            try:
                q.put_nowait(snapshot)
            except Exception:
                pass

    def _cleanup_staging(self, job_id: str) -> None:
        """Clean up staging files/directories owned by this job."""
        with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return
            staging_file = job.staging_file_path
            staging_dir = job.staging_dir_path

        if staging_file and os.path.exists(staging_file):
            try:
                os.remove(staging_file)
                logger.debug("job_manager.cleaned_staging_file job_id=%s path=%s", job_id, staging_file)
            except Exception as e:
                logger.warning("job_manager.clean_file_failed job_id=%s error=%s", job_id, e)

        if staging_dir and os.path.exists(staging_dir):
            try:
                shutil.rmtree(staging_dir, ignore_errors=True)
                logger.debug("job_manager.cleaned_staging_dir job_id=%s path=%s", job_id, staging_dir)
            except Exception as e:
                logger.warning("job_manager.clean_dir_failed job_id=%s error=%s", job_id, e)

    def cleanup_expired_jobs(self, max_age_seconds: Optional[int] = None) -> int:
        """Purge jobs that completed/failed/cancelled older than retention limit."""
        max_age = max_age_seconds or self._retention_seconds
        now = time.time()
        to_remove = []

        with self._lock:
            for jid, job in self._jobs.items():
                if job.stage in TERMINAL_STAGES and (now - job.updated_at) > max_age:
                    to_remove.append(jid)

            for jid in to_remove:
                self._cleanup_staging(jid)
                self._jobs.pop(jid, None)
                self._subscribers.pop(jid, None)

        if to_remove:
            logger.info("job_manager.purged_expired_jobs count=%d", len(to_remove))
        return len(to_remove)


# Singleton job manager instance
job_manager = JobManager()
