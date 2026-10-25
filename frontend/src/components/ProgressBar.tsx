import React from 'react';
import type { ProgressSummary } from '../types/syllabus';

interface ProgressBarProps {
  progress?: ProgressSummary;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  labelPrefix?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress = { total_leaves: 0, completed_leaves: 0, progress_percent: 0 },
  size = 'md',
  showLabel = true,
  labelPrefix = '',
}) => {
  const { total_leaves, completed_leaves, progress_percent } = progress;
  const isComplete = total_leaves > 0 && completed_leaves === total_leaves;

  const heightClasses = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
  }[size];

  return (
    <div className="w-full space-y-1.5">
      {showLabel && (
        <div className="flex items-center justify-between text-xs font-medium">
          <span className="text-gray-300">
            {labelPrefix && <span className="font-semibold text-gray-200">{labelPrefix}: </span>}
            {completed_leaves} of {total_leaves} items completed
          </span>
          <span
            className={`font-semibold tabular-nums ${
              isComplete ? 'text-emerald-400' : 'text-gray-300'
            }`}
          >
            {progress_percent.toFixed(1)}%
          </span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={progress_percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className={`w-full overflow-hidden rounded-full bg-gray-800 border border-gray-700/60 ${heightClasses}`}
      >
        <div
          className={`h-full transition-all duration-300 ease-out rounded-full ${
            isComplete
              ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_12px_rgba(16,185,129,0.5)]'
              : progress_percent > 0
              ? 'bg-gradient-to-r from-emerald-600 to-emerald-400'
              : 'bg-transparent'
          }`}
          style={{ width: `${Math.min(100, Math.max(0, progress_percent))}%` }}
        />
      </div>
    </div>
  );
};
