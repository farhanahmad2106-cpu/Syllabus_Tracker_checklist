import '../setupTests';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalyticsDashboard } from '../components/AnalyticsDashboard';
import * as api from '../lib/api';
import * as nativeBridge from '../lib/nativeBridge';
import type { AcademicPlanResponse, DueRevisionsResponse, SyllabusAnalytics } from '../types/syllabus';

vi.mock('../lib/api', () => ({
  exportSyllabusIcs: vi.fn(() => Promise.resolve('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n')),
  fetchSyllabusAnalytics: vi.fn(),
  fetchDueRevisions: vi.fn(),
  fetchAcademicPlan: vi.fn(),
  submitRevisionReview: vi.fn(),
}));

vi.mock('../lib/nativeBridge', () => ({
  exportAndShareFile: vi.fn().mockResolvedValue('downloaded'),
  isNativePlatform: vi.fn().mockReturnValue(false),
}));

vi.mock('../lib/offlineStore', () => ({
  enqueueMutation: vi.fn().mockResolvedValue('mutation_123'),
}));

describe('AnalyticsDashboard Component', () => {
  const mockAnalytics: SyllabusAnalytics = {
    syllabus_id: 'syl_test_1',
    overall_completion_percentage: 65.5,
    total_eligible_leaves: 20,
    completed_eligible_leaves: 13,
    remaining_eligible_leaves: 7,
    streak: {
      current_streak: 4,
      longest_streak: 7,
      last_activity_date: '2026-11-18',
      is_active_today: true,
    },
    velocity_14d: [
      {
        date: '2026-11-17',
        completed_count: 3,
        uncompleted_count: 0,
        net_change: 3,
        cumulative_completed: 10,
      },
      {
        date: '2026-11-18',
        completed_count: 3,
        uncompleted_count: 0,
        net_change: 3,
        cumulative_completed: 13,
      },
    ],
    subject_coverage: [
      {
        subject_id: 'subj_db',
        subject_code: 'CS101',
        subject_title: 'Database Systems',
        is_lab: false,
        total_leaves: 12,
        completed_leaves: 9,
        completion_percentage: 75.0,
      },
      {
        subject_id: 'subj_lab',
        subject_code: 'CS101L',
        subject_title: 'Database Lab',
        is_lab: true,
        total_leaves: 8,
        completed_leaves: 4,
        completion_percentage: 50.0,
      },
    ],
    revision_queue: {
      due_today_count: 1,
      overdue_count: 1,
      upcoming_7d_count: 3,
      mastered_count: 5,
      total_scheduled: 13,
    },
    exam_risks: [
      {
        node_id: 'subj_db',
        node_type: 'subject',
        title: 'CS101 - Database Systems',
        target_date: '2026-12-01',
        days_remaining: 13,
        total_leaves: 12,
        completed_leaves: 9,
        incomplete_leaves: 3,
        completion_percentage: 75.0,
        required_velocity_per_day: 0.23,
        current_velocity_per_day: 0.43,
        risk_level: 'Low',
        risk_reason: 'Pacing on track to meet deadline',
      },
    ],
  };

  const mockDueRevisions: DueRevisionsResponse = {
    syllabus_id: 'syl_test_1',
    total_due: 2,
    items: [
      {
        schedule_id: 1,
        leaf_id: 'leaf_sql_ddl',
        leaf_title: 'DDL Schemas and Tables',
        module_id: 'mod_1',
        module_title: 'Relational Modeling',
        subject_id: 'subj_db',
        subject_code: 'CS101',
        subject_title: 'Database Systems',
        semester_id: 'sem_1',
        semester_title: 'Semester 1',
        due_date: '2026-11-17',
        days_overdue: 1,
        is_overdue: true,
        repetition_count: 1,
        interval_days: 1,
        ease_factor: 2.5,
        last_reviewed_at: null,
        has_notes: true,
        resource_count: 2,
      },
      {
        schedule_id: 2,
        leaf_id: 'leaf_sql_dml',
        leaf_title: 'DML Queries and Indexes',
        module_id: 'mod_1',
        module_title: 'Relational Modeling',
        subject_id: 'subj_db',
        subject_code: 'CS101',
        subject_title: 'Database Systems',
        semester_id: 'sem_1',
        semester_title: 'Semester 1',
        due_date: '2026-11-18',
        days_overdue: 0,
        is_overdue: false,
        repetition_count: 2,
        interval_days: 6,
        ease_factor: 2.5,
        last_reviewed_at: '2026-11-12T10:00:00Z',
        has_notes: false,
        resource_count: 0,
      },
    ],
  };

  const mockAcademicPlan: AcademicPlanResponse = {
    syllabus_id: 'syl_test_1',
    program_credit_summary: {
      total_enrolled_subjects: 10,
      known_credit_subject_count: 10,
      total_declared_credits: 160,
      completed_credits: 40,
      remaining_credits: 120,
      proportional_earned_estimate: 40,
      unassigned_credit_count: 0,
      eligible_credits_10: 160,
      eligible_credits_4: 0,
    },
    semester_summaries: [],
    grade_scale_projections: [],
    subject_plans: [],
    unassigned_credit_subjects: [],
    calculation_metadata: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.fetchSyllabusAnalytics).mockResolvedValue(mockAnalytics);
    vi.mocked(api.fetchDueRevisions).mockResolvedValue(mockDueRevisions);
    vi.mocked(api.fetchAcademicPlan).mockResolvedValue(mockAcademicPlan);
  });

  it('renders loading state initially and then renders KPI cards', async () => {
    render(
      <AnalyticsDashboard
        syllabusId="syl_test_1"
        syllabusTitle="B.Sc. Data Engineering"
      />
    );

    // Initial loading indicator
    expect(
      screen.getByText(/Aggregating study analytics/i)
    ).toBeInTheDocument();

    // Wait for cards to render
    await waitFor(() => {
      expect(screen.getByText('65.5%')).toBeInTheDocument();
      expect(screen.getByText(/13 \/ 20 topics/i)).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument(); // current streak
      expect(screen.getByText(/Active Today/i)).toBeInTheDocument();
      expect(screen.getByText('Mastered Topics')).toBeInTheDocument();
      expect(screen.getByText(/of 13 scheduled/i)).toBeInTheDocument();
    }, { timeout: 4000 });
  });

  it('renders 14-day study activity native SVG chart', async () => {
    render(
      <AnalyticsDashboard
        syllabusId="syl_test_1"
        syllabusTitle="B.Sc. Data Engineering"
      />
    );

    await waitFor(() => {
      expect(
        screen.getByLabelText('14-Day Study Activity Bar Chart')
      ).toBeInTheDocument();
    });
  });

  it('renders due revision items with breadcrumbs and rating buttons', async () => {
    render(
      <AnalyticsDashboard
        syllabusId="syl_test_1"
        syllabusTitle="B.Sc. Data Engineering"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('DDL Schemas and Tables')).toBeInTheDocument();
      expect(screen.getByText('DML Queries and Indexes')).toBeInTheDocument();
      expect(screen.getByText(/1d overdue/i)).toBeInTheDocument();
    });

    // Check rating buttons (Again, Hard, Good, Easy)
    expect(screen.getAllByText(/1 • Again/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/2 • Hard/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/3 • Good/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/4 • Easy/i)[0]).toBeInTheDocument();
  });

  it('submits a review rating optimistically and updates UI', async () => {
    vi.mocked(api.submitRevisionReview).mockResolvedValue({
      schedule_id: 1,
      syllabus_id: 'syl_test_1',
      leaf_id: 'leaf_sql_ddl',
      repetition_count: 2,
      interval_days: 6,
      ease_factor: 2.5,
      next_review_date: '2026-11-24',
      quality: 3,
      reviewed_at: '2026-11-18T12:00:00Z',
    });

    render(
      <AnalyticsDashboard
        syllabusId="syl_test_1"
        syllabusTitle="B.Sc. Data Engineering"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('DDL Schemas and Tables')).toBeInTheDocument();
    });

    const goodBtn = screen.getAllByText(/3 • Good/i)[0];
    fireEvent.click(goodBtn);

    // Optimistically removed from list
    await waitFor(() => {
      expect(
        screen.queryByText('DDL Schemas and Tables')
      ).not.toBeInTheDocument();
    });

    expect(api.submitRevisionReview).toHaveBeenCalledWith(
      'syl_test_1',
      'leaf_sql_ddl',
      expect.objectContaining({ quality: 3 })
    );
  });

  it('renders subject coverage breakdown and lab badge', async () => {
    render(
      <AnalyticsDashboard
        syllabusId="syl_test_1"
        syllabusTitle="B.Sc. Data Engineering"
      />
    );

    await waitFor(() => {
      expect(
        screen.getByText(/CS101 • Database Systems/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/CS101L • Database Lab/i)
      ).toBeInTheDocument();
      expect(screen.getByText('LAB')).toBeInTheDocument();
    });
  });

  it('renders upcoming exam risk panel with risk badge and required velocity', async () => {
    render(
      <AnalyticsDashboard
        syllabusId="syl_test_1"
        syllabusTitle="B.Sc. Data Engineering"
      />
    );

    await waitFor(() => {
      expect(
        screen.getAllByText('CS101 - Database Systems').length
      ).toBeGreaterThan(0);
      expect(screen.getByText('Low Risk')).toBeInTheDocument();
      expect(screen.getByText('13d')).toBeInTheDocument();
      expect(screen.getByText('0.23 /day')).toBeInTheDocument();
    }, { timeout: 4000 });
  });

  it('triggers calendar export and sharing when Sync to Calendar is clicked', async () => {
    render(
      <AnalyticsDashboard
        syllabusId="syl_test_1"
        syllabusTitle="B.Sc. Data Engineering"
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Sync to Calendar \(\.ics\)/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Sync to Calendar \(\.ics\)/i }));

    await waitFor(() => {
      expect(api.exportSyllabusIcs).toHaveBeenCalledWith(
        'syl_test_1',
        expect.objectContaining({
          includeDeadlines: true,
          includeRevisions: true,
          includeCompleted: false,
        })
      );
      expect(nativeBridge.exportAndShareFile).toHaveBeenCalledWith(
        expect.objectContaining({
          filename: 'B.Sc. Data Engineering_schedule.ics',
          mimeType: 'text/calendar',
          dialogTitle: 'Sync Academic Calendar',
        })
      );
    });
  });
});
