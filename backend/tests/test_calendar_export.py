"""Unit and integration tests for RFC 5545 iCalendar Export & Secure Subscribed Feeds."""

from datetime import date, datetime, timedelta, timezone
import hashlib
import json
import pytest

from backend.app.database import (
    finalize_syllabus_enrollment,
    get_syllabus_record,
    save_syllabus,
    update_leaf_completion,
    upsert_target_deadline,
)
from backend.app.models import RevisionSchedule, TargetDeadline
from backend.app.schemas import (
    AcademicYear,
    HierarchicalSyllabus,
    Module,
    Semester,
    Subject,
    Subtopic,
)
from backend.app.services.calendar_service import (
    build_syllabus_ics,
    escape_ics_text,
    fold_ics_line,
    serialize_ics_lines,
)


@pytest.fixture
def calendar_test_syllabus() -> HierarchicalSyllabus:
    """Fixture providing a standard 5-tier syllabus with enrolled and unenrolled branches."""
    return HierarchicalSyllabus(
        id="syl_cal_test",
        title="Computer Science & Data Engineering",
        source_filename="cs_de_curriculum.pdf",
        schema_version=2,
        years=[
            AcademicYear(
                id="yr_1",
                title="Year 1",
                order_index=0,
                semesters=[
                    Semester(
                        id="sem_1",
                        title="Semester 1",
                        order_index=0,
                        subjects=[
                            Subject(
                                id="subj_ds",
                                title="Data Structures & Algorithms",
                                code="CS101",
                                is_enrolled=True,
                                enrollment_status="mandatory",
                                modules=[
                                    Module(
                                        id="mod_trees",
                                        title="Binary Trees & Heaps",
                                        contact_hours=12,
                                        topics=[
                                            Subtopic(
                                                id="top_avl",
                                                title="AVL Self-Balancing Trees",
                                                source_text="Rotations and balance factors in AVL trees",
                                            ),
                                            Subtopic(
                                                id="top_heap",
                                                title="Binary Min/Max Heaps",
                                                source_text="Heapify and priority queue implementations",
                                            ),
                                        ],
                                    )
                                ],
                            ),
                            Subject(
                                id="subj_elective",
                                title="Quantum Computing Algorithms",
                                code="QC101",
                                is_elective=True,
                                is_enrolled=False,
                                enrollment_status="excluded",
                                modules=[
                                    Module(
                                        id="mod_qubits",
                                        title="Qubits and Quantum Gates",
                                        contact_hours=10,
                                        topics=[
                                            Subtopic(
                                                id="top_hadamard",
                                                title="Hadamard and Pauli Gates",
                                                source_text="Superposition matrices and phase shifts",
                                            )
                                        ],
                                    )
                                ],
                            ),
                        ],
                    )
                ],
            )
        ],
    )


# =============================================================================
# 1. RFC 5545 Text Escaping & Line Folding Unit Tests
# =============================================================================

def test_escape_ics_text():
    """Verify that backslashes, semicolons, commas, and newlines are escaped per RFC 5545."""
    assert escape_ics_text("") == ""
    assert escape_ics_text(None) == ""

    # Backslash escaping first
    assert escape_ics_text(r"C:\study\notes") == r"C:\\study\\notes"

    # Delimiters
    assert escape_ics_text("Math, Physics; Chemistry") == r"Math\, Physics\; Chemistry"

    # Newlines: CRLF, LF, CR all become literal \n
    multiline = "Line 1\r\nLine 2\nLine 3\rLine 4"
    assert escape_ics_text(multiline) == r"Line 1\nLine 2\nLine 3\nLine 4"

    # Combined complex text
    complex_text = "Notes (Chapter 1):\n- Item A, cost: $10; Path: C:\\Docs"
    expected = r"Notes (Chapter 1):\n- Item A\, cost: $10\; Path: C:\\Docs"
    assert escape_ics_text(complex_text) == expected


def test_fold_ics_line_ascii():
    """Verify that lines exceeding 75 octets are folded with CRLF + space."""
    short_line = "SUMMARY:Short line within 75 octets limit"
    assert len(short_line.encode("utf-8")) <= 75
    assert fold_ics_line(short_line) == short_line

    # Long line: 120 chars
    long_line = "DESCRIPTION:" + ("A" * 120)
    folded = fold_ics_line(long_line)
    lines = folded.split("\r\n")

    assert len(lines) == 2
    # First physical line has max 75 octets
    assert len(lines[0].encode("utf-8")) <= 75
    # Continuation line starts with a single space
    assert lines[1].startswith(" ")
    # Continuation line with the space has max 75 octets
    assert len(lines[1].encode("utf-8")) <= 75

    # Unfolding: remove '\r\n ' restores original line
    unfolded = folded.replace("\r\n ", "")
    assert unfolded == long_line


def test_fold_ics_line_multibyte_unicode():
    """Verify line folding never splits multi-byte UTF-8 code points across lines."""
    # 3-byte and 4-byte characters
    # '🚀' is 4 bytes, '✓' is 3 bytes, 'ö' is 2 bytes
    prefix = "SUMMARY:" + ("X" * 60)  # 68 bytes
    # Adding a 4-byte emoji: 68 + 4 = 72 bytes. Adding another: 72 + 4 = 76 bytes (must break)
    test_line = prefix + "🚀📚✨🌟🎉"
    folded = fold_ics_line(test_line)
    physical_lines = folded.split("\r\n")

    for idx, pl in enumerate(physical_lines):
        if idx > 0:
            assert pl.startswith(" ")
        assert len(pl.encode("utf-8")) <= 75
        # Verify valid UTF-8 by re-encoding
        assert pl.encode("utf-8").decode("utf-8") == pl

    # Roundtrip check
    unfolded = folded.replace("\r\n ", "")
    assert unfolded == test_line


def test_serialize_ics_lines_crlf_terminator():
    """Verify serialize_ics_lines terminates every physical line with CRLF."""
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "END:VCALENDAR"]
    output = serialize_ics_lines(lines)
    assert output.endswith("\r\n")
    # No bare LFs without CR
    assert "\r\n" in output
    assert output.count("\n") == output.count("\r\n")


# =============================================================================
# 2. Calendar Event Generation & Deterministic Identity Tests
# =============================================================================

def test_calendar_deterministic_uids_and_ordering(calendar_test_syllabus):
    """Verify that event UIDs remain stable across repeated exports and date edits."""
    dl1 = TargetDeadline(
        syllabus_id="syl_cal_test",
        node_id="subj_ds",
        node_type="subject",
        target_date=date(2026, 12, 1),
    )
    rev1 = RevisionSchedule(
        syllabus_id="syl_cal_test",
        leaf_id="top_avl",
        repetition_count=2,
        ease_factor=2.5,
        interval_days=6,
        next_review_date=date(2026, 11, 25),
        is_suspended=False,
    )

    fixed_dtstamp = datetime(2026, 11, 20, 12, 0, 0, tzinfo=timezone.utc)

    ics1 = build_syllabus_ics(
        syllabus_id="syl_cal_test",
        syllabus_title="CS Curriculum",
        hierarchy=calendar_test_syllabus,
        deadlines=[dl1],
        revisions=[rev1],
        dtstamp=fixed_dtstamp,
    )

    ics2 = build_syllabus_ics(
        syllabus_id="syl_cal_test",
        syllabus_title="CS Curriculum",
        hierarchy=calendar_test_syllabus,
        deadlines=[dl1],
        revisions=[rev1],
        dtstamp=fixed_dtstamp,
    )

    # Identical input produces identical output
    assert ics1 == ics2

    # Verify UIDs
    assert "UID:deadline-syl_cal_test-subj_ds@syllabustracker.app" in ics1
    assert "UID:revision-syl_cal_test-top_avl@syllabustracker.app" in ics1

    # Date change on deadline preserves UID
    dl1_updated = TargetDeadline(
        syllabus_id="syl_cal_test",
        node_id="subj_ds",
        node_type="subject",
        target_date=date(2027, 1, 15),
    )
    ics3 = build_syllabus_ics(
        syllabus_id="syl_cal_test",
        syllabus_title="CS Curriculum",
        hierarchy=calendar_test_syllabus,
        deadlines=[dl1_updated],
        revisions=[rev1],
        dtstamp=fixed_dtstamp,
    )
    assert "UID:deadline-syl_cal_test-subj_ds@syllabustracker.app" in ics3
    assert "DTSTART;VALUE=DATE:20270115" in ics3
    assert "DTEND;VALUE=DATE:20270116" in ics3


def test_deadline_event_valarm_and_dates(calendar_test_syllabus):
    """Verify deadline all-day dates, exclusive DTEND, and VALARM structure."""
    target = date(2026, 11, 20)
    dl = TargetDeadline(
        syllabus_id="syl_cal_test",
        node_id="subj_ds",
        node_type="subject",
        target_date=target,
    )

    ics = build_syllabus_ics(
        syllabus_id="syl_cal_test",
        syllabus_title="Computer Science",
        hierarchy=calendar_test_syllabus,
        deadlines=[dl],
        revisions=[],
    )

    assert "BEGIN:VEVENT" in ics
    assert "DTSTART;VALUE=DATE:20261120" in ics
    assert "DTEND;VALUE=DATE:20261121" in ics  # Exclusive end date (+1 day)
    assert "CATEGORIES:EXAM,DEADLINE,SYLLABUS" in ics
    assert "BEGIN:VALARM" in ics
    assert "ACTION:DISPLAY" in ics
    assert "TRIGGER:-P1D" in ics
    assert "DESCRIPTION:Upcoming academic deadline" in ics
    assert "END:VALARM" in ics
    assert "END:VEVENT" in ics


def test_sm2_revision_event_details(calendar_test_syllabus):
    """Verify SM-2 revision event metadata: repetition count + 1, interval, and ease factor."""
    review_d = date(2026, 11, 24)
    rev = RevisionSchedule(
        syllabus_id="syl_cal_test",
        leaf_id="top_avl",
        repetition_count=3,
        ease_factor=2.45,
        interval_days=10,
        next_review_date=review_d,
        is_suspended=False,
    )

    ics = build_syllabus_ics(
        syllabus_id="syl_cal_test",
        syllabus_title="Computer Science",
        hierarchy=calendar_test_syllabus,
        deadlines=[],
        revisions=[rev],
    )

    # Unfolded text allows verifying long DESCRIPTION fields without line folding splits
    unfolded = ics.replace("\r\n ", "")
    # repetition_count = 3 -> next review is #4
    assert "[SM-2 Review #4] AVL Self-Balancing Trees" in ics
    assert "DTSTART;VALUE=DATE:20261124" in ics
    assert "DTEND;VALUE=DATE:20261125" in ics
    assert "CATEGORIES:REVISION,SPACED-REPETITION,SYLLABUS" in ics
    assert "Interval: 10d" in unfolded
    assert "Ease Factor: EF 2.45" in unfolded
    assert "Repetitions: 3" in unfolded


# =============================================================================
# 3. Elective Exclusion Invariant Tests
# =============================================================================

def test_elective_exclusion_invariant(calendar_test_syllabus):
    """Verify that unenrolled subjects and their descendant leaves are strictly excluded."""
    # Deadline on unenrolled elective
    dl_unenrolled = TargetDeadline(
        syllabus_id="syl_cal_test",
        node_id="subj_elective",
        node_type="subject",
        target_date=date(2026, 12, 10),
    )
    # Deadline on enrolled subject
    dl_enrolled = TargetDeadline(
        syllabus_id="syl_cal_test",
        node_id="subj_ds",
        node_type="subject",
        target_date=date(2026, 12, 15),
    )

    # Revision on unenrolled leaf
    rev_unenrolled = RevisionSchedule(
        syllabus_id="syl_cal_test",
        leaf_id="top_hadamard",
        repetition_count=1,
        ease_factor=2.5,
        interval_days=3,
        next_review_date=date(2026, 11, 28),
        is_suspended=False,
    )
    # Revision on enrolled leaf
    rev_enrolled = RevisionSchedule(
        syllabus_id="syl_cal_test",
        leaf_id="top_avl",
        repetition_count=1,
        ease_factor=2.5,
        interval_days=3,
        next_review_date=date(2026, 11, 28),
        is_suspended=False,
    )

    ics = build_syllabus_ics(
        syllabus_id="syl_cal_test",
        syllabus_title="Computer Science",
        hierarchy=calendar_test_syllabus,
        deadlines=[dl_unenrolled, dl_enrolled],
        revisions=[rev_unenrolled, rev_enrolled],
    )

    # Enrolled items must appear
    assert "Data Structures & Algorithms" in ics
    assert "top_avl" in ics

    # Unenrolled items must NOT appear
    assert "Quantum Computing Algorithms" not in ics
    assert "top_hadamard" not in ics
    assert "subj_elective" not in ics


# =============================================================================
# 4. Completion Filtering Tests
# =============================================================================

def test_completion_filtering_deadlines(calendar_test_syllabus):
    """Verify that completed branches are excluded when include_completed=False and marked when True."""
    dl = TargetDeadline(
        syllabus_id="syl_cal_test",
        node_id="subj_ds",
        node_type="subject",
        target_date=date(2026, 12, 1),
    )

    # Both leaves of subj_ds are completed: 100% complete branch
    completed_leaves = {"top_avl", "top_heap"}

    # Case 1: include_completed = False -> Excluded
    ics_excluded = build_syllabus_ics(
        syllabus_id="syl_cal_test",
        syllabus_title="Computer Science",
        hierarchy=calendar_test_syllabus,
        deadlines=[dl],
        revisions=[],
        completed_leaf_ids=completed_leaves,
        include_completed=False,
    )
    assert "BEGIN:VEVENT" not in ics_excluded

    # Case 2: include_completed = True -> Included with [Completed] prefix
    ics_included = build_syllabus_ics(
        syllabus_id="syl_cal_test",
        syllabus_title="Computer Science",
        hierarchy=calendar_test_syllabus,
        deadlines=[dl],
        revisions=[],
        completed_leaf_ids=completed_leaves,
        include_completed=True,
    )
    assert "BEGIN:VEVENT" in ics_included
    assert "[Completed] [Exam / Deadline] Data Structures & Algorithms" in ics_included


def test_past_incomplete_deadlines_retained(calendar_test_syllabus):
    """Verify that deadlines past their target date remain included if the branch is incomplete."""
    past_date = date(2026, 1, 10)
    dl = TargetDeadline(
        syllabus_id="syl_cal_test",
        node_id="subj_ds",
        node_type="subject",
        target_date=past_date,
    )

    # Incomplete branch: only 1 of 2 leaves completed
    completed_leaves = {"top_avl"}

    ics = build_syllabus_ics(
        syllabus_id="syl_cal_test",
        syllabus_title="Computer Science",
        hierarchy=calendar_test_syllabus,
        deadlines=[dl],
        revisions=[],
        completed_leaf_ids=completed_leaves,
        include_completed=False,
    )
    assert "BEGIN:VEVENT" in ics
    assert "DTSTART;VALUE=DATE:20260110" in ics


# =============================================================================
# 5. Integration & REST API Security Tests
# =============================================================================

def test_api_export_ics_endpoint(client, db_session, calendar_test_syllabus):
    """Verify GET /api/syllabus/{id}/export/ics returns compliant text/calendar response."""
    save_syllabus(db_session, calendar_test_syllabus)
    upsert_target_deadline(
        db_session,
        syllabus_id="syl_cal_test",
        node_id="subj_ds",
        node_type="subject",
        target_date=date(2026, 12, 1),
    )

    res = client.get("/api/syllabus/syl_cal_test/export/ics")
    assert res.status_code == 200
    assert "text/calendar" in res.headers["content-type"]
    assert "attachment; filename=" in res.headers["content-disposition"]
    assert res.headers["content-disposition"].endswith('.ics"')

    body = res.text
    assert body.startswith("BEGIN:VCALENDAR\r\n")
    assert body.endswith("END:VCALENDAR\r\n")
    assert "UID:deadline-syl_cal_test-subj_ds@syllabustracker.app" in body


def test_api_feed_token_lifecycle_and_security(client, db_session, calendar_test_syllabus):
    """Verify generation, rotation, revocation, and security of calendar feed tokens."""
    save_syllabus(db_session, calendar_test_syllabus)
    upsert_target_deadline(
        db_session,
        syllabus_id="syl_cal_test",
        node_id="subj_ds",
        node_type="subject",
        target_date=date(2026, 12, 1),
    )

    # 1. Generate new feed token
    post_res = client.post("/api/syllabus/syl_cal_test/calendar/feed-token")
    assert post_res.status_code == 200
    data = post_res.json()
    feed_url = data["feed_url"]
    assert "/api/calendar/feed/" in feed_url
    assert feed_url.endswith(".ics")

    # Extract token
    token = feed_url.split("/api/calendar/feed/")[1].replace(".ics", "")
    assert len(token) >= 32  # High entropy >= 256 bits

    # Verify token is stored as SHA-256 hash in DB, NEVER plaintext
    rec = get_syllabus_record(db_session, "syl_cal_test")
    assert rec.calendar_feed_enabled is True
    assert rec.calendar_feed_token_hash is not None
    assert rec.calendar_feed_token_hash != token
    assert rec.calendar_feed_token_hash == hashlib.sha256(token.encode("utf-8")).hexdigest()

    # 2. Access public feed with valid token
    feed_res = client.get(f"/api/calendar/feed/{token}.ics")
    assert feed_res.status_code == 200
    assert "text/calendar" in feed_res.headers["content-type"]
    assert "Cache-Control" in feed_res.headers
    assert "private, no-cache, max-age=300" in feed_res.headers["Cache-Control"]
    assert "UID:deadline-syl_cal_test-subj_ds@syllabustracker.app" in feed_res.text

    # 3. Access public feed with invalid token -> 404
    bad_res = client.get("/api/calendar/feed/invalid_or_forged_token.ics")
    assert bad_res.status_code == 404

    # 4. Predictable syllabus ID cannot be used as a feed credential
    syl_res = client.get("/api/calendar/feed/syl_cal_test.ics")
    assert syl_res.status_code == 404

    # 5. Rotate token: generates new token and invalidates old token
    post_res2 = client.post("/api/syllabus/syl_cal_test/calendar/feed-token")
    assert post_res2.status_code == 200
    feed_url2 = post_res2.json()["feed_url"]
    token2 = feed_url2.split("/api/calendar/feed/")[1].replace(".ics", "")
    assert token2 != token

    # Old token is now invalid -> 404
    old_feed_res = client.get(f"/api/calendar/feed/{token}.ics")
    assert old_feed_res.status_code == 404

    # New token is valid -> 200
    new_feed_res = client.get(f"/api/calendar/feed/{token2}.ics")
    assert new_feed_res.status_code == 200

    # 6. Revoke token
    del_res = client.delete("/api/syllabus/syl_cal_test/calendar/feed-token")
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True

    # After revocation, feed is immediately disabled -> 404
    revoked_feed_res = client.get(f"/api/calendar/feed/{token2}.ics")
    assert revoked_feed_res.status_code == 404


def test_api_404_for_nonexistent_syllabus(client):
    """Verify 404 on export and token endpoints when syllabus does not exist."""
    assert client.get("/api/syllabus/nonexistent/export/ics").status_code == 404
    assert client.post("/api/syllabus/nonexistent/calendar/feed-token").status_code == 404
    assert client.delete("/api/syllabus/nonexistent/calendar/feed-token").status_code == 404
