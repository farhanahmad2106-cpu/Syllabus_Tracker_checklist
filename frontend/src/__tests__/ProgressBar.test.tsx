import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProgressBar } from '../components/ProgressBar';

describe('ProgressBar', () => {
  it('renders 0% progress correctly', () => {
    render(
      <ProgressBar
        progress={{ total_leaves: 10, completed_leaves: 0, progress_percent: 0.0 }}
        showLabel={true}
      />
    );
    expect(screen.getByText('0 of 10 items completed')).toBeInTheDocument();
    expect(screen.getByText('0.0%')).toBeInTheDocument();
  });

  it('renders completed progress correctly', () => {
    render(
      <ProgressBar
        progress={{ total_leaves: 4, completed_leaves: 4, progress_percent: 100.0 }}
        showLabel={true}
      />
    );
    expect(screen.getByText('4 of 4 items completed')).toBeInTheDocument();
    expect(screen.getByText('100.0%')).toBeInTheDocument();
  });

  it('renders safe empty progress when total leaves is 0', () => {
    render(
      <ProgressBar
        progress={{ total_leaves: 0, completed_leaves: 0, progress_percent: 0.0 }}
        showLabel={true}
      />
    );
    expect(screen.getByText('0 of 0 items completed')).toBeInTheDocument();
    expect(screen.getByText('0.0%')).toBeInTheDocument();
  });
});
