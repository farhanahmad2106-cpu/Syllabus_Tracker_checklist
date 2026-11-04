"""Export Service for generating Markdown, JSON backups, and Printable HTML reports.

Adheres strictly to the canonical five-tier hierarchy and ensures robust XSS defense.
"""

from datetime import datetime, timezone
import html
from typing import Any, Dict, List, Optional, Set
from urllib.parse import quote

from backend.app.models import TargetDeadline, TopicResource
from backend.app.schemas import (
    BackupEnvelope,
    ExportOptions,
    HierarchicalSyllabus,
    Subject,
)
from backend.app.progress import calculate_syllabus_progress, get_all_leaf_ids
from backend.app.services.pacing import calculate_node_pacing, find_node_in_syllabus


def generate_markdown_export(
    syllabus: HierarchicalSyllabus,
    completed_leaf_ids: Set[str],
    notes_map: Dict[str, str],
    resources_list: List[TopicResource],
    deadlines_map: Dict[str, TargetDeadline],
    options: ExportOptions,
) -> str:
    """Generate a clean, hierarchical Markdown document representing the syllabus."""
    lines: List[str] = []

    # Title & Metadata
    lines.append(f"# {syllabus.title}")
    lines.append("")
    lines.append(f"**Source Document:** `{syllabus.source_filename}`  ")
    lines.append(f"**Exported At:** `{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}`  ")

    # Overall Progress
    all_leaves = get_all_leaf_ids(syllabus)
    total_count = len(all_leaves)
    completed_count = len(completed_leaf_ids.intersection(set(all_leaves)))
    pct = round((completed_count / total_count * 100), 1) if total_count > 0 else 0.0
    lines.append(f"**Overall Progress:** {completed_count}/{total_count} subtopics ({pct}%)  ")
    lines.append("")

    # Deadlines / Pacing Summary
    if options.include_pacing and deadlines_map:
        lines.append("## Exam & Study Deadlines")
        lines.append("")
        lines.append("| Scope | Target Date | Days Left | Topics/Wk | Hrs/Wk | Pacing Status |")
        lines.append("| :--- | :---: | :---: | :---: | :---: | :---: |")

        for node_id, dl in deadlines_map.items():
            found = find_node_in_syllabus(syllabus, node_id)
            if not found:
                continue
            node_obj, n_type = found
            title = getattr(node_obj, "title", node_id)
            code = getattr(node_obj, "code", None)
            display_title = f"{title} ({code})" if code else title

            pacing = calculate_node_pacing(node_obj, completed_leaf_ids, dl.target_date)
            status_text = pacing.status.replace("_", " ").title()
            days_str = str(pacing.days_remaining) if pacing.days_remaining is not None else "N/A"
            topics_wk = f"{pacing.topics_per_week:.1f}" if pacing.topics_per_week is not None else "N/A"
            hrs_wk = f"{pacing.hours_per_week:.1f}" if pacing.hours_per_week is not None else "N/A"

            lines.append(f"| {display_title} | {dl.target_date.isoformat()} | {days_str} | {topics_wk} | {hrs_wk} | {status_text} |")
        lines.append("")

    # Build resource map: node_id -> List[TopicResource]
    res_by_node: Dict[str, List[TopicResource]] = {}
    for r in resources_list:
        res_by_node.setdefault(r.node_id, []).append(r)

    # Traverse 5-Tier Hierarchy
    for yr in syllabus.years:
        lines.append(f"## {yr.title}")
        lines.append("")

        for sem in yr.semesters:
            lines.append(f"### {sem.title}")
            lines.append("")

            # Filter subjects based on enrollment
            active_subjects: List[Subject] = []
            unenrolled_subjects: List[Subject] = []

            for subj in sem.subjects:
                if subj.is_enrolled:
                    active_subjects.append(subj)
                else:
                    unenrolled_subjects.append(subj)

            subjects_to_render = active_subjects
            if not options.enrolled_only and unenrolled_subjects:
                subjects_to_render = active_subjects + unenrolled_subjects

            for subj in subjects_to_render:
                elective_tag = " *(Optional / Not Enrolled)*" if not subj.is_enrolled else (" *(Elective)*" if subj.is_elective else "")
                code_tag = f" `[{subj.code}]`" if subj.code else ""
                lines.append(f"#### {subj.title}{code_tag}{elective_tag}")

                desc = getattr(subj, "description", None)
                if desc:
                    lines.append(f"> {desc}")
                    lines.append("")

                for mod in subj.modules:
                    hrs_tag = f" *({mod.contact_hours} hrs)*" if mod.contact_hours and mod.contact_hours > 0 else ""
                    lines.append(f"##### {mod.title}{hrs_tag}")
                    lines.append("")

                    # Module-level resources
                    if options.include_resources and mod.id in res_by_node:
                        lines.append("  **Module Resources:**")
                        for r in res_by_node[mod.id]:
                            icon = "🎥" if r.resource_type == "youtube" else ("🐙" if r.resource_type == "github" else "📄")
                            lines.append(f"  - {icon} [{r.title}]({r.url}) *({r.resource_type})*")
                        lines.append("")

                    # Subtopics
                    for top in mod.subtopics:
                        is_done = top.id in completed_leaf_ids
                        check = "[x]" if is_done else "[ ]"
                        lines.append(f"- {check} **{top.title}**")

                        # Leaf resources
                        if options.include_resources and top.id in res_by_node:
                            for r in res_by_node[top.id]:
                                icon = "🎥" if r.resource_type == "youtube" else ("🐙" if r.resource_type == "github" else "🔗")
                                lines.append(f"  - {icon} [{r.title}]({r.url}) *({r.resource_type})*")

                        # Topic Note
                        if options.include_notes and top.id in notes_map and notes_map[top.id].strip():
                            note_text = notes_map[top.id].strip()
                            lines.append("  > **Notes:**")
                            for nline in note_text.splitlines():
                                lines.append(f"  > {nline}")
                    lines.append("")

    return "\n".join(lines).strip() + "\n"


def generate_json_backup(
    syllabus: HierarchicalSyllabus,
    completed_leaf_ids: Set[str],
    notes_map: Dict[str, str],
    resources_list: List[TopicResource],
    deadlines_map: Dict[str, TargetDeadline],
    options: ExportOptions,
) -> Dict[str, Any]:
    """Generate a structured, portable JSON backup adhering to Schema 2.1."""
    enrolled_ids = [
        s.id
        for yr in syllabus.years
        for sem in yr.semesters
        for s in sem.subjects
        if s.is_enrolled
    ]

    resources_data = []
    if options.include_resources:
        for r in resources_list:
            created_str = r.created_at.isoformat() if hasattr(r.created_at, "isoformat") else str(r.created_at)
            resources_data.append({
                "id": r.id,
                "node_id": r.node_id,
                "node_type": r.node_type,
                "title": r.title,
                "url": r.url,
                "resource_type": r.resource_type,
                "created_at": created_str,
            })

    deadlines_data = {}
    if options.include_pacing:
        for node_id, d in deadlines_map.items():
            deadlines_data[node_id] = {
                "node_id": d.node_id,
                "node_type": d.node_type,
                "target_date": d.target_date.isoformat(),
                "created_at": d.created_at.isoformat() if hasattr(d.created_at, "isoformat") else str(d.created_at),
                "updated_at": d.updated_at.isoformat() if hasattr(d.updated_at, "isoformat") else str(d.updated_at),
            }

    envelope = BackupEnvelope(
        schema_version="2.1",
        application="Hierarchical Syllabus Checklist & Progress Tracker",
        exported_at=datetime.now(timezone.utc).isoformat(),
        syllabus=syllabus.model_dump(),
        enrollment={
            "requires_confirmation": syllabus.requires_enrollment_confirmation,
            "enrolled_subject_ids": enrolled_ids,
        },
        completed_leaves=sorted(list(completed_leaf_ids)),
        notes=notes_map if options.include_notes else {},
        resources=resources_data,
        deadlines=deadlines_data,
        metadata={
            "source_filename": syllabus.source_filename,
            "options": options.model_dump(),
        },
    )

    return envelope.model_dump()


def generate_html_report(
    syllabus: HierarchicalSyllabus,
    completed_leaf_ids: Set[str],
    notes_map: Dict[str, str],
    resources_list: List[TopicResource],
    deadlines_map: Dict[str, TargetDeadline],
    options: ExportOptions,
) -> str:
    """Generate a self-contained, printable HTML report with print media queries and XSS defense."""
    all_leaves = get_all_leaf_ids(syllabus)
    total_count = len(all_leaves)
    completed_count = len(completed_leaf_ids.intersection(set(all_leaves)))
    pct = round((completed_count / total_count * 100), 1) if total_count > 0 else 0.0

    safe_title = html.escape(syllabus.title)
    safe_filename = html.escape(syllabus.source_filename)
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    # Resource mapping
    res_by_node: Dict[str, List[TopicResource]] = {}
    for r in resources_list:
        res_by_node.setdefault(r.node_id, []).append(r)

    pacing_html = ""
    if options.include_pacing and deadlines_map:
        rows = []
        for node_id, dl in deadlines_map.items():
            found = find_node_in_syllabus(syllabus, node_id)
            if not found:
                continue
            node_obj, _ = found
            title = getattr(node_obj, "title", node_id)
            code = getattr(node_obj, "code", None)
            display_title = f"{title} ({code})" if code else title

            pacing = calculate_node_pacing(node_obj, completed_leaf_ids, dl.target_date)
            status_cls = {
                "completed": "badge-success",
                "on_track": "badge-info",
                "at_risk": "badge-warning",
                "behind": "badge-danger",
            }.get(pacing.status, "badge-info")

            rows.append(f"""
                <tr>
                    <td><strong>{html.escape(display_title)}</strong></td>
                    <td class="text-center">{html.escape(dl.target_date.isoformat())}</td>
                    <td class="text-center">{pacing.days_remaining if pacing.days_remaining is not None else 'N/A'}</td>
                    <td class="text-center">{f'{pacing.topics_per_week:.1f}' if pacing.topics_per_week is not None else 'N/A'}</td>
                    <td class="text-center">{f'{pacing.hours_per_week:.1f}' if pacing.hours_per_week is not None else 'N/A'}</td>
                    <td class="text-center"><span class="badge {status_cls}">{html.escape(pacing.status.replace('_', ' ').title())}</span></td>
                </tr>
            """)

        pacing_html = f"""
            <section class="section break-inside-avoid">
                <h2>🎯 Exam Deadlines &amp; Study Pacing</h2>
                <table class="table">
                    <thead>
                        <tr>
                            <th>Course / Semester</th>
                            <th class="text-center">Target Date</th>
                            <th class="text-center">Days Left</th>
                            <th class="text-center">Topics/Wk</th>
                            <th class="text-center">Hrs/Wk</th>
                            <th class="text-center">Pacing Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {''.join(rows)}
                    </tbody>
                </table>
            </section>
        """

    content_sections = []
    for yr in syllabus.years:
        sem_htmls = []
        for sem in yr.semesters:
            subj_htmls = []
            for subj in sem.subjects:
                if not subj.is_enrolled and options.enrolled_only:
                    continue

                subj_leaves = [t.id for m in subj.modules for t in m.subtopics]
                s_tot = len(subj_leaves)
                s_comp = len(completed_leaf_ids.intersection(set(subj_leaves)))
                s_pct = round((s_comp / s_tot * 100), 1) if s_tot > 0 else 0.0

                mod_htmls = []
                for mod in subj.modules:
                    res_html = ""
                    if options.include_resources and mod.id in res_by_node:
                        r_items = "".join([
                            f'<li><span class="res-type">[{html.escape(r.resource_type)}]</span> <a href="{html.escape(r.url)}" target="_blank" rel="noopener noreferrer">{html.escape(r.title)}</a></li>'
                            for r in res_by_node[mod.id]
                        ])
                        res_html = f'<div class="module-resources"><strong>Module Resources:</strong><ul>{r_items}</ul></div>'

                    topic_items = []
                    for top in mod.subtopics:
                        is_done = top.id in completed_leaf_ids
                        check_icon = "☑" if is_done else "☐"
                        checked_cls = "completed" if is_done else ""

                        t_res = ""
                        if options.include_resources and top.id in res_by_node:
                            r_spans = " ".join([
                                f'<a class="res-link" href="{html.escape(r.url)}" target="_blank" rel="noopener noreferrer">🔗 {html.escape(r.title)}</a>'
                                for r in res_by_node[top.id]
                            ])
                            t_res = f'<div class="topic-res">{r_spans}</div>'

                        t_note = ""
                        if options.include_notes and top.id in notes_map and notes_map[top.id].strip():
                            safe_note = html.escape(notes_map[top.id].strip()).replace("\n", "<br/>")
                            t_note = f'<div class="topic-note"><div class="topic-note-title">Study Notes:</div><div>{safe_note}</div></div>'

                        topic_items.append(f"""
                            <li class="topic-item {checked_cls}">
                                <div class="topic-header">
                                    <span class="topic-check">{check_icon}</span>
                                    <span class="topic-title">{html.escape(top.title)}</span>
                                </div>
                                {t_res}
                                {t_note}
                            </li>
                        """)

                    hrs_badge = f'<span class="badge badge-neutral">{mod.contact_hours} hrs</span>' if mod.contact_hours and mod.contact_hours > 0 else ""
                    mod_htmls.append(f"""
                        <div class="module-block break-inside-avoid">
                            <div class="module-header">
                                <h5>{html.escape(mod.title)}</h5>
                                {hrs_badge}
                            </div>
                            {res_html}
                            <ul class="topic-list">
                                {''.join(topic_items)}
                            </ul>
                        </div>
                    """)

                enrollment_badge = '<span class="badge badge-warning">Unenrolled</span>' if not subj.is_enrolled else ('<span class="badge badge-info">Elective</span>' if subj.is_elective else "")
                subj_htmls.append(f"""
                    <div class="subject-card break-inside-avoid">
                        <div class="subject-header">
                            <div>
                                <h4>{html.escape(subj.title)} {f'<span class="subject-code">[{html.escape(subj.code)}]</span>' if subj.code else ''}</h4>
                                {enrollment_badge}
                            </div>
                            <div class="progress-container">
                                <div class="progress-bar-bg">
                                    <div class="progress-bar-fill" style="width: {s_pct}%;"></div>
                                </div>
                                <span class="progress-label">{s_comp}/{s_tot} ({s_pct}%)</span>
                            </div>
                        </div>
                        <div class="modules-container">
                            {''.join(mod_htmls)}
                        </div>
                    </div>
                """)

            sem_htmls.append(f"""
                <div class="semester-section">
                    <h3>{html.escape(sem.title)}</h3>
                    {''.join(subj_htmls)}
                </div>
            """)

        content_sections.append(f"""
            <section class="year-section">
                <h2>{html.escape(yr.title)}</h2>
                {''.join(sem_htmls)}
            </section>
        """)

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{safe_title} - Syllabus Report</title>
    <style>
        :root {{
            --bg: #ffffff;
            --text: #1e293b;
            --muted: #64748b;
            --border: #e2e8f0;
            --primary: #3b82f6;
            --primary-bg: #eff6ff;
            --success: #10b981;
            --success-bg: #ecfdf5;
            --warning: #f59e0b;
            --warning-bg: #fffbeb;
            --danger: #ef4444;
            --danger-bg: #fef2f2;
            --card-bg: #f8fafc;
        }}

        @page {{
            margin: 1.5cm;
            size: auto;
        }}

        * {{
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }}

        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background-color: var(--bg);
            color: var(--text);
            line-height: 1.5;
            padding: 2rem;
            max-width: 900px;
            margin: 0 auto;
        }}

        .no-print {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            background-color: var(--primary-bg);
            border: 1px solid #bfdbfe;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            margin-bottom: 2rem;
        }}

        .btn-print {{
            background-color: var(--primary);
            color: white;
            border: none;
            padding: 0.5rem 1.25rem;
            border-radius: 6px;
            font-weight: 600;
            cursor: pointer;
            font-size: 0.95rem;
        }}

        .btn-print:hover {{
            background-color: #2563eb;
        }}

        .header {{
            border-bottom: 2px solid var(--border);
            padding-bottom: 1.5rem;
            margin-bottom: 2rem;
        }}

        .header h1 {{
            font-size: 2rem;
            font-weight: 800;
            color: #0f172a;
            margin-bottom: 0.5rem;
        }}

        .header-meta {{
            font-size: 0.875rem;
            color: var(--muted);
            display: flex;
            flex-wrap: wrap;
            gap: 1.5rem;
        }}

        .summary-card {{
            background: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 1.25rem;
            margin-bottom: 2rem;
        }}

        .progress-container {{
            display: flex;
            align-items: center;
            gap: 0.75rem;
        }}

        .progress-bar-bg {{
            flex: 1;
            height: 10px;
            background: #e2e8f0;
            border-radius: 999px;
            overflow: hidden;
        }}

        .progress-bar-fill {{
            height: 100%;
            background: var(--primary);
            border-radius: 999px;
        }}

        .progress-label {{
            font-size: 0.85rem;
            font-weight: 600;
            color: var(--muted);
            white-space: nowrap;
        }}

        .section {{
            margin-bottom: 2rem;
        }}

        .table {{
            width: 100%;
            border-collapse: collapse;
            font-size: 0.875rem;
            margin-top: 0.75rem;
        }}

        .table th, .table td {{
            border: 1px solid var(--border);
            padding: 0.6rem 0.75rem;
            text-align: left;
        }}

        .table th {{
            background: #f1f5f9;
            font-weight: 600;
        }}

        .text-center {{
            text-align: center;
        }}

        .badge {{
            display: inline-block;
            padding: 0.2rem 0.5rem;
            font-size: 0.75rem;
            font-weight: 600;
            border-radius: 999px;
        }}

        .badge-success {{ background: var(--success-bg); color: var(--success); }}
        .badge-info {{ background: var(--primary-bg); color: var(--primary); }}
        .badge-warning {{ background: var(--warning-bg); color: var(--warning); }}
        .badge-danger {{ background: var(--danger-bg); color: var(--danger); }}
        .badge-neutral {{ background: #f1f5f9; color: var(--muted); }}

        .year-section {{
            margin-bottom: 2.5rem;
        }}

        .year-section h2 {{
            font-size: 1.5rem;
            font-weight: 700;
            border-bottom: 1px solid var(--border);
            padding-bottom: 0.5rem;
            margin-bottom: 1.25rem;
        }}

        .semester-section {{
            margin-bottom: 1.75rem;
            padding-left: 0.5rem;
        }}

        .semester-section h3 {{
            font-size: 1.25rem;
            font-weight: 600;
            color: #334155;
            margin-bottom: 1rem;
        }}

        .subject-card {{
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 1.25rem;
            margin-bottom: 1.5rem;
            background: #ffffff;
        }}

        .subject-header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
        }}

        .subject-header h4 {{
            font-size: 1.1rem;
            font-weight: 700;
        }}

        .subject-code {{
            font-weight: 400;
            color: var(--muted);
            font-size: 0.9rem;
        }}

        .module-block {{
            border-left: 3px solid #cbd5e1;
            padding-left: 1rem;
            margin-top: 1rem;
            margin-bottom: 1.25rem;
        }}

        .module-header {{
            display: flex;
            align-items: center;
            gap: 0.5rem;
            margin-bottom: 0.5rem;
        }}

        .module-header h5 {{
            font-size: 1rem;
            font-weight: 600;
        }}

        .module-resources {{
            font-size: 0.85rem;
            background: var(--card-bg);
            border: 1px dashed var(--border);
            padding: 0.5rem 0.75rem;
            border-radius: 6px;
            margin-bottom: 0.75rem;
        }}

        .module-resources ul {{
            padding-left: 1.25rem;
            margin-top: 0.25rem;
        }}

        .res-type {{
            font-size: 0.75rem;
            font-weight: 600;
            color: var(--muted);
        }}

        .topic-list {{
            list-style: none;
            padding: 0;
            margin: 0;
        }}

        .topic-item {{
            padding: 0.4rem 0;
            border-bottom: 1px solid #f1f5f9;
        }}

        .topic-item.completed .topic-title {{
            color: #64748b;
            text-decoration: line-through;
        }}

        .topic-header {{
            display: flex;
            align-items: flex-start;
            gap: 0.5rem;
        }}

        .topic-check {{
            font-size: 1.1rem;
            line-height: 1;
            font-family: monospace;
        }}

        .topic-title {{
            font-size: 0.9rem;
        }}

        .topic-res {{
            padding-left: 1.5rem;
            margin-top: 0.2rem;
            font-size: 0.8rem;
        }}

        .res-link {{
            color: var(--primary);
            text-decoration: none;
            margin-right: 0.75rem;
        }}

        .res-link:hover {{
            text-decoration: underline;
        }}

        .topic-note {{
            padding: 0.5rem 0.75rem;
            margin-left: 1.5rem;
            margin-top: 0.35rem;
            background: #f8fafc;
            border-left: 3px solid #94a3b8;
            border-radius: 4px;
            font-size: 0.825rem;
            color: #334155;
        }}

        .topic-note-title {{
            font-weight: 600;
            margin-bottom: 0.2rem;
            color: #475569;
        }}

        .break-inside-avoid {{
            break-inside: avoid;
            page-break-inside: avoid;
        }}

        @media print {{
            body {{
                padding: 0;
                color: #000;
            }}
            .no-print {{
                display: none !important;
            }}
            .subject-card {{
                border-color: #ccc;
            }}
            .progress-bar-fill {{
                background: #000 !important;
            }}
            a {{
                text-decoration: none;
                color: #000;
            }}
        }}
    </style>
</head>
<body>
    <div class="no-print">
        <div>
            <strong>Printable Syllabus Progress Report</strong> &mdash; Generated for offline study and tracking.
        </div>
        <button class="btn-print" onclick="window.print()">🖨️ Print / Save PDF</button>
    </div>

    <header class="header">
        <h1>{safe_title}</h1>
        <div class="header-meta">
            <div><strong>Source:</strong> {safe_filename}</div>
            <div><strong>Generated:</strong> {now_str}</div>
            <div><strong>Total Leaves:</strong> {total_count}</div>
        </div>
    </header>

    <div class="summary-card">
        <div style="margin-bottom: 0.5rem; font-weight: 600;">Overall Syllabus Completion</div>
        <div class="progress-container">
            <div class="progress-bar-bg">
                <div class="progress-bar-fill" style="width: {pct}%;"></div>
            </div>
            <span class="progress-label">{completed_count} / {total_count} ({pct}%)</span>
        </div>
    </div>

    {pacing_html}

    <main>
        {''.join(content_sections)}
    </main>
</body>
</html>"""
