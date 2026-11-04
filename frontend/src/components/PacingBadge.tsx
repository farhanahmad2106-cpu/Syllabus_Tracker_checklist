import React, { useState, useRef, useEffect, useId } from 'react';
import { Calendar, CheckCircle2, AlertTriangle, Clock, X, Loader2 } from 'lucide-react';
import type { PacingMetrics, PacingStatus, SetTargetDatePayload } from '../types/syllabus';

export interface PacingBadgeProps {
  metrics?: PacingMetrics;
  nodeId: string;
  nodeType: 'subject' | 'semester';
  onSetDeadline: (payload: SetTargetDatePayload) => Promise<void>;
  onClearDeadline: (nodeId: string) => Promise<void>;
}

const STATUS_STYLES: Record<PacingStatus, string> = {
  completed: 'bg-emerald-950/40 text-emerald-400 border-emerald-800/60',
  on_track: 'bg-teal-950/40 text-teal-300 border-teal-800/60',
  at_risk: 'bg-amber-950/40 text-amber-300 border-amber-800/60',
  behind: 'bg-rose-950/40 text-rose-300 border-rose-800/60',
  not_set: 'bg-gray-900/60 text-gray-400 border-gray-800 hover:text-gray-200 hover:border-gray-700',
};

export const PacingBadge: React.FC<PacingBadgeProps> = ({
  metrics,
  nodeId,
  nodeType,
  onSetDeadline,
  onClearDeadline,
}) => {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false);
  const [targetDateInput, setTargetDateInput] = useState<string>(
    metrics?.target_date || ''
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const popoverId = useId();
  const dateInputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const status: PacingStatus = metrics?.status || 'not_set';

  useEffect(() => {
    if (isPickerOpen) {
      dateInputRef.current?.focus();
    }
  }, [isPickerOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isPickerOpen && !isSaving) {
          setIsPickerOpen(false);
          setErrorMessage(null);
        }
        if (isConfirmClearOpen && !isClearing) {
          setIsConfirmClearOpen(false);
          setErrorMessage(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPickerOpen, isConfirmClearOpen, isSaving, isClearing]);

  const handleOpenPicker = (e: React.MouseEvent) => {
    e.stopPropagation();
    setErrorMessage(null);
    setTargetDateInput(metrics?.target_date || '');
    setIsPickerOpen(true);
    setIsConfirmClearOpen(false);
  };

  const handleClosePicker = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!isSaving) {
      setIsPickerOpen(false);
      setErrorMessage(null);
    }
  };

  const handleSaveDeadline = async (e: React.FormEvent | React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (!targetDateInput.trim()) {
      setErrorMessage('Please select a valid target date');
      return;
    }

    // Verify format YYYY-MM-DD
    const isoPattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!isoPattern.test(targetDateInput)) {
      setErrorMessage('Date must be formatted as YYYY-MM-DD');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    try {
      await onSetDeadline({
        node_id: nodeId,
        node_type: nodeType,
        target_date: targetDateInput,
      });
      setIsPickerOpen(false);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save target date');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenClearConfirm = (e: React.MouseEvent) => {
    e.stopPropagation();
    setErrorMessage(null);
    setIsConfirmClearOpen(true);
    setIsPickerOpen(false);
  };

  const handleCancelClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isClearing) {
      setIsConfirmClearOpen(false);
      setErrorMessage(null);
    }
  };

  const handleConfirmClear = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsClearing(true);
    setErrorMessage(null);
    try {
      await onClearDeadline(nodeId);
      setIsConfirmClearOpen(false);
      setTargetDateInput('');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to clear deadline');
    } finally {
      setIsClearing(false);
    }
  };

  // Render Days Indicator
  const renderDaysIndicator = () => {
    if (status === 'completed') {
      return (
        <span className="flex items-center gap-1 font-semibold">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>Completed</span>
        </span>
      );
    }

    if (metrics?.days_remaining === null || metrics?.days_remaining === undefined) {
      return null;
    }

    if (metrics.days_remaining < 0) {
      const overdueDays = Math.abs(metrics.days_remaining);
      return (
        <span className="flex items-center gap-1 font-medium text-rose-300">
          <AlertTriangle className="w-3 h-3" />
          <span>{overdueDays}d overdue</span>
        </span>
      );
    }

    return (
      <span className="flex items-center gap-1 font-medium">
        <Clock className="w-3 h-3" />
        <span>{metrics.days_remaining}d left</span>
      </span>
    );
  };

  // Render Velocity Metrics (only when not completed)
  const renderVelocities = () => {
    if (status === 'completed' || !metrics) return null;

    const topicsPerWk = metrics.topics_per_week;
    const hoursPerWk = metrics.hours_per_week;
    const hasRemainingHours = metrics.remaining_contact_hours > 0;

    return (
      <span className="flex items-center gap-1.5 text-[11px] opacity-90 border-l border-current/25 pl-1.5">
        <span>
          {topicsPerWk} {topicsPerWk === 1 ? 'topic/wk' : 'topics/wk'}
        </span>
        {hasRemainingHours && (
          <>
            <span>•</span>
            <span>
              {hoursPerWk} {hoursPerWk === 1 ? 'hr/wk' : 'hrs/wk'}
            </span>
          </>
        )}
      </span>
    );
  };

  return (
    <div
      className="relative inline-flex items-center text-xs"
      onClick={(e) => e.stopPropagation()}
      data-testid={`pacing-badge-container-${nodeId}`}
    >
      {status === 'not_set' ? (
        <button
          type="button"
          onClick={handleOpenPicker}
          aria-expanded={isPickerOpen}
          aria-controls={popoverId}
          aria-label={`Set target date for ${nodeType} ${nodeId}`}
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-medium transition-colors focus:outline-hidden focus:ring-2 focus:ring-teal-500/50 ${STATUS_STYLES.not_set}`}
          data-testid={`pacing-badge-set-btn-${nodeId}`}
        >
          <Calendar className="w-3 h-3" />
          <span>+ Target Date</span>
        </button>
      ) : (
        <div
          data-testid={`pacing-badge-${nodeId}`}
          className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-medium shadow-xs transition-colors ${STATUS_STYLES[status]}`}
        >
          {renderDaysIndicator()}
          {renderVelocities()}

          {/* Edit / Open Calendar button */}
          <button
            type="button"
            onClick={handleOpenPicker}
            aria-label={`Edit target date for ${nodeType} ${nodeId}`}
            title={`Edit deadline: ${metrics?.target_date || ''}`}
            className="p-0.5 rounded hover:bg-white/10 transition-colors focus:outline-hidden focus:ring-1 focus:ring-current"
            data-testid={`pacing-badge-edit-btn-${nodeId}`}
          >
            <Calendar className="w-3 h-3 opacity-75 hover:opacity-100" />
          </button>

          {/* Clear button */}
          <button
            type="button"
            onClick={handleOpenClearConfirm}
            aria-label={`Clear deadline for ${nodeType} ${nodeId}`}
            title="Clear target deadline"
            className="p-0.5 rounded hover:bg-white/10 transition-colors focus:outline-hidden focus:ring-1 focus:ring-current"
            data-testid={`pacing-badge-clear-btn-${nodeId}`}
          >
            <X className="w-3 h-3 opacity-75 hover:opacity-100" />
          </button>
        </div>
      )}

      {/* Date Picker Popover */}
      {isPickerOpen && (
        <div
          id={popoverId}
          ref={popoverRef}
          role="dialog"
          aria-modal="false"
          aria-label="Set target date"
          onClick={(e) => e.stopPropagation()}
          className="absolute z-50 top-full mt-1.5 left-0 w-64 bg-gray-900 border border-gray-700/80 rounded-xl shadow-xl p-3 space-y-3"
          data-testid={`pacing-picker-popover-${nodeId}`}
        >
          <div className="flex items-center justify-between pb-1.5 border-b border-gray-800">
            <span className="text-xs font-semibold text-gray-200">
              {status === 'not_set' ? 'Set Target Date' : 'Update Target Date'}
            </span>
            <button
              type="button"
              onClick={handleClosePicker}
              aria-label="Close date picker"
              disabled={isSaving}
              className="text-gray-400 hover:text-gray-200 p-0.5 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <form onSubmit={handleSaveDeadline} className="space-y-2.5">
            <div>
              <label
                htmlFor={`date-input-${nodeId}`}
                className="block text-[11px] text-gray-400 mb-1"
              >
                Target completion date
              </label>
              <input
                ref={dateInputRef}
                id={`date-input-${nodeId}`}
                type="date"
                value={targetDateInput}
                onChange={(e) => {
                  setTargetDateInput(e.target.value);
                  setErrorMessage(null);
                }}
                disabled={isSaving}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-gray-950 border border-gray-700 text-gray-200 focus:outline-hidden focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                data-testid={`pacing-date-input-${nodeId}`}
              />
            </div>

            {errorMessage && (
              <div
                role="alert"
                className="text-[11px] text-rose-400 bg-rose-950/40 border border-rose-900/50 p-1.5 rounded"
                data-testid={`pacing-error-${nodeId}`}
              >
                {errorMessage}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={handleClosePicker}
                disabled={isSaving}
                className="px-2.5 py-1 rounded text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving || !targetDateInput}
                className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium bg-teal-600 hover:bg-teal-500 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
                data-testid={`pacing-save-btn-${nodeId}`}
              >
                {isSaving && <Loader2 className="w-3 h-3 animate-spin" />}
                <span>{isSaving ? 'Saving...' : 'Save'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Clear Confirmation Popover */}
      {isConfirmClearOpen && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label="Confirm clear deadline"
          onClick={(e) => e.stopPropagation()}
          className="absolute z-50 top-full mt-1.5 left-0 w-60 bg-gray-900 border border-gray-700/80 rounded-xl shadow-xl p-3 space-y-2.5"
          data-testid={`pacing-clear-popover-${nodeId}`}
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-gray-200">Clear target date?</p>
              <p className="text-[11px] text-gray-400">
                Pacing calculations for this {nodeType} will be reset.
              </p>
            </div>
          </div>

          {errorMessage && (
            <div role="alert" className="text-[11px] text-rose-400">
              {errorMessage}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1 border-t border-gray-800">
            <button
              type="button"
              onClick={handleCancelClear}
              disabled={isClearing}
              className="px-2 py-1 rounded text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-800 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmClear}
              disabled={isClearing}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-50 shadow-xs"
              data-testid={`pacing-confirm-clear-btn-${nodeId}`}
            >
              {isClearing && <Loader2 className="w-3 h-3 animate-spin" />}
              <span>{isClearing ? 'Clearing...' : 'Clear'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
