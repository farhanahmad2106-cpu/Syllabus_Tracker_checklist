import '../setupTests';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AcademicPlanModal } from '../components/AcademicPlanModal';
import type { Subject, SubjectAcademicPlanItem } from '../types/syllabus';

describe('AcademicPlanModal Component', () => {
  const mockSubject: Subject = {
    id: 'subj_algos',
    title: 'Design and Analysis of Algorithms',
    code: 'CS301',
    credits: 4.0,
    ltp: '3-1-0',
    is_elective: false,
    is_enrolled: true,
    enrollment_status: 'mandatory',
    modules: [],
  };

  const mockExistingPlan: SubjectAcademicPlanItem = {
    subject_id: 'subj_algos',
    subject_title: 'Design and Analysis of Algorithms',
    subject_code: 'CS301',
    semester_id: 'sem_1',
    semester_title: 'Semester 1',
    is_enrolled: true,
    is_lab: false,
    is_elective: false,
    declared_credits: 4.0,
    credit_override: 4.5,
    effective_credits: 4.5,
    target_grade_points: 9.0,
    grade_scale: '10.0',
    is_gpa_eligible: true,
    is_completed: false,
    total_leaves: 10,
    completed_leaves: 4,
    ltp: '3-1-0',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal with subject information and initial values', () => {
    render(
      <AcademicPlanModal
        isOpen={true}
        onClose={vi.fn()}
        syllabusId="syl_1"
        subject={mockSubject}
        existingPlan={mockExistingPlan}
        onSavePlan={vi.fn()}
      />
    );

    expect(screen.getByText('Academic Credit & GPA Plan')).toBeInTheDocument();
    expect(screen.getByText(/Design and Analysis of Algorithms/i)).toBeInTheDocument();
    expect(screen.getByText('4 Credits')).toBeInTheDocument();

    const overrideInput = screen.getByLabelText(/Credit Override/i) as HTMLInputElement;
    expect(overrideInput.value).toBe('4.5');

    const gradeInput = screen.getByLabelText(/Target Grade Points/i) as HTMLInputElement;
    expect(gradeInput.value).toBe('9');
  });

  it('handles user input changes and submits updated plan', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);

    render(
      <AcademicPlanModal
        isOpen={true}
        onClose={vi.fn()}
        syllabusId="syl_1"
        subject={mockSubject}
        existingPlan={null}
        onSavePlan={handleSave}
      />
    );

    const overrideInput = screen.getByLabelText(/Credit Override/i);
    fireEvent.change(overrideInput, { target: { value: '5.0' } });

    const gradeInput = screen.getByLabelText(/Target Grade Points/i);
    fireEvent.change(gradeInput, { target: { value: '9.5' } });

    const saveBtn = screen.getByRole('button', { name: /Save Academic Plan/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledWith('subj_algos', {
        credit_override: 5.0,
        target_grade_points: 9.5,
        grade_scale: '10.0',
      });
    });
  });

  it('validates grade points according to grade scale', async () => {
    render(
      <AcademicPlanModal
        isOpen={true}
        onClose={vi.fn()}
        syllabusId="syl_1"
        subject={mockSubject}
        existingPlan={null}
        onSavePlan={vi.fn()}
      />
    );

    // Switch to 4.0 scale
    const scaleBtn = screen.getByRole('radio', { name: /4.0 Point Scale/i });
    fireEvent.click(scaleBtn);

    // Enter out-of-range grade
    const gradeInput = screen.getByLabelText(/Target Grade Points/i);
    fireEvent.change(gradeInput, { target: { value: '5.5' } });

    const form = screen.getByRole('dialog').querySelector('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(
        screen.getByText(/Target grade must be a number between 0.0 and 4.0 for the 4.0 scale/i)
      ).toBeInTheDocument();
    });
  });

  it('calls onClose when Cancel button is clicked', () => {
    const handleClose = vi.fn();

    render(
      <AcademicPlanModal
        isOpen={true}
        onClose={handleClose}
        syllabusId="syl_1"
        subject={mockSubject}
        existingPlan={null}
        onSavePlan={vi.fn()}
      />
    );

    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
