import { describe, it, expect } from 'vitest';
import {
  buildCurriculumMasteryGraph,
  inferPrerequisiteEdges,
  isEnrolledSubject,
  resolveEffectiveCredits,
  isLaboratorySubject,
  getMasteryTier,
  resolveSubjectRisk,
  FOUNDATION_SATISFACTION_THRESHOLD,
  type SemesterColumn,
} from '../lib/curriculumGraph';
import type {
  HierarchicalSyllabus,
  Subject,
  AcademicPlanResponse,
  SubjectAcademicPlanItem,
  PacingMetrics,
  ExamRiskItem,
} from '../types/syllabus';

describe('Curriculum Graph Engine (curriculumGraph.ts)', () => {
  const createMockSyllabus = (): HierarchicalSyllabus => ({
    id: 'syl_test_1',
    title: 'Computer Science & Engineering',
    created_at: '2026-11-21T00:00:00Z',
    updated_at: '2026-11-21T00:00:00Z',
    source_filename: 'cse_curriculum.pdf',
    schema_version: 2,
    years: [
      {
        id: 'yr_1',
        title: 'Year 1',
        year_number: 1,
        semesters: [
          {
            id: 'sem_1',
            title: 'Semester 1',
            semester_number: 1,
            subjects: [
              {
                id: 'subj_math1',
                title: 'Engineering Mathematics I',
                code: 'MATH101',
                credits: 4,
                is_lab: false,
                is_enrolled: true,
                enrollment_status: 'mandatory',
                modules: [
                  {
                    id: 'mod_m1_1',
                    title: 'Calculus Fundamentals',
                    topics: [
                      { id: 'leaf_m1_1', title: 'Limits', source_text: 'Limits' },
                      { id: 'leaf_m1_2', title: 'Derivatives', source_text: 'Derivatives' },
                    ],
                  },
                ],
              },
              {
                id: 'subj_prog1',
                title: 'Programming Fundamentals',
                code: 'CS101',
                credits: 3,
                is_lab: false,
                is_enrolled: true,
                enrollment_status: 'mandatory',
                modules: [
                  {
                    id: 'mod_p1_1',
                    title: 'C Syntax',
                    topics: [
                      { id: 'leaf_p1_1', title: 'Variables', source_text: 'Variables' },
                      { id: 'leaf_p1_2', title: 'Loops', source_text: 'Loops' },
                    ],
                  },
                ],
              },
              {
                id: 'subj_chem_lab',
                title: 'Chemistry Lab',
                code: 'CHM101L',
                credits: 1,
                is_lab: true,
                is_enrolled: true,
                enrollment_status: 'mandatory',
                modules: [
                  {
                    id: 'mod_chm_1',
                    title: 'Titration',
                    topics: [
                      { id: 'leaf_chm_1', title: 'Acid Base', source_text: 'Acid Base' },
                    ],
                  },
                ],
              },
              {
                id: 'subj_elective_excluded',
                title: 'German Language I',
                code: 'LNG101',
                credits: 2,
                is_lab: false,
                is_elective: true,
                is_enrolled: false,
                enrollment_status: 'excluded',
                modules: [
                  {
                    id: 'mod_lng_1',
                    title: 'Alphabet',
                    topics: [{ id: 'leaf_lng_1', title: 'Letters', source_text: 'Letters' }],
                  },
                ],
              },
            ],
          },
          {
            id: 'sem_2',
            title: 'Semester 2',
            semester_number: 2,
            subjects: [
              {
                id: 'subj_math2',
                title: 'Engineering Mathematics II',
                code: 'MATH102',
                credits: 4,
                is_lab: false,
                is_enrolled: true,
                enrollment_status: 'mandatory',
                modules: [
                  {
                    id: 'mod_m2_1',
                    title: 'Multivariable Calculus',
                    topics: [
                      { id: 'leaf_m2_1', title: 'Partial Derivs', source_text: 'Partial Derivs' },
                      { id: 'leaf_m2_2', title: 'Integrals', source_text: 'Integrals' },
                    ],
                  },
                ],
              },
              {
                id: 'subj_dsa',
                title: 'Data Structures',
                code: 'CS201',
                credits: 4,
                is_lab: false,
                is_enrolled: true,
                enrollment_status: 'mandatory',
                modules: [
                  {
                    id: 'mod_dsa_1',
                    title: 'Linear Structures',
                    topics: [
                      { id: 'leaf_dsa_1', title: 'Arrays', source_text: 'Arrays' },
                      { id: 'leaf_dsa_2', title: 'Linked Lists', source_text: 'Linked Lists' },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'yr_2',
        title: 'Year 2',
        year_number: 2,
        semesters: [
          {
            id: 'sem_3',
            title: 'Semester 3',
            semester_number: 3,
            subjects: [
              {
                id: 'subj_algo',
                title: 'Advanced Data Structures',
                code: 'CS301',
                credits: 3,
                is_lab: false,
                is_enrolled: true,
                enrollment_status: 'mandatory',
                modules: [
                  {
                    id: 'mod_adv_1',
                    title: 'Trees & Graphs',
                    topics: [
                      { id: 'leaf_algo_1', title: 'Red Black Trees', source_text: 'Red Black Trees' },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  });

  describe('1. Mastery calculations & Aggregations', () => {
    it('calculates 100% completion correctly for fully completed subjects', () => {
      const syllabus = createMockSyllabus();
      const completedIds = ['leaf_m1_1', 'leaf_m1_2'];
      const graph = buildCurriculumMasteryGraph(syllabus, completedIds);

      const math1 = graph.columns[0].subjects.find((s) => s.subjectId === 'subj_math1');
      expect(math1).toBeDefined();
      expect(math1?.completedLeaves).toBe(2);
      expect(math1?.totalLeaves).toBe(2);
      expect(math1?.masteryPercent).toBe(100);
      expect(math1?.masteryTier).toBe('mastered');
    });

    it('calculates partial completion and in-progress tier correctly', () => {
      const syllabus = createMockSyllabus();
      const completedIds = ['leaf_m1_1'];
      const graph = buildCurriculumMasteryGraph(syllabus, completedIds);

      const math1 = graph.columns[0].subjects.find((s) => s.subjectId === 'subj_math1');
      expect(math1?.completedLeaves).toBe(1);
      expect(math1?.totalLeaves).toBe(2);
      expect(math1?.masteryPercent).toBe(50);
      expect(math1?.masteryTier).toBe('in-progress');
    });

    it('calculates 0% completion and not-started tier correctly', () => {
      const syllabus = createMockSyllabus();
      const graph = buildCurriculumMasteryGraph(syllabus, []);

      const math1 = graph.columns[0].subjects.find((s) => s.subjectId === 'subj_math1');
      expect(math1?.completedLeaves).toBe(0);
      expect(math1?.totalLeaves).toBe(2);
      expect(math1?.masteryPercent).toBe(0);
      expect(math1?.masteryTier).toBe('not-started');
    });

    it('aggregates module-level progress accurately from child subtopics', () => {
      const syllabus = createMockSyllabus();
      const completedIds = ['leaf_m1_1'];
      const graph = buildCurriculumMasteryGraph(syllabus, completedIds);

      const math1 = graph.columns[0].subjects.find((s) => s.subjectId === 'subj_math1');
      expect(math1?.modules.length).toBe(1);
      const mod = math1?.modules[0];
      expect(mod?.completedLeaves).toBe(1);
      expect(mod?.totalLeaves).toBe(2);
      expect(mod?.masteryPercent).toBe(50);
    });

    it('aggregates semester mastery from leaf counts, not by averaging subjects or weighting credits', () => {
      const syllabus = createMockSyllabus();
      // Sem 1 enrolled subjects:
      // Math 1: 2 leaves, Prog 1: 2 leaves, Chem Lab: 1 leaf = 5 total enrolled leaves
      // If 2 leaves completed out of 5:
      const completedIds = ['leaf_m1_1', 'leaf_m1_2'];
      const graph = buildCurriculumMasteryGraph(syllabus, completedIds);

      const sem1 = graph.columns[0];
      expect(sem1.completedLeaves).toBe(2);
      expect(sem1.totalLeaves).toBe(5);
      expect(sem1.masteryPercent).toBe(40); // 2/5 * 100 = 40%
    });

    it('handles zero-leaf subjects safely without dividing by zero or classifying as mastered', () => {
      const syllabus = createMockSyllabus();
      syllabus.years[0].semesters[0].subjects![0].modules = []; // empty leaves
      const graph = buildCurriculumMasteryGraph(syllabus, []);

      const math1 = graph.columns[0].subjects.find((s) => s.subjectId === 'subj_math1');
      expect(math1?.totalLeaves).toBe(0);
      expect(math1?.completedLeaves).toBe(0);
      expect(math1?.masteryPercent).toBe(0);
      expect(math1?.masteryTier).toBe('not-started');
      expect(getMasteryTier(0, 0)).toBe('not-started');
    });

    it('handles empty syllabus input gracefully', () => {
      const emptyGraph = buildCurriculumMasteryGraph(null);
      expect(emptyGraph.columns).toEqual([]);
      expect(emptyGraph.edges).toEqual([]);
      expect(emptyGraph.overallMasteryPercent).toBe(0);
      expect(emptyGraph.totalEnrolledLeaves).toBe(0);
    });
  });

  describe('2. Enrollment filtering & Elective exclusions', () => {
    it('strictly excludes subjects with is_enrolled === false or status === excluded', () => {
      const syllabus = createMockSyllabus();
      const graph = buildCurriculumMasteryGraph(syllabus, ['leaf_lng_1']);

      const sem1 = graph.columns[0];
      const excludedSubj = sem1.subjects.find((s) => s.subjectId === 'subj_elective_excluded');
      expect(excludedSubj).toBeUndefined();
      // Excluded leaves must not contribute to denominator
      expect(sem1.totalLeaves).toBe(5);
      // Excluded credits must not contribute to total
      expect(sem1.totalCredits).toBe(8); // 4 + 3 + 1 = 8 cr (excludes 2 cr of German)
    });

    it('excludes subjects with enrollment_status === pending', () => {
      const testSubject = {
        id: 'subj_pending',
        title: 'Pending Elective',
        is_enrolled: true,
        enrollment_status: 'pending',
      };
      expect(isEnrolledSubject(testSubject)).toBe(false);
    });

    it('maintains compatibility with legacy records lacking enrollment metadata', () => {
      const legacySubject = {
        id: 'subj_legacy',
        title: 'Legacy Subject',
      };
      expect(isEnrolledSubject(legacySubject)).toBe(true);
    });
  });

  describe('3. Academic metadata & Credit resolution', () => {
    it('resolves effective credits with override precedence over canonical credits', () => {
      const syllabus = createMockSyllabus();
      const academicPlan: AcademicPlanResponse = {
        syllabus_id: syllabus.id,
        grade_scale_projections: [],
        subject_plans: [
          {
            subject_id: 'subj_math1',
            credit_override: 5.0,
            effective_credits: 5.0,
            grade_scale: '10.0',
          } as unknown as SubjectAcademicPlanItem,
        ],
        unassigned_credit_subjects: [],
      } as unknown as AcademicPlanResponse;

      const resolvedCredits = resolveEffectiveCredits(
        syllabus.years[0].semesters[0].subjects![0],
        academicPlan
      );
      expect(resolvedCredits).toBe(5.0);

      const graph = buildCurriculumMasteryGraph(syllabus, [], null, academicPlan);
      const math1 = graph.columns[0].subjects.find((s) => s.subjectId === 'subj_math1');
      expect(math1?.credits).toBe(5.0);
    });

    it('preserves zero-credit subjects accurately', () => {
      const zeroCreditSubj: Subject = {
        id: 'subj_zero',
        title: 'Orientation Seminar',
        credits: 0,
        modules: [],
      };
      expect(resolveEffectiveCredits(zeroCreditSubj, null)).toBe(0);
    });

    it('identifies laboratory subjects from metadata', () => {
      const syllabus = createMockSyllabus();
      const graph = buildCurriculumMasteryGraph(syllabus, []);
      const chemLab = graph.columns[0].subjects.find((s) => s.subjectId === 'subj_chem_lab');
      expect(chemLab?.isLab).toBe(true);
      expect(isLaboratorySubject(syllabus.years[0].semesters[0].subjects![2])).toBe(true);
    });
  });

  describe('4. Risk and Pacing integration', () => {
    it('identifies overdue subjects when days_remaining < 0 and incomplete', () => {
      const pacingData: Record<string, PacingMetrics> = {
        subj_math1: {
          node_id: 'subj_math1',
          target_date: '2026-11-01',
          days_remaining: -5,
          total_leaves: 2,
          completed_leaves: 1,
          remaining_leaves: 1,
          remaining_contact_hours: 10,
          topics_per_week: 1,
          hours_per_week: 5,
          status: 'behind',
        },
      };

      const risk = resolveSubjectRisk('subj_math1', 1, 2, pacingData);
      expect(risk.riskStatus).toBe('overdue');
    });

    it('does not classify a mastered (100%) subject as overdue even if deadline is passed', () => {
      const pacingData: Record<string, PacingMetrics> = {
        subj_math1: {
          node_id: 'subj_math1',
          target_date: '2026-11-01',
          days_remaining: -10,
          total_leaves: 2,
          completed_leaves: 2,
          remaining_leaves: 0,
          remaining_contact_hours: 0,
          topics_per_week: 0,
          hours_per_week: 0,
          status: 'completed',
        },
      };

      const risk = resolveSubjectRisk('subj_math1', 2, 2, pacingData);
      expect(risk.riskStatus).toBe('on-track');
    });

    it('returns riskStatus none for subjects without applicable deadlines', () => {
      const risk = resolveSubjectRisk('subj_math1', 0, 2, {});
      expect(risk.riskStatus).toBe('none');
    });

    it('attaches exam risk metrics without conflating them with pacing status', () => {
      const examRisks: ExamRiskItem[] = [
        {
          node_id: 'subj_math1',
          node_type: 'subject',
          title: 'Engineering Mathematics I',
          target_date: '2026-12-01',
          days_remaining: 10,
          total_leaves: 2,
          completed_leaves: 0,
          incomplete_leaves: 2,
          completion_percentage: 0,
          required_velocity_per_day: 0.2,
          current_velocity_per_day: 0.0,
          risk_level: 'High',
          risk_reason: 'Zero progress recorded with 10 days remaining',
        },
      ];

      const risk = resolveSubjectRisk('subj_math1', 0, 2, null, examRisks);
      expect(risk.riskStatus).toBe('none'); // no pacing deadline record
      expect(risk.examRiskLevel).toBe('High');
      expect(risk.examRiskReason).toContain('Zero progress');
    });
  });

  describe('5. Deterministic Prerequisite Inference', () => {
    it('infers Roman numeral progression (I → II) with high confidence', () => {
      const syllabus = createMockSyllabus();
      const graph = buildCurriculumMasteryGraph(syllabus, []);

      const mathEdge = graph.edges.find(
        (e) => e.fromSubjectId === 'subj_math1' && e.toSubjectId === 'subj_math2'
      );
      expect(mathEdge).toBeDefined();
      expect(mathEdge?.relationshipType).toBe('explicit_sequence');
      expect(mathEdge?.confidence).toBe('high');
    });

    it('infers core foundation progression (Programming Fundamentals → Data Structures)', () => {
      const syllabus = createMockSyllabus();
      const graph = buildCurriculumMasteryGraph(syllabus, []);

      const progEdge = graph.edges.find(
        (e) => e.fromSubjectId === 'subj_prog1' && e.toSubjectId === 'subj_dsa'
      );
      expect(progEdge).toBeDefined();
      expect(progEdge?.relationshipType).toBe('core_foundation');
      expect(progEdge?.confidence).toBe('medium');
    });

    it('infers advanced subject progression (Data Structures → Advanced Data Structures)', () => {
      const syllabus = createMockSyllabus();
      const graph = buildCurriculumMasteryGraph(syllabus, []);

      const advEdge = graph.edges.find(
        (e) => e.fromSubjectId === 'subj_dsa' && e.toSubjectId === 'subj_algo'
      );
      expect(advEdge).toBeDefined();
      expect(advEdge?.relationshipType).toBe('advanced_progression');
      expect(advEdge?.confidence).toBe('high');
    });

    it('enforces the 70% foundation satisfaction threshold strictly', () => {
      const columns: SemesterColumn[] = [
        {
          semesterId: 'sem_1',
          semesterTitle: 'Semester 1',
          semesterIndex: 1,
          masteryPercent: 70,
          completedLeaves: 7,
          totalLeaves: 10,
          totalCredits: 4,
          subjectCount: 1,
          subjects: [
            {
              subjectId: 's1',
              title: 'Programming Fundamentals',
              courseCode: 'CS101',
              semesterId: 'sem_1',
              semesterIndex: 1,
              isLab: false,
              credits: 4,
              completedLeaves: 7,
              totalLeaves: 10,
              masteryPercent: 70, // Exactly 70%
              masteryTier: 'in-progress',
              riskStatus: 'none',
              modules: [],
            },
          ],
        },
        {
          semesterId: 'sem_2',
          semesterTitle: 'Semester 2',
          semesterIndex: 2,
          masteryPercent: 0,
          completedLeaves: 0,
          totalLeaves: 10,
          totalCredits: 4,
          subjectCount: 1,
          subjects: [
            {
              subjectId: 's2',
              title: 'Data Structures',
              courseCode: 'CS201',
              semesterId: 'sem_2',
              semesterIndex: 2,
              isLab: false,
              credits: 4,
              completedLeaves: 0,
              totalLeaves: 10,
              masteryPercent: 0,
              masteryTier: 'not-started',
              riskStatus: 'none',
              modules: [],
            },
          ],
        },
      ];

      expect(FOUNDATION_SATISFACTION_THRESHOLD).toBe(70);

      // At exactly 70%, it is satisfied
      const edgesSatisfied = inferPrerequisiteEdges(columns);
      expect(edgesSatisfied[0].isFoundationSatisfied).toBe(true);

      // Below 70% (e.g. 69.9%), it is not satisfied
      columns[0].subjects[0].masteryPercent = 69.9;
      const edgesUnsatisfied = inferPrerequisiteEdges(columns);
      expect(edgesUnsatisfied[0].isFoundationSatisfied).toBe(false);
    });

    it('strictly enforces chronological constraints: no same-semester or backward edges', () => {
      const columns: SemesterColumn[] = [
        {
          semesterId: 'sem_1',
          semesterTitle: 'Semester 1',
          semesterIndex: 1,
          masteryPercent: 0,
          completedLeaves: 0,
          totalLeaves: 10,
          totalCredits: 8,
          subjectCount: 2,
          subjects: [
            {
              subjectId: 's1',
              title: 'Engineering Mathematics I',
              courseCode: 'MATH101',
              semesterId: 'sem_1',
              semesterIndex: 1,
              isLab: false,
              credits: 4,
              completedLeaves: 0,
              totalLeaves: 5,
              masteryPercent: 0,
              masteryTier: 'not-started',
              riskStatus: 'none',
              modules: [],
            },
            {
              subjectId: 's2',
              title: 'Engineering Mathematics II', // Same semester!
              courseCode: 'MATH102',
              semesterId: 'sem_1',
              semesterIndex: 1,
              isLab: false,
              credits: 4,
              completedLeaves: 0,
              totalLeaves: 5,
              masteryPercent: 0,
              masteryTier: 'not-started',
              riskStatus: 'none',
              modules: [],
            },
          ],
        },
      ];

      const edges = inferPrerequisiteEdges(columns);
      expect(edges.length).toBe(0); // Zero edges allowed in same semester
    });

    it('never creates duplicate edges between the same subject pair', () => {
      const syllabus = createMockSyllabus();
      const graph = buildCurriculumMasteryGraph(syllabus, []);

      const pairKeys = graph.edges.map((e) => `${e.fromSubjectId}->${e.toSubjectId}`);
      const uniqueKeys = new Set(pairKeys);
      expect(pairKeys.length).toBe(uniqueKeys.size);
    });
  });

  describe('6. Immutability', () => {
    it('does not mutate source syllabus or academic plan objects', () => {
      const syllabus = createMockSyllabus();
      const serializedBefore = JSON.stringify(syllabus);

      buildCurriculumMasteryGraph(syllabus, ['leaf_m1_1']);

      const serializedAfter = JSON.stringify(syllabus);
      expect(serializedBefore).toBe(serializedAfter);
    });
  });
});
