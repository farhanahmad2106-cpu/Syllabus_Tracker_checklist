import React, { useState, useEffect, useRef } from 'react';
import {
  AlertCircle,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  GraduationCap,
  Layers,
  Link2,
  RefreshCw,
  Scale,
  Sparkles,
  X,
} from 'lucide-react';
import { compareSyllabi } from '../lib/api';
import type {
  SyllabusComparisonItem,
  SyllabusComparisonResponse,
  SyllabusSummary,
} from '../types/syllabus';

interface CompareSyllabiModalProps {
  isOpen: boolean;
  onClose: () => void;
  syllabiList: SyllabusSummary[];
  activeSyllabusId?: string | null;
}

export const CompareSyllabiModal: React.FC<CompareSyllabiModalProps> = ({
  isOpen,
  onClose,
  syllabiList,
  activeSyllabusId,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [comparison, setComparison] = useState<SyllabusComparisonResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);

  // Initialize selected IDs with active syllabus and first other syllabus
  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      if (syllabiList.length >= 2) {
        const initialIds: string[] = [];
        if (activeSyllabusId && syllabiList.some((s) => s.id === activeSyllabusId)) {
          initialIds.push(activeSyllabusId);
        }
        for (const s of syllabiList) {
          if (!initialIds.includes(s.id) && initialIds.length < 2) {
            initialIds.push(s.id);
          }
        }
        setSelectedIds(initialIds);
      } else {
        setSelectedIds([]);
      }
    }
  }, [isOpen, syllabiList, activeSyllabusId]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isLoading) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, isLoading, onClose]);

  // Run comparison whenever selected IDs change (if valid count)
  useEffect(() => {
    let isCancelled = false;

    if (isOpen && selectedIds.length >= 2 && selectedIds.length <= 4) {
      setIsLoading(true);
      setErrorMessage(null);

      compareSyllabi(selectedIds)
        .then((res) => {
          if (!isCancelled) {
            setComparison(res);
            setIsLoading(false);
          }
        })
        .catch((err) => {
          if (!isCancelled) {
            setErrorMessage(err instanceof Error ? err.message : 'Comparison failed');
            setIsLoading(false);
          }
        });
    } else {
      setComparison(null);
      setIsLoading(false);
    }

    return () => {
      isCancelled = true;
    };
  }, [isOpen, selectedIds]);

  if (!isOpen) return null;

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      if (selectedIds.length <= 2) {
        // Can't go below 2
        setErrorMessage('Select at least 2 syllabi to compare.');
        return;
      }
      setSelectedIds((prev) => prev.filter((i) => i !== id));
      setErrorMessage(null);
    } else {
      if (selectedIds.length >= 4) {
        setErrorMessage('You can compare a maximum of 4 syllabi simultaneously.');
        return;
      }
      setSelectedIds((prev) => [...prev, id]);
      setErrorMessage(null);
    }
  };

  const getMatchTypeLabel = (type: string) => {
    switch (type) {
      case 'exact_title':
        return 'Exact Title Match';
      case 'course_code':
        return 'Course Code Match';
      case 'token_similarity':
        return 'Curriculum Topic Overlap';
      default:
        return type;
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="compare-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        ref={modalRef}
        className="w-full max-w-5xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 id="compare-modal-title" className="text-base font-bold text-[var(--text-primary)]">
                Multi-Syllabus Curriculum Comparison
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                Side-by-side structural analytics, completion velocity, credit distribution, and shared courses.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] rounded-lg transition-colors cursor-pointer"
            aria-label="Close comparison"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar">
          {/* Syllabus Selection Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Select 2 to 4 Syllabi ({selectedIds.length} of 4 selected)
              </span>
              {errorMessage && (
                <span className="text-xs text-rose-500 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errorMessage}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
              {syllabiList.map((syl) => {
                const isSelected = selectedIds.includes(syl.id);
                return (
                  <button
                    key={syl.id}
                    type="button"
                    onClick={() => toggleSelect(syl.id)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                      isSelected
                        ? 'border-emerald-500/60 bg-emerald-500/10 shadow-sm'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)]/40 hover:bg-[var(--bg-surface-hover)] opacity-75 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1.5 min-w-0">
                      <span className="text-xs font-semibold text-[var(--text-primary)] truncate" title={syl.title}>
                        {syl.title}
                      </span>
                      <div
                        className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 border ${
                          isSelected
                            ? 'bg-emerald-500 border-emerald-500 text-gray-950'
                            : 'border-[var(--border-subtle)]'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)] flex justify-between">
                      <span>{syl.leaf_count} topics</span>
                      <span className="font-mono">{syl.progress.progress_percent}%</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Loading State */}
          {isLoading ? (
            <div className="p-12 flex flex-col items-center justify-center text-[var(--text-muted)] gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
              <span className="text-sm font-medium">Aggregating cross-syllabus metrics...</span>
            </div>
          ) : comparison ? (
            <div className="space-y-6">
              {/* Comparison Table */}
              <div className="border border-[var(--border-subtle)] rounded-2xl overflow-hidden bg-[var(--bg-surface)] shadow-xs">
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)]">
                        <th className="p-3.5 font-semibold text-[var(--text-muted)] min-w-[160px] sticky left-0 bg-[var(--bg-surface-elevated)] z-10">
                          Metric
                        </th>
                        {comparison.syllabi.map((item) => (
                          <th key={item.syllabus_id} className="p-3.5 font-bold text-[var(--text-primary)] min-w-[180px]">
                            <div className="truncate" title={item.title}>
                              {item.title}
                            </div>
                            <span className="text-[10px] font-normal text-[var(--text-muted)] capitalize">
                              Source: {item.source_type}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-hairline)] font-mono">
                      {/* Structure */}
                      <tr>
                        <td className="p-3 font-sans font-medium text-[var(--text-secondary)] sticky left-0 bg-[var(--bg-surface)]">
                          Academic Years
                        </td>
                        {comparison.syllabi.map((s) => (
                          <td key={s.syllabus_id} className="p-3 text-[var(--text-primary)]">
                            {s.year_count}
                          </td>
                        ))}
                      </tr>

                      <tr>
                        <td className="p-3 font-sans font-medium text-[var(--text-secondary)] sticky left-0 bg-[var(--bg-surface)]">
                          Semesters
                        </td>
                        {comparison.syllabi.map((s) => (
                          <td key={s.syllabus_id} className="p-3 text-[var(--text-primary)]">
                            {s.semester_count}
                          </td>
                        ))}
                      </tr>

                      <tr>
                        <td className="p-3 font-sans font-medium text-[var(--text-secondary)] sticky left-0 bg-[var(--bg-surface)]">
                          Enrolled Subjects
                        </td>
                        {comparison.syllabi.map((s) => (
                          <td key={s.syllabus_id} className="p-3 text-emerald-600 dark:text-emerald-400 font-semibold">
                            {s.enrolled_subjects}
                          </td>
                        ))}
                      </tr>

                      <tr>
                        <td className="p-3 font-sans font-medium text-[var(--text-secondary)] sticky left-0 bg-[var(--bg-surface)]">
                          Excluded Electives
                        </td>
                        {comparison.syllabi.map((s) => (
                          <td key={s.syllabus_id} className="p-3 text-[var(--text-muted)]">
                            {s.excluded_electives}
                          </td>
                        ))}
                      </tr>

                      <tr>
                        <td className="p-3 font-sans font-medium text-[var(--text-secondary)] sticky left-0 bg-[var(--bg-surface)]">
                          Laboratory Ratio
                        </td>
                        {comparison.syllabi.map((s) => (
                          <td key={s.syllabus_id} className="p-3 text-purple-600 dark:text-purple-400">
                            {s.lab_subjects} ({s.lab_ratio_percent}%)
                          </td>
                        ))}
                      </tr>

                      <tr>
                        <td className="p-3 font-sans font-medium text-[var(--text-secondary)] sticky left-0 bg-[var(--bg-surface)]">
                          Curriculum Modules
                        </td>
                        {comparison.syllabi.map((s) => (
                          <td key={s.syllabus_id} className="p-3 text-[var(--text-primary)]">
                            {s.total_modules}
                          </td>
                        ))}
                      </tr>

                      <tr>
                        <td className="p-3 font-sans font-medium text-[var(--text-secondary)] sticky left-0 bg-[var(--bg-surface)]">
                          Completion Progress
                        </td>
                        {comparison.syllabi.map((s) => (
                          <td key={s.syllabus_id} className="p-3 font-bold text-emerald-600 dark:text-emerald-400">
                            {s.completed_topics} / {s.total_topics} ({s.completion_percent}%)
                          </td>
                        ))}
                      </tr>

                      <tr>
                        <td className="p-3 font-sans font-medium text-[var(--text-secondary)] sticky left-0 bg-[var(--bg-surface)]">
                          Declared Credits
                        </td>
                        {comparison.syllabi.map((s) => (
                          <td key={s.syllabus_id} className="p-3 text-[var(--text-primary)] font-semibold">
                            {s.total_known_declared_credits} Cr
                          </td>
                        ))}
                      </tr>

                      <tr>
                        <td className="p-3 font-sans font-medium text-[var(--text-secondary)] sticky left-0 bg-[var(--bg-surface)]">
                          Missing-Credit Courses
                        </td>
                        {comparison.syllabi.map((s) => (
                          <td key={s.syllabus_id} className="p-3 text-amber-600 dark:text-amber-400">
                            {s.missing_credit_subject_count}
                          </td>
                        ))}
                      </tr>

                      <tr>
                        <td className="p-3 font-sans font-medium text-[var(--text-secondary)] sticky left-0 bg-[var(--bg-surface)]">
                          Target GPA Courses
                        </td>
                        {comparison.syllabi.map((s) => (
                          <td key={s.syllabus_id} className="p-3 text-blue-600 dark:text-blue-400">
                            {s.target_gpa_subject_count}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Shared & Overlapping Courses */}
              <div className="p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-500" />
                    <span>Shared & Overlapping Courses</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono">
                      {comparison.shared_subjects.length} identified
                    </span>
                  </h4>
                </div>

                {comparison.shared_subjects.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {comparison.shared_subjects.map((match, idx) => {
                      const sylA = comparison.syllabi.find((s) => s.syllabus_id === match.syllabus_id_a);
                      const sylB = comparison.syllabi.find((s) => s.syllabus_id === match.syllabus_id_b);

                      return (
                        <div
                          key={`${match.subject_id_a}-${match.subject_id_b}-${idx}`}
                          className="p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)]/60 space-y-2 text-xs"
                        >
                          <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
                              {getMatchTypeLabel(match.match_type)}
                            </span>
                            <span className="font-mono">Match: {Math.round(match.match_strength * 100)}%</span>
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-[var(--text-muted)] shrink-0 w-16 truncate">
                                {sylA?.title || 'Syllabus A'}:
                              </span>
                              <strong className="text-[var(--text-primary)] truncate">{match.subject_title_a}</strong>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-[var(--text-muted)] shrink-0 w-16 truncate">
                                {sylB?.title || 'Syllabus B'}:
                              </span>
                              <strong className="text-[var(--text-primary)] truncate">{match.subject_title_b}</strong>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--text-muted)] py-4 text-center">
                    No strongly overlapping courses detected across the selected syllabi.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-[var(--text-muted)]">
              Select between 2 and 4 syllabi to view comparison analytics.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-gray-950 transition-colors cursor-pointer shadow-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
