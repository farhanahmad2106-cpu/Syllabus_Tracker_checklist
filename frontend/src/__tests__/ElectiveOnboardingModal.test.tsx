import '../setupTests';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ElectiveOnboardingModal } from '../components/ElectiveOnboardingModal';
import type { ParseReviewResponse } from '../types/syllabus';

const mockReviewData: ParseReviewResponse = {
  syllabus_id: 'syl_review_1',
  title: 'B.Tech Computer Science & AI',
  detected_electives: [
    {
      id: 'subj_pe1_ml',
      code: 'CS401',
      title: 'Machine Learning',
      is_lab: false,
      is_elective: true,
      elective_group: 'Professional Elective 1',
      is_enrolled: false,
      enrollment_status: 'pending',
      modules: [],
    },
    {
      id: 'subj_pe1_crypto',
      code: 'CS402',
      title: 'Cryptography & Network Security',
      is_lab: false,
      is_elective: true,
      elective_group: 'Professional Elective 1',
      is_enrolled: false,
      enrollment_status: 'pending',
      modules: [],
    },
    {
      id: 'subj_oe1_econ',
      code: 'HU301',
      title: 'Engineering Economics',
      is_lab: false,
      is_elective: true,
      elective_group: 'Open Elective 1',
      is_enrolled: false,
      enrollment_status: 'pending',
      modules: [],
    },
  ],
  elective_groups: ['Professional Elective 1', 'Open Elective 1'],
  requires_enrollment_confirmation: true,
  years: [
    {
      id: 'yr_4',
      title: 'Fourth Year',
      year_number: 4,
      semesters: [
        {
          id: 'sem_7',
          title: 'Semester 7',
          semester_number: 7,
          subjects: [
            {
              id: 'subj_mand_proj',
              code: 'CS491',
              title: 'Major Project Phase 1',
              is_lab: false,
              is_elective: false,
              is_enrolled: true,
              enrollment_status: 'mandatory',
              modules: [],
            },
            {
              id: 'subj_pe1_ml',
              code: 'CS401',
              title: 'Machine Learning',
              is_lab: false,
              is_elective: true,
              elective_group: 'Professional Elective 1',
              is_enrolled: false,
              enrollment_status: 'pending',
              modules: [],
            },
            {
              id: 'subj_pe1_crypto',
              code: 'CS402',
              title: 'Cryptography & Network Security',
              is_lab: false,
              is_elective: true,
              elective_group: 'Professional Elective 1',
              is_enrolled: false,
              enrollment_status: 'pending',
              modules: [],
            },
          ],
        },
      ],
    },
  ],
};

describe('ElectiveOnboardingModal', () => {
  it('renders modal with elective groups, options, and auto-enrolled mandatory courses', () => {
    const handleConfirm = vi.fn();
    const handleClose = vi.fn();

    render(
      <ElectiveOnboardingModal
        isOpen={true}
        reviewData={mockReviewData}
        isSubmitting={false}
        onConfirm={handleConfirm}
        onClose={handleClose}
      />
    );

    expect(screen.getByText(/Confirm Elective Enrollment/i)).toBeInTheDocument();
    expect(screen.getByText('Professional Elective 1')).toBeInTheDocument();
    expect(screen.getByText(/Machine Learning/i)).toBeInTheDocument();
    expect(screen.getByText(/Cryptography & Network Security/i)).toBeInTheDocument();
    expect(screen.getByText(/Open Elective 1/i)).toBeInTheDocument();
  });

  it('allows selecting electives and submitting finalized enrollment', async () => {
    const handleConfirm = vi.fn();
    const handleClose = vi.fn();

    render(
      <ElectiveOnboardingModal
        isOpen={true}
        reviewData={mockReviewData}
        isSubmitting={false}
        onConfirm={handleConfirm}
        onClose={handleClose}
      />
    );

    // Select Machine Learning
    const mlCheckbox = screen.getByLabelText(/Machine Learning/i);
    expect(mlCheckbox).not.toBeChecked();
    fireEvent.click(mlCheckbox);
    expect(mlCheckbox).toBeChecked();

    // Select Engineering Economics
    const econCheckbox = screen.getByLabelText(/Engineering Economics/i);
    expect(econCheckbox).not.toBeChecked();
    fireEvent.click(econCheckbox);
    expect(econCheckbox).toBeChecked();

    // Confirm button
    const confirmBtn = screen.getByRole('button', { name: /Confirm Enrollment & Build Checklist/i });
    expect(confirmBtn).toBeEnabled();
    fireEvent.click(confirmBtn);

    expect(handleConfirm).toHaveBeenCalledTimes(1);
    const submittedIds: string[] = handleConfirm.mock.calls[0][0];
    // Mandatory course must be included
    expect(submittedIds).toContain('subj_mand_proj');
    // Selected electives must be included
    expect(submittedIds).toContain('subj_pe1_ml');
    expect(submittedIds).toContain('subj_oe1_econ');
    // Unselected elective must NOT be included
    expect(submittedIds).not.toContain('subj_pe1_crypto');
  });

  it('calls onClose when Cancel button or backdrop is dismissed', () => {
    const handleClose = vi.fn();

    render(
      <ElectiveOnboardingModal
        isOpen={true}
        reviewData={mockReviewData}
        isSubmitting={false}
        onConfirm={vi.fn()}
        onClose={handleClose}
      />
    );

    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
