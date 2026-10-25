"""Document Ingestion Service coordinating parsing, extraction, validation, and persistence."""

import uuid
from typing import Optional, Tuple
from sqlalchemy.orm import Session

from backend.app.database import save_syllabus, get_completed_leaf_ids
from backend.app.extractor import extract_curriculum
from backend.app.parser import parse_uploaded_file
from backend.app.progress import calculate_syllabus_progress
from backend.app.schemas import HierarchicalSyllabus, SyllabusResponse
from backend.app.validation import canonicalize_extracted_curriculum


def ingest_syllabus_document(
    session: Session,
    file_bytes: bytes,
    filename: str,
    allow_fallback_extraction: bool = True,
    model_override: Optional[str] = None,
) -> SyllabusResponse:
    """
    Executes the complete document ingestion pipeline:
    1. Validation & parsing
    2. Extraction (LLM with deterministic fallback)
    3. Hierarchy canonicalization & grounding check
    4. SQLite transactional persistence
    5. Returns canonical response with initial progress
    """
    # 1. Parse document
    parsed_doc = parse_uploaded_file(file_bytes, filename)

    # 2. Extract structured curriculum
    extracted = extract_curriculum(
        parsed_doc,
        allow_fallback=allow_fallback_extraction,
        model_override=model_override,
    )

    # 3. Canonicalize and validate
    syllabus_id = f"syl_{uuid.uuid4().hex[:12]}"
    canonical_syllabus, warnings = canonicalize_extracted_curriculum(
        extracted=extracted,
        source_filename=filename,
        source_document_text=parsed_doc.text,
        syllabus_id=syllabus_id,
    )

    # 4. Save to SQLite within active transaction
    save_syllabus(session, canonical_syllabus, warnings=warnings)

    # 5. Compute initial progress (0 completed)
    completed_ids = get_completed_leaf_ids(session, canonical_syllabus.id)
    prog, node_prog = calculate_syllabus_progress(canonical_syllabus, completed_ids)

    return SyllabusResponse(
        syllabus=canonical_syllabus,
        completed_leaf_ids=list(completed_ids),
        progress=prog,
        node_progress=node_prog,
        warnings=warnings,
    )
