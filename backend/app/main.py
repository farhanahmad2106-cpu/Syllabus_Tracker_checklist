"""FastAPI entrypoint and API router implementation for the Syllabus Tracker."""

import asyncio
import json
import logging
import os
import shutil
import tempfile
import uuid
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional, Union

from fastapi import Depends, FastAPI, File, HTTPException, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.app.config import settings
from backend.app.database import (
    delete_syllabus,
    delete_target_deadline,
    finalize_syllabus_enrollment,
    get_completed_leaf_ids,
    get_db,
    get_syllabus_record,
    get_syllabus_review,
    get_target_deadline,
    get_target_deadlines,
    init_db,
    list_syllabi_summaries,
    update_bulk_completion,
    update_leaf_completion,
    update_syllabus_title,
    upsert_target_deadline,
)
from backend.app.exceptions import (
    DocumentParserError,
    ExtractionError,
    FileValidationError,
    HierarchyValidationError,
    InvalidLeafError,
    InvalidNodeError,
    SyllabusNotFoundError,
    SyllabusTrackerError,
)
from backend.app.extractor import (
    check_ollama_status,
    check_provider_status,
    get_preferred_model,
)
from backend.app.progress import (
    calculate_syllabus_progress,
    determine_bulk_toggle_action,
    get_node_descendant_leaf_ids,
    is_subject_enrolled,
    node_exists_in_syllabus,
)
from backend.app.schemas import (
    AppConfigResponse,
    BulkToggleRequest,
    FinalizeEnrollmentRequest,
    HierarchicalSyllabus,
    JobProgressResponse,
    LeafToggleRequest,
    PacingMetrics,
    ParseReviewResponse,
    SetTargetDateRequest,
    StartUploadResponse,
    SyllabusPacingSummaryResponse,
    SyllabusRenameRequest,
    SyllabusResponse,
    SyllabusSummary,
)
from backend.app.parser import validate_file_metadata
from backend.app.services.ingestion import ingest_syllabus_document, process_ingestion_job
from backend.app.services.job_manager import job_manager
from backend.app.services.pacing import calculate_node_pacing, find_node_in_syllabus

logging.basicConfig(level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO))
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle events: initialize tables on startup."""
    init_db()
    logger.info("Database initialized successfully.")
    yield


app = FastAPI(
    title="Hierarchical Syllabus Tracker API",
    version="1.0.0",
    description="Production-grade, local-first hierarchical syllabus checklist and progress tracker API.",
    lifespan=lifespan,
)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Exception Handlers ---

@app.exception_handler(SyllabusNotFoundError)
async def syllabus_not_found_handler(request, exc: SyllabusNotFoundError):
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={"detail": str(exc), "error_type": "SyllabusNotFoundError"},
    )


@app.exception_handler(InvalidLeafError)
async def invalid_leaf_handler(request, exc: InvalidLeafError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": str(exc), "error_type": "InvalidLeafError", "leaf_id": exc.leaf_id},
    )


@app.exception_handler(InvalidNodeError)
async def invalid_node_handler(request, exc: InvalidNodeError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": str(exc), "error_type": "InvalidNodeError", "node_id": exc.node_id},
    )


@app.exception_handler(FileValidationError)
async def file_validation_handler(request, exc: FileValidationError):
    detail = str(exc)
    status_code = status.HTTP_400_BAD_REQUEST
    if "maximum allowed size" in detail or "exceeds maximum" in detail:
        status_code = status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
    elif "Unsupported file format" in detail:
        status_code = status.HTTP_415_UNSUPPORTED_MEDIA_TYPE

    return JSONResponse(
        status_code=status_code,
        content={"detail": detail, "error_type": "FileValidationError"},
    )


@app.exception_handler(HierarchyValidationError)
async def hierarchy_validation_handler(request, exc: HierarchyValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": str(exc), "error_type": "HierarchyValidationError"},
    )


@app.exception_handler(DocumentParserError)
async def document_parser_handler(request, exc: DocumentParserError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": str(exc), "error_type": "DocumentParserError"},
    )


@app.exception_handler(ExtractionError)
async def extraction_error_handler(request, exc: ExtractionError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": str(exc), "error_type": "ExtractionError"},
    )


# --- API Routes ---

# --- Operational & Health Routes ---

@app.get("/health")
@app.get("/api/health")
def get_health() -> Dict[str, Any]:
    """Lightweight application health check returning DB and extraction provider diagnostics."""
    is_prov_up, prov_name, prov_msg, available_models = check_provider_status()
    is_ollama_up, ollama_models, ollama_msg = check_ollama_status()
    preferred_model = get_preferred_model(ollama_models) if is_ollama_up else None

    return {
        "status": "healthy",
        "database": "connected",
        "active_provider": prov_name,
        "provider_status": {
            "is_reachable": is_prov_up,
            "message": prov_msg,
        },
        "ollama": {
            "is_reachable": is_ollama_up,
            "message": ollama_msg,
            "configured_model": settings.OLLAMA_MODEL,
            "configured_fallback": settings.OLLAMA_FALLBACK_MODEL,
            "resolved_model": preferred_model,
            "available_models": ollama_models,
        },
    }


@app.get("/ready")
@app.get("/api/ready")
def get_ready(session: Session = Depends(get_db)) -> Dict[str, Any]:
    """Readiness check verifying database connectivity and configuration without exposing secrets."""
    try:
        session.execute(text("SELECT 1"))
        db_ready = True
    except Exception as e:
        logger.error("Readiness check database failure: %s", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connectivity unavailable.",
        )

    is_prov_up, prov_name, prov_msg, _ = check_provider_status()

    return {
        "status": "ready" if db_ready else "not_ready",
        "database_connected": db_ready,
        "provider": {
            "name": prov_name,
            "is_reachable": is_prov_up,
            "message": prov_msg,
        },
    }


@app.get("/api/config", response_model=AppConfigResponse)
def get_app_config() -> AppConfigResponse:
    """Return safe frontend configuration metadata without exposing secrets."""
    is_prov_up, prov_name, _, prov_models = check_provider_status()
    is_ollama_up, ollama_models, _ = check_ollama_status()
    active_model = (
        settings.OPENAI_MODEL
        if prov_name == "openai"
        else (get_preferred_model(ollama_models) if is_ollama_up else None)
    )

    configured_model = (
        settings.OPENAI_MODEL if settings.EXTRACTION_PROVIDER == "openai" else settings.OLLAMA_MODEL
    )

    return AppConfigResponse(
        max_upload_size_bytes=settings.MAX_UPLOAD_SIZE_BYTES,
        max_upload_size_mib=settings.MAX_UPLOAD_SIZE_BYTES // (1024 * 1024),
        allowed_extensions=[".pdf", ".docx", ".doc", ".txt"],
        active_provider=settings.EXTRACTION_PROVIDER,
        configured_model=configured_model,
        active_model=active_model,
        ollama_connected=is_ollama_up,
        features={
            "legacy_doc_conversion": True,
            "evidence_grounding": True,
            "tri_state_checkboxes": True,
            "leaf_only_persistence": True,
            "dual_provider_extraction": True,
            "elective_onboarding": True,
        },
        app_version="2.0.0",
        schema_version=2,
    )


@app.get("/api/syllabi", response_model=List[SyllabusSummary])
def list_syllabi(session: Session = Depends(get_db)):
    """List all saved syllabi with progress totals."""
    return list_syllabi_summaries(session)


upload_semaphore = asyncio.Semaphore(settings.MAX_CONCURRENT_PARSING_JOBS)


@app.post("/api/upload", status_code=status.HTTP_202_ACCEPTED)
async def upload_syllabus(
    file: UploadFile = File(...),
    sync: bool = False,
    session: Session = Depends(get_db),
):
    """
    Accepts syllabus upload (PDF, DOCX, DOC, TXT).
    By default, stages file asynchronously and returns 202 Accepted with a unique job_id
    for real-time SSE progress tracking.
    When sync=True is passed, executes synchronously for legacy clients/tests.
    """
    if not file.filename:
        raise FileValidationError("Upload must include a valid filename.")

    ext = os.path.splitext(file.filename)[1].lower()
    from backend.app.parser import ALLOWED_EXTENSIONS
    if ext not in ALLOWED_EXTENSIONS:
        raise FileValidationError(
            f"Unsupported file format '{ext}'. Allowed formats: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    # Synchronous execution mode (for testing or legacy scripts)
    if sync:
        content = await file.read()
        if len(content) > settings.MAX_UPLOAD_SIZE_BYTES:
            raise FileValidationError(
                f"File exceeds maximum allowed size of {settings.MAX_UPLOAD_SIZE_BYTES // (1024*1024)} MiB."
            )
        timeout_seconds = float(settings.PARSER_TIMEOUT_SECONDS + settings.LLM_TIMEOUT_SECONDS)
        try:
            async with upload_semaphore:
                response = await asyncio.wait_for(
                    asyncio.to_thread(
                        ingest_syllabus_document,
                        session=session,
                        file_bytes=content,
                        filename=file.filename,
                        allow_fallback_extraction=True,
                    ),
                    timeout=timeout_seconds,
                )
                session.commit()
                return JSONResponse(status_code=status.HTTP_201_CREATED, content=response.model_dump())
        except asyncio.TimeoutError:
            session.rollback()
            logger.error(
                "document.processing.timeout filename=%s limit=%ds",
                file.filename,
                int(timeout_seconds),
            )
            return JSONResponse(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                content={
                    "detail": f"Processing for '{file.filename}' exceeded the server time limit of {int(timeout_seconds)}s.",
                    "error_type": "DocumentProcessingTimeout",
                    "code": "DOCUMENT_PROCESSING_TIMEOUT",
                    "retryable": True,
                },
            )
        except OSError as os_err:
            session.rollback()
            logger.error(
                "document.processing.os_error filename=%s err=%s",
                file.filename,
                os_err,
                exc_info=True,
            )
            return JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content={
                    "detail": "System resources are temporarily exhausted. Please ensure the document is a digital text-based PDF, DOCX, or TXT file.",
                    "error_type": "SystemResourceExhausted",
                    "code": "SYSTEM_RESOURCE_EXHAUSTED",
                    "retryable": True,
                },
            )
        except Exception:
            session.rollback()
            raise

    # Standard Asynchronous Job Workflow: Stream to isolated staging directory
    temp_dir = tempfile.mkdtemp(prefix="upload_job_")
    staged_path = os.path.join(temp_dir, f"staged_{uuid.uuid4().hex[:8]}{ext}")
    total_bytes = 0

    try:
        with open(staged_path, "wb") as f_out:
            while chunk := await file.read(65536):
                total_bytes += len(chunk)
                if total_bytes > settings.MAX_UPLOAD_SIZE_BYTES:
                    f_out.close()
                    shutil.rmtree(temp_dir, ignore_errors=True)
                    raise FileValidationError(
                        f"File exceeds maximum allowed size of {settings.MAX_UPLOAD_SIZE_BYTES // (1024*1024)} MiB."
                    )
                f_out.write(chunk)

        if total_bytes == 0:
            shutil.rmtree(temp_dir, ignore_errors=True)
            raise FileValidationError("Uploaded file is empty (0 bytes).")

    except Exception:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise

    # Register in job manager
    job = job_manager.create_job(
        staging_file_path=staged_path,
        staging_dir_path=temp_dir,
        initial_message=f"Upload of '{file.filename}' accepted. Queued for processing.",
    )

    # Schedule background worker
    async def _run_worker():
        async with upload_semaphore:
            await asyncio.to_thread(
                process_ingestion_job,
                job_id=job.job_id,
                file_path=staged_path,
                filename=file.filename,
            )

    asyncio.create_task(_run_worker())

    return JSONResponse(
        status_code=status.HTTP_202_ACCEPTED,
        content=StartUploadResponse(
            job_id=job.job_id,
            stage=job.stage,
            percent=job.percent,
            message=job.message,
        ).model_dump(),
    )


@app.get("/api/upload/progress/{job_id}")
async def stream_upload_progress(job_id: str, request: Request):
    """
    Server-Sent Events (SSE) endpoint emitting real-time progress updates for an ingestion job.
    If requested with Accept: application/json without text/event-stream, returns the JSON progress snapshot.
    """
    job = job_manager.get(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Upload job '{job_id}' not found.",
        )

    accept = request.headers.get("accept", "")
    if "text/event-stream" not in accept and "application/json" in accept:
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content=JobProgressResponse(
                job_id=job.job_id,
                stage=job.stage,
                percent=job.percent,
                message=job.message,
                syllabus_id=job.syllabus_id,
                result=job.result,
                error=job.error,
            ).model_dump(),
        )

    queue = job_manager.subscribe(job_id)
    if queue is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Upload job '{job_id}' not found.",
        )

    async def event_generator():
        event_id = 1
        try:
            # 1. Send initial progress snapshot immediately
            initial_job = job_manager.get(job_id)
            if initial_job:
                payload = initial_job.model_dump_json()
                yield f"id: {event_id}\nevent: progress\ndata: {payload}\n\n"
                event_id += 1
                if initial_job.stage in {"completed", "failed", "cancelled"}:
                    return

            # 2. Stream updates with client disconnection checks
            while True:
                if await request.is_disconnected():
                    break
                try:
                    snapshot = await asyncio.wait_for(queue.get(), timeout=1.0)
                    payload = snapshot.model_dump_json()
                    yield f"id: {event_id}\nevent: progress\ndata: {payload}\n\n"
                    event_id += 1
                    if snapshot.stage in {"completed", "failed", "cancelled"}:
                        break
                except asyncio.TimeoutError:
                    if await request.is_disconnected():
                        break
                    curr = job_manager.get(job_id)
                    if curr and curr.stage in {"completed", "failed", "cancelled"}:
                        payload = curr.model_dump_json()
                        yield f"id: {event_id}\nevent: progress\ndata: {payload}\n\n"
                        break
                    yield ": keep-alive\n\n"
        finally:
            job_manager.unsubscribe(job_id, queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/api/upload/jobs/{job_id}", response_model=JobProgressResponse)
def get_upload_job_status(job_id: str):
    """Polling fallback endpoint returning current job progress snapshot."""
    job = job_manager.get(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Upload job '{job_id}' not found.",
        )
    return JobProgressResponse(
        job_id=job.job_id,
        stage=job.stage,
        percent=job.percent,
        message=job.message,
        syllabus_id=job.syllabus_id,
        result=job.result,
        error=job.error,
    )


@app.post("/api/upload/jobs/{job_id}/cancel")
def cancel_upload_job(job_id: str):
    """Explicitly request cancellation for an in-progress upload job."""
    job = job_manager.get(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Upload job '{job_id}' not found.",
        )
    if job.stage in {"completed", "failed", "cancelled"}:
        return {
            "job_id": job_id,
            "status": "already_terminal",
            "stage": job.stage,
        }
    success = job_manager.request_cancel(job_id)
    return {
        "job_id": job_id,
        "status": "cancellation_requested",
        "success": success,
    }


@app.get("/api/syllabus/{syllabus_id}/review", response_model=ParseReviewResponse)
def get_syllabus_review_endpoint(syllabus_id: str, session: Session = Depends(get_db)):
    """Retrieve draft curriculum and detected elective courses for onboarding confirmation."""
    return get_syllabus_review(session, syllabus_id)


@app.post("/api/syllabus/{syllabus_id}/finalize-enrollment", response_model=SyllabusResponse)
def finalize_enrollment_endpoint(
    syllabus_id: str,
    payload: FinalizeEnrollmentRequest,
    session: Session = Depends(get_db),
):
    """
    Atomically commit student elective course enrollment selections.
    Validates subject IDs and elective groups, preserves leaf completion records,
    and returns the finalized active hierarchy.
    """
    try:
        updated_syllabus = finalize_syllabus_enrollment(
            session=session,
            syllabus_id=syllabus_id,
            enrolled_subject_ids=payload.enrolled_subject_ids,
        )
        session.commit()
    except Exception:
        session.rollback()
        raise

    rec = get_syllabus_record(session, syllabus_id)
    warnings = json.loads(rec.warnings_json) if rec and rec.warnings_json else []
    completed_ids = get_completed_leaf_ids(session, syllabus_id)
    prog, node_prog = calculate_syllabus_progress(updated_syllabus, completed_ids)

    return SyllabusResponse(
        syllabus=updated_syllabus,
        completed_leaf_ids=list(completed_ids),
        progress=prog,
        node_progress=node_prog,
        warnings=warnings,
    )


@app.post("/api/syllabus/{syllabus_id}/update-enrollment", response_model=SyllabusResponse)
def update_enrollment_endpoint(
    syllabus_id: str,
    payload: FinalizeEnrollmentRequest,
    session: Session = Depends(get_db),
):
    """Update elective enrollment after initial finalization without losing completed progress."""
    return finalize_enrollment_endpoint(syllabus_id, payload, session)


@app.get("/api/syllabus/{syllabus_id}", response_model=SyllabusResponse)
def get_syllabus(syllabus_id: str, session: Session = Depends(get_db)):
    """Retrieve canonical syllabus hierarchy, completed leaves, and calculated progress."""
    rec = get_syllabus_record(session, syllabus_id)
    if not rec:
        raise SyllabusNotFoundError(syllabus_id)

    raw_data = json.loads(rec.hierarchy_json)
    syllabus = HierarchicalSyllabus.model_validate(raw_data)
    warnings = json.loads(rec.warnings_json) if rec.warnings_json else []

    completed_ids = get_completed_leaf_ids(session, syllabus_id)
    prog, node_prog = calculate_syllabus_progress(syllabus, completed_ids)

    return SyllabusResponse(
        syllabus=syllabus,
        completed_leaf_ids=list(completed_ids),
        progress=prog,
        node_progress=node_prog,
        warnings=warnings,
    )


@app.patch("/api/syllabus/{syllabus_id}/toggle-leaf", response_model=SyllabusResponse)
def toggle_leaf(
    syllabus_id: str,
    payload: LeafToggleRequest,
    session: Session = Depends(get_db),
):
    """Idempotently update completion status of a single leaf subtopic."""
    rec = get_syllabus_record(session, syllabus_id)
    if not rec:
        raise SyllabusNotFoundError(syllabus_id)

    syllabus = HierarchicalSyllabus.model_validate(json.loads(rec.hierarchy_json))
    warnings = json.loads(rec.warnings_json) if rec.warnings_json else []

    target_completed = payload.target_completed

    try:
        completed_ids = update_leaf_completion(
            session=session,
            syllabus=syllabus,
            leaf_id=payload.leaf_id,
            is_completed=target_completed,
        )
        session.commit()
    except Exception:
        session.rollback()
        raise

    prog, node_prog = calculate_syllabus_progress(syllabus, completed_ids)

    return SyllabusResponse(
        syllabus=syllabus,
        completed_leaf_ids=list(completed_ids),
        progress=prog,
        node_progress=node_prog,
        warnings=warnings,
    )


@app.patch("/api/syllabus/{syllabus_id}/bulk-toggle", response_model=SyllabusResponse)
def toggle_branch(
    syllabus_id: str,
    payload: BulkToggleRequest,
    session: Session = Depends(get_db),
):
    """
    Atomically update completion status for all descendant leaves of any node
    (academic year, semester, subject, module, or whole syllabus).
    """
    rec = get_syllabus_record(session, syllabus_id)
    if not rec:
        raise SyllabusNotFoundError(syllabus_id)

    syllabus = HierarchicalSyllabus.model_validate(json.loads(rec.hierarchy_json))
    warnings = json.loads(rec.warnings_json) if rec.warnings_json else []

    explicit_target = payload.target_completed

    if payload.leaf_ids is not None:
        target_set = set(payload.leaf_ids)
        is_completed = explicit_target
    elif payload.node_id is not None:
        if not node_exists_in_syllabus(syllabus, payload.node_id):
            raise InvalidNodeError(payload.node_id)
        descendant_leaves = get_node_descendant_leaf_ids(syllabus, payload.node_id)
        target_set, is_completed = determine_bulk_toggle_action(
            descendant_leaf_ids=descendant_leaves,
            current_completed_ids=get_completed_leaf_ids(session, syllabus_id),
            explicit_target_state=explicit_target,
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Either 'node_id' or 'leaf_ids' must be provided in bulk-toggle request.",
        )

    try:
        completed_ids = update_bulk_completion(
            session=session,
            syllabus=syllabus,
            target_leaf_ids=target_set,
            is_completed=is_completed,
        )
        session.commit()
    except Exception:
        session.rollback()
        raise

    prog, node_prog = calculate_syllabus_progress(syllabus, completed_ids)

    return SyllabusResponse(
        syllabus=syllabus,
        completed_leaf_ids=list(completed_ids),
        progress=prog,
        node_progress=node_prog,
        warnings=warnings,
    )


@app.patch("/api/syllabus/{syllabus_id}", response_model=SyllabusResponse)
def rename_syllabus(
    syllabus_id: str,
    payload: SyllabusRenameRequest,
    session: Session = Depends(get_db),
):
    """Update user-editable syllabus title metadata."""
    rec = get_syllabus_record(session, syllabus_id)
    if not rec:
        raise SyllabusNotFoundError(syllabus_id)

    try:
        updated_rec = update_syllabus_title(session, syllabus_id, payload.title)
        session.commit()
    except Exception:
        session.rollback()
        raise

    syllabus = HierarchicalSyllabus.model_validate(json.loads(updated_rec.hierarchy_json))
    warnings = json.loads(updated_rec.warnings_json) if updated_rec.warnings_json else []
    completed_ids = get_completed_leaf_ids(session, syllabus_id)
    prog, node_prog = calculate_syllabus_progress(syllabus, completed_ids)

    return SyllabusResponse(
        syllabus=syllabus,
        completed_leaf_ids=list(completed_ids),
        progress=prog,
        node_progress=node_prog,
        warnings=warnings,
    )


@app.delete("/api/syllabus/{syllabus_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_syllabus(syllabus_id: str, session: Session = Depends(get_db)):
    """Delete a syllabus and its completion records transactionally."""
    try:
        delete_syllabus(session, syllabus_id)
        session.commit()
    except Exception:
        session.rollback()
        raise
    return None


# --- Study Pacing & Exam Deadline Engine Endpoints ---

@app.get("/api/syllabus/{syllabus_id}/pacing", response_model=SyllabusPacingSummaryResponse)
def get_syllabus_pacing_summary(
    syllabus_id: str,
    session: Session = Depends(get_db),
):
    """Retrieve pacing metrics for all active subject and semester deadlines in a syllabus."""
    rec = get_syllabus_record(session, syllabus_id)
    if not rec:
        raise SyllabusNotFoundError(syllabus_id)

    syllabus = HierarchicalSyllabus.model_validate(json.loads(rec.hierarchy_json))
    completed_ids = get_completed_leaf_ids(session, syllabus_id)
    deadline_records = get_target_deadlines(session, syllabus_id)

    deadlines_dict: Dict[str, PacingMetrics] = {}
    for d in deadline_records:
        lookup = find_node_in_syllabus(syllabus, d.node_id)
        if lookup:
            node, _ = lookup
            deadlines_dict[d.node_id] = calculate_node_pacing(
                node=node,
                completed_leaf_ids=completed_ids,
                target_date=d.target_date,
            )

    return SyllabusPacingSummaryResponse(
        syllabus_id=syllabus_id,
        deadlines=deadlines_dict,
    )


@app.post("/api/syllabus/{syllabus_id}/deadline", response_model=PacingMetrics)
def set_or_update_target_deadline(
    syllabus_id: str,
    payload: SetTargetDateRequest,
    session: Session = Depends(get_db),
):
    """Register or atomically update a target completion deadline for a Subject or Semester."""
    rec = get_syllabus_record(session, syllabus_id)
    if not rec:
        raise SyllabusNotFoundError(syllabus_id)

    syllabus = HierarchicalSyllabus.model_validate(json.loads(rec.hierarchy_json))

    lookup = find_node_in_syllabus(syllabus, payload.node_id)
    if not lookup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Node '{payload.node_id}' not found in syllabus '{syllabus_id}'",
        )

    node, actual_type = lookup
    if actual_type != payload.node_type:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Node type mismatch: payload specified '{payload.node_type}', but target node '{payload.node_id}' is a '{actual_type}'",
        )

    if actual_type == "subject" and not is_subject_enrolled(node):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Cannot set deadline on non-enrolled or excluded elective subject '{payload.node_id}'",
        )

    try:
        deadline_rec = upsert_target_deadline(
            session=session,
            syllabus_id=syllabus_id,
            node_id=payload.node_id,
            node_type=payload.node_type,
            target_date=payload.target_date,
        )
        session.commit()
    except Exception:
        session.rollback()
        raise

    completed_ids = get_completed_leaf_ids(session, syllabus_id)
    return calculate_node_pacing(
        node=node,
        completed_leaf_ids=completed_ids,
        target_date=deadline_rec.target_date,
    )


@app.delete("/api/syllabus/{syllabus_id}/deadline/{node_id}")
def clear_target_deadline(
    syllabus_id: str,
    node_id: str,
    session: Session = Depends(get_db),
):
    """Idempotently clear a target completion deadline for a Subject or Semester."""
    rec = get_syllabus_record(session, syllabus_id)
    if not rec:
        raise SyllabusNotFoundError(syllabus_id)

    try:
        delete_target_deadline(session, syllabus_id, node_id)
        session.commit()
    except Exception:
        session.rollback()
        raise

    return {
        "status": "cleared",
        "node_id": node_id,
    }
