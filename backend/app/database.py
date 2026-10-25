"""SQLite database engine, connection configuration, and session management."""

import json
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Generator, List, Optional, Set, Tuple

from sqlalchemy import create_engine, event, select, delete
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from backend.app.config import settings
from backend.app.exceptions import (
    InvalidLeafError,
    InvalidNodeError,
    SyllabusNotFoundError,
)
from backend.app.models import Base, LeafCompletionRecord, SyllabusRecord
from backend.app.schemas import HierarchicalSyllabus, SyllabusSummary, ProgressSummary
from backend.app.progress import calculate_syllabus_progress, get_all_leaf_ids


def create_db_engine(db_url: Optional[str] = None) -> Engine:
    """Create a configured SQLite engine with WAL mode and foreign key enforcement."""
    url = db_url or settings.DATABASE_URL
    is_sqlite = url.startswith("sqlite")

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
    """Initialize database tables."""
    target_engine = db_engine or engine
    Base.metadata.create_all(bind=target_engine)


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
) -> SyllabusRecord:
    """Persist a new syllabus record transactionally."""
    record = SyllabusRecord(
        id=syllabus.id,
        title=syllabus.title,
        source_filename=syllabus.source_filename,
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


def list_syllabi_summaries(session: Session) -> List[SyllabusSummary]:
    """List all saved syllabi with their calculated progress totals."""
    records = session.scalars(
        select(SyllabusRecord).order_by(SyllabusRecord.created_at.desc())
    ).all()

    summaries = []
    for r in records:
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
    """Delete a syllabus and its completions (via cascade and explicit deletion)."""
    rec = get_syllabus_record(session, syllabus_id)
    if not rec:
        raise SyllabusNotFoundError(syllabus_id)

    # Delete completions explicitly for absolute transactional safety
    session.execute(
        delete(LeafCompletionRecord).where(LeafCompletionRecord.syllabus_id == syllabus_id)
    )
    session.delete(rec)
    session.flush()
    return True
