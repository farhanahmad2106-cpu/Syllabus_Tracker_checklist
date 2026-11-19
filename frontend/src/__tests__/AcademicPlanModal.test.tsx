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
    is_laboratory: false,
    is_elective: false,
    is_enrolled: true,
    enrollment_status: 'mandatory',
    modules: [],
  };

  const mockExistingPlan: SubjectAcademicPlanItem = {
    subject_id: 'subj_algos',
    subject_title: 'Design and Analysis of Algorithms',
    subject_code: 'CS301',
    is_enrolled: true,
    declared_credits: 4.0,
    credit_override: 4.5,
    effective_credits: 4.5,
    target_grade_points: 9.0,
    grade_scale: '10.0',
    is_gpa_eligible: true,
    ltp: '3-1-0',
    is_laboratory: false,
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
        onSave={vi.fn()}
      />
    );

    expect(screen.getByText('Academic Credit & Target Grade')).toBeInTheDocument();
    expect(screen.getByText('Design and Analysis of Algorithms')).toBeInTheDocument();
    expect(screen.getByText('Declared Credits: 4')).toBeInTheDocument();

    const overrideInput = screen.getByTestId('credit-override-input') as HTMLInputElement;
    expect(overrideInput.value).toBe('4.5');

    const gradeInput = screen.getByTestId('target-grade-input') as HTMLInputElement;
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
        onSave={handleSave}
      />
    );

    const overrideInput = screen.getByTestId('credit-override-input');
    fireEvent.change(overrideInput, { target: { value: '5.0' } });

    const gradeInput = screen.getByTestId('target-grade-input');
    fireEvent.change(gradeInput, { target: { value: '9.5' } });

    const saveBtn = screen.getByTestId('save-plan-btn');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledWith('subj_algos', {
        credit_override: 5.0,
        target_grade_points: 9.5,
        grade_scale: '10.0',
      });
    });
  });

  it('validates grade points according to grade scale', () => {
    render(
      <AcademicPlanModal
        isOpen={true}
        onClose={vi.fn()}
        syllabusId="syl_1"
        subject={mockSubject}
        existingPlan={null}
        onSave={vi.fn()}
      />
    );

    // Switch to 4.0 scale
    const scaleSelect = screen.getByTestId('grade-scale-select');
    fireEvent.change(scaleSelect, { target: { value: '4.0' } });

    // Enter out-of-range grade
    const gradeInput = screen.getByTestId('target-grade-input');
    fireEvent.change(gradeInput, { target: { value: '5.5' } });

    const saveBtn = screen.getByTestId('save-plan-btn');
    fireEvent.click(saveBtn);

    expect(screen.getByText('Target grade points must be between 0.0 and 4.0.')).toBeInTheDocument();
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
        onSave={vi.fn()}
      />
    );

    const cancelBtn = screen.getByTestId('cancel-plan-btn');
    fireEvent.click(cancelBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
