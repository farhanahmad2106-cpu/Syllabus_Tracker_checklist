import '../setupTests';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PacingBadge } from '../components/PacingBadge';
import type { PacingMetrics } from '../types/syllabus';

describe('PacingBadge Component', () => {
  const baseMetrics: PacingMetrics = {
    node_id: 'subj_1',
    target_date: '2026-12-01',
    days_remaining: 14,
    total_leaves: 10,
    completed_leaves: 2,
    remaining_leaves: 8,
    remaining_contact_hours: 16.0,
    topics_per_week: 4.0,
    hours_per_week: 8.0,
    status: 'on_track',
  };

  it('renders not_set state with "+ Target Date" button', () => {
    const handleSet = vi.fn().mockResolvedValue(undefined);
    const handleClear = vi.fn().mockResolvedValue(undefined);

    render(
      <PacingBadge
        metrics={undefined}
        nodeId="subj_1"
        nodeType="subject"
        onSetDeadline={handleSet}
        onClearDeadline={handleClear}
      />
    );

    expect(screen.getByText('+ Target Date')).toBeInTheDocument();
  });

  it('renders on_track status with teal styling and velocity metrics', () => {
    const handleSet = vi.fn().mockResolvedValue(undefined);
    const handleClear = vi.fn().mockResolvedValue(undefined);

    render(
      <PacingBadge
        metrics={baseMetrics}
        nodeId="subj_1"
        nodeType="subject"
        onSetDeadline={handleSet}
        onClearDeadline={handleClear}
      />
    );

    const badge = screen.getByTestId('pacing-badge-subj_1');
    expect(badge.className).toContain('text-teal-300');
    expect(screen.getByText('14d left')).toBeInTheDocument();
    expect(screen.getByText('4 topics/wk')).toBeInTheDocument();
    expect(screen.getByText('8 hrs/wk')).toBeInTheDocument();
  });

  it('renders at_risk status with amber styling', () => {
    const atRiskMetrics: PacingMetrics = {
      ...baseMetrics,
      days_remaining: 5,
      status: 'at_risk',
    };

    render(
      <PacingBadge
        metrics={atRiskMetrics}
        nodeId="subj_1"
        nodeType="subject"
        onSetDeadline={vi.fn()}
        onClearDeadline={vi.fn()}
      />
    );

    const badge = screen.getByTestId('pacing-badge-subj_1');
    expect(badge.className).toContain('text-amber-300');
    expect(screen.getByText('5d left')).toBeInTheDocument();
  });

  it('renders behind status with rose styling and overdue days', () => {
    const behindMetrics: PacingMetrics = {
      ...baseMetrics,
      days_remaining: -3,
      status: 'behind',
    };

    render(
      <PacingBadge
        metrics={behindMetrics}
        nodeId="subj_1"
        nodeType="subject"
        onSetDeadline={vi.fn()}
        onClearDeadline={vi.fn()}
      />
    );

    const badge = screen.getByTestId('pacing-badge-subj_1');
    expect(badge.className).toContain('text-rose-300');
    expect(screen.getByText('3d overdue')).toBeInTheDocument();
  });

  it('renders completed status without misleading weekly velocities', () => {
    const completedMetrics: PacingMetrics = {
      ...baseMetrics,
      remaining_leaves: 0,
      completed_leaves: 10,
      remaining_contact_hours: 0.0,
      topics_per_week: 0.0,
      hours_per_week: 0.0,
      status: 'completed',
    };

    render(
      <PacingBadge
        metrics={completedMetrics}
        nodeId="subj_1"
        nodeType="subject"
        onSetDeadline={vi.fn()}
        onClearDeadline={vi.fn()}
      />
    );

    const badge = screen.getByTestId('pacing-badge-subj_1');
    expect(badge.className).toContain('text-emerald-400');
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.queryByText(/topics\/wk/)).not.toBeInTheDocument();
  });

  it('opens date picker popover, submits ISO date, and calls onSetDeadline', async () => {
    const handleSet = vi.fn().mockResolvedValue(undefined);
    const handleClear = vi.fn().mockResolvedValue(undefined);

    render(
      <PacingBadge
        nodeId="subj_1"
        nodeType="subject"
        onSetDeadline={handleSet}
        onClearDeadline={handleClear}
      />
    );

    const setBtn = screen.getByTestId('pacing-badge-set-btn-subj_1');
    fireEvent.click(setBtn);

    const input = screen.getByTestId('pacing-date-input-subj_1');
    expect(input).toBeInTheDocument();

    fireEvent.change(input, { target: { value: '2026-12-25' } });
    const saveBtn = screen.getByTestId('pacing-save-btn-subj_1');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(handleSet).toHaveBeenCalledWith({
        node_id: 'subj_1',
        node_type: 'subject',
        target_date: '2026-12-25',
      });
    });
  });

  it('displays API error if onSetDeadline fails', async () => {
    const handleSet = vi.fn().mockRejectedValue(new Error('Network submission error'));

    render(
      <PacingBadge
        nodeId="subj_1"
        nodeType="subject"
        onSetDeadline={handleSet}
        onClearDeadline={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('pacing-badge-set-btn-subj_1'));
    const input = screen.getByTestId('pacing-date-input-subj_1');
    fireEvent.change(input, { target: { value: '2026-12-25' } });
    fireEvent.click(screen.getByTestId('pacing-save-btn-subj_1'));

    await waitFor(() => {
      expect(screen.getByTestId('pacing-error-subj_1')).toHaveTextContent(
        'Network submission error'
      );
    });
  });

  it('opens confirmation and calls onClearDeadline when confirmed', async () => {
    const handleClear = vi.fn().mockResolvedValue(undefined);

    render(
      <PacingBadge
        metrics={baseMetrics}
        nodeId="subj_1"
        nodeType="subject"
        onSetDeadline={vi.fn()}
        onClearDeadline={handleClear}
      />
    );

    const clearBtn = screen.getByTestId('pacing-badge-clear-btn-subj_1');
    fireEvent.click(clearBtn);

    expect(screen.getByText('Clear target date?')).toBeInTheDocument();
    const confirmBtn = screen.getByTestId('pacing-confirm-clear-btn-subj_1');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(handleClear).toHaveBeenCalledWith('subj_1');
    });
  });

  it('stops click propagation to avoid triggering parent accordion toggles', () => {
    const parentClick = vi.fn();
    const handleSet = vi.fn().mockResolvedValue(undefined);

    render(
      <div onClick={parentClick}>
        <PacingBadge
          nodeId="subj_1"
          nodeType="subject"
          onSetDeadline={handleSet}
          onClearDeadline={vi.fn()}
        />
      </div>
    );

    const setBtn = screen.getByTestId('pacing-badge-set-btn-subj_1');
    fireEvent.click(setBtn);

    expect(parentClick).not.toHaveBeenCalled();
  });
});

