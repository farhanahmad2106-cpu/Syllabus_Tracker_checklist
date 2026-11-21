/**
 * Deterministic Academic Curriculum Graph & Prerequisite Inference Engine.
 * Phase 14 — Cycle C: Pure TypeScript implementation with zero React / DOM dependencies.
 *
 * Implements read-only projections of the canonical five-tier hierarchy:
 * Year -> Semester -> Subject -> Module -> Leaf Subtopic.
 * Strictly calculates leaf-weighted mastery without credit multiplication.
 */

import type {
  AcademicPlanResponse,
  HierarchicalSyllabus,
  PacingMetrics,
  ExamRiskItem,
  Subject,
} from '../types/syllabus';
import { isSubjectEnrolled } from './progress';

// --- Types & Interfaces ---

export type MasteryTier = 'mastered' | 'in-progress' | 'not-started';

export type RiskStatus = 'overdue' | 'behind' | 'on-track' | 'ahead' | 'none';

export type RelationshipType =
  | 'explicit_sequence'
  | 'advanced_progression'
  | 'core_foundation';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface ModuleMasterySummary {
  moduleId: string;
  title: string;
  completedLeaves: number;
  totalLeaves: number;
  masteryPercent: number;
}

export interface SubjectMasteryNode {
  subjectId: string;
  title: string;
  courseCode: string | null;
  semesterId: string;
  semesterIndex: number;
  isLab: boolean;
  credits: number | null;
  completedLeaves: number;
  totalLeaves: number;
  masteryPercent: number;
  masteryTier: MasteryTier;
  riskStatus: RiskStatus;
  examRiskLevel?: 'Low' | 'Moderate' | 'High' | 'Critical' | null;
  examRiskReason?: string | null;
  modules: ModuleMasterySummary[];
}

export interface PrerequisiteEdge {
  fromSubjectId: string;
  toSubjectId: string;
  reason: string;
  relationshipType: RelationshipType;
  isFoundationSatisfied: boolean;
  confidence: ConfidenceLevel;
}

export interface SemesterColumn {
  semesterId: string;
  semesterTitle: string;
  semesterIndex: number;
  subjects: SubjectMasteryNode[];
  masteryPercent: number;
  completedLeaves: number;
  totalLeaves: number;
  totalCredits: number;
  subjectCount: number;
}

export interface CurriculumMasteryGraph {
  columns: SemesterColumn[];
  edges: PrerequisiteEdge[];
  overallMasteryPercent: number;
  totalCompletedLeaves: number;
  totalEnrolledLeaves: number;
  totalEnrolledCredits: number;
  totalEnrolledSubjects: number;
}

/**
 * Standard threshold for considering foundational prerequisite knowledge satisfied.
 * Source subject mastery >= 70% is deemed satisfied; < 70% is deemed in-progress / unsatisfied.
 */
export const FOUNDATION_SATISFACTION_THRESHOLD = 70;

// --- Helper Functions ---

/**
 * Centralized, deterministic enrollment verification.
 * Follows canonical application rules: excluded or pending subjects return false.
 */
export function isEnrolledSubject(subject: any): boolean {
  return isSubjectEnrolled(subject);
}

/**
 * Resolve effective credits for a subject based on academic plan overrides or syllabus metadata.
 * Preserves zero credits correctly and returns null when no credits are specified.
 */
export function resolveEffectiveCredits(
  subject: Subject,
  academicPlan?: AcademicPlanResponse | null
): number | null {
  if (academicPlan?.subject_plans) {
    const plan = academicPlan.subject_plans.find((p) => p.subject_id === subject.id);
    if (plan) {
      if (plan.effective_credits !== undefined && plan.effective_credits !== null) {
        return plan.effective_credits;
      }
      if (plan.credit_override !== undefined && plan.credit_override !== null) {
        return plan.credit_override;
      }
    }
  }
  if (subject.credits !== undefined && subject.credits !== null) {
    return subject.credits;
  }
  return null;
}

/**
 * Determine laboratory status from authoritative metadata.
 */
export function isLaboratorySubject(subject: Subject): boolean {
  return Boolean(subject.is_lab);
}

/**
 * Classify mastery tier according to strict completion rules:
 * - mastered: exactly 100% completion with at least one leaf.
 * - in-progress: > 0% and < 100%.
 * - not-started: 0% completion or zero leaves.
 */
export function getMasteryTier(completedLeaves: number, totalLeaves: number): MasteryTier {
  if (totalLeaves === 0) return 'not-started';
  if (completedLeaves >= totalLeaves) return 'mastered';
  if (completedLeaves > 0) return 'in-progress';
  return 'not-started';
}

/**
 * Resolve pacing and exam risk signals without conflating the two.
 * Mastered subjects are never presented as overdue or behind schedule.
 */
export function resolveSubjectRisk(
  subjectId: string,
  completedLeaves: number,
  totalLeaves: number,
  pacingData?: Record<string, PacingMetrics> | null,
  examRisks?: ExamRiskItem[] | null
): {
  riskStatus: RiskStatus;
  examRiskLevel: 'Low' | 'Moderate' | 'High' | 'Critical' | null;
  examRiskReason: string | null;
} {
  let examRiskLevel: 'Low' | 'Moderate' | 'High' | 'Critical' | null = null;
  let examRiskReason: string | null = null;

  if (examRisks && examRisks.length > 0) {
    const matchedExam = examRisks.find((r) => r.node_id === subjectId);
    if (matchedExam) {
      examRiskLevel = matchedExam.risk_level;
      examRiskReason = matchedExam.risk_reason;
    }
  }

  // If subject is 100% mastered, it cannot be overdue or behind schedule
  const isMastered = totalLeaves > 0 && completedLeaves >= totalLeaves;

  const pacing = pacingData ? pacingData[subjectId] : undefined;
  if (!pacing || pacing.status === 'not_set' || !pacing.target_date) {
    return {
      riskStatus: 'none',
      examRiskLevel,
      examRiskReason,
    };
  }

  if (isMastered) {
    return {
      riskStatus: 'on-track',
      examRiskLevel,
      examRiskReason,
    };
  }

  // Not mastered with active target deadline
  const daysRemaining = pacing.days_remaining;
  if (daysRemaining !== null && daysRemaining !== undefined && daysRemaining < 0) {
    return {
      riskStatus: 'overdue',
      examRiskLevel,
      examRiskReason,
    };
  }

  if (pacing.status === 'behind' || pacing.status === 'at_risk') {
    return {
      riskStatus: 'behind',
      examRiskLevel,
      examRiskReason,
    };
  }

  if (pacing.status === 'on_track' || pacing.status === 'completed') {
    // If significantly ahead (> 14 days left and >= 50% completed), mark ahead
    if (
      daysRemaining !== null &&
      daysRemaining !== undefined &&
      daysRemaining > 14 &&
      totalLeaves > 0 &&
      completedLeaves / totalLeaves >= 0.5
    ) {
      return {
        riskStatus: 'ahead',
        examRiskLevel,
        examRiskReason,
      };
    }
    return {
      riskStatus: 'on-track',
      examRiskLevel,
      examRiskReason,
    };
  }

  return {
    riskStatus: 'none',
    examRiskLevel,
    examRiskReason,
  };
}

/**
 * Text and course-code normalization for accurate string comparisons.
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract Roman numeral sequence value from a title string.
 * Supports: I -> 1, II -> 2, III -> 3, IV -> 4, V -> 5.
 */
function extractRomanNumeral(title: string): { base: string; number: number } | null {
  const romanPattern = /\b(i{1,3}|iv|v)\b\s*$/i;
  const match = title.trim().match(romanPattern);
  if (!match) return null;

  const romanMap: Record<string, number> = {
    i: 1,
    ii: 2,
    iii: 3,
    iv: 4,
    v: 5,
  };

  const val = romanMap[match[1].toLowerCase()];
  if (!val) return null;

  const base = title.slice(0, match.index).trim();
  return { base, number: val };
}

/**
 * Extract Arabic numeral sequence value from a title string.
 * E.g. "Programming 1" -> { base: "Programming", number: 1 }
 */
function extractArabicNumeral(title: string): { base: string; number: number } | null {
  const arabicPattern = /\b([1-9])\b\s*$/;
  const match = title.trim().match(arabicPattern);
  if (!match) return null;

  const num = parseInt(match[1], 10);
  const base = title.slice(0, match.index).trim();
  return { base, number: num };
}

/**
 * Extract course-code prefix and numeric course tier.
 * E.g. "CS101" -> { prefix: "CS", num: 101 }
 *      "CS-201" -> { prefix: "CS", num: 201 }
 */
function parseCourseCode(code: string): { prefix: string; num: number } | null {
  const match = code.trim().match(/^([A-Za-z]+)[\s-]*([0-9]{3,4})$/);
  if (!match) return null;
  return {
    prefix: match[1].toUpperCase(),
    num: parseInt(match[2], 10),
  };
}

// Curated dictionary of strong foundational relationships between core academic disciplines.
interface FoundationRule {
  sourceRegex: RegExp;
  targetRegex: RegExp;
  reason: string;
}

const CORE_FOUNDATION_RULES: FoundationRule[] = [
  {
    sourceRegex: /\b(programming\s*fundamentals|intro(duction)?\s*(to)?\s*programming|computer\s*programming|c\s*programming|python\s*programming)\b/i,
    targetRegex: /\b(data\s*structures|algorithms|object\s*oriented|oop)\b/i,
    reason: 'Programming fundamentals establish essential syntactic and algorithmic logic for data structures and software design',
  },
  {
    sourceRegex: /\b(data\s*structures)\b/i,
    targetRegex: /\b(algorithms|operating\s*systems|database|dbms|compiler|advanced\s*data\s*structures)\b/i,
    reason: 'Data structures provide the core organization primitives necessary for operating systems, DBMS, and advanced algorithms',
  },
  {
    sourceRegex: /\b(design\s*and\s*analysis\s*of\s*algorithms|algorithms)\b/i,
    targetRegex: /\b(artificial\s*intelligence|machine\s*learning|advanced\s*algorithms|distributed\s*algorithms|theory\s*of\s*computation)\b/i,
    reason: 'Algorithm design principles and computational complexity form the theoretical basis for AI and advanced computing',
  },
  {
    sourceRegex: /\b(calculus|engineering\s*mathematics|applied\s*mathematics)\b/i,
    targetRegex: /\b(machine\s*learning|signals|computer\s*graphics|optimization|numerical\s*methods)\b/i,
    reason: 'Differential and integral calculus are mathematically foundational for gradient-based learning, signals, and graphics',
  },
  {
    sourceRegex: /\b(linear\s*algebra)\b/i,
    targetRegex: /\b(machine\s*learning|deep\s*learning|computer\s*graphics|computer\s*vision|data\s*science)\b/i,
    reason: 'Vector spaces and matrix transformations underpin modern graphics rendering, vision, and machine learning models',
  },
  {
    sourceRegex: /\b(probability(\s*and|\s*&)?\s*statistics|statistics(\s*and|\s*&)?\s*probability|biostatistics)\b/i,
    targetRegex: /\b(machine\s*learning|data\s*science|artificial\s*intelligence|pattern\s*recognition|data\s*mining)\b/i,
    reason: 'Probability distributions and statistical estimation drive data science, stochastic algorithms, and ML inference',
  },
  {
    sourceRegex: /\b(digital\s*logic|digital\s*electronics|switching\s*theory)\b/i,
    targetRegex: /\b(computer\s*architecture|computer\s*organization|microprocessor|embedded\s*systems)\b/i,
    reason: 'Boolean logic and digital circuits form the hardware implementation foundation for processor microarchitecture',
  },
  {
    sourceRegex: /\b(basic\s*electronics|electronic\s*devices)\b/i,
    targetRegex: /\b(electronic\s*circuits|analog\s*circuits|integrated\s*circuits|vlsi)\b/i,
    reason: 'Semiconductor fundamentals and basic circuit analysis precede advanced analog and VLSI circuit design',
  },
  {
    sourceRegex: /\b(object\s*oriented\s*(programming)?|oop)\b/i,
    targetRegex: /\b(software\s*engineering|web\s*development|design\s*patterns|mobile\s*app(lication)?\s*development)\b/i,
    reason: 'Object-oriented abstraction and design patterns are essential prerequisites for scalable software engineering',
  },
  {
    sourceRegex: /\b(database\s*management|database\s*systems|dbms)\b/i,
    targetRegex: /\b(web\s*development|big\s*data|data\s*mining|data\s*warehousing|cloud\s*computing)\b/i,
    reason: 'Relational storage and query execution provide persistent data management foundations for web and big data platforms',
  },
  {
    sourceRegex: /\b(operating\s*systems)\b/i,
    targetRegex: /\b(distributed\s*systems|cloud\s*computing|computer\s*networks|virtualization)\b/i,
    reason: 'Process concurrency, virtual memory, and kernel I/O concepts are foundational for distributed cloud architecture',
  },
  {
    sourceRegex: /\b(computer\s*networks)\b/i,
    targetRegex: /\b(network\s*security|cyber\s*security|distributed\s*systems|cloud\s*computing|cryptography)\b/i,
    reason: 'Layered networking protocols and packet routing are required foundations for distributed computing and cyber security',
  },
];

// --- Main Engine Implementation ---

/**
 * Infer deterministic academic prerequisite and progression edges between enrolled semester subjects.
 * Strictly adheres to:
 * 1. Source semesterIndex < Target semesterIndex (no same-semester, backward, or cyclic edges).
 * 2. Rule A: Explicit sequence progression (I -> II, 1 -> 2, CS101 -> CS201).
 * 3. Rule B: Advanced subject progression (Data Structures -> Advanced Data Structures).
 * 4. Rule C: Curated core academic foundations.
 * 5. Foundation satisfaction: source.masteryPercent >= 70.
 * 6. Edge deduplication: keeps the highest-confidence relationship.
 */
export function inferPrerequisiteEdges(columns: SemesterColumn[]): PrerequisiteEdge[] {
  const edgeMap = new Map<string, PrerequisiteEdge>();

  // Collect all enrolled subjects in chronological semester order
  const allSubjects: (SubjectMasteryNode & { semesterIndex: number })[] = [];
  columns.forEach((col) => {
    col.subjects.forEach((subj) => {
      allSubjects.push({
        ...subj,
        semesterIndex: col.semesterIndex,
      });
    });
  });

  for (let i = 0; i < allSubjects.length; i++) {
    const source = allSubjects[i];

    for (let j = 0; j < allSubjects.length; j++) {
      const target = allSubjects[j];

      // Rule D: Strict chronological constraint
      if (source.semesterIndex >= target.semesterIndex) {
        continue;
      }

      // Check Rule A: Explicit Sequence Progression
      let matchedEdge: {
        type: RelationshipType;
        confidence: ConfidenceLevel;
        reason: string;
      } | null = null;

      // 1. Check Rule B: Advanced Subject Progression first
      // E.g. Data Structures -> Advanced Data Structures
      const normSource = normalizeText(source.title);
      const normTarget = normalizeText(target.title);

      if (normTarget.startsWith('advanced ') || normTarget.endsWith(' advanced')) {
        const targetStem = normTarget.replace(/\badvanced\b/g, '').trim();
        const cleanSource = normSource
          .replace(/\b(introduction to|intro to|fundamentals of|basic)\b/g, '')
          .trim();

        if (
          (cleanSource.length > 3 && targetStem.includes(cleanSource)) ||
          (targetStem.length > 3 && cleanSource.includes(targetStem))
        ) {
          matchedEdge = {
            type: 'advanced_progression',
            confidence: 'high',
            reason: `Advanced academic progression: ${source.title} provides foundation for ${target.title}`,
          };
        }
      }

      // 2. Check Rule A: Explicit Sequence Progression (Roman / Arabic / Course Code with shared stem)
      if (!matchedEdge) {
        // Roman numeral sequence check (e.g. Mathematics I -> Mathematics II)
        const sourceRoman = extractRomanNumeral(source.title);
        const targetRoman = extractRomanNumeral(target.title);

        if (sourceRoman && targetRoman) {
          const normSourceBase = normalizeText(sourceRoman.base);
          const normTargetBase = normalizeText(targetRoman.base);
          if (
            normSourceBase.length > 2 &&
            normSourceBase === normTargetBase &&
            targetRoman.number === sourceRoman.number + 1
          ) {
            matchedEdge = {
              type: 'explicit_sequence',
              confidence: 'high',
              reason: `Sequential curriculum progression: ${source.title} → ${target.title}`,
            };
          }
        }
      }

      if (!matchedEdge) {
        // Arabic numeral sequence check (e.g. Programming 1 -> Programming 2)
        const sourceArabic = extractArabicNumeral(source.title);
        const targetArabic = extractArabicNumeral(target.title);

        if (sourceArabic && targetArabic) {
          const normSourceBase = normalizeText(sourceArabic.base);
          const normTargetBase = normalizeText(targetArabic.base);
          if (
            normSourceBase.length > 2 &&
            normSourceBase === normTargetBase &&
            targetArabic.number === sourceArabic.number + 1
          ) {
            matchedEdge = {
              type: 'explicit_sequence',
              confidence: 'high',
              reason: `Sequential academic sequence: ${source.title} → ${target.title}`,
            };
          }
        }
      }

      // 3. Check Rule C: Core Academic Foundations (Curated discipline dictionary)
      // Done before generic course-code step so strong subject matches are properly classified
      if (!matchedEdge) {
        for (const rule of CORE_FOUNDATION_RULES) {
          if (rule.sourceRegex.test(source.title) && rule.targetRegex.test(target.title)) {
            if (normSource !== normTarget) {
              matchedEdge = {
                type: 'core_foundation',
                confidence: 'medium',
                reason: rule.reason,
              };
              break;
            }
          }
        }
      }

      // 4. Course code progression check for remaining sequential subjects
      if (!matchedEdge && source.courseCode && target.courseCode) {
        const sourceCode = parseCourseCode(source.courseCode);
        const targetCode = parseCourseCode(target.courseCode);

        if (sourceCode && targetCode && sourceCode.prefix === targetCode.prefix) {
          const isStandardStep =
            targetCode.num === sourceCode.num + 1 ||
            targetCode.num === sourceCode.num + 100 ||
            (targetCode.num >= 200 && sourceCode.num < 200 && targetCode.num <= sourceCode.num + 101);

          if (isStandardStep) {
            const sourceWords = normSource.split(' ').filter((w) => w.length > 3);
            const targetWords = normTarget.split(' ').filter((w) => w.length > 3);
            const sharedWords = sourceWords.filter((w) => targetWords.includes(w));

            // Only link via course code if they share subject keywords or sequential discipline
            if (sharedWords.length > 0) {
              matchedEdge = {
                type: 'explicit_sequence',
                confidence: 'high',
                reason: `Course code academic sequence (${source.courseCode} → ${target.courseCode}): ${source.title} precedes ${target.title}`,
              };
            }
          }
        }
      }

      // If matched, register edge with deduplication
      if (matchedEdge) {
        const isSatisfied = source.masteryPercent >= FOUNDATION_SATISFACTION_THRESHOLD;
        const edgeKey = `${source.subjectId}->${target.subjectId}`;

        const newEdge: PrerequisiteEdge = {
          fromSubjectId: source.subjectId,
          toSubjectId: target.subjectId,
          reason: matchedEdge.reason,
          relationshipType: matchedEdge.type,
          isFoundationSatisfied: isSatisfied,
          confidence: matchedEdge.confidence,
        };

        const existing = edgeMap.get(edgeKey);
        if (!existing) {
          edgeMap.set(edgeKey, newEdge);
        } else {
          // Keep higher confidence / stronger relationship
          const priority: Record<RelationshipType, number> = {
            explicit_sequence: 3,
            advanced_progression: 2,
            core_foundation: 1,
          };
          if (priority[newEdge.relationshipType] > priority[existing.relationshipType]) {
            edgeMap.set(edgeKey, newEdge);
          }
        }
      }
    }
  }

  // Return deterministically sorted edges
  return Array.from(edgeMap.values()).sort((a, b) => {
    if (a.fromSubjectId !== b.fromSubjectId) {
      return a.fromSubjectId.localeCompare(b.fromSubjectId);
    }
    return a.toSubjectId.localeCompare(b.toSubjectId);
  });
}

/**
 * Primary constructor for the complete Curriculum Mastery Graph.
 * Traverses the canonical hierarchy, filters unenrolled electives, aggregates leaf completion,
 * resolves effective credits and pacing risk, and infers prerequisite dependencies.
 */
export function buildCurriculumMasteryGraph(
  syllabus: HierarchicalSyllabus | null | undefined,
  completedLeafIds: Iterable<string> | null | undefined = [],
  pacingData?: Record<string, PacingMetrics> | null,
  academicPlan?: AcademicPlanResponse | null,
  examRisks?: ExamRiskItem[] | null
): CurriculumMasteryGraph {
  if (!syllabus || !syllabus.years || syllabus.years.length === 0) {
    return {
      columns: [],
      edges: [],
      overallMasteryPercent: 0,
      totalCompletedLeaves: 0,
      totalEnrolledLeaves: 0,
      totalEnrolledCredits: 0,
      totalEnrolledSubjects: 0,
    };
  }

  const completedSet = new Set(completedLeafIds || []);
  const columns: SemesterColumn[] = [];

  let globalCompletedLeaves = 0;
  let globalEnrolledLeaves = 0;
  let globalEnrolledCredits = 0;
  let globalEnrolledSubjects = 0;
  let chronologicalSemesterIndex = 0;

  for (const year of syllabus.years) {
    for (const sem of year.semesters || []) {
      chronologicalSemesterIndex += 1;
      const semIndex = chronologicalSemesterIndex;

      // Extract subjects, filtering for enrolled curriculum only
      const rawSubjects: Subject[] = (sem.subjects && sem.subjects.length > 0)
        ? sem.subjects
        : (sem.topics && sem.topics.length > 0)
        ? sem.topics.map((t: any) => ({
            id: `subj_${t.id}`,
            title: t.title,
            code: null,
            is_enrolled: true,
            enrollment_status: 'mandatory' as const,
            modules: [
              {
                id: t.id,
                title: 'Module 1',
                topics: t.subtopics || t.topics || [],
              },
            ],
          }))
        : [];

      const enrolledSubjects = rawSubjects.filter(isEnrolledSubject);
      const subjectNodes: SubjectMasteryNode[] = [];

      let semCompletedLeaves = 0;
      let semEnrolledLeaves = 0;
      let semCredits = 0;

      for (const subj of enrolledSubjects) {
        const modulesList: ModuleMasterySummary[] = [];
        let subjCompletedLeaves = 0;
        let subjTotalLeaves = 0;

        for (const mod of subj.modules || []) {
          const modLeaves = (mod.topics || []).map((top: any) => top.id);
          const modTotal = modLeaves.length;
          const modCompleted = modLeaves.filter((leafId: string) => completedSet.has(leafId)).length;
          const modPercent = modTotal === 0 ? 0 : Math.round((modCompleted / modTotal) * 1000) / 10;

          modulesList.push({
            moduleId: mod.id,
            title: mod.title,
            completedLeaves: modCompleted,
            totalLeaves: modTotal,
            masteryPercent: modPercent,
          });

          subjCompletedLeaves += modCompleted;
          subjTotalLeaves += modTotal;
        }

        const subjMasteryPercent =
          subjTotalLeaves === 0 ? 0 : Math.round((subjCompletedLeaves / subjTotalLeaves) * 1000) / 10;
        const masteryTier = getMasteryTier(subjCompletedLeaves, subjTotalLeaves);

        const credits = resolveEffectiveCredits(subj, academicPlan);
        const isLab = isLaboratorySubject(subj);
        const risk = resolveSubjectRisk(subj.id, subjCompletedLeaves, subjTotalLeaves, pacingData, examRisks);

        subjectNodes.push({
          subjectId: subj.id,
          title: subj.title,
          courseCode: subj.code || null,
          semesterId: sem.id,
          semesterIndex: semIndex,
          isLab,
          credits,
          completedLeaves: subjCompletedLeaves,
          totalLeaves: subjTotalLeaves,
          masteryPercent: subjMasteryPercent,
          masteryTier,
          riskStatus: risk.riskStatus,
          examRiskLevel: risk.examRiskLevel,
          examRiskReason: risk.examRiskReason,
          modules: modulesList,
        });

        semCompletedLeaves += subjCompletedLeaves;
        semEnrolledLeaves += subjTotalLeaves;
        if (credits !== null && credits > 0) {
          semCredits += credits;
        }
      }

      const semMasteryPercent =
        semEnrolledLeaves === 0 ? 0 : Math.round((semCompletedLeaves / semEnrolledLeaves) * 1000) / 10;

      columns.push({
        semesterId: sem.id,
        semesterTitle: sem.title,
        semesterIndex: semIndex,
        subjects: subjectNodes,
        masteryPercent: semMasteryPercent,
        completedLeaves: semCompletedLeaves,
        totalLeaves: semEnrolledLeaves,
        totalCredits: Math.round(semCredits * 10) / 10,
        subjectCount: subjectNodes.length,
      });

      globalCompletedLeaves += semCompletedLeaves;
      globalEnrolledLeaves += semEnrolledLeaves;
      globalEnrolledCredits += semCredits;
      globalEnrolledSubjects += subjectNodes.length;
    }
  }

  const overallMasteryPercent =
    globalEnrolledLeaves === 0 ? 0 : Math.round((globalCompletedLeaves / globalEnrolledLeaves) * 1000) / 10;

  const edges = inferPrerequisiteEdges(columns);

  return {
    columns,
    edges,
    overallMasteryPercent,
    totalCompletedLeaves: globalCompletedLeaves,
    totalEnrolledLeaves: globalEnrolledLeaves,
    totalEnrolledCredits: Math.round(globalEnrolledCredits * 10) / 10,
    totalEnrolledSubjects: globalEnrolledSubjects,
  };
}
