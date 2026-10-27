"""Document Ingestion Service coordinating parsing, chunking, extraction, validation, and persistence.
Supports both asynchronous job execution with real-time SSE progress updates and synchronous ingestion.
"""

import hashlib
import logging
import os
import time
import uuid
from typing import Optional
from sqlalchemy.orm import Session

from backend.app.database import (
    get_completed_leaf_ids,
    get_db_context,
    save_syllabus,
)
from backend.app.exceptions import DocumentParserError, ExtractionError, HierarchyValidationError
from backend.app.extractor import extract_curriculum
from backend.app.parser import parse_uploaded_file
from backend.app.progress import calculate_syllabus_progress
from backend.app.schemas import HierarchicalSyllabus, SyllabusResponse
from backend.app.services.chunking import (
    detect_semantic_chunks,
    process_chunks_with_progress,
)
from backend.app.services.job_manager import job_manager
from backend.app.validation import canonicalize_extracted_curriculum

logger = logging.getLogger(__name__)


def ingest_syllabus_document(
    session: Session,
    file_bytes: bytes,
    filename: str,
    allow_fallback_extraction: bool = True,
    model_override: Optional[str] = None,
) -> SyllabusResponse:
    """
    Synchronous ingestion pipeline (preserved for legacy callers and tests):
    1. Validation & parsing
    2. Semantic chunking & structured extraction
    3. Hierarchy canonicalization & grounding check
    4. SQLite transactional persistence
    5. Returns canonical response with initial progress
    """
    # 1. Parse document
    parsed_doc = parse_uploaded_file(file_bytes, filename)

    # Calculate content hash for deduplication
    import hashlib
    content_hash = hashlib.sha256(file_bytes).hexdigest()

    # 2. Semantic chunking & extraction
    chunks = detect_semantic_chunks(parsed_doc)
    extracted = process_chunks_with_progress(
        chunks=chunks,
        source_filename=filename,
        allow_fallback=allow_fallback_extraction,
        model_override=model_override,
        extract_fn=extract_curriculum,
    )

    # 3. Canonicalize and validate
    from sqlalchemy import select
    from backend.app.models import SyllabusRecord

    stmt = select(SyllabusRecord).where(
        SyllabusRecord.content_hash == content_hash,
        SyllabusRecord.source_filename == filename,
    )
    existing_rec = session.scalars(stmt).first()
    syllabus_id = existing_rec.id if existing_rec else f"syl_{uuid.uuid4().hex[:12]}"

    canonical_syllabus, warnings = canonicalize_extracted_curriculum(
        extracted=extracted,
        source_filename=filename,
        source_document_text=parsed_doc.raw_text or parsed_doc.text,
        syllabus_id=syllabus_id,
    )
    canonical_syllabus.content_hash = content_hash

    # 4. Save to SQLite within active transaction
    save_syllabus(session, canonical_syllabus, warnings=warnings, content_hash=content_hash)

    # 5. Compute initial progress
    completed_ids = get_completed_leaf_ids(session, canonical_syllabus.id)
    prog, node_prog = calculate_syllabus_progress(canonical_syllabus, completed_ids)

    return SyllabusResponse(
        syllabus=canonical_syllabus,
        completed_leaf_ids=list(completed_ids),
        progress=prog,
        node_progress=node_prog,
        warnings=warnings,
    )


def process_ingestion_job(
    job_id: str,
    file_path: str,
    filename: str,
    allow_fallback_extraction: bool = True,
    model_override: Optional[str] = None,
) -> None:
    """
    Asynchronous background job worker executing the complete chunked ingestion workflow:
    - Stage: validating (0-10%)
    - Stage: parsing (10-30%)
    - Stage: chunking (30-40%)
    - Stage: extracting (40-85%)
    - Stage: validating_result (85-95%)
    - Stage: persisting (95-99%)
    - Stage: completed (100%)
    
    Checks cancellation before and during each stage and performs rollback on abort.
    """
    logger.info("ingestion_job.started job_id=%s filename=%s", job_id, filename)
    start_time = time.time()

    def check_cancel() -> bool:
        if job_manager.is_cancel_requested(job_id):
            logger.info("ingestion_job.cancelled job_id=%s", job_id)
            job_manager.mark_cancelled(job_id, "Processing was cancelled by user.")
            return True
        return False

    try:
        # Check cancellation before start
        if check_cancel():
            return

        # Stage: validating
        job_manager.update(
            job_id=job_id,
            stage="validating",
            percent=5,
            message=f"Validating upload metadata for '{filename}'.",
        )

        if not os.path.exists(file_path):
            job_manager.mark_failed(job_id, f"Staged file '{file_path}' was not found on disk.")
            return

        with open(file_path, "rb") as f:
            file_bytes = f.read()

        if check_cancel():
            return

        # Stage: parsing (10-30%)
        job_manager.update(
            job_id=job_id,
            stage="parsing",
            percent=15,
            message="Parsing document layout and extracting text pages.",
        )

        parsed_doc = parse_uploaded_file(file_bytes, filename)
        job_manager.update(
            job_id=job_id,
            stage="parsing",
            percent=30,
            message=f"Successfully extracted {len(parsed_doc.text):,} characters from document.",
        )

        if check_cancel():
            return

        # Stage: chunking (30-40%)
        job_manager.update(
            job_id=job_id,
            stage="chunking",
            percent=35,
            message="Detecting academic semester and course boundaries.",
        )

        chunks = detect_semantic_chunks(parsed_doc)
        total_chunks = len(chunks)
        job_manager.update(
            job_id=job_id,
            stage="chunking",
            percent=40,
            message=f"Divided syllabus into {total_chunks} semantic extraction section(s).",
        )

        if check_cancel():
            return

        # Stage: extracting (40-85%)
        def on_chunk_progress(pct: int, msg: str) -> None:
            job_manager.update(
                job_id=job_id,
                stage="extracting",
                percent=pct,
                message=msg,
            )

        extracted = process_chunks_with_progress(
            chunks=chunks,
            source_filename=filename,
            on_progress=on_chunk_progress,
            is_cancelled=lambda: job_manager.is_cancel_requested(job_id),
            allow_fallback=allow_fallback_extraction,
            model_override=model_override,
            extract_fn=extract_curriculum,
        )

        if check_cancel():
            return

        # Stage: validating_result (85-95%)
        job_manager.update(
            job_id=job_id,
            stage="validating_result",
            percent=88,
            message="Canonicalizing 5-level hierarchy and verifying verbatim source evidence.",
        )

        content_hash = hashlib.sha256(file_bytes).hexdigest()
        from backend.app.database import get_syllabus_by_hash
        with get_db_context() as session:
            existing_rec = get_syllabus_by_hash(session, content_hash)
            syllabus_id = existing_rec.id if existing_rec else f"syl_{uuid.uuid4().hex[:12]}"

        canonical_syllabus, warnings = canonicalize_extracted_curriculum(
            extracted=extracted,
            source_filename=filename,
            source_document_text=parsed_doc.raw_text or parsed_doc.text,
            syllabus_id=syllabus_id,
        )
        canonical_syllabus.content_hash = content_hash

        job_manager.update(
            job_id=job_id,
            stage="validating_result",
            percent=95,
            message="Hierarchy validated. Preparing database transaction.",
        )

        if check_cancel():
            return

        # Stage: persisting (95-99%)
        job_manager.update(
            job_id=job_id,
            stage="persisting",
            percent=97,
            message="Saving verified syllabus and hierarchy to SQLite.",
        )

        with get_db_context() as session:
            save_syllabus(session, canonical_syllabus, warnings=warnings, content_hash=content_hash)
            completed_ids = get_completed_leaf_ids(session, canonical_syllabus.id)
            prog, node_prog = calculate_syllabus_progress(canonical_syllabus, completed_ids)

            response = SyllabusResponse(
                syllabus=canonical_syllabus,
                completed_leaf_ids=list(completed_ids),
                progress=prog,
                node_progress=node_prog,
                warnings=warnings,
            )

        # Stage: completed (100%)
        duration = time.time() - start_time
        logger.info(
            "ingestion_job.completed job_id=%s syllabus_id=%s duration=%.2fs leaves=%d",
            job_id,
            canonical_syllabus.id,
            duration,
            prog.total_leaves,
        )
        job_manager.mark_completed(
            job_id=job_id,
            result=response.model_dump(),
            message=f"Syllabus '{canonical_syllabus.title}' processed successfully in {duration:.1f}s.",
        )

    except Exception as exc:
        if job_manager.is_cancel_requested(job_id):
            logger.info("ingestion_job.cancelled_on_exception job_id=%s", job_id)
            job_manager.mark_cancelled(job_id, "Processing was cancelled by user.")
            return

        logger.error("ingestion_job.failed job_id=%s error=%s", job_id, exc, exc_info=True)
        job_manager.mark_failed(
            job_id=job_id,
            error=str(exc),
            message=f"Processing failed: {str(exc)}",
        )
