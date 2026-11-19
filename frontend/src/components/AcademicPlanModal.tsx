import React, { useState, useEffect, useRef } from 'react';
import {
  Award,
  BookOpen,
  Check,
  GraduationCap,
  Info,
  RefreshCw,
  X,
  AlertCircle,
} from 'lucide-react';
import type {
  GradeScale,
  Subject,
  SubjectAcademicPlanItem,
  SubjectAcademicPlanUpdate,
} from '../types/syllabus';

interface AcademicPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  subject: Subject | null;
  syllabusId: string;
  existingPlan?: SubjectAcademicPlanItem | null;
  onSavePlan: (
    subjectId: string,
    plan: SubjectAcademicPlanUpdate
  ) => Promise<void>;
  isOnline?: boolean;
}

export const AcademicPlanModal: React.FC<AcademicPlanModalProps> = ({
  isOpen,
  onClose,
  subject,
  existingPlan,
  onSavePlan,
  isOnline = true,
}) => {
  const [creditOverride, setCreditOverride] = useState<string>('');
  const [targetGrade, setTargetGrade] = useState<string>('');
  const [gradeScale, setGradeScale] = useState<GradeScale>('10.0');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && subject) {
      setCreditOverride(
        existingPlan?.credit_override !== undefined && existingPlan?.credit_override !== null
          ? String(existingPlan.credit_override)
          : ''
      );
      setTargetGrade(
        existingPlan?.target_grade_points !== undefined && existingPlan?.target_grade_points !== null
          ? String(existingPlan.target_grade_points)
          : ''
      );
      setGradeScale(existingPlan?.grade_scale || '10.0');
      setErrorMessage(null);

      // Focus trap initial focus
      setTimeout(() => {
        firstInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, subject, existingPlan]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSaving) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, isSaving, onClose]);

  if (!isOpen || !subject) return null;

  const declaredCredits = subject.credits ?? null;
  const parsedOverride = creditOverride.trim() !== '' ? parseFloat(creditOverride) : null;
  const effectiveCredits = parsedOverride !== null && !isNaN(parsedOverride) ? parsedOverride : declaredCredits;

  const parsedGrade = targetGrade.trim() !== '' ? parseFloat(targetGrade) : null;
  const maxGrade = gradeScale === '10.0' ? 10.0 : 4.0;
  const isGpaEligible =
    effectiveCredits !== null &&
    effectiveCredits > 0 &&
    parsedGrade !== null &&
    !isNaN(parsedGrade) &&
    parsedGrade >= 0 &&
    parsedGrade <= maxGrade;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validation
    let finalOverride: number | null = null;
    if (creditOverride.trim() !== '') {
      const c = parseFloat(creditOverride);
      if (isNaN(c) || c < 0 || c > 30) {
        setErrorMessage('Credit override must be a number between 0.0 and 30.0');
        return;
      }
      finalOverride = Math.round(c * 100) / 100;
    }

    let finalGrade: number | null = null;
    if (targetGrade.trim() !== '') {
      const g = parseFloat(targetGrade);
      if (isNaN(g) || g < 0 || g > maxGrade) {
        setErrorMessage(
          `Target grade must be a number between 0.0 and ${maxGrade.toFixed(1)} for the ${gradeScale} scale`
        );
        return;
      }
      finalGrade = Math.round(g * 100) / 100;
    }

    setIsSaving(true);
    try {
      await onSavePlan(subject.id, {
        credit_override: finalOverride,
        target_grade_points: finalGrade,
        grade_scale: gradeScale,
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save academic plan';
      setErrorMessage(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearOverride = () => {
    setCreditOverride('');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="academic-plan-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        ref={modalRef}
        className="w-full max-w-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3
                id="academic-plan-modal-title"
                className="text-base font-bold text-[var(--text-primary)] truncate"
              >
                Academic Credit & GPA Plan
              </h3>
              <p className="text-xs text-[var(--text-muted)] truncate">
                {subject.code ? `${subject.code} • ` : ''}
                {subject.title}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] rounded-lg transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSave} className="p-5 space-y-4 overflow-y-auto custom-scrollbar">
          {errorMessage && (
            <div
              role="alert"
              className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-600 dark:text-rose-400 flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Course Metadata Card */}
          <div className="p-3.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-hairline)] space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-muted)]">Source Declared Credits:</span>
              <span className="font-mono font-semibold text-[var(--text-primary)]">
                {declaredCredits !== null ? `${declaredCredits} Credits` : 'Not declared in syllabus'}
              </span>
            </div>
            {subject.ltp && (
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-muted)]">Lecture-Tutorial-Practical (L-T-P):</span>
                <span className="font-mono font-medium text-[var(--text-secondary)]">{subject.ltp}</span>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-[var(--border-subtle)] pt-1.5">
              <span className="text-[var(--text-muted)] font-medium">Effective Credit Weight:</span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {effectiveCredits !== null ? `${effectiveCredits} Credits` : 'Unassigned (Excluded from GPA)'}
              </span>
            </div>
          </div>

          {/* Credit Override Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="credit-override-input"
                className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5"
              >
                <BookOpen className="w-3.5 h-3.5 text-emerald-500" />
                <span>Credit Override</span>
              </label>
              {creditOverride.trim() !== '' && (
                <button
                  type="button"
                  onClick={handleClearOverride}
                  className="text-[11px] text-[var(--text-muted)] hover:text-emerald-500 hover:underline cursor-pointer"
                >
                  Revert to declared
                </button>
              )}
            </div>
            <input
              id="credit-override-input"
              ref={firstInputRef}
              type="number"
              step="0.5"
              min="0"
              max="30"
              placeholder={declaredCredits !== null ? String(declaredCredits) : 'e.g. 4.0'}
              value={creditOverride}
              onChange={(e) => setCreditOverride(e.target.value)}
              disabled={isSaving}
              className="w-full px-3 py-2 text-xs rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-primary)] focus:outline-hidden focus:ring-2 focus:ring-emerald-500/50"
            />
            <p className="text-[11px] text-[var(--text-muted)]">
              Manual credit weight for this course. Leave blank to default to source declared credits.
            </p>
          </div>

          {/* Grade Scale Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-blue-500" />
              <span>Grading Scale Standard</span>
            </label>
            <div
              role="radiogroup"
              aria-label="Select grading scale"
              className="grid grid-cols-2 gap-2"
            >
              <button
                type="button"
                role="radio"
                aria-checked={gradeScale === '10.0'}
                onClick={() => setGradeScale('10.0')}
                className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                  gradeScale === '10.0'
                    ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]'
                }`}
              >
                <div className="font-semibold">10.0 Point Scale</div>
                <div className="text-[10px] opacity-75">Common in India / Europe</div>
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={gradeScale === '4.0'}
                onClick={() => setGradeScale('4.0')}
                className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                  gradeScale === '4.0'
                    ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]'
                }`}
              >
                <div className="font-semibold">4.0 Point Scale</div>
                <div className="text-[10px] opacity-75">US Standard (GPA)</div>
              </button>
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              Projections for 10.0 and 4.0 scales are strictly isolated and never combined.
            </p>
          </div>

          {/* Target Grade Points Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="target-grade-input"
                className="text-xs font-semibold text-[var(--text-primary)]"
              >
                Target Grade Points (0.0 – {maxGrade.toFixed(1)})
              </label>
              {targetGrade.trim() !== '' && (
                <button
                  type="button"
                  onClick={() => setTargetGrade('')}
                  className="text-[11px] text-[var(--text-muted)] hover:text-emerald-500 hover:underline cursor-pointer"
                >
                  Clear target
                </button>
              )}
            </div>
            <input
              id="target-grade-input"
              type="number"
              step="0.1"
              min="0"
              max={maxGrade}
              placeholder={`e.g. ${gradeScale === '10.0' ? '9.0' : '3.8'}`}
              value={targetGrade}
              onChange={(e) => setTargetGrade(e.target.value)}
              disabled={isSaving}
              className="w-full px-3 py-2 text-xs rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-primary)] focus:outline-hidden focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          {/* Eligibility Callout */}
          <div
            className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
              isGpaEligible
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                : 'bg-[var(--bg-canvas)] border-[var(--border-subtle)] text-[var(--text-muted)]'
            }`}
          >
            <div className="flex items-center gap-2">
              {isGpaEligible ? (
                <Check className="w-4 h-4 shrink-0 text-emerald-500" />
              ) : (
                <Info className="w-4 h-4 shrink-0 text-[var(--text-muted)]" />
              )}
              <span>
                {isGpaEligible
                  ? `Eligible for ${gradeScale} Target GPA Projections`
                  : 'Assign credits and a target grade to include in GPA projections'}
              </span>
            </div>
          </div>

          {!isOnline && (
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-600 dark:text-amber-400">
              Offline mode: Changes will be stored in your offline queue and synchronized when reconnected.
            </div>
          )}

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-medium rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-gray-950 flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Academic Plan</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
