import '../setupTests';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { CompareSyllabiModal } from '../components/CompareSyllabiModal';
import * as api from '../lib/api';
import type { SyllabusComparisonResponse, SyllabusListItem } from '../types/syllabus';

vi.mock('../lib/api', () => ({
  compareSyllabi: vi.fn(),
}));

describe('CompareSyllabiModal Component', () => {
  const mockSyllabi: SyllabusListItem[] = [
    {
      id: 'syl_1',
      title: 'Computer Science & Engineering',
      source_filename: 'cse.pdf',
      schema_version: '1.0.0',
      created_at: '2026-11-01T00:00:00Z',
      progress: {
        total_leaves: 100,
        completed_leaves: 60,
        progress_percent: 60.0,
      },
    },
    {
      id: 'syl_2',
      title: 'Information Technology',
      source_filename: 'it.pdf',
      schema_version: '1.0.0',
      created_at: '2026-11-01T00:00:00Z',
      progress: {
        total_leaves: 90,
        completed_leaves: 45,
        progress_percent: 50.0,
      },
    },
    {
      id: 'syl_3',
      title: 'Electronics & Communication',
      source_filename: 'ece.pdf',
      schema_version: '1.0.0',
      created_at: '2026-11-01T00:00:00Z',
      progress: {
        total_leaves: 110,
        completed_leaves: 33,
        progress_percent: 30.0,
      },
    },
  ];

  const mockComparisonResponse: SyllabusComparisonResponse = {
    total_compared: 2,
    syllabi: [
      {
        syllabus_id: 'syl_1',
        title: 'Computer Science & Engineering',
        source_filename: 'cse.pdf',
        total_years: 4,
        total_semesters: 8,
        total_subjects: 40,
        enrolled_subjects_count: 36,
        elective_subjects_count: 4,
        total_modules: 120,
        total_leaves: 100,
        completed_leaves: 60,
        completion_percentage: 60.0,
        total_declared_credits: 160.0,
        total_effective_credits: 160.0,
        total_completed_credits: 96.0,
        proportional_earned_credits_estimate: 96.0,
        laboratory_courses_count: 8,
        laboratory_ratio_percent: 20.0,
        weekly_workload: {
          lecture_hours: 32.0,
          tutorial_hours: 8.0,
          practical_hours: 16.0,
          total_hours: 56.0,
        },
        projections: {
          scale_10: {
            target_gpa: 8.8,
            gpa_eligible_credits: 160.0,
            gpa_eligible_subjects_count: 36,
            scale: '10.0',
          },
          scale_4: {
            target_gpa: null,
            gpa_eligible_credits: 0.0,
            gpa_eligible_subjects_count: 0,
            scale: '4.0',
          },
        },
      },
      {
        syllabus_id: 'syl_2',
        title: 'Information Technology',
        source_filename: 'it.pdf',
        total_years: 4,
        total_semesters: 8,
        total_subjects: 38,
        enrolled_subjects_count: 35,
        elective_subjects_count: 3,
        total_modules: 115,
        total_leaves: 90,
        completed_leaves: 45,
        completion_percentage: 50.0,
        total_declared_credits: 155.0,
        total_effective_credits: 155.0,
        total_completed_credits: 77.5,
        proportional_earned_credits_estimate: 77.5,
        laboratory_courses_count: 7,
        laboratory_ratio_percent: 18.4,
        weekly_workload: {
          lecture_hours: 30.0,
          tutorial_hours: 6.0,
          practical_hours: 14.0,
          total_hours: 50.0,
        },
        projections: {
          scale_10: {
            target_gpa: 8.5,
            gpa_eligible_credits: 155.0,
            gpa_eligible_subjects_count: 35,
            scale: '10.0',
          },
          scale_4: {
            target_gpa: null,
            gpa_eligible_credits: 0.0,
            gpa_eligible_subjects_count: 0,
            scale: '4.0',
          },
        },
      },
    ],
    shared_subjects: [
      {
        subject_title: 'Data Structures and Algorithms',
        subject_code: 'CS201',
        match_type: 'exact_code',
        similarity_score: 1.0,
        syllabus_ids: ['syl_1', 'syl_2'],
        credits_by_syllabus: { syl_1: 4.0, syl_2: 4.0 },
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal with syllabus checkboxes and handles selection', () => {
    render(
      <CompareSyllabiModal
        isOpen={true}
        onClose={vi.fn()}
        syllabi={mockSyllabi}
        initialSelectedIds={['syl_1']}
      />
    );

    expect(screen.getByText('Curriculum Comparison Matrix')).toBeInTheDocument();
    expect(screen.getByText('Computer Science & Engineering')).toBeInTheDocument();
    expect(screen.getByText('Information Technology')).toBeInTheDocument();
    expect(screen.getByText('Electronics & Communication')).toBeInTheDocument();

    // Check that Compare button is disabled with only 1 syllabus selected
    const compareBtn = screen.getByTestId('run-comparison-btn');
    expect(compareBtn).toBeDisabled();
  });

  it('enforces 2 to 4 syllabus selection limit', () => {
    render(
      <CompareSyllabiModal
        isOpen={true}
        onClose={vi.fn()}
        syllabi={mockSyllabi}
        initialSelectedIds={['syl_1', 'syl_2']}
      />
    );

    const compareBtn = screen.getByTestId('run-comparison-btn');
    expect(compareBtn).not.toBeDisabled();
    expect(screen.getByText('Ready to compare 2 curricula.')).toBeInTheDocument();
  });

  it('fetches comparison data and displays metrics and shared courses', async () => {
    vi.mocked(api.compareSyllabi).mockResolvedValue(mockComparisonResponse);

    render(
      <CompareSyllabiModal
        isOpen={true}
        onClose={vi.fn()}
        syllabi={mockSyllabi}
        initialSelectedIds={['syl_1', 'syl_2']}
      />
    );

    const compareBtn = screen.getByTestId('run-comparison-btn');
    fireEvent.click(compareBtn);

    await waitFor(() => {
      expect(api.compareSyllabi).toHaveBeenCalledWith(['syl_1', 'syl_2']);
      expect(screen.getByText('Side-by-Side Comparison Matrix')).toBeInTheDocument();
      expect(screen.getByText('Curriculum Progress')).toBeInTheDocument();
      expect(screen.getByText('Data Structures and Algorithms')).toBeInTheDocument();
    });
  });

  it('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn();
    render(
      <CompareSyllabiModal
        isOpen={true}
        onClose={handleClose}
        syllabi={mockSyllabi}
        initialSelectedIds={['syl_1']}
      />
    );

    const closeBtn = screen.getByLabelText('Close comparison modal');
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
