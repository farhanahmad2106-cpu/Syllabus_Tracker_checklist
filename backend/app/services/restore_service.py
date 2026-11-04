"""Restore Service for parsing, validating, and restoring portable backup envelopes.

Provides atomic transactional restoration in either 'clone' or 'replace' mode with rollback on error.
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
    mode: Literal["clone", "replace"] = "clone",
    target_syllabus_id: Optional[str] = None,
) -> BackupRestoreResult:
    """
    Restore a syllabus from a portable JSON backup.
    
    In 'clone' mode:
      Generates a fresh unique syllabus_id and creates new records.
    In 'replace' mode:
      Overwrites target_syllabus_id, replacing its hierarchy, completions, notes, resources, and deadlines.
    """
    warnings: List[str] = []

    # 1. Validate envelope
    if not isinstance(backup_data, dict):
        raise HierarchyValidationError("Backup payload must be a JSON object")

    schema_version = str(backup_data.get("schema_version", ""))
    if not schema_version.startswith("2."):
        warnings.append(f"Restoring backup with schema version '{schema_version}'. Expected version 2.x.")

    syllabus_dict = backup_data.get("syllabus")
    if not syllabus_dict or not isinstance(syllabus_dict, dict):
        raise HierarchyValidationError("Backup payload missing 'syllabus' object")

    try:
        syllabus = HierarchicalSyllabus.model_validate(syllabus_dict)
    except Exception as e:
        raise HierarchyValidationError(f"Invalid syllabus hierarchy in backup: {e}")

    # 2. Determine target syllabus ID
    if mode == "replace":
        if not target_syllabus_id:
            raise HierarchyValidationError("target_syllabus_id is required when mode is 'replace'")
        rec = session.scalars(
            select(SyllabusRecord).where(SyllabusRecord.id == target_syllabus_id)
        ).first()
        if not rec:
            raise SyllabusNotFoundError(target_syllabus_id)
        eff_syllabus_id = target_syllabus_id
        syllabus.id = eff_syllabus_id
    else:
        # Clone mode: generate new unique ID
        eff_syllabus_id = f"syl_{uuid.uuid4().hex[:12]}"
        syllabus.id = eff_syllabus_id
        if not syllabus.title.endswith("(Restored)"):
            syllabus.title = f"{syllabus.title} (Restored)"

    # 3. Map valid nodes in hierarchy
    valid_leaves: Set[str] = set(get_all_leaf_ids(syllabus))
    valid_modules: Set[str] = {
        m.id
        for yr in syllabus.years
        for sem in yr.semesters
        for s in sem.subjects
        for m in s.modules
    }
    valid_subjects: Set[str] = {
        s.id
        for yr in syllabus.years
        for sem in yr.semesters
        for s in sem.subjects
    }
    valid_semesters: Set[str] = {
        sem.id
        for yr in syllabus.years
        for sem in yr.semesters
    }

    # 4. If replace mode: clean existing related data
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

    # 5. Persist SyllabusRecord
    now_dt = datetime.now(timezone.utc)
    syllabus.updated_at = now_dt.isoformat()
    if mode == "replace":
        rec = session.scalars(
            select(SyllabusRecord).where(SyllabusRecord.id == eff_syllabus_id)
        ).first()
        assert rec is not None
        rec.title = syllabus.title
        rec.hierarchy_json = syllabus.model_dump_json()
        rec.updated_at = now_dt
    else:
        rec = SyllabusRecord(
            id=eff_syllabus_id,
            title=syllabus.title,
            source_filename=syllabus.source_filename,
            content_hash=None,
            schema_version=syllabus.schema_version,
            hierarchy_json=syllabus.model_dump_json(),
            warnings_json="[]",
            created_at=now_dt,
            updated_at=now_dt,
        )
        session.add(rec)

    session.flush()

    # 6. Restore Completed Leaves
    raw_completed = backup_data.get("completed_leaves", [])
    restored_completed_count = 0
    if isinstance(raw_completed, list):
        for leaf_id in raw_completed:
            if leaf_id in valid_leaves:
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

    # 7. Restore Notes
    raw_notes = backup_data.get("notes", {})
    restored_notes_count = 0
    if isinstance(raw_notes, dict):
        for leaf_id, content in raw_notes.items():
            if leaf_id in valid_leaves:
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

    # 8. Restore Resources
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

    # 9. Restore Deadlines
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

    session.flush()

    return BackupRestoreResult(
        success=True,
        syllabus_id=eff_syllabus_id,
        restored_completed_leaves=restored_completed_count,
        restored_notes=restored_notes_count,
        restored_resources=restored_resources_count,
        restored_deadlines=restored_deadlines_count,
        warnings=warnings,
    )
