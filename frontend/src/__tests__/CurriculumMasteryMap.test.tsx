import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CurriculumMasteryMap } from '../components/CurriculumMasteryMap';
import type { HierarchicalSyllabus, PacingMetrics } from '../types/syllabus';

describe('CurriculumMasteryMap Component', () => {
  const mockSyllabus: HierarchicalSyllabus = {
    id: 'syl_cs_map',
    title: 'Computer Science Curriculum',
    created_at: '2026-11-21T00:00:00Z',
    updated_at: '2026-11-21T00:00:00Z',
    source_filename: 'cs_map.pdf',
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
                    id: 'mod_m1',
                    title: 'Calculus',
                    topics: [
                      { id: 'leaf_m1', title: 'Derivatives', source_text: 'Derivatives' },
                      { id: 'leaf_m2', title: 'Integrals', source_text: 'Integrals' },
                    ],
                  },
                ],
              },
              {
                id: 'subj_cs_lab',
                title: 'Programming Lab',
                code: 'CS101L',
                credits: 2,
                is_lab: true,
                is_enrolled: true,
                enrollment_status: 'mandatory',
                modules: [
                  {
                    id: 'mod_lab',
                    title: 'C Experiments',
                    topics: [{ id: 'leaf_lab1', title: 'Pointers', source_text: 'Pointers' }],
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
                    id: 'mod_m2',
                    title: 'Multivariable Calculus',
                    topics: [{ id: 'leaf_m3', title: 'Vectors', source_text: 'Vectors' }],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };

  it('renders overall curriculum header metrics and semester columns', () => {
    render(
      <CurriculumMasteryMap
        syllabus={mockSyllabus}
        completedLeafIds={['leaf_m1', 'leaf_m2']}
      />
    );

    // Curriculum Header
    expect(screen.getByText('Curriculum Mastery Map')).toBeInTheDocument();
    expect(screen.getByText(/3 Enrolled Subjects/i)).toBeInTheDocument();
    expect(screen.getByText(/10 Total Credits/i)).toBeInTheDocument();

    // Semester Columns
    expect(screen.getByTestId('semester-column-sem_1')).toBeInTheDocument();
    expect(screen.getByTestId('semester-column-sem_2')).toBeInTheDocument();

    // Subject Cards
    expect(screen.getByTestId('subject-card-subj_math1')).toBeInTheDocument();
    expect(screen.getByTestId('subject-card-subj_cs_lab')).toBeInTheDocument();
    expect(screen.getByTestId('subject-card-subj_math2')).toBeInTheDocument();
  });

  it('displays laboratory and credit badges on cards', () => {
    render(<CurriculumMasteryMap syllabus={mockSyllabus} />);

    // Lab badge
    expect(screen.getByText('LAB')).toBeInTheDocument();

    // Credit badges
    expect(screen.getAllByText('4 cr').length).toBe(2);
    expect(screen.getByText('2 cr')).toBeInTheDocument();
  });

  it('filters subjects when filter pills are activated', () => {
    render(
      <CurriculumMasteryMap
        syllabus={mockSyllabus}
        completedLeafIds={['leaf_m1', 'leaf_m2']} // Math1 is 100% mastered, Math2 is 0%, CS Lab is 0%
      />
    );

    // Filter to Mastered (100%)
    const masteredBtn = screen.getByRole('button', { name: /Mastered \(100%\)/i });
    fireEvent.click(masteredBtn);

    // Math1 should be visible, others should be hidden
    expect(screen.getByTestId('subject-card-subj_math1')).toBeInTheDocument();
    expect(screen.queryByTestId('subject-card-subj_cs_lab')).not.toBeInTheDocument();
    expect(screen.queryByTestId('subject-card-subj_math2')).not.toBeInTheDocument();

    // Switch back to All Enrolled
    const allBtn = screen.getByRole('button', { name: /All Enrolled/i });
    fireEvent.click(allBtn);

    expect(screen.getByTestId('subject-card-subj_math1')).toBeInTheDocument();
    expect(screen.getByTestId('subject-card-subj_cs_lab')).toBeInTheDocument();
    expect(screen.getByTestId('subject-card-subj_math2')).toBeInTheDocument();
  });

  it('toggles prerequisite SVG connector links', () => {
    render(<CurriculumMasteryMap syllabus={mockSyllabus} />);

    // Initially showPrereqs is enabled
    expect(screen.getByTestId('prerequisite-svg-canvas')).toBeInTheDocument();

    // Uncheck prerequisite toggle
    const toggle = screen.getByLabelText(/Show Prerequisite Links/i);
    fireEvent.click(toggle);

    expect(screen.queryByTestId('prerequisite-svg-canvas')).not.toBeInTheDocument();
  });

  it('opens Subject Mastery Inspector upon clicking a subject card', () => {
    render(<CurriculumMasteryMap syllabus={mockSyllabus} />);

    expect(screen.queryByTestId('subject-mastery-inspector')).not.toBeInTheDocument();

    // Click Math 1
    const card = screen.getByTestId('subject-card-subj_math1');
    fireEvent.click(card);

    expect(screen.getByTestId('subject-mastery-inspector')).toBeInTheDocument();
    expect(screen.getByText('Module Progress Breakdown')).toBeInTheDocument();
    expect(screen.getByText('Calculus')).toBeInTheDocument();
  });

  it('calls onNavigateToNode when Jump to Syllabus Tree is clicked in the inspector', () => {
    const handleNavigate = vi.fn();
    render(
      <CurriculumMasteryMap
        syllabus={mockSyllabus}
        onNavigateToNode={handleNavigate}
      />
    );

    // Open inspector for Math 1
    fireEvent.click(screen.getByTestId('subject-card-subj_math1'));

    const jumpBtn = screen.getByTestId('jump-to-tree-btn');
    expect(jumpBtn).toBeInTheDocument();

    fireEvent.click(jumpBtn);
    expect(handleNavigate).toHaveBeenCalledWith('subj_math1');
  });

  it('supports keyboard navigation and Enter key activation on subject cards', () => {
    render(<CurriculumMasteryMap syllabus={mockSyllabus} />);

    const card = screen.getByTestId('subject-card-subj_math1');
    fireEvent.keyDown(card, { key: 'Enter' });

    expect(screen.getByTestId('subject-mastery-inspector')).toBeInTheDocument();
  });

  it('renders pacing risk indicators accurately', () => {
    const pacingData: Record<string, PacingMetrics> = {
      subj_math1: {
        node_id: 'subj_math1',
        target_date: '2026-11-01',
        days_remaining: -4,
        total_leaves: 2,
        completed_leaves: 0,
        remaining_leaves: 2,
        remaining_contact_hours: 8,
        topics_per_week: 2,
        hours_per_week: 8,
        status: 'behind',
      },
    };

    render(
      <CurriculumMasteryMap
        syllabus={mockSyllabus}
        pacingData={pacingData}
      />
    );

    expect(screen.getByText(/Overdue Deadline/i)).toBeInTheDocument();
  });
});
