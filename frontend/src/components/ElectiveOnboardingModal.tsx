import React, { useEffect, useState, useId } from 'react';
import * as Checkbox from '@radix-ui/react-checkbox';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  GraduationCap,
  Layers,
  X,
} from 'lucide-react';
import type { ParseReviewResponse, Subject } from '../types/syllabus';

interface ElectiveOnboardingModalProps {
  isOpen: boolean;
  syllabusId?: string;
  syllabusTitle?: string;
  detectedElectives?: Subject[];
  electiveGroups?: Record<string, Subject[]> | string[];
  reviewData?: ParseReviewResponse;
  warnings?: string[];
  onConfirm: (selectedSubjectIds: string[]) => Promise<void>;
  onClose?: () => void;
  isSubmitting?: boolean;
}

export const ElectiveOnboardingModal: React.FC<ElectiveOnboardingModalProps> = ({
  isOpen,
  syllabusId: _syllabusId,
  syllabusTitle,
  detectedElectives = [],
  electiveGroups,
  reviewData,
  warnings = [],
  onConfirm,
  onClose,
  isSubmitting = false,
}) => {
  const titleId = useId();
  const descId = useId();

  const effectiveTitle = reviewData?.title || syllabusTitle || 'Academic Syllabus';
  const effectiveWarnings =
    warnings.length > 0 ? warnings : reviewData?.extraction_warnings || [];
  const effectiveElectives: Subject[] =
    reviewData?.detected_electives || detectedElectives || [];

  // Collect mandatory subject IDs to guarantee they remain enrolled upon finalization
  const mandatorySubjectIds: string[] = [];
  const years = reviewData?.years || [];
  years.forEach((yr) => {
    (yr.semesters || []).forEach((sem) => {
      (sem.subjects || []).forEach((subj) => {
        if (!subj.is_elective || subj.enrollment_status === 'mandatory') {
          mandatorySubjectIds.push(subj.id);
        }
      });
    });
  });

  // Initialize selected subjects: pre-select already 'selected' electives, or none if all pending
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    effectiveElectives.forEach((subj) => {
      if (subj.enrollment_status === 'selected' || subj.is_enrolled === true) {
        initial.add(subj.id);
      }
    });
    return initial;
  });

  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const next = new Set<string>();
    effectiveElectives.forEach((subj) => {
      if (subj.enrollment_status === 'selected' || subj.is_enrolled === true) {
        next.add(subj.id);
      }
    });
    setSelectedIds(next);
  }, [effectiveElectives]);

  if (!isOpen) return null;

  const toggleSubject = (subjectId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(subjectId)) {
        next.delete(subjectId);
      } else {
        next.add(subjectId);
      }
      return next;
    });
  };

  const handleConfirm = async () => {
    setSubmitError(null);
    try {
      const allFinalEnrolled = Array.from(
        new Set([...mandatorySubjectIds, ...Array.from(selectedIds)])
      );
      await onConfirm(allFinalEnrolled);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Failed to finalize elective enrollment.'
      );
    }
  };

  // Group display resolution
  let displayGroups: Record<string, Subject[]> = {};
  if (
    electiveGroups &&
    !Array.isArray(electiveGroups) &&
    Object.keys(electiveGroups).length > 0
  ) {
    displayGroups = electiveGroups;
  } else {
    effectiveElectives.forEach((subj) => {
      const groupName = subj.elective_group?.trim() || 'General Electives';
      if (!displayGroups[groupName]) {
        displayGroups[groupName] = [];
      }
      displayGroups[groupName].push(subj);
    });
  }
  if (Object.keys(displayGroups).length === 0 && effectiveElectives.length > 0) {
    displayGroups = { 'Available Electives': effectiveElectives };
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
    >
      <div className="bg-gray-900 border border-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between bg-gray-900/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h2 id={titleId} className="text-lg font-semibold text-white flex items-center gap-2">
                Confirm Elective Enrollment
              </h2>
              <p id={descId} className="text-xs text-gray-400">
                {effectiveTitle} · Select the elective courses you are taking this academic cycle.
              </p>
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition"
              aria-label="Close elective modal"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {effectiveWarnings.length > 0 && (
            <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-300 space-y-1">
                <p className="font-semibold">Curriculum Structure Notice</p>
                {effectiveWarnings.map((w, idx) => (
                  <p key={idx}>{w}</p>
                ))}
              </div>
            </div>
          )}

          {submitError && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="text-xs text-rose-300">
                <p className="font-semibold">Enrollment Error</p>
                <p>{submitError}</p>
              </div>
            </div>
          )}

          <div className="space-y-5">
            {Object.entries(displayGroups).map(([groupName, subjects]) => (
              <div
                key={groupName}
                className="bg-gray-950/60 border border-gray-800/80 rounded-xl p-4 space-y-3"
              >
                <div className="flex items-center justify-between border-b border-gray-800/60 pb-2">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-400" />
                    <span className="text-sm font-semibold text-gray-200">{groupName}</span>
                  </div>
                  <span className="text-xs text-gray-500 font-mono">
                    {subjects.length} course{subjects.length === 1 ? '' : 's'}
                  </span>
                </div>

                <div className="space-y-2">
                  {subjects.map((subj) => {
                    const isChecked = selectedIds.has(subj.id);
                    const checkboxId = `elective-cb-${subj.id}`;
                    return (
                      <div
                        key={subj.id}
                        onClick={() => toggleSubject(subj.id)}
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition select-none ${
                          isChecked
                            ? 'bg-indigo-950/30 border-indigo-500/40 text-white'
                            : 'bg-gray-900/40 border-gray-800 text-gray-300 hover:border-gray-700'
                        }`}
                      >
                        <Checkbox.Root
                          id={checkboxId}
                          checked={isChecked}
                          onCheckedChange={() => toggleSubject(subj.id)}
                          onClick={(e) => e.stopPropagation()}
                          className={`w-4 h-4 mt-0.5 shrink-0 rounded border flex items-center justify-center transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 focus:ring-offset-gray-900 ${
                            isChecked
                              ? 'bg-indigo-600 border-indigo-600 text-white'
                              : 'bg-gray-800 border-gray-700 hover:border-gray-500'
                          }`}
                          aria-label={`Enroll in ${subj.title}`}
                        >
                          <Checkbox.Indicator>
                            <Check className="w-3 h-3 stroke-[3]" />
                          </Checkbox.Indicator>
                        </Checkbox.Root>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {subj.code && (
                              <span className="text-xs font-mono font-medium text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                                {subj.code}
                              </span>
                            )}
                            <label
                              htmlFor={checkboxId}
                              className="text-sm font-medium leading-snug cursor-pointer truncate"
                            >
                              {subj.title}
                            </label>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                            <span>{subj.modules?.length ?? 0} module(s)</span>
                            {subj.is_lab && (
                              <span className="text-[10px] bg-purple-500/10 text-purple-300 px-1 rounded border border-purple-500/20">
                                Lab
                              </span>
                            )}
                            <span className="text-[10px] text-gray-500">
                              {isChecked ? 'Enrolled in active checklist' : 'Excluded from progress'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 bg-gray-950/40 border border-gray-800/60 rounded-lg text-xs text-gray-400 space-y-1">
            <p className="font-semibold text-gray-300">Enrollment Invariant:</p>
            <p>
              • Mandatory core courses are automatically enrolled and cannot be excluded.
            </p>
            <p>
              • Unselected electives remain in the syllabus repository and can be re-enrolled at any time without losing completed progress.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-800 bg-gray-900/80 flex items-center justify-between shrink-0">
          <div className="text-xs text-gray-400">
            <span className="font-medium text-indigo-400">{selectedIds.size}</span> elective course
            {selectedIds.size === 1 ? '' : 's'} selected
          </div>
          <div className="flex items-center gap-2">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-medium text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg shadow-sm shadow-indigo-500/20 flex items-center gap-2 transition"
            >
              {isSubmitting ? (
                <span>Finalizing Enrollment...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm Enrollment & Build Checklist</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

