"""FastAPI entrypoint and API router implementation for the Syllabus Tracker."""

import json
import logging
from contextlib import asynccontextmanager
from typing import Any, Dict, List

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from backend.app.config import settings
from backend.app.database import (
    delete_syllabus,
    get_completed_leaf_ids,
    get_db,
    get_syllabus_record,
    init_db,
    list_syllabi_summaries,
    update_bulk_completion,
    update_leaf_completion,
    update_syllabus_title,
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
from backend.app.extractor import check_ollama_status, get_preferred_model
from backend.app.progress import (
    calculate_syllabus_progress,
    determine_bulk_toggle_action,
    get_node_descendant_leaf_ids,
    node_exists_in_syllabus,
)
from backend.app.schemas import (
    BulkToggleRequest,
    HierarchicalSyllabus,
    LeafToggleRequest,
    SyllabusRenameRequest,
    SyllabusResponse,
    SyllabusSummary,
)
from backend.app.services.ingestion import ingest_syllabus_document

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
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"detail": str(exc), "error_type": "FileValidationError"},
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

@app.get("/api/health")
def get_health() -> Dict[str, Any]:
    """Lightweight application health check returning DB and Ollama model diagnostics."""
    is_ollama_up, available_models, ollama_msg = check_ollama_status()
    preferred_model = get_preferred_model(available_models) if is_ollama_up else None

    return {
        "status": "healthy",
        "database": "connected",
        "ollama": {
            "is_reachable": is_ollama_up,
            "message": ollama_msg,
            "configured_model": settings.OLLAMA_MODEL,
            "configured_fallback": settings.OLLAMA_FALLBACK_MODEL,
            "resolved_model": preferred_model,
            "available_models": available_models,
        },
    }


@app.get("/api/syllabi", response_model=List[SyllabusSummary])
def list_syllabi(session: Session = Depends(get_db)):
    """List all saved syllabi with progress totals."""
    return list_syllabi_summaries(session)


@app.post("/api/upload", response_model=SyllabusResponse, status_code=status.HTTP_201_CREATED)
async def upload_syllabus(
    file: UploadFile = File(...),
    session: Session = Depends(get_db),
):
    """
    Upload and ingest an academic syllabus document (PDF, DOCX, TXT).
    Parses document, extracts 5-level hierarchy via Ollama/Instructor, validates grounding,
    and commits to SQLite transactionally.
    """
    if not file.filename:
        raise FileValidationError("Upload must include a valid filename.")

    content = await file.read()
    if len(content) > settings.MAX_UPLOAD_SIZE_BYTES:
        raise FileValidationError(
            f"File exceeds maximum upload size of {settings.MAX_UPLOAD_SIZE_BYTES // (1024*1024)} MiB."
        )

    try:
        response = ingest_syllabus_document(
            session=session,
            file_bytes=content,
            filename=file.filename,
            allow_fallback_extraction=True,
        )
        session.commit()
        return response
    except Exception:
        session.rollback()
        raise


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

    try:
        completed_ids = update_leaf_completion(
            session=session,
            syllabus=syllabus,
            leaf_id=payload.leaf_id,
            is_completed=payload.is_completed,
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
    (academic year, semester, topic, or whole syllabus).
    """
    rec = get_syllabus_record(session, syllabus_id)
    if not rec:
        raise SyllabusNotFoundError(syllabus_id)

    syllabus = HierarchicalSyllabus.model_validate(json.loads(rec.hierarchy_json))
    warnings = json.loads(rec.warnings_json) if rec.warnings_json else []

    if payload.leaf_ids is not None:
        target_set = set(payload.leaf_ids)
        is_completed = payload.is_completed
    elif payload.node_id is not None:
        if not node_exists_in_syllabus(syllabus, payload.node_id):
            raise InvalidNodeError(payload.node_id)
        descendant_leaves = get_node_descendant_leaf_ids(syllabus, payload.node_id)
        target_set, is_completed = determine_bulk_toggle_action(
            descendant_leaf_ids=descendant_leaves,
            current_completed_ids=get_completed_leaf_ids(session, syllabus_id),
            explicit_target_state=payload.is_completed,
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
