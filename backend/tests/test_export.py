"""Integration tests for Export endpoints (Markdown, JSON backup, Printable HTML)."""

from datetime import date
import json
import pytest

from backend.app.database import (
    add_topic_resource,
    save_syllabus,
    update_leaf_completion,
    upsert_target_deadline,
    upsert_topic_note,
)
from backend.app.schemas import (
    AcademicYear,
    HierarchicalSyllabus,
    Module,
    Semester,
    Subject,
    Subtopic,
)


@pytest.fixture
def exportable_syllabus() -> HierarchicalSyllabus:
    return HierarchicalSyllabus(
        id="syl_export_test",
        title="Engineering Mathematics & Computing",
        source_filename="eng_math.pdf",
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
                                id="subj_calc",
                                title="Calculus I",
                                code="MATH101",
                                is_enrolled=True,
                                enrollment_status="mandatory",
                                modules=[
                                    Module(
                                        id="mod_diff",
                                        title="Differential Calculus",
                                        contact_hours=15,
                                        topics=[
                                            Subtopic(
                                                id="top_limits",
                                                title="Limits & Continuity",
                                                source_text="Limits definition and evaluation",
                                            ),
                                            Subtopic(
                                                id="top_deriv",
                                                title="Derivatives & Chain Rule",
                                                source_text="Derivative rules and applications",
                                            ),
                                        ],
                                    )
                                ],
                            ),
                            Subject(
                                id="subj_opt",
                                title="Optimization Methods",
                                code="MATH102",
                                is_elective=True,
                                is_enrolled=False,
                                enrollment_status="excluded",
                                modules=[
                                    Module(
                                        id="mod_linprog",
                                        title="Linear Programming",
                                        contact_hours=10,
                                        topics=[
                                            Subtopic(
                                                id="top_simplex",
                                                title="Simplex Method",
                                                source_text="Simplex tableau and pivot operations",
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


def test_markdown_export(client, db_session, exportable_syllabus):
    save_syllabus(db_session, exportable_syllabus)
    update_leaf_completion(db_session, exportable_syllabus, "top_limits", True)
    upsert_topic_note(db_session, exportable_syllabus.id, "top_limits", "Key limit: sin(x)/x -> 1 as x -> 0")
    add_topic_resource(
        db_session,
        exportable_syllabus.id,
        "mod_diff",
        "module",
        "3Blue1Brown Calculus",
        "https://www.youtube.com/watch?v=WUvTyaaNkzM",
        "youtube",
    )
    upsert_target_deadline(
        db_session,
        exportable_syllabus.id,
        "subj_calc",
        "subject",
        date(2026, 12, 1),
    )
    db_session.commit()

    # 1. Full export (enrolled only)
    resp = client.get(f"/api/syllabus/{exportable_syllabus.id}/export/markdown")
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/markdown")
    assert "attachment" in resp.headers["content-disposition"]
    text = resp.text

    # Header and hierarchy
    assert "# Engineering Mathematics & Computing" in text
    assert "## Year 1" in text
    assert "### Semester 1" in text
    assert "#### Calculus I `[MATH101]`" in text
    assert "##### Differential Calculus *(15 hrs)*" in text

    # Checkbox completion
    assert "- [x] **Limits & Continuity**" in text
    assert "- [ ] **Derivatives & Chain Rule**" in text

    # Note & Resource
    assert "Key limit: sin(x)/x -> 1" in text
    assert "3Blue1Brown Calculus" in text

    # Deadlines table
    assert "## Exam & Study Deadlines" in text

    # Excluded course should not appear with default enrolled_only=True
    assert "Optimization Methods" not in text

    # 2. Export with enrolled_only=False
    resp2 = client.get(f"/api/syllabus/{exportable_syllabus.id}/export/markdown?enrolled_only=false")
    assert resp2.status_code == 200
    assert "Optimization Methods" in resp2.text
    assert "(Optional / Not Enrolled)" in resp2.text


def test_json_backup_export(client, db_session, exportable_syllabus):
    save_syllabus(db_session, exportable_syllabus)
    update_leaf_completion(db_session, exportable_syllabus, "top_limits", True)
    upsert_topic_note(db_session, exportable_syllabus.id, "top_limits", "Limits notes")
    add_topic_resource(
        db_session,
        exportable_syllabus.id,
        "top_limits",
        "subtopic",
        "Khan Academy Limits",
        "https://www.khanacademy.org/math/calculus-1",
        "documentation",
    )
    upsert_target_deadline(
        db_session,
        exportable_syllabus.id,
        "subj_calc",
        "subject",
        date(2026, 12, 1),
    )
    db_session.commit()

    resp = client.get(f"/api/syllabus/{exportable_syllabus.id}/export/json")
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("application/json")
    assert "attachment" in resp.headers["content-disposition"]

    envelope = resp.json()
    assert envelope["schema_version"] == "2.1"
    assert envelope["application"] == "Hierarchical Syllabus Checklist & Progress Tracker"
    assert "top_limits" in envelope["completed_leaves"]
    assert envelope["notes"]["top_limits"] == "Limits notes"
    assert len(envelope["resources"]) == 1
    assert envelope["resources"][0]["title"] == "Khan Academy Limits"
    assert "subj_calc" in envelope["deadlines"]
    assert envelope["syllabus"]["id"] == exportable_syllabus.id


def test_html_printable_export(client, db_session, exportable_syllabus):
    save_syllabus(db_session, exportable_syllabus)
    update_leaf_completion(db_session, exportable_syllabus, "top_limits", True)
    upsert_topic_note(db_session, exportable_syllabus.id, "top_limits", "Notes with <b>HTML</b> test")
    db_session.commit()

    resp = client.get(f"/api/syllabus/{exportable_syllabus.id}/export/html")
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/html")
    html = resp.text

    assert "<title>Engineering Mathematics &amp; Computing - Syllabus Report</title>" in html
    assert "@media print" in html
    assert "window.print()" in html
    # XSS safety: raw tags should be escaped
    assert "&lt;b&gt;HTML&lt;/b&gt;" in html
    assert "<script>" not in html

