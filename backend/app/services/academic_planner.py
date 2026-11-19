"""Academic Planning & Multi-Syllabus Comparison Service (Phase 13 — Cycle A).

Core Capabilities:
1. Subject-level academic planning: credit overrides and target grade points.
2. Semester and program-level credit workload analytics:
   - Declared credits
   - Completed credits (strictly requires 100% leaf completion)
   - Proportional Earned Estimate (workload estimate, not official credits)
   - Remaining credits
   - Unassigned credit subject tracking
3. Scale-isolated GPA projections (10.0 scale vs 4.0 scale are strictly separated).
4. Multi-syllabus comparison matrix (2 to 4 syllabi) with shared course detection.
"""

import math
import re
import unicodedata
from datetime import datetime, timezone
from typing import Dict, List, Optional, Set, Tuple

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.database import get_completed_leaf_ids, get_syllabus_record
from backend.app.exceptions import SyllabusNotFoundError
from backend.app.models import SubjectAcademicPlan, SyllabusRecord
from backend.app.progress import is_subject_enrolled
from backend.app.schemas import (
    AcademicPlanResponse,
    GradeScaleProjection,
    HierarchicalSyllabus,
    ProgramCreditSummary,
    SemesterCreditSummary,
    SharedSubjectMatch,
    Subject,
    SubjectAcademicPlanItem,
    SyllabusComparisonItem,
    SyllabusComparisonResponse,
)

GENERIC_SUBJECT_WORDS = {
    "introduction",
    "intro",
    "fundamentals",
    "fundamental",
    "basic",
    "basics",
    "engineering",
    "theory",
    "practical",
    "laboratory",
    "lab",
    "course",
    "subject",
    "applied",
    "advanced",
    "principles",
    "principle",
    "technology",
    "studies",
    "study",
    "science",
    "i",
    "ii",
    "iii",
    "iv",
    "v",
    "1",
    "2",
    "3",
    "4",
    "and",
    "to",
    "of",
    "in",
    "for",
}


def normalize_title_for_comparison(title: str) -> str:
    """Normalize subject title by folding case, normalizing unicode, and stripping punctuation."""
    if not title:
        return ""
    norm = unicodedata.normalize("NFKC", title)
    norm = norm.lower()
    norm = re.sub(r"[^\w\s]", " ", norm)
    tokens = [t.strip() for t in norm.split() if t.strip()]
    return " ".join(tokens)


def get_meaningful_tokens(title: str) -> Set[str]:
    """Extract informative semantic tokens from a subject title, filtering generic words."""
    norm = normalize_title_for_comparison(title)
    tokens = {t for t in norm.split() if len(t) >= 3 and t not in GENERIC_SUBJECT_WORDS}
    return tokens


def get_effective_credits(
    declared_credits: Optional[float],
    credit_override: Optional[float],
) -> Optional[float]:
    """Resolve effective academic credits: manual override takes precedence over declared credits."""
    if credit_override is not None:
        if not (math.isnan(credit_override) or math.isinf(credit_override) or credit_override < 0.0 or credit_override > 30.0):
            return round(credit_override, 2)
    if declared_credits is not None:
        if not (math.isnan(declared_credits) or math.isinf(declared_credits) or declared_credits < 0.0 or declared_credits > 30.0):
            return round(declared_credits, 2)
    return None


def compute_credit_and_gpa_plan(
    session: Session,
    syllabus: HierarchicalSyllabus,
    completed_leaf_ids: Optional[Set[str]] = None,
) -> AcademicPlanResponse:
    """
    Pure, mathematically rigorous calculation engine for academic credit workload and target GPA projections.

    Invariants Enforced:
    1. Excluded electives (is_enrolled == False) contribute 0 to active credit and GPA totals.
    2. Completed credits strictly require 100% leaf completion (L_total > 0 and L_completed == L_total).
    3. Proportional Earned Estimate = sum(C_i * (L_completed / L_total)); 0 for 0-leaf courses.
    4. GPA scales (10.0 vs 4.0) are strictly isolated and never averaged together.
    5. Missing credits remain unknown (None) and are tracked explicitly.
    """
    if completed_leaf_ids is None:
        completed_leaf_ids = set(get_completed_leaf_ids(session, syllabus.id))

    # Fetch stored academic plan records for this syllabus
    stmt = select(SubjectAcademicPlan).where(SubjectAcademicPlan.syllabus_id == syllabus.id)
    plan_records = {p.subject_id: p for p in session.scalars(stmt).all()}

    subject_plans: List[SubjectAcademicPlanItem] = []
    semester_summaries: List[SemesterCreditSummary] = []
    unassigned_credit_subjects: List[str] = []

    # Cumulative program accumulators
    prog_enrolled_count = 0
    prog_known_credit_count = 0
    prog_total_declared = 0.0
    prog_completed_credits = 0.0
    prog_proportional_estimate = 0.0
    prog_unassigned_count = 0

    prog_gpa_weighted_10 = 0.0
    prog_gpa_credits_10 = 0.0
    prog_eligible_subjects_10 = 0

    prog_gpa_weighted_4 = 0.0
    prog_gpa_credits_4 = 0.0
    prog_eligible_subjects_4 = 0

    for year in syllabus.years:
        for sem in year.semesters:
            sem_enrolled_count = 0
            sem_known_credit_count = 0
            sem_total_declared = 0.0
            sem_completed_credits = 0.0
            sem_proportional_estimate = 0.0
            sem_unassigned_count = 0

            sem_gpa_weighted_10 = 0.0
            sem_gpa_credits_10 = 0.0
            sem_gpa_weighted_4 = 0.0
            sem_gpa_credits_4 = 0.0

            subjects_list = sem.subjects or []
            for subj in subjects_list:
                enrolled = is_subject_enrolled(subj)
                subj_leaves = [t.id for m in subj.modules for t in m.topics]
                total_leaves = len(subj_leaves)
                completed_leaves = sum(1 for lid in subj_leaves if lid in completed_leaf_ids)

                # Strict completion rule: requires total_leaves > 0 and all leaves completed
                is_completed = (total_leaves > 0 and completed_leaves == total_leaves)

                plan_rec = plan_records.get(subj.id)
                declared_c = subj.credits
                override_c = plan_rec.credit_override if plan_rec else None
                effective_c = get_effective_credits(declared_c, override_c)

                grade_scale = plan_rec.grade_scale if plan_rec else "10.0"
                target_g = plan_rec.target_grade_points if plan_rec else None

                # GPA eligibility requires enrolled, positive effective credits, and assigned target grade
                is_gpa_eligible = bool(
                    enrolled
                    and effective_c is not None
                    and effective_c > 0.0
                    and target_g is not None
                )

                item = SubjectAcademicPlanItem(
                    subject_id=subj.id,
                    subject_title=subj.title,
                    subject_code=subj.code,
                    semester_id=sem.id,
                    semester_title=sem.title,
                    is_enrolled=enrolled,
                    is_lab=subj.is_lab,
                    is_elective=subj.is_elective,
                    declared_credits=declared_c,
                    credit_override=override_c,
                    effective_credits=effective_c,
                    ltp=subj.ltp,
                    grade_scale=grade_scale,  # type: ignore[arg-type]
                    target_grade_points=target_g,
                    is_gpa_eligible=is_gpa_eligible,
                    is_completed=is_completed,
                    total_leaves=total_leaves,
                    completed_leaves=completed_leaves,
                )
                subject_plans.append(item)

                # Only enrolled courses participate in active planning metrics
                if enrolled:
                    sem_enrolled_count += 1
                    prog_enrolled_count += 1

                    if effective_c is not None:
                        sem_known_credit_count += 1
                        prog_known_credit_count += 1
                        sem_total_declared += effective_c
                        prog_total_declared += effective_c

                        if is_completed:
                            sem_completed_credits += effective_c
                            prog_completed_credits += effective_c

                        # Proportional Earned Estimate: C_i * (completed / total)
                        if total_leaves > 0:
                            prop = effective_c * (completed_leaves / total_leaves)
                            sem_proportional_estimate += prop
                            prog_proportional_estimate += prop
                    else:
                        sem_unassigned_count += 1
                        prog_unassigned_count += 1
                        unassigned_credit_subjects.append(subj.title)

                    # GPA Accumulation
                    if is_gpa_eligible and effective_c is not None and target_g is not None:
                        if grade_scale == "10.0":
                            sem_gpa_weighted_10 += (effective_c * target_g)
                            sem_gpa_credits_10 += effective_c
                            prog_gpa_weighted_10 += (effective_c * target_g)
                            prog_gpa_credits_10 += effective_c
                            prog_eligible_subjects_10 += 1
                        elif grade_scale == "4.0":
                            sem_gpa_weighted_4 += (effective_c * target_g)
                            sem_gpa_credits_4 += effective_c
                            prog_gpa_weighted_4 += (effective_c * target_g)
                            prog_gpa_credits_4 += effective_c
                            prog_eligible_subjects_4 += 1

            # Semester Summary
            target_sgpa_10 = (
                round(sem_gpa_weighted_10 / sem_gpa_credits_10, 2)
                if sem_gpa_credits_10 > 0.0
                else None
            )
            target_sgpa_4 = (
                round(sem_gpa_weighted_4 / sem_gpa_credits_4, 2)
                if sem_gpa_credits_4 > 0.0
                else None
            )

            sem_remaining = max(0.0, sem_total_declared - sem_completed_credits)

            semester_summaries.append(
                SemesterCreditSummary(
                    semester_id=sem.id,
                    semester_title=sem.title,
                    semester_number=sem.semester_number,
                    enrolled_subject_count=sem_enrolled_count,
                    known_credit_subject_count=sem_known_credit_count,
                    total_declared_credits=round(sem_total_declared, 2),
                    completed_credits=round(sem_completed_credits, 2),
                    remaining_credits=round(sem_remaining, 2),
                    proportional_earned_estimate=round(sem_proportional_estimate, 2),
                    unassigned_credit_count=sem_unassigned_count,
                    target_sgpa_10=target_sgpa_10,
                    target_sgpa_4=target_sgpa_4,
                    eligible_credits_10=round(sem_gpa_credits_10, 2),
                    eligible_credits_4=round(sem_gpa_credits_4, 2),
                )
            )

    # Program Summary
    prog_remaining = max(0.0, prog_total_declared - prog_completed_credits)
    target_cgpa_10 = (
        round(prog_gpa_weighted_10 / prog_gpa_credits_10, 2)
        if prog_gpa_credits_10 > 0.0
        else None
    )
    target_cgpa_4 = (
        round(prog_gpa_weighted_4 / prog_gpa_credits_4, 2)
        if prog_gpa_credits_4 > 0.0
        else None
    )

    program_credit_summary = ProgramCreditSummary(
        total_enrolled_subjects=prog_enrolled_count,
        known_credit_subject_count=prog_known_credit_count,
        total_declared_credits=round(prog_total_declared, 2),
        completed_credits=round(prog_completed_credits, 2),
        remaining_credits=round(prog_remaining, 2),
        proportional_earned_estimate=round(prog_proportional_estimate, 2),
        unassigned_credit_count=prog_unassigned_count,
        target_cgpa_10=target_cgpa_10,
        target_cgpa_4=target_cgpa_4,
        eligible_credits_10=round(prog_gpa_credits_10, 2),
        eligible_credits_4=round(prog_gpa_credits_4, 2),
    )

    grade_scale_projections = [
        GradeScaleProjection(
            grade_scale="10.0",
            target_cgpa=target_cgpa_10,
            eligible_credits=round(prog_gpa_credits_10, 2),
            eligible_subjects_count=prog_eligible_subjects_10,
        ),
        GradeScaleProjection(
            grade_scale="4.0",
            target_cgpa=target_cgpa_4,
            eligible_credits=round(prog_gpa_credits_4, 2),
            eligible_subjects_count=prog_eligible_subjects_4,
        ),
    ]

    return AcademicPlanResponse(
        syllabus_id=syllabus.id,
        program_credit_summary=program_credit_summary,
        semester_summaries=semester_summaries,
        grade_scale_projections=grade_scale_projections,
        subject_plans=subject_plans,
        unassigned_credit_subjects=unassigned_credit_subjects,
        calculation_metadata={
            "calculated_at": datetime.now(timezone.utc).isoformat(),
            "formula_notes": {
                "completed_credits": "Sum of effective credits for enrolled courses where 100% of subtopics are checked.",
                "proportional_earned_estimate": "Sum of effective credits scaled by leaf progress. Informational only.",
                "target_gpa": "Credit-weighted target grade points. 10.0 and 4.0 scales are strictly isolated.",
            },
        },
    )


def compare_syllabi(
    session: Session,
    syllabus_ids: List[str],
) -> SyllabusComparisonResponse:
    """
    Compare between 2 and 4 syllabus records across curriculum structure, completion, lab ratio, and credits.
    Also detects shared and overlapping courses across compared syllabi using conservative token & title matching.
    """
    import json
    from fastapi import HTTPException

    if len(syllabus_ids) < 2 or len(syllabus_ids) > 4:
        raise HTTPException(
            status_code=400,
            detail="Comparison requires between 2 and 4 unique syllabus IDs.",
        )
    if len(set(syllabus_ids)) != len(syllabus_ids):
        raise HTTPException(
            status_code=400,
            detail="Duplicate syllabus IDs are not permitted.",
        )

    loaded_syllabi: List[Tuple[HierarchicalSyllabus, SyllabusRecord, Set[str]]] = []
    for sid in syllabus_ids:
        rec = get_syllabus_record(session, sid)
        if not rec:
            raise SyllabusNotFoundError(sid)
        raw_data = json.loads(rec.hierarchy_json)
        syl = HierarchicalSyllabus.model_validate(raw_data)
        completed_ids = set(get_completed_leaf_ids(session, sid))
        loaded_syllabi.append((syl, rec, completed_ids))

    comparison_items: List[SyllabusComparisonItem] = []
    syllabus_subjects_map: Dict[str, List[Tuple[Subject, str]]] = {}

    for syl, rec, completed_ids in loaded_syllabi:
        plan_stmt = select(SubjectAcademicPlan).where(SubjectAcademicPlan.syllabus_id == syl.id)
        plans = {p.subject_id: p for p in session.scalars(plan_stmt).all()}

        total_subjects = 0
        enrolled_subjects = 0
        excluded_electives = 0
        lab_subjects = 0
        total_modules = 0
        total_topics = 0
        completed_topics = 0
        total_known_declared_credits = 0.0
        missing_credit_subjects = 0
        target_gpa_subjects = 0

        subj_list_for_matching: List[Tuple[Subject, str]] = []

        for yr in syl.years:
            for sem in yr.semesters:
                for subj in (sem.subjects or []):
                    total_subjects += 1
                    is_enrolled = is_subject_enrolled(subj)
                    subj_leaves = [t.id for m in subj.modules for t in m.topics]
                    total_modules += len(subj.modules)
                    total_topics += len(subj_leaves)
                    completed_topics += sum(1 for lid in subj_leaves if lid in completed_ids)

                    if subj.is_lab and is_enrolled:
                        lab_subjects += 1

                    if subj.is_elective and not is_enrolled:
                        excluded_electives += 1

                    if is_enrolled:
                        enrolled_subjects += 1
                        subj_list_for_matching.append((subj, sem.title))

                        plan = plans.get(subj.id)
                        eff_c = get_effective_credits(subj.credits, plan.credit_override if plan else None)
                        if eff_c is not None:
                            total_known_declared_credits += eff_c
                        else:
                            missing_credit_subjects += 1

                        if plan and plan.target_grade_points is not None:
                            target_gpa_subjects += 1

        syllabus_subjects_map[syl.id] = subj_list_for_matching

        completion_pct = (
            round((completed_topics / total_topics) * 100, 1)
            if total_topics > 0
            else 0.0
        )
        lab_ratio = (
            round((lab_subjects / enrolled_subjects) * 100, 1)
            if enrolled_subjects > 0
            else 0.0
        )

        comparison_items.append(
            SyllabusComparisonItem(
                syllabus_id=syl.id,
                title=syl.title,
                source_type=getattr(rec, "source_type", "upload") or "upload",
                source_filename=syl.source_filename,
                year_count=len(syl.years),
                semester_count=sum(len(y.semesters) for y in syl.years),
                total_subjects=total_subjects,
                enrolled_subjects=enrolled_subjects,
                excluded_electives=excluded_electives,
                lab_subjects=lab_subjects,
                lab_ratio_percent=lab_ratio,
                total_modules=total_modules,
                total_topics=total_topics,
                completed_topics=completed_topics,
                completion_percent=completion_pct,
                total_known_declared_credits=round(total_known_declared_credits, 2),
                missing_credit_subject_count=missing_credit_subjects,
                target_gpa_subject_count=target_gpa_subjects,
            )
        )

    # Detect shared and overlapping courses between each distinct pair of syllabi
    shared_matches: List[SharedSubjectMatch] = []
    seen_match_pairs: Set[Tuple[str, str, str, str]] = set()

    syl_ids = [syl.id for syl, _, _ in loaded_syllabi]
    for i in range(len(syl_ids)):
        for j in range(i + 1, len(syl_ids)):
            id_a, id_b = syl_ids[i], syl_ids[j]
            subjects_a = syllabus_subjects_map.get(id_a, [])
            subjects_b = syllabus_subjects_map.get(id_b, [])

            for subj_a, _ in subjects_a:
                norm_a = normalize_title_for_comparison(subj_a.title)
                tokens_a = get_meaningful_tokens(subj_a.title)
                code_a = subj_a.code.strip().upper() if subj_a.code else None

                for subj_b, _ in subjects_b:
                    pair_key = (id_a, subj_a.id, id_b, subj_b.id)
                    if pair_key in seen_match_pairs:
                        continue

                    norm_b = normalize_title_for_comparison(subj_b.title)
                    tokens_b = get_meaningful_tokens(subj_b.title)
                    code_b = subj_b.code.strip().upper() if subj_b.code else None

                    match_type: Optional[str] = None
                    strength: float = 0.0

                    # 1. Exact normalized title match
                    if norm_a and norm_a == norm_b:
                        match_type = "exact_title"
                        strength = 1.0

                    # 2. Exact course code match (e.g. CS101 == CS101)
                    elif code_a and code_b and code_a == code_b and len(code_a) >= 3:
                        match_type = "course_code"
                        strength = 0.95

                    # 3. High semantic token similarity (Jaccard >= 0.70 with at least 2 non-generic tokens)
                    elif len(tokens_a) >= 2 and len(tokens_b) >= 2:
                        intersection = tokens_a.intersection(tokens_b)
                        union = tokens_a.union(tokens_b)
                        jaccard = len(intersection) / len(union)
                        if jaccard >= 0.70:
                            match_type = "token_similarity"
                            strength = round(jaccard, 2)

                    if match_type:
                        seen_match_pairs.add(pair_key)
                        shared_matches.append(
                            SharedSubjectMatch(
                                subject_title_a=subj_a.title,
                                subject_title_b=subj_b.title,
                                syllabus_id_a=id_a,
                                syllabus_id_b=id_b,
                                subject_id_a=subj_a.id,
                                subject_id_b=subj_b.id,
                                match_type=match_type,  # type: ignore[arg-type]
                                match_strength=strength,
                            )
                        )

    return SyllabusComparisonResponse(
        syllabi=comparison_items,
        shared_subjects=shared_matches,
        compared_at=datetime.now(timezone.utc).isoformat(),
    )
