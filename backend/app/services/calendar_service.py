"""RFC 5545 iCalendar Serialization Service for Academic Deadlines & SM-2 Revision Schedules.

Pure, deterministic calendar serialization ensuring:
- RFC 5545 compliance (UTF-8 encoding, CRLF line endings, 75-octet physical line folding).
- Strict elective exclusion (leaves and deadlines belonging to unenrolled subjects excluded).
- Completion filtering (completed branches excluded by default; [Completed] prefix when included).
- Stable deterministic UIDs preventing event duplication on import and feed refresh.
- Accurate all-day event date ranges (exclusive DTEND).
"""

from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Set, Tuple

from backend.app.models import RevisionSchedule, TargetDeadline
from backend.app.progress import (
    calculate_syllabus_progress,
    get_all_leaf_ids,
    get_node_descendant_leaf_ids,
    is_subject_enrolled,
)
from backend.app.schemas import HierarchicalSyllabus, Subject
from backend.app.services.pacing import find_node_in_syllabus


def escape_ics_text(value: str) -> str:
    """Escape TEXT property values according to RFC 5545 section 3.3.11.

    Escaping rules:
    - Normalizes CRLF and standalone CR into LF.
    - Backslash (\\) is escaped as '\\\\'.
    - Semicolon (;) is escaped as '\\;'.
    - Comma (,) is escaped as '\\,'.
    - Newline (\\n) is escaped as '\\n'.
    """
    if not value:
        return ""
    # Normalize newlines
    normalized = value.replace("\r\n", "\n").replace("\r", "\n")
    # Escape backslashes first to prevent double-escaping
    escaped = normalized.replace("\\", "\\\\")
    # Escape delimiters
    escaped = escaped.replace(";", "\\;")
    escaped = escaped.replace(",", "\\,")
    # Escape newlines
    escaped = escaped.replace("\n", "\\n")
    return escaped


def fold_ics_line(line: str) -> str:
    """Fold an RFC 5545 content line to a maximum physical line length of 75 octets.

    Requirements:
    - Counts UTF-8 octets, not Python character lengths.
    - Never splits multibyte UTF-8 characters across physical lines.
    - Continuation lines begin with exactly one space (which counts as 1 octet of the 75-octet limit).
    - Physical lines are joined with CRLF (\\r\\n).
    """
    encoded = line.encode("utf-8")
    if len(encoded) <= 75:
        return line

    chunks: List[str] = []
    current_limit = 75  # First physical line has 75 octets available
    current_chars: List[str] = []
    current_bytes = 0

    for char in line:
        char_bytes = len(char.encode("utf-8"))
        if current_bytes + char_bytes > current_limit:
            # Current line full; push folded segment
            chunks.append("".join(current_chars))
            current_chars = [char]
            current_bytes = char_bytes
            current_limit = 74  # Subsequent lines reserve 1 byte for continuation space
        else:
            current_chars.append(char)
            current_bytes += char_bytes

    if current_chars:
        chunks.append("".join(current_chars))

    # Continuation lines start with a single space preceded by CRLF
    return "\r\n ".join(chunks)


def serialize_ics_lines(lines: List[str]) -> str:
    """Fold each logical property line and join with CRLF line endings.

    Guarantees the terminating line also ends with CRLF.
    """
    folded = [fold_ics_line(line) for line in lines]
    return "\r\n".join(folded) + "\r\n"


def _format_date(d: date) -> str:
    """Format a standard date as YYYYMMDD for all-day DTSTART/DTEND."""
    return d.strftime("%Y%m%d")


def _format_dtstamp(dt: Optional[datetime] = None) -> str:
    """Format UTC timestamp as YYYYMMDDTHHMMSSZ for DTSTAMP."""
    ts = dt or datetime.now(timezone.utc)
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    else:
        ts = ts.astimezone(timezone.utc)
    return ts.strftime("%Y%m%d%H%M%SZ")


def build_syllabus_ics(
    syllabus_id: str,
    syllabus_title: str,
    hierarchy: HierarchicalSyllabus,
    deadlines: List[TargetDeadline],
    revisions: List[RevisionSchedule],
    completed_leaf_ids: Optional[Set[str]] = None,
    include_deadlines: bool = True,
    include_revisions: bool = True,
    include_completed: bool = False,
    dtstamp: Optional[datetime] = None,
) -> str:
    """Pure, deterministic RFC 5545 iCalendar builder.

    Generates a VCALENDAR document containing VEVENT components for eligible
    exam/target deadlines and SM-2 revision review schedules.

    Enforces:
    - Elective exclusion: nodes and leaves belonging to unenrolled subjects are excluded.
    - Completion filtering: completed branches excluded by default; [Completed] when included.
    - Stable UIDs: identity remains stable across date, note, or interval changes.
    - Deterministic event ordering: sorted by (event_date, category_order, uid).
    """
    comp_leaf_ids = completed_leaf_ids if completed_leaf_ids is not None else set()
    dtstamp_str = _format_dtstamp(dtstamp)

    # 1. Map hierarchy nodes, subject enrollment, and leaf breadcrumbs
    enrolled_subject_ids: Set[str] = set()
    subject_map: Dict[str, Subject] = {}
    leaf_meta_map: Dict[str, Dict[str, Any]] = {}
    semester_map: Dict[str, Dict[str, Any]] = {}

    for yr in hierarchy.years:
        for sem in yr.semesters:
            semester_map[sem.id] = {
                "title": sem.title,
                "year_title": yr.title,
                "breadcrumb": f"{yr.title} > {sem.title}",
            }
            for subj in sem.subjects:
                subject_map[subj.id] = subj
                is_enrolled = is_subject_enrolled(subj)
                if is_enrolled:
                    enrolled_subject_ids.add(subj.id)

                subj_code_str = f" [{subj.code}]" if getattr(subj, "code", None) else ""
                subj_title_full = f"{subj.title}{subj_code_str}"

                for mod in subj.modules:
                    for top in mod.topics:
                        breadcrumb = f"{yr.title} > {sem.title} > {subj_title_full} > {mod.title} > {top.title}"
                        leaf_meta_map[top.id] = {
                            "title": top.title,
                            "subject_id": subj.id,
                            "subject_title": subj.title,
                            "subject_code": getattr(subj, "code", None),
                            "module_title": mod.title,
                            "semester_title": sem.title,
                            "year_title": yr.title,
                            "breadcrumb": breadcrumb,
                            "is_enrolled": is_enrolled,
                        }

    # 2. Authoritative progress calculation for completion filtering
    _, node_progress_map = calculate_syllabus_progress(hierarchy, comp_leaf_ids)

    # Event accumulator: tuples of (sort_key, event_lines)
    # sort_key: (date_str, category_priority, uid)
    event_entries: List[Tuple[Tuple[str, int, str], List[str]]] = []

    # -------------------------------------------------------------------------
    # 3. Deadline Events (VEVENT)
    # -------------------------------------------------------------------------
    if include_deadlines:
        for dl in deadlines:
            node_id = dl.node_id
            target_date = dl.target_date
            if not target_date:
                continue

            # Lookup node in syllabus hierarchy
            lookup = find_node_in_syllabus(hierarchy, node_id)
            if not lookup:
                continue
            node_obj, node_type = lookup

            # Enforce Elective Exclusion
            if node_type == "subject":
                subj = subject_map.get(node_id)
                if not subj or not is_subject_enrolled(subj):
                    # Unenrolled subject deadline is strictly excluded
                    continue
            elif node_type == "semester":
                # Check if semester contains any enrolled leaves
                descendant_leaves = get_node_descendant_leaf_ids(hierarchy, node_id, enrolled_only=True)
                if not descendant_leaves:
                    # Semester with no enrolled subjects/leaves is excluded
                    continue

            # Check completion status
            node_prog = node_progress_map.get(node_id)
            is_branch_completed = (
                node_prog is not None
                and node_prog.total_leaves > 0
                and node_prog.completed_leaves == node_prog.total_leaves
            )

            if is_branch_completed and not include_completed:
                # Exclude completed branch deadlines by default
                continue

            node_title = getattr(node_obj, "title", node_id)
            node_code = getattr(node_obj, "code", None)
            display_title = f"{node_title} ({node_code})" if node_code else node_title

            # Build Summary
            prefix = "[Completed] " if is_branch_completed else ""
            summary_raw = f"{prefix}[Exam / Deadline] {display_title} ({syllabus_title})"
            summary = escape_ics_text(summary_raw)

            # Build Breadcrumb Path
            if node_type == "semester":
                sem_info = semester_map.get(node_id, {})
                breadcrumb_path = sem_info.get("breadcrumb", node_title)
            elif node_type == "subject":
                # Find semester for subject
                sem_name = "Semester"
                for yr in hierarchy.years:
                    for sem in yr.semesters:
                        if any(s.id == node_id for s in sem.subjects):
                            sem_name = f"{yr.title} > {sem.title}"
                            break
                breadcrumb_path = f"{sem_name} > {display_title}"
            else:
                breadcrumb_path = display_title

            # Progress details
            comp_cnt = node_prog.completed_leaves if node_prog else 0
            tot_cnt = node_prog.total_leaves if node_prog else 0
            pct_val = node_prog.progress_percent if node_prog else 0.0
            progress_str = f"{comp_cnt}/{tot_cnt} topics ({pct_val}%)"

            # Build Description
            desc_parts = [
                f"Syllabus: {syllabus_title}",
                f"Scope: {node_type.title()}",
                f"Item: {display_title}",
                f"Path: {breadcrumb_path}",
                f"Progress: {progress_str}",
                f"Target Deadline: {target_date.isoformat()}",
            ]
            if is_branch_completed:
                desc_parts.append("Status: Completed (100%)")

            description_escaped = escape_ics_text("\n".join(desc_parts))

            # Stable UID
            uid = f"deadline-{syllabus_id}-{node_id}@syllabustracker.app"

            # All-day dates
            dtstart_val = _format_date(target_date)
            dtend_val = _format_date(target_date + timedelta(days=1))

            vevent_lines = [
                "BEGIN:VEVENT",
                f"UID:{uid}",
                f"DTSTAMP:{dtstamp_str}",
                f"DTSTART;VALUE=DATE:{dtstart_val}",
                f"DTEND;VALUE=DATE:{dtend_val}",
                f"SUMMARY:{summary}",
                f"DESCRIPTION:{description_escaped}",
                "CATEGORIES:EXAM,DEADLINE,SYLLABUS",
                "BEGIN:VALARM",
                "ACTION:DISPLAY",
                "TRIGGER:-P1D",
                "DESCRIPTION:Upcoming academic deadline",
                "END:VALARM",
                "END:VEVENT",
            ]

            sort_key = (dtstart_val, 0, uid)
            event_entries.append((sort_key, vevent_lines))

    # -------------------------------------------------------------------------
    # 4. SM-2 Revision Events (VEVENT)
    # -------------------------------------------------------------------------
    if include_revisions:
        for rev in revisions:
            leaf_id = rev.leaf_id
            review_date = rev.next_review_date
            if not review_date:
                continue

            # Strict Suspended Filter
            if rev.is_suspended:
                continue

            # Strict Elective Exclusion: check leaf's parent subject enrollment
            meta = leaf_meta_map.get(leaf_id)
            if not meta or not meta.get("is_enrolled", True):
                continue

            # Check if parent branch completed
            subject_id = meta.get("subject_id")
            subj_prog = node_progress_map.get(subject_id) if subject_id else None
            is_branch_completed = (
                subj_prog is not None
                and subj_prog.total_leaves > 0
                and subj_prog.completed_leaves == subj_prog.total_leaves
            )
            # Active SM-2 spaced repetition for completed leaves remains visible unless branch completed filtering is enforced
            if is_branch_completed and not include_completed:
                # Check whether topic itself is completed; SM-2 reviews exist for completed topics.
                # However, if user chose not to include completed course events, exclude:
                # Per spec 4.2: "Completed academic branches must follow the established completion
                # semantics and must not produce misleading active revision events."
                # If the entire subject is complete and include_completed is False, skip:
                continue

            leaf_title = meta.get("title", leaf_id)
            rep_next = rev.repetition_count + 1
            summary_raw = f"[SM-2 Review #{rep_next}] {leaf_title}"
            summary = escape_ics_text(summary_raw)

            # Build Description
            desc_parts = [
                f"Syllabus: {syllabus_title}",
                f"Path: {meta.get('breadcrumb', leaf_title)}",
                f"Topic: {leaf_title}",
                f"Interval: {rev.interval_days}d",
                f"Ease Factor: EF {rev.ease_factor:.2f}",
                f"Repetitions: {rev.repetition_count}",
                f"Scheduled Review: {review_date.isoformat()}",
            ]
            description_escaped = escape_ics_text("\n".join(desc_parts))

            # Stable UID
            uid = f"revision-{syllabus_id}-{leaf_id}@syllabustracker.app"

            # All-day dates
            dtstart_val = _format_date(review_date)
            dtend_val = _format_date(review_date + timedelta(days=1))

            vevent_lines = [
                "BEGIN:VEVENT",
                f"UID:{uid}",
                f"DTSTAMP:{dtstamp_str}",
                f"DTSTART;VALUE=DATE:{dtstart_val}",
                f"DTEND;VALUE=DATE:{dtend_val}",
                f"SUMMARY:{summary}",
                f"DESCRIPTION:{description_escaped}",
                "CATEGORIES:REVISION,SPACED-REPETITION,SYLLABUS",
                "END:VEVENT",
            ]

            sort_key = (dtstart_val, 1, uid)
            event_entries.append((sort_key, vevent_lines))

    # -------------------------------------------------------------------------
    # 5. Deterministic Sort & VCALENDAR Envelope Assembly
    # -------------------------------------------------------------------------
    event_entries.sort(key=lambda x: x[0])

    cal_name = escape_ics_text(f"Syllabus Tracker - {syllabus_title}")
    cal_desc = escape_ics_text("Academic deadlines and spaced-repetition schedule")

    calendar_lines: List[str] = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Syllabus Tracker//Academic Calendar 1.0//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        f"X-WR-CALNAME:{cal_name}",
        f"X-WR-CALDESC:{cal_desc}",
    ]

    for _, event_lines in event_entries:
        calendar_lines.extend(event_lines)

    calendar_lines.append("END:VCALENDAR")

    return serialize_ics_lines(calendar_lines)
