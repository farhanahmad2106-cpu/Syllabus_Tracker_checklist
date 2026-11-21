"""Restore Service for parsing, validating, and restoring portable backup envelopes.

Provides atomic transactional restoration in 'clone', 'replace', or 'merge' mode with rollback on error.
Supports Schema 2.0, Schema 2.1, and Schema 2.2 full-fidelity academic archives.
"""

from datetime import date, datetime, timezone
import json
from typing import Any, Dict, List, Literal, Optional, Set
from urllib.parse import urlparse
import uuid

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from backend.app.exceptions import HierarchyValidationError, SyllabusNotFoundError
from backend.app.models import (
    LeafCompletionRecord,
    RevisionSchedule,
    StudyFlashcard,
    SubjectAcademicPlan,
    SyllabusRecord,
    TargetDeadline,
    TopicNote,
    TopicResource,
)
from backend.app.schemas import (
    BackupRestoreResult,
    HierarchicalSyllabus,
)
from backend.app.progress import get_all_leaf_ids


def validate_safe_url(url: str) -> bool:
    """Check that URL has http/https scheme, a valid host, and no user credentials."""
    try:
        parsed = urlparse(url.strip())
        if parsed.scheme.lower() not in ("http", "https"):
            return False
        if not parsed.netloc:
            return False
        if parsed.username or parsed.password:
            return False
        return True
    except Exception:
        return False


def restore_backup(
    session: Session,
    backup_data: Dict[str, Any],
    mode: Literal["clone", "replace", "merge"] = "clone",
    target_syllabus_id: Optional[str] = None,
) -> BackupRestoreResult:
    """
    Restore a syllabus from a portable JSON backup.
    
    In 'clone' mode:
      Generates a fresh unique syllabus_id and creates isolated records with complete ID remapping.
    In 'replace' mode:
      Overwrites target_syllabus_id, replacing its hierarchy, completions, notes, resources, deadlines,
      revision schedules, academic plans, and flashcards.
    In 'merge' mode:
      Integrates incoming study records into target_syllabus_id, preserving existing destination state
      and safely deduplicating items to prevent data collisions.
    """
    warnings: List[str] = []

    # 1. Validate envelope
    if not isinstance(backup_data, dict):
        raise HierarchyValidationError("Backup payload must be a JSON object")

    schema_version = str(backup_data.get("schema_version", "2.0"))
    if not schema_version.startswith("2."):
        warnings.append(f"Restoring backup with schema version '{schema_version}'. Expected version 2.x.")

    syllabus_dict = backup_data.get("syllabus")
    if not syllabus_dict or not isinstance(syllabus_dict, dict):
        raise HierarchyValidationError("Backup payload missing 'syllabus' object")

    try:
        incoming_syllabus = HierarchicalSyllabus.model_validate(syllabus_dict)
    except Exception as e:
        raise HierarchyValidationError(f"Invalid syllabus hierarchy in backup: {e}")

    now_dt = datetime.now(timezone.utc)

    # 2. Determine target syllabus ID & handle mode setup
    if mode in ("replace", "merge"):
        if not target_syllabus_id:
            raise HierarchyValidationError(f"target_syllabus_id is required when mode is '{mode}'")
        rec = session.scalars(
            select(SyllabusRecord).where(SyllabusRecord.id == target_syllabus_id)
        ).first()
        if not rec:
            raise SyllabusNotFoundError(target_syllabus_id)
        eff_syllabus_id = target_syllabus_id
    else:
        # Clone mode: generate new unique ID
        eff_syllabus_id = f"syl_{uuid.uuid4().hex[:12]}"
        incoming_syllabus.id = eff_syllabus_id
        if not incoming_syllabus.title.endswith("(Restored)"):
            incoming_syllabus.title = f"{incoming_syllabus.title} (Restored)"

    # 3. Determine active syllabus hierarchy reference for validation
    if mode == "merge":
        rec = session.scalars(
            select(SyllabusRecord).where(SyllabusRecord.id == eff_syllabus_id)
        ).first()
        assert rec is not None
        active_syllabus = HierarchicalSyllabus.model_validate(json.loads(rec.hierarchy_json))
    else:
        active_syllabus = incoming_syllabus
        active_syllabus.id = eff_syllabus_id

    valid_leaves: Set[str] = set(get_all_leaf_ids(active_syllabus))
    valid_modules: Set[str] = {
        m.id
        for yr in active_syllabus.years
        for sem in yr.semesters
        for s in sem.subjects
        for m in s.modules
    }
    valid_subjects: Set[str] = {
        s.id
        for yr in active_syllabus.years
        for sem in yr.semesters
        for s in sem.subjects
    }
    valid_semesters: Set[str] = {
        sem.id
        for yr in active_syllabus.years
        for sem in yr.semesters
    }

    # 4. Handle Replace / Clone persistence of SyllabusRecord
    if mode == "replace":
        session.execute(
            delete(LeafCompletionRecord).where(LeafCompletionRecord.syllabus_id == eff_syllabus_id)
        )
        session.execute(
            delete(TargetDeadline).where(TargetDeadline.syllabus_id == eff_syllabus_id)
        )
        session.execute(
            delete(TopicNote).where(TopicNote.syllabus_id == eff_syllabus_id)
        )
        session.execute(
            delete(TopicResource).where(TopicResource.syllabus_id == eff_syllabus_id)
        )
        session.execute(
            delete(RevisionSchedule).where(RevisionSchedule.syllabus_id == eff_syllabus_id)
        )
        session.execute(
            delete(SubjectAcademicPlan).where(SubjectAcademicPlan.syllabus_id == eff_syllabus_id)
        )
        session.execute(
            delete(StudyFlashcard).where(StudyFlashcard.syllabus_id == eff_syllabus_id)
        )

        rec = session.scalars(
            select(SyllabusRecord).where(SyllabusRecord.id == eff_syllabus_id)
        ).first()
        assert rec is not None
        rec.title = active_syllabus.title
        rec.hierarchy_json = active_syllabus.model_dump_json()
        rec.updated_at = now_dt
        session.flush()

    elif mode == "clone":
        rec = SyllabusRecord(
            id=eff_syllabus_id,
            title=active_syllabus.title,
            source_filename=active_syllabus.source_filename,
            content_hash=None,
            schema_version=active_syllabus.schema_version,
            hierarchy_json=active_syllabus.model_dump_json(),
            warnings_json="[]",
            created_at=now_dt,
            updated_at=now_dt,
        )
        session.add(rec)
        session.flush()

    # Query destination state if in merge mode for conflict resolution & deduplication
    existing_completed: Set[str] = set()
    existing_notes: Set[str] = set()
    existing_resources: Set[tuple] = set()
    existing_deadlines: Set[str] = set()
    existing_schedules: Set[str] = set()
    existing_plans: Set[str] = set()
    existing_flashcard_fps: Set[str] = set()
    existing_flashcard_qs: Set[tuple] = set()

    if mode == "merge":
        existing_completed = set(
            session.scalars(
                select(LeafCompletionRecord.leaf_id).where(LeafCompletionRecord.syllabus_id == eff_syllabus_id)
            ).all()
        )
        existing_notes = set(
            session.scalars(
                select(TopicNote.leaf_id).where(TopicNote.syllabus_id == eff_syllabus_id)
            ).all()
        )
        res_records = session.scalars(
            select(TopicResource).where(TopicResource.syllabus_id == eff_syllabus_id)
        ).all()
        existing_resources = {(r.node_id, r.url) for r in res_records}
        existing_deadlines = set(
            session.scalars(
                select(TargetDeadline.node_id).where(TargetDeadline.syllabus_id == eff_syllabus_id)
            ).all()
        )
        existing_schedules = set(
            session.scalars(
                select(RevisionSchedule.leaf_id).where(RevisionSchedule.syllabus_id == eff_syllabus_id)
            ).all()
        )
        existing_plans = set(
            session.scalars(
                select(SubjectAcademicPlan.subject_id).where(SubjectAcademicPlan.syllabus_id == eff_syllabus_id)
            ).all()
        )
        fc_records = session.scalars(
            select(StudyFlashcard).where(StudyFlashcard.syllabus_id == eff_syllabus_id)
        ).all()
        existing_flashcard_fps = {f.fingerprint for f in fc_records if f.fingerprint}
        existing_flashcard_qs = {(f.leaf_id, f.front_question) for f in fc_records}

    # 5. Restore Completed Leaves
    raw_completed = backup_data.get("completed_leaves", [])
    restored_completed_count = 0
    if isinstance(raw_completed, list):
        for leaf_id in raw_completed:
            if leaf_id in valid_leaves:
                if mode == "merge" and leaf_id in existing_completed:
                    continue
                session.add(
                    LeafCompletionRecord(
                        syllabus_id=eff_syllabus_id,
                        leaf_id=leaf_id,
                        completed_at=now_dt,
                    )
                )
                restored_completed_count += 1
            else:
                warnings.append(f"Skipped completion for non-existent leaf: {leaf_id}")

    # 6. Restore Notes
    raw_notes = backup_data.get("notes", {})
    restored_notes_count = 0
    if isinstance(raw_notes, dict):
        for leaf_id, content in raw_notes.items():
            if leaf_id in valid_leaves:
                if mode == "merge" and leaf_id in existing_notes:
                    warnings.append(f"Preserved destination note conflict for leaf: {leaf_id}")
                    continue
                content_str = str(content)[:50000]
                session.add(
                    TopicNote(
                        syllabus_id=eff_syllabus_id,
                        leaf_id=leaf_id,
                        content=content_str,
                        created_at=now_dt,
                        updated_at=now_dt,
                    )
                )
                restored_notes_count += 1
            else:
                warnings.append(f"Skipped note for non-existent leaf: {leaf_id}")

    # 7. Restore Resources
    raw_resources = backup_data.get("resources", [])
    restored_resources_count = 0
    if isinstance(raw_resources, list):
        for r in raw_resources:
            if not isinstance(r, dict):
                continue
            n_id = r.get("node_id")
            n_type = r.get("node_type", "subtopic")
            title = str(r.get("title", "")).strip()[:200]
            url = str(r.get("url", "")).strip()[:2048]
            r_type = r.get("resource_type", "link")

            if n_type == "subtopic" and n_id not in valid_leaves:
                warnings.append(f"Skipped resource '{title}' for non-existent subtopic: {n_id}")
                continue
            elif n_type == "module" and n_id not in valid_modules:
                warnings.append(f"Skipped resource '{title}' for non-existent module: {n_id}")
                continue

            if not validate_safe_url(url):
                warnings.append(f"Skipped resource '{title}' due to unsafe URL: {url}")
                continue

            if mode == "merge" and (n_id, url) in existing_resources:
                continue

            session.add(
                TopicResource(
                    syllabus_id=eff_syllabus_id,
                    node_id=n_id,
                    node_type=n_type,
                    title=title or "Resource",
                    url=url,
                    resource_type=r_type if r_type in ("youtube", "documentation", "slides", "github", "link") else "link",
                    created_at=now_dt,
                )
            )
            restored_resources_count += 1

    # 8. Restore Deadlines
    raw_deadlines = backup_data.get("deadlines", {})
    restored_deadlines_count = 0
    if isinstance(raw_deadlines, dict):
        for node_id, d_info in raw_deadlines.items():
            if not isinstance(d_info, dict):
                continue
            target_str = d_info.get("target_date")
            n_type = d_info.get("node_type", "subject")

            if n_type == "subject" and node_id not in valid_subjects:
                warnings.append(f"Skipped deadline for non-existent subject: {node_id}")
                continue
            elif n_type == "semester" and node_id not in valid_semesters:
                warnings.append(f"Skipped deadline for non-existent semester: {node_id}")
                continue

            if mode == "merge" and node_id in existing_deadlines:
                warnings.append(f"Preserved destination deadline conflict for {node_id}")
                continue

            try:
                t_date = date.fromisoformat(target_str)
            except Exception:
                warnings.append(f"Skipped deadline for {node_id}: invalid date format '{target_str}'")
                continue

            session.add(
                TargetDeadline(
                    syllabus_id=eff_syllabus_id,
                    node_id=node_id,
                    node_type=n_type,
                    target_date=t_date,
                    created_at=now_dt,
                    updated_at=now_dt,
                )
            )
            restored_deadlines_count += 1

    # 9. Restore Revision Schedules (Schema 2.2)
    raw_schedules = backup_data.get("revision_schedules", [])
    restored_schedules_count = 0
    if isinstance(raw_schedules, list):
        for s_info in raw_schedules:
            if not isinstance(s_info, dict):
                continue
            leaf_id = s_info.get("leaf_id")
            if leaf_id in valid_leaves:
                if mode == "merge" and leaf_id in existing_schedules:
                    warnings.append(f"Preserved destination revision schedule conflict for leaf: {leaf_id}")
                    continue

                next_rev_str = s_info.get("next_review_date")
                try:
                    next_rev = date.fromisoformat(next_rev_str) if next_rev_str else now_dt.date()
                except Exception:
                    next_rev = now_dt.date()

                last_rev_str = s_info.get("last_reviewed_at")
                try:
                    last_rev = datetime.fromisoformat(last_rev_str) if last_rev_str else None
                except Exception:
                    last_rev = None

                session.add(
                    RevisionSchedule(
                        syllabus_id=eff_syllabus_id,
                        leaf_id=leaf_id,
                        algorithm_version=str(s_info.get("algorithm_version", "sm2-v1")),
                        repetition_count=int(s_info.get("repetition_count", 0)),
                        ease_factor=float(s_info.get("ease_factor", 2.5)),
                        interval_days=int(s_info.get("interval_days", 1)),
                        next_review_date=next_rev,
                        last_reviewed_at=last_rev,
                        last_quality=s_info.get("last_quality"),
                        is_suspended=bool(s_info.get("is_suspended", False)),
                        created_at=now_dt,
                        updated_at=now_dt,
                    )
                )
                restored_schedules_count += 1
            else:
                warnings.append(f"Skipped revision schedule for non-existent leaf: {leaf_id}")

    # 10. Restore Academic Plans (Schema 2.2)
    raw_plans = backup_data.get("academic_plans", [])
    restored_plans_count = 0
    if isinstance(raw_plans, list):
        for p_info in raw_plans:
            if not isinstance(p_info, dict):
                continue
            subject_id = p_info.get("subject_id")
            if subject_id in valid_subjects:
                if mode == "merge" and subject_id in existing_plans:
                    warnings.append(f"Preserved destination academic plan conflict for subject: {subject_id}")
                    continue

                g_scale = p_info.get("grade_scale", "10.0")
                session.add(
                    SubjectAcademicPlan(
                        syllabus_id=eff_syllabus_id,
                        subject_id=subject_id,
                        credit_override=float(p_info["credit_override"]) if p_info.get("credit_override") is not None else None,
                        target_grade_points=float(p_info["target_grade_points"]) if p_info.get("target_grade_points") is not None else None,
                        grade_scale=g_scale if g_scale in ("10.0", "4.0") else "10.0",
                        created_at=now_dt,
                        updated_at=now_dt,
                    )
                )
                restored_plans_count += 1
            else:
                warnings.append(f"Skipped academic plan for non-existent subject: {subject_id}")

    # 11. Restore Flashcards (Schema 2.2)
    raw_flashcards = backup_data.get("flashcards", [])
    restored_flashcards_count = 0
    if isinstance(raw_flashcards, list):
        for fc_info in raw_flashcards:
            if not isinstance(fc_info, dict):
                continue
            leaf_id = fc_info.get("leaf_id")
            if leaf_id in valid_leaves:
                fp = fc_info.get("fingerprint")
                fq = str(fc_info.get("front_question", ""))

                if mode == "merge":
                    if fp and fp in existing_flashcard_fps:
                        warnings.append(f"Skipped duplicate flashcard with fingerprint for leaf: {leaf_id}")
                        continue
                    if (leaf_id, fq) in existing_flashcard_qs:
                        warnings.append(f"Skipped duplicate flashcard question for leaf: {leaf_id}")
                        continue

                session.add(
                    StudyFlashcard(
                        syllabus_id=eff_syllabus_id,
                        leaf_id=leaf_id,
                        front_question=fq,
                        back_answer=str(fc_info.get("back_answer", "")),
                        citation_label=str(fc_info.get("citation_label", "Syllabus Excerpt")),
                        source_quote=str(fc_info.get("source_quote", "")),
                        source_type=fc_info.get("source_type", "official_syllabus"),
                        source_page=fc_info.get("source_page"),
                        created_by=fc_info.get("created_by", "ai_grounded"),
                        fingerprint=fp,
                        created_at=now_dt,
                        updated_at=now_dt,
                    )
                )
                restored_flashcards_count += 1
            else:
                warnings.append(f"Skipped flashcard for non-existent leaf: {leaf_id}")

    session.flush()

    return BackupRestoreResult(
        success=True,
        syllabus_id=eff_syllabus_id,
        restored_completed_leaves=restored_completed_count,
        restored_notes=restored_notes_count,
        restored_resources=restored_resources_count,
        restored_deadlines=restored_deadlines_count,
        restored_revision_schedules=restored_schedules_count,
        restored_academic_plans=restored_plans_count,
        restored_flashcards=restored_flashcards_count,
        mode=mode,
        source_schema_version=schema_version,
        warnings=warnings,
    )
