"""SQLite database engine, connection configuration, and session management."""

import json
import os
from contextlib import contextmanager
from datetime import date, datetime, timedelta, timezone
from typing import Any, Generator, List, Optional, Set, Tuple

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
from backend.app.models import (
    Base,
    CompletionEvent,
    LeafCompletionRecord,
    RevisionEvent,
    RevisionSchedule,
    StudyFlashcard,
    SubjectAcademicPlan,
    SyllabusRecord,
    TargetDeadline,
    TopicNote,
    TopicResource,
)
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

            # Ensure completion_events table is created if running against existing database
            ce_check = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='completion_events'"))
            if not ce_check.fetchone():
                CompletionEvent.__table__.create(bind=conn, checkfirst=True)
                conn.commit()

            # Ensure revision_schedules table is created if running against existing database
            rs_check = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='revision_schedules'"))
            if not rs_check.fetchone():
                RevisionSchedule.__table__.create(bind=conn, checkfirst=True)
                conn.commit()

            # Ensure revision_events table is created if running against existing database
            re_check = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='revision_events'"))
            if not re_check.fetchone():
                RevisionEvent.__table__.create(bind=conn, checkfirst=True)
                conn.commit()

            # Ensure subject_academic_plans table is created if running against existing database
            sap_check = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='subject_academic_plans'"))
            if not sap_check.fetchone():
                SubjectAcademicPlan.__table__.create(bind=conn, checkfirst=True)
                conn.commit()

            # Ensure study_flashcards table is created if running against existing database
            sf_check = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='study_flashcards'"))
            if not sf_check.fetchone():
                StudyFlashcard.__table__.create(bind=conn, checkfirst=True)
                conn.commit()

            # Ensure SQLite FTS5 virtual table exists for local RAG retrieval
            try:
                conn.execute(
                    text(
                        """
                        CREATE VIRTUAL TABLE IF NOT EXISTS syllabus_retrieval_fts USING fts5(
                            syllabus_id UNINDEXED,
                            leaf_id UNINDEXED,
                            source_type UNINDEXED,
                            hierarchy_breadcrumb,
                            title,
                            content,
                            source_page UNINDEXED,
                            tokenize = 'unicode61'
                        )
                        """
                    )
                )
                conn.commit()
            except Exception:
                pass

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
        try:
            rebuild_syllabus_fts_index(session, syllabus.id)
        except Exception:
            pass
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
    try:
        rebuild_syllabus_fts_index(session, syllabus.id)
    except Exception:
        pass
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
    event_source: str = "user_toggle",
    idempotency_key: Optional[str] = None,
) -> Set[str]:
    """Atomically and idempotently set completion state for a single leaf, logging historical events and updating revision schedules."""
    valid_leaves = set(get_all_leaf_ids(syllabus))
    if leaf_id not in valid_leaves:
        raise InvalidLeafError(leaf_id=leaf_id)

    now = datetime.now(timezone.utc)
    existing = session.scalars(
        select(LeafCompletionRecord).where(
            LeafCompletionRecord.syllabus_id == syllabus.id,
            LeafCompletionRecord.leaf_id == leaf_id,
        )
    ).first()

    if is_completed:
        # Idempotent insert: only add if not already present
        if not existing:
            new_rec = LeafCompletionRecord(syllabus_id=syllabus.id, leaf_id=leaf_id, completed_at=now)
            session.add(new_rec)
            session.add(
                CompletionEvent(
                    syllabus_id=syllabus.id,
                    leaf_id=leaf_id,
                    action="completed",
                    recorded_at=now,
                    event_source=event_source,
                    idempotency_key=idempotency_key,
                )
            )
            # Initialize or reactivate revision schedule
            sched = session.scalars(
                select(RevisionSchedule).where(
                    RevisionSchedule.syllabus_id == syllabus.id,
                    RevisionSchedule.leaf_id == leaf_id,
                )
            ).first()
            if not sched:
                tomorrow = now.date() + timedelta(days=1)
                session.add(
                    RevisionSchedule(
                        syllabus_id=syllabus.id,
                        leaf_id=leaf_id,
                        algorithm_version="sm2-v1",
                        repetition_count=0,
                        ease_factor=2.5,
                        interval_days=1,
                        next_review_date=tomorrow,
                        is_suspended=False,
                        created_at=now,
                        updated_at=now,
                    )
                )
            elif sched.is_suspended:
                sched.is_suspended = False
                sched.updated_at = now
                if sched.next_review_date < now.date():
                    sched.next_review_date = now.date()
    else:
        # Idempotent remove: only delete if present
        if existing:
            stmt = delete(LeafCompletionRecord).where(
                LeafCompletionRecord.syllabus_id == syllabus.id,
                LeafCompletionRecord.leaf_id == leaf_id,
            )
            session.execute(stmt)
            session.add(
                CompletionEvent(
                    syllabus_id=syllabus.id,
                    leaf_id=leaf_id,
                    action="uncompleted",
                    recorded_at=now,
                    event_source=event_source,
                    idempotency_key=idempotency_key,
                )
            )
            # Suspend revision schedule if active
            sched = session.scalars(
                select(RevisionSchedule).where(
                    RevisionSchedule.syllabus_id == syllabus.id,
                    RevisionSchedule.leaf_id == leaf_id,
                )
            ).first()
            if sched and not sched.is_suspended:
                sched.is_suspended = True
                sched.updated_at = now

    # Update syllabus updated_at
    rec = get_syllabus_record(session, syllabus.id)
    if rec:
        rec.updated_at = now

    session.flush()
    return get_completed_leaf_ids(session, syllabus.id)


def update_bulk_completion(
    session: Session,
    syllabus: HierarchicalSyllabus,
    target_leaf_ids: Set[str],
    is_completed: bool,
    event_source: str = "bulk_toggle",
    idempotency_key: Optional[str] = None,
) -> Set[str]:
    """Atomically set completion for a set of resolved descendant leaf IDs, logging historical events and updating revision schedules."""
    valid_leaves = set(get_all_leaf_ids(syllabus))
    invalid = target_leaf_ids - valid_leaves
    if invalid:
        raise InvalidLeafError(
            leaf_id=next(iter(invalid)),
            message=f"Target leaf IDs include invalid IDs: {invalid}"
        )

    current_completed = get_completed_leaf_ids(session, syllabus.id)
    now = datetime.now(timezone.utc)
    tomorrow = now.date() + timedelta(days=1)

    if is_completed:
        to_add = target_leaf_ids - current_completed
        if to_add:
            existing_scheds = {
                s.leaf_id: s for s in session.scalars(
                    select(RevisionSchedule).where(
                        RevisionSchedule.syllabus_id == syllabus.id,
                        RevisionSchedule.leaf_id.in_(to_add),
                    )
                ).all()
            }
            for lid in to_add:
                session.add(LeafCompletionRecord(syllabus_id=syllabus.id, leaf_id=lid, completed_at=now))
                session.add(
                    CompletionEvent(
                        syllabus_id=syllabus.id,
                        leaf_id=lid,
                        action="completed",
                        recorded_at=now,
                        event_source=event_source,
                        idempotency_key=idempotency_key,
                    )
                )
                if lid not in existing_scheds:
                    session.add(
                        RevisionSchedule(
                            syllabus_id=syllabus.id,
                            leaf_id=lid,
                            algorithm_version="sm2-v1",
                            repetition_count=0,
                            ease_factor=2.5,
                            interval_days=1,
                            next_review_date=tomorrow,
                            is_suspended=False,
                            created_at=now,
                            updated_at=now,
                        )
                    )
                else:
                    s = existing_scheds[lid]
                    if s.is_suspended:
                        s.is_suspended = False
                        s.updated_at = now
                        if s.next_review_date < now.date():
                            s.next_review_date = now.date()
    else:
        to_remove = target_leaf_ids & current_completed
        if to_remove:
            stmt = delete(LeafCompletionRecord).where(
                LeafCompletionRecord.syllabus_id == syllabus.id,
                LeafCompletionRecord.leaf_id.in_(to_remove),
            )
            session.execute(stmt)

            existing_scheds = {
                s.leaf_id: s for s in session.scalars(
                    select(RevisionSchedule).where(
                        RevisionSchedule.syllabus_id == syllabus.id,
                        RevisionSchedule.leaf_id.in_(to_remove),
                    )
                ).all()
            }
            for lid in to_remove:
                session.add(
                    CompletionEvent(
                        syllabus_id=syllabus.id,
                        leaf_id=lid,
                        action="uncompleted",
                        recorded_at=now,
                        event_source=event_source,
                        idempotency_key=idempotency_key,
                    )
                )
                if lid in existing_scheds:
                    s = existing_scheds[lid]
                    if not s.is_suspended:
                        s.is_suspended = True
                        s.updated_at = now

    rec = get_syllabus_record(session, syllabus.id)
    if rec:
        rec.updated_at = now

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
    session.execute(
        delete(CompletionEvent).where(CompletionEvent.syllabus_id == syllabus_id)
    )
    session.execute(
        delete(RevisionSchedule).where(RevisionSchedule.syllabus_id == syllabus_id)
    )
    session.execute(
        delete(RevisionEvent).where(RevisionEvent.syllabus_id == syllabus_id)
    )
    session.execute(
        delete(SubjectAcademicPlan).where(SubjectAcademicPlan.syllabus_id == syllabus_id)
    )
    session.execute(
        delete(StudyFlashcard).where(StudyFlashcard.syllabus_id == syllabus_id)
    )
    try:
        delete_syllabus_fts(session, syllabus_id)
    except Exception:
        pass
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

    try:
        rebuild_syllabus_fts_index(session, syllabus_id)
    except Exception:
        pass

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
    try:
        sync_topic_note_fts(session, syllabus_id, leaf_id, content)
    except Exception:
        pass
    return note


def delete_topic_note(session: Session, syllabus_id: str, leaf_id: str) -> bool:
    """Delete a topic note for a specific leaf subtopic in a syllabus. Returns True if deleted, False if not found."""
    existing = get_topic_note(session, syllabus_id, leaf_id)
    if not existing:
        return False
    session.delete(existing)
    session.flush()
    try:
        delete_topic_note_fts(session, syllabus_id, leaf_id)
    except Exception:
        pass
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


def get_subject_academic_plans(
    session: Session, syllabus_id: str
) -> List[SubjectAcademicPlan]:
    """Retrieve all subject academic planning records for a syllabus."""
    stmt = select(SubjectAcademicPlan).where(SubjectAcademicPlan.syllabus_id == syllabus_id)
    return list(session.scalars(stmt).all())


def get_subject_academic_plan(
    session: Session, syllabus_id: str, subject_id: str
) -> Optional[SubjectAcademicPlan]:
    """Retrieve an academic plan record for a specific subject."""
    stmt = select(SubjectAcademicPlan).where(
        SubjectAcademicPlan.syllabus_id == syllabus_id,
        SubjectAcademicPlan.subject_id == subject_id,
    )
    return session.scalars(stmt).first()


def upsert_subject_academic_plan(
    session: Session,
    syllabus_id: str,
    subject_id: str,
    credit_override: Any = None,
    target_grade_points: Optional[float] = None,
    grade_scale: str = "10.0",
) -> SubjectAcademicPlan:
    """Create or update an academic plan record for a subject."""
    if hasattr(credit_override, "credit_override"):
        plan_obj = credit_override
        credit_override = plan_obj.credit_override
        target_grade_points = plan_obj.target_grade_points
        grade_scale = getattr(plan_obj, "grade_scale", None) or grade_scale
    elif isinstance(credit_override, dict):
        plan_dict = credit_override
        credit_override = plan_dict.get("credit_override")
        target_grade_points = plan_dict.get("target_grade_points")
        grade_scale = plan_dict.get("grade_scale", grade_scale)

    now = datetime.now(timezone.utc)
    rec = get_subject_academic_plan(session, syllabus_id, subject_id)
    if rec:
        rec.credit_override = credit_override
        rec.target_grade_points = target_grade_points
        rec.grade_scale = grade_scale
        rec.updated_at = now
    else:
        rec = SubjectAcademicPlan(
            syllabus_id=syllabus_id,
            subject_id=subject_id,
            credit_override=credit_override,
            target_grade_points=target_grade_points,
            grade_scale=grade_scale,
            created_at=now,
            updated_at=now,
        )
        session.add(rec)
    session.flush()
    return rec


# ===========================================================================
# Phase 13 Cycle B: FTS5 Local RAG Indexing & Flashcards Helpers
# ===========================================================================


def ensure_fts_table(session: Session) -> None:
    """Ensure syllabus_retrieval_fts virtual table exists in the active session's database."""
    try:
        session.execute(
            text(
                """
                CREATE VIRTUAL TABLE IF NOT EXISTS syllabus_retrieval_fts USING fts5(
                    syllabus_id UNINDEXED,
                    leaf_id UNINDEXED,
                    source_type UNINDEXED,
                    hierarchy_breadcrumb,
                    title,
                    content,
                    source_page UNINDEXED,
                    tokenize = 'unicode61'
                )
                """
            )
        )
    except Exception:
        pass


def delete_syllabus_fts(session: Session, syllabus_id: str) -> None:
    """Remove all indexed syllabus excerpts and personal notes for a syllabus from FTS5."""
    ensure_fts_table(session)
    try:
        session.execute(
            text("DELETE FROM syllabus_retrieval_fts WHERE syllabus_id = :syl_id"),
            {"syl_id": syllabus_id},
        )
    except Exception:
        pass


def rebuild_syllabus_fts_index(session: Session, syllabus_id: str) -> int:
    """
    Deterministically rebuild the FTS5 index for a syllabus from scratch.
    - Purges stale FTS rows for syllabus_id.
    - Indexes enrolled Tier-5 leaves with breadcrumb context and verbatim source_text.
    - Indexes student personal notes for enrolled leaves.
    - Excludes unenrolled electives.
    """
    ensure_fts_table(session)
    rec = get_syllabus_record(session, syllabus_id)
    if not rec:
        return 0

    delete_syllabus_fts(session, syllabus_id)

    raw_data = json.loads(rec.hierarchy_json)
    syllabus = HierarchicalSyllabus.model_validate(raw_data)

    leaf_meta: dict[str, dict[str, Any]] = {}
    total_indexed = 0

    # Index official syllabus excerpts
    for yr in syllabus.years:
        for sem in yr.semesters:
            for subj in sem.subjects:
                # Exclude unenrolled electives
                if not getattr(subj, "is_enrolled", True):
                    continue
                subj_title = f"{subj.code} - {subj.title}" if getattr(subj, "code", None) else subj.title
                for mod in subj.modules:
                    breadcrumb = f"{yr.title} > {sem.title} > {subj_title} > {mod.title}"
                    for top in mod.topics:
                        leaf_meta[top.id] = {
                            "title": top.title,
                            "breadcrumb": breadcrumb,
                            "subject_id": subj.id,
                        }
                        page_val = str(top.source_page) if getattr(top, "source_page", None) is not None else ""
                        try:
                            session.execute(
                                text(
                                    """
                                    INSERT INTO syllabus_retrieval_fts(
                                        syllabus_id, leaf_id, source_type, hierarchy_breadcrumb, title, content, source_page
                                    ) VALUES (:syl_id, :leaf_id, 'syllabus_excerpt', :breadcrumb, :title, :content, :source_page)
                                    """
                                ),
                                {
                                    "syl_id": syllabus_id,
                                    "leaf_id": top.id,
                                    "breadcrumb": breadcrumb,
                                    "title": top.title,
                                    "content": top.source_text or top.title,
                                    "source_page": page_val,
                                },
                            )
                            total_indexed += 1
                        except Exception:
                            pass

    # Index personal notes for enrolled leaves
    notes = get_all_syllabus_notes(session, syllabus_id)
    for note in notes:
        meta = leaf_meta.get(note.leaf_id)
        if not meta or not note.content.strip():
            continue
        try:
            session.execute(
                text(
                    """
                    INSERT INTO syllabus_retrieval_fts(
                        syllabus_id, leaf_id, source_type, hierarchy_breadcrumb, title, content, source_page
                    ) VALUES (:syl_id, :leaf_id, 'student_note', :breadcrumb, :title, :content, '')
                    """
                ),
                {
                    "syl_id": syllabus_id,
                    "leaf_id": note.leaf_id,
                    "breadcrumb": meta["breadcrumb"],
                    "title": f"Note: {meta['title']}",
                    "content": note.content,
                },
            )
            total_indexed += 1
        except Exception:
            pass

    return total_indexed


def sync_topic_note_fts(
    session: Session,
    syllabus_id: str,
    leaf_id: str,
    content: str,
) -> None:
    """Synchronize an updated or created topic note in FTS5."""
    ensure_fts_table(session)
    try:
        # Delete prior note row in FTS
        session.execute(
            text(
                "DELETE FROM syllabus_retrieval_fts WHERE syllabus_id = :syl_id AND leaf_id = :leaf_id AND source_type = 'student_note'"
            ),
            {"syl_id": syllabus_id, "leaf_id": leaf_id},
        )
        if content.strip():
            # Resolve breadcrumb from syllabus record
            rec = get_syllabus_record(session, syllabus_id)
            if rec:
                raw_data = json.loads(rec.hierarchy_json)
                syllabus = HierarchicalSyllabus.model_validate(raw_data)
                breadcrumb = "Course Notes"
                title = "Note"
                found = False
                for yr in syllabus.years:
                    if found:
                        break
                    for sem in yr.semesters:
                        if found:
                            break
                        for subj in sem.subjects:
                            if not getattr(subj, "is_enrolled", True):
                                continue
                            for mod in subj.modules:
                                for top in mod.topics:
                                    if top.id == leaf_id:
                                        subj_title = f"{subj.code} - {subj.title}" if getattr(subj, "code", None) else subj.title
                                        breadcrumb = f"{yr.title} > {sem.title} > {subj_title} > {mod.title}"
                                        title = f"Note: {top.title}"
                                        found = True
                                        break
                session.execute(
                    text(
                        """
                        INSERT INTO syllabus_retrieval_fts(
                            syllabus_id, leaf_id, source_type, hierarchy_breadcrumb, title, content, source_page
                        ) VALUES (:syl_id, :leaf_id, 'student_note', :breadcrumb, :title, :content, '')
                        """
                    ),
                    {
                        "syl_id": syllabus_id,
                        "leaf_id": leaf_id,
                        "breadcrumb": breadcrumb,
                        "title": title,
                        "content": content,
                    },
                )
    except Exception:
        pass


def delete_topic_note_fts(session: Session, syllabus_id: str, leaf_id: str) -> None:
    """Delete a topic note row from FTS5."""
    ensure_fts_table(session)
    try:
        session.execute(
            text(
                "DELETE FROM syllabus_retrieval_fts WHERE syllabus_id = :syl_id AND leaf_id = :leaf_id AND source_type = 'student_note'"
            ),
            {"syl_id": syllabus_id, "leaf_id": leaf_id},
        )
    except Exception:
        pass


# --- Study Flashcards Persistence Helpers ---

def get_study_flashcards(
    session: Session,
    syllabus_id: str,
    leaf_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> List[StudyFlashcard]:
    """Retrieve flashcards for a syllabus, optionally filtered by leaf_id."""
    stmt = select(StudyFlashcard).where(StudyFlashcard.syllabus_id == syllabus_id)
    if leaf_id:
        stmt = stmt.where(StudyFlashcard.leaf_id == leaf_id)
    stmt = stmt.order_by(StudyFlashcard.created_at.desc()).offset(offset).limit(limit)
    return list(session.scalars(stmt).all())


def get_study_flashcard(
    session: Session,
    syllabus_id: str,
    card_id: int,
) -> Optional[StudyFlashcard]:
    """Retrieve a single flashcard by syllabus_id and card_id."""
    stmt = select(StudyFlashcard).where(
        StudyFlashcard.syllabus_id == syllabus_id,
        StudyFlashcard.id == card_id,
    )
    return session.scalars(stmt).first()


def create_study_flashcard(
    session: Session,
    card: StudyFlashcard,
) -> StudyFlashcard:
    """Save a new study flashcard."""
    session.add(card)
    session.flush()
    return card


def create_study_flashcards_batch(
    session: Session,
    cards: List[StudyFlashcard],
) -> List[StudyFlashcard]:
    """Save a batch of study flashcards."""
    for c in cards:
        session.add(c)
    session.flush()
    return cards


def delete_study_flashcard(
    session: Session,
    syllabus_id: str,
    card_id: int,
) -> bool:
    """Delete a flashcard by syllabus_id and card_id. Returns True if deleted, False otherwise."""
    card = get_study_flashcard(session, syllabus_id, card_id)
    if not card:
        return False
    session.delete(card)
    session.flush()
    return True




