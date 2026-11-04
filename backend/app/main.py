"""FastAPI entrypoint and API router implementation for the Syllabus Tracker."""

import asyncio
import json
import logging
import os
import shutil
import tempfile
import uuid
import re
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional, Union

from fastapi import Depends, FastAPI, File, HTTPException, Query, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response, StreamingResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.app.config import settings
from backend.app.database import (
    add_topic_resource,
    delete_syllabus,
    delete_target_deadline,
    delete_topic_note,
    delete_topic_resource,
    finalize_syllabus_enrollment,
    get_all_syllabus_notes,
    get_all_syllabus_resources,
    get_completed_leaf_ids,
    get_db,
    get_syllabus_record,
    get_syllabus_review,
    get_target_deadline,
    get_target_deadlines,
    get_topic_note,
    get_topic_resources,
    init_db,
    list_syllabi_summaries,
    update_bulk_completion,
    update_leaf_completion,
    update_syllabus_title,
    upsert_target_deadline,
    upsert_topic_note,
)
from backend.app.exceptions import (
    DocumentParserError,
    ExtractionError,
    FileValidationError,
    HierarchyValidationError,
    InvalidLeafError,
    InvalidNodeError,
    ScraperError,
    SSRFProtectionError,
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
    get_all_leaf_ids,
    get_node_descendant_leaf_ids,
    is_subject_enrolled,
    node_exists_in_syllabus,
)
from backend.app.schemas import (
    AddResourceRequest,
    AppConfigResponse,
    BackupEnvelope,
    BackupRestoreRequest,
    BackupRestoreResult,
    BulkToggleRequest,
    EmbeddedDocumentPreview,
    ExportOptions,
    FinalizeEnrollmentRequest,
    HierarchicalSyllabus,
    IngestUrlRequest,
    JobProgressResponse,
    LeafToggleRequest,
    NoteResponse,
    PacingMetrics,
    ParseReviewResponse,
    ResourceResponse,
    SaveNoteRequest,
    ScrapePreviewResponse,
    SetTargetDateRequest,
    StartUploadResponse,
    SyllabusPacingSummaryResponse,
    SyllabusRenameRequest,
    SyllabusResponse,
    SyllabusSummary,
)
from backend.app.parser import validate_file_metadata
from backend.app.services.export_service import (
    generate_html_report,
    generate_json_backup,
    generate_markdown_export,
)
from backend.app.services.ingestion import ingest_syllabus_document, process_ingestion_job, process_web_ingestion_job
from backend.app.services.job_manager import job_manager
from backend.app.services.pacing import calculate_node_pacing, find_node_in_syllabus
from backend.app.services.restore_service import restore_backup
from backend.app.services.web_scraper import fetch_web_content, validate_safe_url

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


@app.exception_handler(SSRFProtectionError)
async def ssrf_protection_handler(request, exc: SSRFProtectionError):
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"detail": str(exc), "error_type": "SSRFProtectionError"},
    )


@app.exception_handler(ScraperError)
async def scraper_error_handler(request, exc: ScraperError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": str(exc), "error_type": "ScraperError"},
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
            "web_scraping": True,
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


# --- Option-C: Automated Web Scraper Endpoints ---

@app.post("/api/scrape/preview", response_model=ScrapePreviewResponse)
async def preview_scrape_url(payload: IngestUrlRequest):
    """
    Read-only preview endpoint:
    - Normalizes and validates URL against SSRF and private IP policies.
    - Connects safely and acquires HTML or direct document.
    - Discovers relevant embedded PDF/DOCX syllabus documents.
    - Generates cleaned content preview.
    - Does NOT execute LLM extraction or persist any database records.
    """
    try:
        scraped = await fetch_web_content(
            url=payload.url,
            follow_embedded_pdf=False,  # Preview does not auto-follow so user sees discovered choices
            selected_document_url=payload.selected_document_url,
        )
    except SSRFProtectionError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except ScraperError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )

    # Build preview snippet (max 1200 chars)
    if scraped.source_kind in ("pdf", "docx"):
        content_preview = f"Direct downloadable {scraped.source_kind.upper()} document: {scraped.binary_filename}"
    else:
        content_preview = (scraped.html_markdown or "")[:1200]
        if len(scraped.html_markdown or "") > 1200:
            content_preview += "..."

    embedded_previews = [
        EmbeddedDocumentPreview(
            url=doc.url,
            filename=doc.filename,
            document_type=doc.document_type,
            relevance_score=doc.relevance_score,
            relevance_label=doc.relevance_label,
            display_title=doc.display_title,
        )
        for doc in scraped.embedded_documents
    ]

    import hashlib
    token_material = f"{scraped.final_url}|{payload.selected_document_url or ''}|{scraped.resolved_title}"
    preview_token = hashlib.sha256(token_material.encode("utf-8")).hexdigest()[:24]

    return ScrapePreviewResponse(
        url=scraped.requested_url,
        final_url=scraped.final_url,
        resolved_title=scraped.resolved_title,
        content_type=scraped.content_type,
        source_kind=scraped.source_kind,
        detected_embedded_files=embedded_previews,
        content_preview=content_preview,
        warnings=scraped.warnings,
        requires_document_selection=scraped.requires_document_selection,
        preview_token=preview_token,
    )


@app.post("/api/scrape/ingest", status_code=status.HTTP_202_ACCEPTED, response_model=StartUploadResponse)
async def ingest_scrape_url(payload: IngestUrlRequest):
    """
    Asynchronous web ingestion endpoint:
    - Re-validates URL syntax and SSRF policies.
    - Registers background job with job_manager.
    - Dispatches asynchronous worker task (process_web_ingestion_job).
    - Returns 202 Accepted with job_id for real-time SSE progress tracking.
    """
    try:
        validated_url = validate_safe_url(payload.url)
        if payload.selected_document_url:
            validate_safe_url(payload.selected_document_url)
    except SSRFProtectionError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    display_title = payload.custom_title or payload.url
    job = job_manager.create_job(
        initial_message=f"Web syllabus ingestion accepted for '{display_title}'. Queued for processing.",
    )

    async def _run_web_worker():
        async with upload_semaphore:
            await asyncio.to_thread(
                process_web_ingestion_job,
                job_id=job.job_id,
                url=validated_url,
                follow_embedded_pdf=payload.follow_embedded_pdf,
                custom_title=payload.custom_title,
                selected_document_url=payload.selected_document_url,
            )

    asyncio.create_task(_run_web_worker())

    return StartUploadResponse(
        job_id=job.job_id,
        stage=job.stage,
        percent=job.percent,
        message=job.message,
    )



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


# --- Option-B: Topic Notes Endpoints ---

@app.get("/api/syllabus/{syllabus_id}/notes", response_model=List[NoteResponse])
def get_all_notes_for_syllabus(
    syllabus_id: str,
    session: Session = Depends(get_db),
):
    """Retrieve all topic notes for a syllabus."""
    rec = get_syllabus_record(session, syllabus_id)
    if not rec:
        raise SyllabusNotFoundError(syllabus_id)

    notes = get_all_syllabus_notes(session, syllabus_id)
    return [
        NoteResponse(
            leaf_id=n.leaf_id,
            content=n.content,
            updated_at=n.updated_at,
        )
        for n in notes
    ]


@app.get("/api/syllabus/{syllabus_id}/notes/{leaf_id}", response_model=NoteResponse)
def get_topic_study_note(
    syllabus_id: str,
    leaf_id: str,
    session: Session = Depends(get_db),
):
    """Retrieve note for a specific topic leaf."""
    rec = get_syllabus_record(session, syllabus_id)
    if not rec:
        raise SyllabusNotFoundError(syllabus_id)

    raw_data = json.loads(rec.hierarchy_json)
    syllabus = HierarchicalSyllabus.model_validate(raw_data)
    valid_leaves = set(get_all_leaf_ids(syllabus))
    if leaf_id not in valid_leaves:
        raise InvalidLeafError(leaf_id)

    note = get_topic_note(session, syllabus_id, leaf_id)
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No note found for topic '{leaf_id}'",
        )

    return NoteResponse(
        leaf_id=note.leaf_id,
        content=note.content,
        updated_at=note.updated_at,
    )


@app.put("/api/syllabus/{syllabus_id}/notes/{leaf_id}", response_model=NoteResponse)
def save_topic_study_note(
    syllabus_id: str,
    leaf_id: str,
    payload: SaveNoteRequest,
    session: Session = Depends(get_db),
):
    """Create or update persistent Markdown study note for a topic leaf."""
    rec = get_syllabus_record(session, syllabus_id)
    if not rec:
        raise SyllabusNotFoundError(syllabus_id)

    raw_data = json.loads(rec.hierarchy_json)
    syllabus = HierarchicalSyllabus.model_validate(raw_data)
    valid_leaves = set(get_all_leaf_ids(syllabus))
    if leaf_id not in valid_leaves:
        raise InvalidLeafError(leaf_id)

    try:
        note = upsert_topic_note(
            session=session,
            syllabus_id=syllabus_id,
            leaf_id=leaf_id,
            content=payload.content,
        )
        session.commit()
    except Exception:
        session.rollback()
        raise

    return NoteResponse(
        leaf_id=note.leaf_id,
        content=note.content,
        updated_at=note.updated_at,
    )


@app.delete("/api/syllabus/{syllabus_id}/notes/{leaf_id}")
def delete_topic_study_note(
    syllabus_id: str,
    leaf_id: str,
    session: Session = Depends(get_db),
):
    """Delete a topic study note."""
    rec = get_syllabus_record(session, syllabus_id)
    if not rec:
        raise SyllabusNotFoundError(syllabus_id)

    deleted = delete_topic_note(session, syllabus_id, leaf_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No note found for topic '{leaf_id}'",
        )

    session.commit()
    return {"status": "deleted", "leaf_id": leaf_id}


# --- Option-B: Learning Resources Endpoints ---

@app.get("/api/syllabus/{syllabus_id}/resources", response_model=List[ResourceResponse])
def get_resources_for_syllabus(
    syllabus_id: str,
    node_id: Optional[str] = Query(default=None),
    node_type: Optional[str] = Query(default=None),
    session: Session = Depends(get_db),
):
    """Retrieve learning resources attached to subtopics or modules."""
    rec = get_syllabus_record(session, syllabus_id)
    if not rec:
        raise SyllabusNotFoundError(syllabus_id)

    resources = get_topic_resources(session, syllabus_id, node_id=node_id, node_type=node_type)
    return [
        ResourceResponse(
            id=r.id,
            node_id=r.node_id,
            node_type=r.node_type,
            title=r.title,
            url=r.url,
            resource_type=r.resource_type,
            created_at=r.created_at,
        )
        for r in resources
    ]


@app.post("/api/syllabus/{syllabus_id}/resources", response_model=ResourceResponse, status_code=status.HTTP_201_CREATED)
def add_resource_to_syllabus(
    syllabus_id: str,
    payload: AddResourceRequest,
    session: Session = Depends(get_db),
):
    """Attach a learning resource (YouTube, Docs, Slides, GitHub, Link) to a subtopic or module."""
    rec = get_syllabus_record(session, syllabus_id)
    if not rec:
        raise SyllabusNotFoundError(syllabus_id)

    raw_data = json.loads(rec.hierarchy_json)
    syllabus = HierarchicalSyllabus.model_validate(raw_data)

    if payload.node_type == "subtopic":
        valid_leaves = set(get_all_leaf_ids(syllabus))
        if payload.node_id not in valid_leaves:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Subtopic '{payload.node_id}' not found in syllabus",
            )
    elif payload.node_type == "module":
        valid_modules = {
            m.id
            for yr in syllabus.years
            for sem in yr.semesters
            for s in sem.subjects
            for m in s.modules
        }
        if payload.node_id not in valid_modules:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Module '{payload.node_id}' not found in syllabus",
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid node_type '{payload.node_type}'",
        )

    try:
        res = add_topic_resource(
            session=session,
            syllabus_id=syllabus_id,
            node_id=payload.node_id,
            node_type=payload.node_type,
            title=payload.title,
            url=payload.url,
            resource_type=payload.resource_type,
        )
        session.commit()
    except Exception:
        session.rollback()
        raise

    return ResourceResponse(
        id=res.id,
        node_id=res.node_id,
        node_type=res.node_type,
        title=res.title,
        url=res.url,
        resource_type=res.resource_type,
        created_at=res.created_at,
    )


@app.delete("/api/syllabus/{syllabus_id}/resources/{resource_id}")
def delete_resource_from_syllabus(
    syllabus_id: str,
    resource_id: int,
    session: Session = Depends(get_db),
):
    """Delete a learning resource."""
    rec = get_syllabus_record(session, syllabus_id)
    if not rec:
        raise SyllabusNotFoundError(syllabus_id)

    deleted = delete_topic_resource(session, syllabus_id, resource_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Resource '{resource_id}' not found",
        )

    session.commit()
    return {"status": "deleted", "resource_id": resource_id}


# --- Option-B: Export, Backup & Restore Endpoints ---

@app.get("/api/syllabus/{syllabus_id}/export/markdown")
def export_syllabus_markdown(
    syllabus_id: str,
    include_notes: bool = Query(default=True),
    include_resources: bool = Query(default=True),
    include_pacing: bool = Query(default=True),
    enrolled_only: bool = Query(default=True),
    session: Session = Depends(get_db),
):
    """Export complete syllabus as a hierarchical Markdown checklist."""
    rec = get_syllabus_record(session, syllabus_id)
    if not rec:
        raise SyllabusNotFoundError(syllabus_id)

    raw_data = json.loads(rec.hierarchy_json)
    syllabus = HierarchicalSyllabus.model_validate(raw_data)
    completed_ids = get_completed_leaf_ids(session, syllabus_id)

    notes = get_all_syllabus_notes(session, syllabus_id)
    notes_map = {n.leaf_id: n.content for n in notes}

    resources = get_all_syllabus_resources(session, syllabus_id)

    deadlines = get_target_deadlines(session, syllabus_id)
    deadlines_map = {d.node_id: d for d in deadlines}

    options = ExportOptions(
        include_notes=include_notes,
        include_resources=include_resources,
        include_pacing=include_pacing,
        enrolled_only=enrolled_only,
    )

    md_content = generate_markdown_export(
        syllabus=syllabus,
        completed_leaf_ids=completed_ids,
        notes_map=notes_map,
        resources_list=resources,
        deadlines_map=deadlines_map,
        options=options,
    )

    slug = re.sub(r"[^a-zA-Z0-9_\-]", "_", syllabus.title).strip("_") or "syllabus"
    filename = f"{slug}.md"

    return Response(
        content=md_content,
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/api/syllabus/{syllabus_id}/export/json")
def export_syllabus_json(
    syllabus_id: str,
    include_notes: bool = Query(default=True),
    include_resources: bool = Query(default=True),
    include_pacing: bool = Query(default=True),
    enrolled_only: bool = Query(default=True),
    session: Session = Depends(get_db),
):
    """Export portable, versioned JSON backup envelope (Schema 2.1)."""
    rec = get_syllabus_record(session, syllabus_id)
    if not rec:
        raise SyllabusNotFoundError(syllabus_id)

    raw_data = json.loads(rec.hierarchy_json)
    syllabus = HierarchicalSyllabus.model_validate(raw_data)
    completed_ids = get_completed_leaf_ids(session, syllabus_id)

    notes = get_all_syllabus_notes(session, syllabus_id)
    notes_map = {n.leaf_id: n.content for n in notes}

    resources = get_all_syllabus_resources(session, syllabus_id)

    deadlines = get_target_deadlines(session, syllabus_id)
    deadlines_map = {d.node_id: d for d in deadlines}

    options = ExportOptions(
        include_notes=include_notes,
        include_resources=include_resources,
        include_pacing=include_pacing,
        enrolled_only=enrolled_only,
    )

    backup_dict = generate_json_backup(
        syllabus=syllabus,
        completed_leaf_ids=completed_ids,
        notes_map=notes_map,
        resources_list=resources,
        deadlines_map=deadlines_map,
        options=options,
    )

    slug = re.sub(r"[^a-zA-Z0-9_\-]", "_", syllabus.title).strip("_") or "syllabus"
    filename = f"{slug}_backup.json"

    return Response(
        content=json.dumps(backup_dict, indent=2),
        media_type="application/json; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/api/syllabus/{syllabus_id}/export/html")
def export_syllabus_html(
    syllabus_id: str,
    include_notes: bool = Query(default=True),
    include_resources: bool = Query(default=True),
    include_pacing: bool = Query(default=True),
    enrolled_only: bool = Query(default=True),
    session: Session = Depends(get_db),
):
    """Export self-contained, printable HTML report with print styles and XSS defense."""
    rec = get_syllabus_record(session, syllabus_id)
    if not rec:
        raise SyllabusNotFoundError(syllabus_id)

    raw_data = json.loads(rec.hierarchy_json)
    syllabus = HierarchicalSyllabus.model_validate(raw_data)
    completed_ids = get_completed_leaf_ids(session, syllabus_id)

    notes = get_all_syllabus_notes(session, syllabus_id)
    notes_map = {n.leaf_id: n.content for n in notes}

    resources = get_all_syllabus_resources(session, syllabus_id)

    deadlines = get_target_deadlines(session, syllabus_id)
    deadlines_map = {d.node_id: d for d in deadlines}

    options = ExportOptions(
        include_notes=include_notes,
        include_resources=include_resources,
        include_pacing=include_pacing,
        enrolled_only=enrolled_only,
    )

    html_content = generate_html_report(
        syllabus=syllabus,
        completed_leaf_ids=completed_ids,
        notes_map=notes_map,
        resources_list=resources,
        deadlines_map=deadlines_map,
        options=options,
    )

    return Response(
        content=html_content,
        media_type="text/html; charset=utf-8",
    )


@app.post("/api/syllabus/restore-backup", response_model=BackupRestoreResult)
async def restore_syllabus_backup_endpoint(
    request: Request,
    session: Session = Depends(get_db),
):
    """Restore a syllabus from a portable JSON backup file or JSON payload."""
    content_type = request.headers.get("content-type", "")

    backup_payload: Dict[str, Any] = {}
    mode = "clone"
    target_syllabus_id = None

    if "multipart/form-data" in content_type:
        form = await request.form()
        uploaded_file = form.get("file")
        if not uploaded_file or not hasattr(uploaded_file, "read"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Form data missing 'file' upload",
            )
        file_bytes = await uploaded_file.read()
        try:
            backup_payload = json.loads(file_bytes.decode("utf-8"))
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is not valid JSON",
            )
        mode = form.get("mode", "clone")
        target_syllabus_id = form.get("target_syllabus_id")
    else:
        try:
            body = await request.json()
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Request body must be valid JSON",
            )
        if "backup_data" in body:
            backup_payload = body["backup_data"]
            mode = body.get("mode", "clone")
            target_syllabus_id = body.get("target_syllabus_id")
        else:
            backup_payload = body
            mode = body.get("mode", "clone") if "mode" in body else "clone"
            target_syllabus_id = body.get("target_syllabus_id")

    try:
        result = restore_backup(
            session=session,
            backup_data=backup_payload,
            mode=mode,
            target_syllabus_id=target_syllabus_id,
        )
        session.commit()
        return result
    except (HierarchyValidationError, SyllabusNotFoundError) as e:
        session.rollback()
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to restore backup: {str(e)}",
        )

