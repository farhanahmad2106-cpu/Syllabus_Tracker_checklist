import '../setupTests';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { CompareSyllabiModal } from '../components/CompareSyllabiModal';
import * as api from '../lib/api';
import type { SyllabusComparisonResponse, SyllabusSummary } from '../types/syllabus';

vi.mock('../lib/api', () => ({
  compareSyllabi: vi.fn(),
}));

describe('CompareSyllabiModal Component', () => {
  const mockSyllabi: SyllabusSummary[] = [
    {
      id: 'syl_1',
      title: 'Computer Science & Engineering',
      source_filename: 'cse.pdf',
      created_at: '2026-11-01T00:00:00Z',
      updated_at: '2026-11-01T00:00:00Z',
      leaf_count: 100,
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
      created_at: '2026-11-01T00:00:00Z',
      updated_at: '2026-11-01T00:00:00Z',
      leaf_count: 90,
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
      created_at: '2026-11-01T00:00:00Z',
      updated_at: '2026-11-01T00:00:00Z',
      leaf_count: 110,
      progress: {
        total_leaves: 110,
        completed_leaves: 33,
        progress_percent: 30.0,
      },
    },
  ];

  const mockComparisonResponse: SyllabusComparisonResponse = {
    syllabi: [
      {
        syllabus_id: 'syl_1',
        title: 'Computer Science & Engineering',
        source_type: 'pdf',
        source_filename: 'cse.pdf',
        year_count: 4,
        semester_count: 8,
        total_subjects: 40,
        enrolled_subjects: 36,
        excluded_electives: 4,
        lab_subjects: 8,
        lab_ratio_percent: 20.0,
        total_modules: 120,
        total_topics: 100,
        completed_topics: 60,
        completion_percent: 60.0,
        total_known_declared_credits: 160.0,
        missing_credit_subject_count: 0,
        target_gpa_subject_count: 36,
      },
      {
        syllabus_id: 'syl_2',
        title: 'Information Technology',
        source_type: 'pdf',
        source_filename: 'it.pdf',
        year_count: 4,
        semester_count: 8,
        total_subjects: 38,
        enrolled_subjects: 35,
        excluded_electives: 3,
        lab_subjects: 6,
        lab_ratio_percent: 15.8,
        total_modules: 110,
        total_topics: 90,
        completed_topics: 45,
        completion_percent: 50.0,
        total_known_declared_credits: 150.0,
        missing_credit_subject_count: 0,
        target_gpa_subject_count: 35,
      },
    ],
    shared_subjects: [
      {
        subject_title_a: 'Data Structures and Algorithms',
        subject_title_b: 'Data Structures and Algorithms',
        syllabus_id_a: 'syl_1',
        syllabus_id_b: 'syl_2',
        subject_id_a: 'subj_cse_dsa',
        subject_id_b: 'subj_it_dsa',
        match_type: 'course_code',
        match_strength: 1.0,
      },
    ],
    compared_at: '2026-11-19T10:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.compareSyllabi).mockResolvedValue(mockComparisonResponse);
  });

  it('renders modal with syllabus checkboxes and selection controls', () => {
    render(
      <CompareSyllabiModal
        isOpen={true}
        onClose={vi.fn()}
        syllabiList={mockSyllabi}
        activeSyllabusId="syl_1"
      />
    );

    expect(screen.getByText('Multi-Syllabus Curriculum Comparison')).toBeInTheDocument();
    expect(screen.getByText('Computer Science & Engineering')).toBeInTheDocument();
    expect(screen.getByText('Information Technology')).toBeInTheDocument();
    expect(screen.getByText('Electronics & Communication')).toBeInTheDocument();
  });

  it('triggers comparison API when 2 or more syllabi are selected', async () => {
    vi.mocked(api.compareSyllabi).mockResolvedValue(mockComparisonResponse);

    render(
      <CompareSyllabiModal
        isOpen={true}
        onClose={vi.fn()}
        syllabiList={mockSyllabi}
        activeSyllabusId="syl_1"
      />
    );

    await waitFor(() => {
      expect(api.compareSyllabi).toHaveBeenCalled();
    });
  });

  it('displays comparison metrics when API returns data', async () => {
    vi.mocked(api.compareSyllabi).mockResolvedValue(mockComparisonResponse);

    render(
      <CompareSyllabiModal
        isOpen={true}
        onClose={vi.fn()}
        syllabiList={mockSyllabi}
        activeSyllabusId="syl_1"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Academic Years')).toBeInTheDocument();
      expect(screen.getByText('Shared & Overlapping Courses')).toBeInTheDocument();
      expect(screen.getAllByText('Data Structures and Algorithms')[0]).toBeInTheDocument();
    });
  });

  it('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn();

    render(
      <CompareSyllabiModal
        isOpen={true}
        onClose={handleClose}
        syllabiList={mockSyllabi}
        activeSyllabusId="syl_1"
      />
    );

    const closeBtn = screen.getByRole('button', { name: /Close comparison/i });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
