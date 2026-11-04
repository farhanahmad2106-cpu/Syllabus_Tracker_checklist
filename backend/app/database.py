"""SQLite database engine, connection configuration, and session management."""

import json
import os
from contextlib import contextmanager
from datetime import date, datetime, timezone
from typing import Generator, List, Optional, Set, Tuple

from sqlalchemy import create_engine, event, select, delete, text
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from backend.app.config import settings
from backend.app.exceptions import (
    HierarchyValidationError,
    InvalidLeafError,
    InvalidNodeError,
    SyllabusNotFoundError,
)
from backend.app.models import Base, LeafCompletionRecord, SyllabusRecord, TargetDeadline, TopicNote, TopicResource
from backend.app.schemas import (
    HierarchicalSyllabus,
    ParseReviewResponse,
    ProgressSummary,
    Subject,
    SyllabusSummary,
)
from backend.app.progress import calculate_syllabus_progress, get_all_leaf_ids


def create_db_engine(db_url: Optional[str] = None) -> Engine:
    """Create a configured SQLite engine with WAL mode and foreign key enforcement."""
    url = db_url or settings.DATABASE_URL
    is_sqlite = url.startswith("sqlite")

    if is_sqlite and ":memory:" not in url:
        clean_path = url.replace("sqlite:///", "")
        db_dir = os.path.dirname(clean_path)
        if db_dir:
            os.makedirs(db_dir, exist_ok=True)

    engine = create_engine(
        url,
        connect_args={"check_same_thread": False} if is_sqlite else {},
        echo=False,
    )

    if is_sqlite:
        @event.listens_for(engine, "connect")
        def set_sqlite_pragma(dbapi_connection, connection_record):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.execute("PRAGMA busy_timeout=5000")
            # In memory databases don't use WAL
            if ":memory:" not in url:
                try:
                    cursor.execute("PRAGMA journal_mode=WAL")
                except Exception:
                    pass
            cursor.close()

    return engine


# Default engine and sessionmaker
engine = create_db_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db(db_engine: Optional[Engine] = None) -> None:
    """Initialize database tables and run non-destructive schema migrations."""
    target_engine = db_engine or engine
    Base.metadata.create_all(bind=target_engine)

    # Safe idempotent migration: verify content_hash column exists on syllabi table
    try:
        with target_engine.connect() as conn:
            result = conn.execute(text("PRAGMA table_info(syllabi)"))
            columns = [row[1] for row in result.fetchall()]
            if "content_hash" not in columns:
                conn.execute(text("ALTER TABLE syllabi ADD COLUMN content_hash VARCHAR(64)"))
                conn.commit()

            if "source_type" not in columns:
                conn.execute(text("ALTER TABLE syllabi ADD COLUMN source_type VARCHAR(32) DEFAULT 'upload'"))
                conn.commit()

            if "source_url" not in columns:
                conn.execute(text("ALTER TABLE syllabi ADD COLUMN source_url VARCHAR(2048)"))
                conn.commit()

            # Ensure target_deadlines table is created if running against existing database
            table_check = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='target_deadlines'"))
            if not table_check.fetchone():
                TargetDeadline.__table__.create(bind=conn, checkfirst=True)
                conn.commit()

            # Ensure topic_notes table is created if running against existing database
            notes_check = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='topic_notes'"))
            if not notes_check.fetchone():
                TopicNote.__table__.create(bind=conn, checkfirst=True)
                conn.commit()

            # Ensure topic_resources table is created if running against existing database
            res_check = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='topic_resources'"))
            if not res_check.fetchone():
                TopicResource.__table__.create(bind=conn, checkfirst=True)
                conn.commit()
    except Exception:
        pass


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency for obtaining a database session."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@contextmanager
def get_db_context(session_factory: Optional[sessionmaker] = None) -> Generator[Session, None, None]:
    """Context manager for non-FastAPI database operations."""
    factory = session_factory or SessionLocal
    session = factory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


# --- Database Repository Helpers ---

def save_syllabus(
    session: Session,
    syllabus: HierarchicalSyllabus,
    warnings: Optional[List[str]] = None,
    content_hash: Optional[str] = None,
) -> SyllabusRecord:
    """Persist or update a syllabus record transactionally."""
    eff_hash = content_hash or syllabus.content_hash
    if not eff_hash:
        import hashlib
        eff_hash = hashlib.sha256(syllabus.model_dump_json().encode("utf-8")).hexdigest()

    existing = None
    if eff_hash:
        stmt = select(SyllabusRecord).where(
            SyllabusRecord.content_hash == eff_hash,
            SyllabusRecord.source_filename == syllabus.source_filename,
        )
        existing = session.scalars(stmt).first()

    if not existing:
        existing = get_syllabus_record(session, syllabus.id)

    if existing:
        # Update existing record in-place preserving its completions
        existing.title = syllabus.title
        existing.source_filename = syllabus.source_filename
        existing.source_type = getattr(syllabus, "source_type", "upload") or "upload"
        existing.source_url = getattr(syllabus, "source_url", None)
        existing.content_hash = eff_hash
        existing.schema_version = syllabus.schema_version
        existing.hierarchy_json = syllabus.model_dump_json()
        existing.warnings_json = json.dumps(warnings or [])
        existing.updated_at = datetime.now(timezone.utc)
        session.flush()
        return existing

    record = SyllabusRecord(
        id=syllabus.id,
        title=syllabus.title,
        source_filename=syllabus.source_filename,
        source_type=getattr(syllabus, "source_type", "upload") or "upload",
        source_url=getattr(syllabus, "source_url", None),
        content_hash=eff_hash,
        schema_version=syllabus.schema_version,
        hierarchy_json=syllabus.model_dump_json(),
        warnings_json=json.dumps(warnings or []),
        created_at=datetime.fromisoformat(syllabus.created_at) if syllabus.created_at else datetime.now(timezone.utc),
        updated_at=datetime.fromisoformat(syllabus.updated_at) if syllabus.updated_at else datetime.now(timezone.utc),
    )
    session.add(record)
    session.flush()
    return record


def get_syllabus_record(session: Session, syllabus_id: str) -> Optional[SyllabusRecord]:
    """Retrieve a syllabus record by ID."""
    stmt = select(SyllabusRecord).where(SyllabusRecord.id == syllabus_id)
    return session.scalars(stmt).first()


def get_syllabus_by_hash(session: Session, content_hash: str) -> Optional[SyllabusRecord]:
    """Retrieve a syllabus record by its content hash."""
    stmt = select(SyllabusRecord).where(SyllabusRecord.content_hash == content_hash)
    return session.scalars(stmt).first()


def list_syllabi_summaries(session: Session) -> List[SyllabusSummary]:
    """List all saved syllabi with their calculated progress totals, deduplicating canonical documents."""
    records = session.scalars(
        select(SyllabusRecord).order_by(SyllabusRecord.created_at.desc())
    ).all()

    summaries = []
    seen_ids: Set[str] = set()
    for r in records:
        if r.id in seen_ids:
            continue
        seen_ids.add(r.id)

        try:
            raw_data = json.loads(r.hierarchy_json)
            syllabus = HierarchicalSyllabus.model_validate(raw_data)
        except Exception:
            continue

        completed_ids = get_completed_leaf_ids(session, r.id)
        prog, _ = calculate_syllabus_progress(syllabus, completed_ids)
        all_leaves = get_all_leaf_ids(syllabus)

        summaries.append(
            SyllabusSummary(
                id=r.id,
                title=r.title,
                created_at=r.created_at.isoformat(),
                updated_at=r.updated_at.isoformat(),
                source_filename=r.source_filename,
                source_type=getattr(r, "source_type", "upload") or "upload",
                source_url=getattr(r, "source_url", None),
                progress=prog,
                leaf_count=len(all_leaves),
            )
        )
    return summaries


def get_completed_leaf_ids(session: Session, syllabus_id: str) -> Set[str]:
    """Get the set of completed leaf IDs for a syllabus."""
    stmt = select(LeafCompletionRecord.leaf_id).where(
        LeafCompletionRecord.syllabus_id == syllabus_id
    )
    return set(session.scalars(stmt).all())


def update_leaf_completion(
    session: Session,
    syllabus: HierarchicalSyllabus,
    leaf_id: str,
    is_completed: bool,
) -> Set[str]:
    """Atomically and idempotently set completion state for a single leaf."""
    valid_leaves = set(get_all_leaf_ids(syllabus))
    if leaf_id not in valid_leaves:
        raise InvalidLeafError(leaf_id=leaf_id)

    if is_completed:
        # Idempotent insert: only add if not already present
        existing = session.scalars(
            select(LeafCompletionRecord).where(
                LeafCompletionRecord.syllabus_id == syllabus.id,
                LeafCompletionRecord.leaf_id == leaf_id,
            )
        ).first()
        if not existing:
            new_rec = LeafCompletionRecord(syllabus_id=syllabus.id, leaf_id=leaf_id)
            session.add(new_rec)
    else:
        # Idempotent remove
        stmt = delete(LeafCompletionRecord).where(
            LeafCompletionRecord.syllabus_id == syllabus.id,
            LeafCompletionRecord.leaf_id == leaf_id,
        )
        session.execute(stmt)

    # Update syllabus updated_at
    rec = get_syllabus_record(session, syllabus.id)
    if rec:
        rec.updated_at = datetime.now(timezone.utc)

    session.flush()
    return get_completed_leaf_ids(session, syllabus.id)


def update_bulk_completion(
    session: Session,
    syllabus: HierarchicalSyllabus,
    target_leaf_ids: Set[str],
    is_completed: bool,
) -> Set[str]:
    """Atomically set completion for a set of resolved descendant leaf IDs."""
    valid_leaves = set(get_all_leaf_ids(syllabus))
    invalid = target_leaf_ids - valid_leaves
    if invalid:
        raise InvalidLeafError(
            leaf_id=next(iter(invalid)),
            message=f"Target leaf IDs include invalid IDs: {invalid}"
        )

    current_completed = get_completed_leaf_ids(session, syllabus.id)

    if is_completed:
        to_add = target_leaf_ids - current_completed
        for lid in to_add:
            session.add(LeafCompletionRecord(syllabus_id=syllabus.id, leaf_id=lid))
    else:
        to_remove = target_leaf_ids & current_completed
        if to_remove:
            stmt = delete(LeafCompletionRecord).where(
                LeafCompletionRecord.syllabus_id == syllabus.id,
                LeafCompletionRecord.leaf_id.in_(to_remove),
            )
            session.execute(stmt)

    rec = get_syllabus_record(session, syllabus.id)
    if rec:
        rec.updated_at = datetime.now(timezone.utc)

    session.flush()
    return get_completed_leaf_ids(session, syllabus.id)


def update_syllabus_title(
    session: Session, syllabus_id: str, new_title: str
) -> SyllabusRecord:
    """Update syllabus title in metadata and within hierarchy JSON."""
    rec = get_syllabus_record(session, syllabus_id)
    if not rec:
        raise SyllabusNotFoundError(syllabus_id)

    rec.title = new_title.strip()
    rec.updated_at = datetime.now(timezone.utc)

    # Also update title inside hierarchy JSON
    raw_data = json.loads(rec.hierarchy_json)
    raw_data["title"] = rec.title
    raw_data["updated_at"] = rec.updated_at.isoformat()
    rec.hierarchy_json = json.dumps(raw_data)

    session.flush()
    return rec


def delete_syllabus(session: Session, syllabus_id: str) -> bool:
    """Delete a syllabus and its completions/deadlines/notes/resources (via cascade and explicit deletion)."""
    rec = get_syllabus_record(session, syllabus_id)
    if not rec:
        raise SyllabusNotFoundError(syllabus_id)

    # Delete completions, deadlines, notes, and resources explicitly for absolute transactional safety
    session.execute(
        delete(LeafCompletionRecord).where(LeafCompletionRecord.syllabus_id == syllabus_id)
    )
    session.execute(
        delete(TargetDeadline).where(TargetDeadline.syllabus_id == syllabus_id)
    )
    session.execute(
        delete(TopicNote).where(TopicNote.syllabus_id == syllabus_id)
    )
    session.execute(
        delete(TopicResource).where(TopicResource.syllabus_id == syllabus_id)
    )
    session.delete(rec)
    session.flush()
    return True


def get_target_deadlines(session: Session, syllabus_id: str) -> List[TargetDeadline]:
    """Retrieve all target deadlines registered for a syllabus."""
    stmt = select(TargetDeadline).where(TargetDeadline.syllabus_id == syllabus_id)
    return list(session.scalars(stmt).all())


def get_target_deadline(
    session: Session, syllabus_id: str, node_id: str
) -> Optional[TargetDeadline]:
    """Retrieve a target deadline for a specific node in a syllabus."""
    stmt = select(TargetDeadline).where(
        TargetDeadline.syllabus_id == syllabus_id,
        TargetDeadline.node_id == node_id,
    )
    return session.scalars(stmt).first()


def upsert_target_deadline(
    session: Session,
    syllabus_id: str,
    node_id: str,
    node_type: str,
    target_date: date,
) -> TargetDeadline:
    """
    Atomically insert or update a target deadline for a syllabus node.
    Enforces unique constraint on (syllabus_id, node_id) and preserves created_at.
    """
    now = datetime.now(timezone.utc)
    stmt = sqlite_insert(TargetDeadline).values(
        syllabus_id=syllabus_id,
        node_id=node_id,
        node_type=node_type,
        target_date=target_date,
        created_at=now,
        updated_at=now,
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=["syllabus_id", "node_id"],
        set_={
            "target_date": stmt.excluded.target_date,
            "node_type": stmt.excluded.node_type,
            "updated_at": stmt.excluded.updated_at,
        },
    )
    session.execute(stmt)
    session.flush()

    rec = get_target_deadline(session, syllabus_id, node_id)
    assert rec is not None
    return rec


def delete_target_deadline(
    session: Session, syllabus_id: str, node_id: str
) -> bool:
    """Idempotently delete a target deadline for a specific node in a syllabus."""
    stmt = delete(TargetDeadline).where(
        TargetDeadline.syllabus_id == syllabus_id,
        TargetDeadline.node_id == node_id,
    )
    session.execute(stmt)
    session.flush()
    return True


def get_syllabus_review(session: Session, syllabus_id: str) -> ParseReviewResponse:
    """Retrieve draft hierarchy and detected elective groups for student enrollment confirmation."""
    rec = get_syllabus_record(session, syllabus_id)
    if not rec:
        raise SyllabusNotFoundError(syllabus_id)

    raw_data = json.loads(rec.hierarchy_json)
    syllabus = HierarchicalSyllabus.model_validate(raw_data)
    warnings = json.loads(rec.warnings_json) if rec.warnings_json else []

    detected_electives: List[Subject] = []
    elective_groups: dict[str, List[Subject]] = {}

    for yr in syllabus.years:
        for sem in yr.semesters:
            for subj in sem.subjects:
                if subj.is_elective or subj.enrollment_status in ("pending", "selected", "excluded"):
                    detected_electives.append(subj)
                    grp = subj.elective_group or f"{sem.title} Electives"
                    if grp not in elective_groups:
                        elective_groups[grp] = []
                    elective_groups[grp].append(subj)

    return ParseReviewResponse(
        syllabus_id=syllabus.id,
        title=syllabus.title,
        detected_electives=detected_electives,
        elective_groups=elective_groups,
        years=syllabus.years,
        requires_enrollment_confirmation=syllabus.requires_enrollment_confirmation,
        extraction_warnings=warnings,
    )


def finalize_syllabus_enrollment(
    session: Session,
    syllabus_id: str,
    enrolled_subject_ids: List[str],
) -> HierarchicalSyllabus:
    """
    Atomically finalize or update elective enrollment for a syllabus.
    - Validates that all submitted subject IDs belong to the syllabus.
    - Mandatory courses remain enrolled.
    - Elective courses matching enrolled_subject_ids become enrolled ('selected').
    - Non-matching elective courses become excluded ('excluded').
    - Completed leaf records are strictly preserved.
    """
    rec = get_syllabus_record(session, syllabus_id)
    if not rec:
        raise SyllabusNotFoundError(syllabus_id)

    raw_data = json.loads(rec.hierarchy_json)
    syllabus = HierarchicalSyllabus.model_validate(raw_data)

    # Build lookup of all subjects in syllabus
    subject_map: dict[str, Subject] = {}
    for yr in syllabus.years:
        for sem in yr.semesters:
            for subj in sem.subjects:
                subject_map[subj.id] = subj

    # Validate that every submitted ID belongs to this syllabus
    submitted_set = set(enrolled_subject_ids)
    invalid_ids = submitted_set - set(subject_map.keys())
    if invalid_ids:
        raise HierarchyValidationError(
            f"Submitted subject ID(s) do not belong to syllabus '{syllabus_id}': {sorted(invalid_ids)}"
        )

    # Apply enrollment states
    for subj in subject_map.values():
        if subj.is_elective:
            if subj.id in submitted_set:
                subj.is_enrolled = True
                subj.enrollment_status = "selected"
            else:
                subj.is_enrolled = False
                subj.enrollment_status = "excluded"
        else:
            # Mandatory course: cannot be excluded
            subj.is_enrolled = True
            subj.enrollment_status = "mandatory"

    syllabus.requires_enrollment_confirmation = False
    syllabus.updated_at = datetime.now(timezone.utc).isoformat()

    rec.hierarchy_json = syllabus.model_dump_json()
    rec.updated_at = datetime.now(timezone.utc)
    session.flush()

    return syllabus


# --- Topic Notes Helpers ---

def get_topic_note(session: Session, syllabus_id: str, leaf_id: str) -> Optional[TopicNote]:
    """Retrieve a topic note for a specific leaf subtopic in a syllabus."""
    stmt = select(TopicNote).where(
        TopicNote.syllabus_id == syllabus_id,
        TopicNote.leaf_id == leaf_id,
    )
    return session.scalars(stmt).first()


def upsert_topic_note(
    session: Session,
    syllabus_id: str,
    leaf_id: str,
    content: str,
) -> TopicNote:
    """
    Atomically insert or update a topic note for a leaf subtopic.
    Preserves created_at while updating content and updated_at.
    """
    now = datetime.now(timezone.utc)
    stmt = sqlite_insert(TopicNote).values(
        syllabus_id=syllabus_id,
        leaf_id=leaf_id,
        content=content,
        created_at=now,
        updated_at=now,
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=["syllabus_id", "leaf_id"],
        set_={
            "content": stmt.excluded.content,
            "updated_at": stmt.excluded.updated_at,
        },
    )
    session.execute(stmt)
    session.flush()

    note = get_topic_note(session, syllabus_id, leaf_id)
    assert note is not None
    return note


def delete_topic_note(session: Session, syllabus_id: str, leaf_id: str) -> bool:
    """Delete a topic note for a specific leaf subtopic in a syllabus. Returns True if deleted, False if not found."""
    existing = get_topic_note(session, syllabus_id, leaf_id)
    if not existing:
        return False
    session.delete(existing)
    session.flush()
    return True


def get_all_syllabus_notes(session: Session, syllabus_id: str) -> List[TopicNote]:
    """Retrieve all topic notes saved for a syllabus."""
    stmt = select(TopicNote).where(TopicNote.syllabus_id == syllabus_id)
    return list(session.scalars(stmt).all())


# --- Topic Resources Helpers ---

def get_topic_resources(
    session: Session,
    syllabus_id: str,
    node_id: Optional[str] = None,
    node_type: Optional[str] = None,
) -> List[TopicResource]:
    """Retrieve resources for a syllabus, optionally filtered by node_id and/or node_type."""
    stmt = select(TopicResource).where(TopicResource.syllabus_id == syllabus_id)
    if node_id:
        stmt = stmt.where(TopicResource.node_id == node_id)
    if node_type:
        stmt = stmt.where(TopicResource.node_type == node_type)
    stmt = stmt.order_by(TopicResource.created_at.asc())
    return list(session.scalars(stmt).all())


def get_all_syllabus_resources(session: Session, syllabus_id: str) -> List[TopicResource]:
    """Retrieve all resources saved for a syllabus."""
    stmt = select(TopicResource).where(
        TopicResource.syllabus_id == syllabus_id
    ).order_by(TopicResource.created_at.asc())
    return list(session.scalars(stmt).all())


def add_topic_resource(
    session: Session,
    syllabus_id: str,
    node_id: str,
    node_type: str,
    title: str,
    url: str,
    resource_type: str = "link",
) -> TopicResource:
    """Add a new learning resource attached to a subtopic or module."""
    now = datetime.now(timezone.utc)
    res = TopicResource(
        syllabus_id=syllabus_id,
        node_id=node_id,
        node_type=node_type,
        title=title,
        url=url,
        resource_type=resource_type,
        created_at=now,
    )
    session.add(res)
    session.flush()
    return res


def delete_topic_resource(
    session: Session,
    syllabus_id: str,
    resource_id: int,
) -> bool:
    """Delete a learning resource by ID for a syllabus. Returns True if deleted, False if not found."""
    stmt = select(TopicResource).where(
        TopicResource.id == resource_id,
        TopicResource.syllabus_id == syllabus_id,
    )
    res = session.scalars(stmt).first()
    if not res:
        return False
    session.delete(res)
    session.flush()
    return True


