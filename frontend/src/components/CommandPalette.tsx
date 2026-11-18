import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  AlertCircle,
  BookOpen,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  Download,
  FileCode,
  FileText,
  FlaskConical,
  Folder,
  Layers,
  Link2,
  Moon,
  Search,
  Sparkles,
  Sun,
  Upload,
  X,
  Monitor,
} from 'lucide-react';
import type {
  HierarchicalSyllabus,
  PacingMetrics,
  TopicNote,
  TopicResource,
} from '../types/syllabus';
import { getSemesterSubjects } from './SyllabusTree';

export type CommandItemType =
  | 'year'
  | 'semester'
  | 'subject'
  | 'module'
  | 'topic'
  | 'note'
  | 'resource'
  | 'action';

export type QuickFilterType =
  | 'all'
  | 'incomplete'
  | 'completed'
  | 'lab'
  | 'needs_review'
  | 'at_risk';

export interface CommandSearchResult {
  id: string;
  type: CommandItemType;
  title: string;
  subtitle?: string;
  breadcrumb?: string;
  code?: string | null;
  matchText?: string;
  targetNodeId?: string;
  actionId?: string;
  score: number;
  category: 'Academic Structure' | 'Topics' | 'Notes' | 'Resources' | 'Quick Actions';
  isCompleted?: boolean;
  isLab?: boolean;
  needsReview?: boolean;
  pacingStatus?: string;
}

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  syllabus: HierarchicalSyllabus | null;
  completedLeafIds?: string[];
  pacingData?: Record<string, PacingMetrics>;
  notes?: TopicNote[];
  resources?: TopicResource[];
  currentTheme?: 'dark' | 'light' | 'system';
  onNavigateToNode?: (nodeId: string) => void;
  onOpenNote?: (leafId: string, leafTitle: string) => void;
  onOpenResource?: (nodeId: string, nodeType: 'subtopic' | 'module', nodeTitle: string) => void;
  onOpenUpload?: () => void;
  onOpenElectives?: () => void;
  onExportMarkdown?: () => void;
  onSetTheme?: (theme: 'dark' | 'light' | 'system') => void;
}

// Lightweight fuzzy subsequence match: returns true if all chars in query appear sequentially in target
function fuzzyMatch(target: string, query: string): boolean {
  let tIdx = 0;
  let qIdx = 0;
  while (tIdx < target.length && qIdx < query.length) {
    if (target[tIdx] === query[qIdx]) {
      qIdx++;
    }
    tIdx++;
  }
  return qIdx === query.length;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  syllabus,
  completedLeafIds = [],
  pacingData = {},
  notes = [],
  resources = [],
  currentTheme = 'system',
  onNavigateToNode,
  onOpenNote,
  onOpenResource,
  onOpenUpload,
  onOpenElectives,
  onExportMarkdown,
  onSetTheme,
}) => {
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<QuickFilterType>('all');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  const completedSet = useMemo(() => new Set(completedLeafIds), [completedLeafIds]);

  // Capture previous active element on open to restore focus upon close
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement | null;
      setQuery('');
      setActiveFilter('all');
      setSelectedIndex(0);
      // Autofocus input
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      if (previousActiveElement.current && typeof previousActiveElement.current.focus === 'function') {
        previousActiveElement.current.focus();
      }
    }
  }, [isOpen]);

  // Global Keyboard Shortcuts (Ctrl+K / Cmd+K and Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is composing through IME
      if (e.isComposing) return;

      const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform || '');
      const isTrigger = (isMac ? e.metaKey : e.ctrlKey) && (e.key === 'k' || e.key === 'K');

      if (isTrigger) {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          // Open handled by consumer or if controlled here
        }
      } else if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Build searchable index from syllabus hierarchy, notes, resources, and actions
  const index = useMemo(() => {
    const items: CommandSearchResult[] = [];

    // 1. Quick Actions
    items.push({
      id: 'act_import',
      type: 'action',
      title: 'Import Syllabus Document',
      subtitle: 'Upload a PDF, DOCX, DOC, or TXT curriculum file',
      category: 'Quick Actions',
      actionId: 'import',
      score: 10,
    });

    if (syllabus) {
      items.push({
        id: 'act_electives',
        type: 'action',
        title: 'Configure Electives',
        subtitle: 'Review and select elective course groups',
        category: 'Quick Actions',
        actionId: 'electives',
        score: 9,
      });

      items.push({
        id: 'act_export_md',
        type: 'action',
        title: 'Export Markdown Checklist',
        subtitle: 'Export current syllabus progress and notes to Markdown',
        category: 'Quick Actions',
        actionId: 'export_md',
        score: 8,
      });
    }

    items.push(
      {
        id: 'act_theme_dark',
        type: 'action',
        title: 'Switch Theme: Dark',
        subtitle: 'Obsidian dark palette with emerald accents',
        category: 'Quick Actions',
        actionId: 'theme_dark',
        score: 5,
      },
      {
        id: 'act_theme_light',
        type: 'action',
        title: 'Switch Theme: Light',
        subtitle: 'Daylight clean palette with crisp contrast',
        category: 'Quick Actions',
        actionId: 'theme_light',
        score: 5,
      },
      {
        id: 'act_theme_system',
        type: 'action',
        title: 'Switch Theme: System',
        subtitle: 'Sync automatically with operating system preference',
        category: 'Quick Actions',
        actionId: 'theme_system',
        score: 5,
      }
    );

    if (!syllabus) return items;

    // 2. Academic Hierarchy: Years, Semesters, Subjects, Modules, Topics
    const topicToSubjectMap: Record<string, { subjectId: string; title: string }> = {};

    syllabus.years.forEach((yr) => {
      items.push({
        id: `node_${yr.id}`,
        type: 'year',
        title: yr.title,
        breadcrumb: yr.title,
        targetNodeId: yr.id,
        category: 'Academic Structure',
        score: 0,
      });

      (yr.semesters || []).forEach((sem) => {
        const semPacing = pacingData[sem.id]?.status;
        items.push({
          id: `node_${sem.id}`,
          type: 'semester',
          title: sem.title,
          breadcrumb: `${yr.title} → ${sem.title}`,
          targetNodeId: sem.id,
          category: 'Academic Structure',
          pacingStatus: semPacing,
          score: 0,
        });

        const subjects = getSemesterSubjects(sem);
        subjects.forEach((subj) => {
          const subjPacing = pacingData[subj.id]?.status;
          const isLab = Boolean(subj.is_lab);
          const subjNeedsReview = Boolean(
            (subj as unknown as { evidence_status?: string }).evidence_status === 'needs_review' ||
            (subj as unknown as { grounding_status?: string }).grounding_status === 'needs_review'
          );

          items.push({
            id: `node_${subj.id}`,
            type: 'subject',
            title: subj.title,
            code: subj.code || null,
            breadcrumb: `${yr.title} → ${sem.title} → ${subj.title}`,
            targetNodeId: subj.id,
            category: 'Academic Structure',
            isLab,
            needsReview: subjNeedsReview,
            pacingStatus: subjPacing,
            score: 0,
          });

          (subj.modules || []).forEach((mod) => {
            const modNeedsReview = Boolean(
              (mod as unknown as { evidence_status?: string }).evidence_status === 'needs_review' ||
              (mod as unknown as { grounding_status?: string }).grounding_status === 'needs_review'
            );

            items.push({
              id: `node_${mod.id}`,
              type: 'module',
              title: mod.title,
              breadcrumb: `${yr.title} → ${sem.title} → ${subj.title} → ${mod.title}`,
              targetNodeId: mod.id,
              category: 'Academic Structure',
              isLab,
              needsReview: modNeedsReview,
              score: 0,
            });

            (mod.topics || []).forEach((top) => {
              topicToSubjectMap[top.id] = { subjectId: subj.id, title: subj.title };
              const isCompleted = completedSet.has(top.id);
              const topStatus = top.grounding_status || top.evidence_status;
              const topNeedsReview =
                topStatus === 'needs_review' ||
                topStatus === 'review_required' ||
                (topStatus && topStatus !== 'verified');

              items.push({
                id: `node_${top.id}`,
                type: 'topic',
                title: top.title,
                breadcrumb: `${subj.title} → ${mod.title}`,
                targetNodeId: top.id,
                category: 'Topics',
                isCompleted,
                isLab,
                needsReview: topNeedsReview,
                score: 0,
              });
            });
          });
        });
      });
    });

    // 3. Personal Notes
    notes.forEach((note) => {
      if (!note.content || !note.content.trim()) return;
      const cleanContent = note.content.trim();
      const firstLine = cleanContent.split('\n')[0].substring(0, 80);
      const parentSubject = topicToSubjectMap[note.leaf_id];

      items.push({
        id: `note_${note.leaf_id}`,
        type: 'note',
        title: `Note: ${firstLine}`,
        matchText: cleanContent,
        breadcrumb: parentSubject ? `Study Note in ${parentSubject.title}` : 'Study Note',
        targetNodeId: note.leaf_id,
        category: 'Notes',
        score: 0,
      });
    });

    // 4. Resource Bookmarks
    resources.forEach((res) => {
      const parentSubject = topicToSubjectMap[res.node_id];
      items.push({
        id: `res_${res.id}`,
        type: 'resource',
        title: res.title,
        subtitle: res.url,
        matchText: `${res.title} ${res.url}`,
        breadcrumb: parentSubject ? `Resource in ${parentSubject.title}` : `Resource (${res.resource_type})`,
        targetNodeId: res.node_id,
        category: 'Resources',
        score: 0,
      });
    });

    return items;
  }, [syllabus, pacingData, completedSet, notes, resources]);

  // Filter & rank results deterministically
  const filteredResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qWords = q ? q.split(/\s+/).filter(Boolean) : [];

    // Filter by quick filter chip first
    let pool = index;
    if (activeFilter === 'incomplete') {
      pool = index.filter((item) => item.type === 'topic' && item.isCompleted === false);
    } else if (activeFilter === 'completed') {
      pool = index.filter((item) => item.type === 'topic' && item.isCompleted === true);
    } else if (activeFilter === 'lab') {
      pool = index.filter((item) => item.isLab === true);
    } else if (activeFilter === 'needs_review') {
      pool = index.filter((item) => item.needsReview === true);
    } else if (activeFilter === 'at_risk') {
      pool = index.filter((item) => item.pacingStatus === 'at_risk' || item.pacingStatus === 'behind');
    }

    if (!q) {
      // Natural empty-query list (capped at 40)
      return pool.slice(0, 40);
    }

    // Rank each item
    const scored: CommandSearchResult[] = [];

    for (const item of pool) {
      const titleLower = item.title.toLowerCase();
      const codeLower = (item.code || '').toLowerCase();
      const matchTextLower = (item.matchText || '').toLowerCase();
      const breadcrumbLower = (item.breadcrumb || '').toLowerCase();

      let score = 0;

      // 1. Exact course code match
      if (codeLower && codeLower === q) {
        score += 1000;
      } else if (codeLower && codeLower.startsWith(q)) {
        score += 800;
      } else if (codeLower && codeLower.includes(q)) {
        score += 600;
      }

      // 2. Exact title match
      if (titleLower === q) {
        score += 900;
      }
      // 3. Prefix match
      else if (titleLower.startsWith(q)) {
        score += 700;
      }
      // 4. Substring match
      else if (titleLower.includes(q)) {
        score += 450;
      }
      // 5. All query words match
      else if (qWords.length > 1 && qWords.every((w) => titleLower.includes(w))) {
        score += 400;
      }
      // 6. Fuzzy subsequence match
      else if (fuzzyMatch(titleLower, q)) {
        score += 250;
      }

      // 7. Note content or resource URL match
      if (matchTextLower.includes(q)) {
        score += 200;
      }

      // 8. Breadcrumb context match
      if (breadcrumbLower.includes(q)) {
        score += 100;
      }

      if (score > 0) {
        scored.push({
          ...item,
          score,
        });
      }
    }

    // Sort descending by score, tiebreak by title
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.title.localeCompare(b.title);
    });

    return scored.slice(0, 50);
  }, [index, query, activeFilter]);

  // Keep selected index within bounds
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, activeFilter]);

  // Handle Action / Item Selection
  const handleSelect = useCallback(
    (item: CommandSearchResult) => {
      onClose();

      if (item.type === 'action') {
        if (item.actionId === 'import' && onOpenUpload) {
          onOpenUpload();
        } else if (item.actionId === 'electives' && onOpenElectives) {
          onOpenElectives();
        } else if (item.actionId === 'export_md' && onExportMarkdown) {
          onExportMarkdown();
        } else if (item.actionId === 'theme_dark' && onSetTheme) {
          onSetTheme('dark');
        } else if (item.actionId === 'theme_light' && onSetTheme) {
          onSetTheme('light');
        } else if (item.actionId === 'theme_system' && onSetTheme) {
          onSetTheme('system');
        }
        return;
      }

      if (item.type === 'note' && onOpenNote && item.targetNodeId) {
        // Open note drawer and navigate to topic
        onOpenNote(item.targetNodeId, item.title.replace('Note: ', ''));
        if (onNavigateToNode) {
          onNavigateToNode(item.targetNodeId);
        }
        return;
      }

      if (item.type === 'resource' && onOpenResource && item.targetNodeId) {
        // Open resource modal and navigate
        onOpenResource(item.targetNodeId, 'subtopic', item.title);
        if (onNavigateToNode) {
          onNavigateToNode(item.targetNodeId);
        }
        return;
      }

      // Academic node navigation (Year, Semester, Subject, Module, Topic)
      if (item.targetNodeId && onNavigateToNode) {
        onNavigateToNode(item.targetNodeId);
      }
    },
    [
      onClose,
      onOpenUpload,
      onOpenElectives,
      onExportMarkdown,
      onSetTheme,
      onOpenNote,
      onOpenResource,
      onNavigateToNode,
    ]
  );

  // Keyboard navigation inside dialog (ArrowUp, ArrowDown, Enter)
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (filteredResults.length > 0 ? (prev + 1) % filteredResults.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        filteredResults.length > 0 ? (prev - 1 + filteredResults.length) % filteredResults.length : 0
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredResults.length > 0 && filteredResults[selectedIndex]) {
        handleSelect(filteredResults[selectedIndex]);
      }
    }
  };

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector<HTMLElement>(`[data-result-index="${selectedIndex}"]`);
      if (activeEl && typeof activeEl.scrollIntoView === 'function') {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette and Curriculum Search"
      className="fixed inset-0 z-50 flex items-start justify-center pt-14 sm:pt-20 px-3 sm:px-4 bg-black/60 backdrop-blur-xs transition-opacity"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-2xl bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header Input */}
        <div className="flex items-center px-4 py-3.5 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)]">
          <Search className="w-4 h-4 text-[var(--text-muted)] shrink-0 mr-3" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Type a course code (e.g. CS101), topic, note, or command..."
            aria-label="Search curriculum, topics, notes, or actions"
            className="w-full bg-transparent text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-md transition-colors"
              aria-label="Clear search input"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <span className="hidden sm:inline-block ml-3 px-1.5 py-0.5 text-[10px] font-mono font-semibold rounded bg-[var(--bg-surface-hover)] text-[var(--text-muted)] border border-[var(--border-subtle)]">
            ESC
          </span>
        </div>

        {/* Quick Filter Chips */}
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)] overflow-x-auto custom-scrollbar shrink-0">
          <FilterChip
            label="All"
            active={activeFilter === 'all'}
            onClick={() => setActiveFilter('all')}
          />
          <FilterChip
            label="Incomplete"
            active={activeFilter === 'incomplete'}
            onClick={() => setActiveFilter('incomplete')}
            icon={<Circle className="w-3 h-3 text-gray-400" />}
          />
          <FilterChip
            label="Completed"
            active={activeFilter === 'completed'}
            onClick={() => setActiveFilter('completed')}
            icon={<CheckCircle2 className="w-3 h-3 text-emerald-500" />}
          />
          <FilterChip
            label="Lab Courses"
            active={activeFilter === 'lab'}
            onClick={() => setActiveFilter('lab')}
            icon={<FlaskConical className="w-3 h-3 text-purple-400" />}
          />
          <FilterChip
            label="Needs Review"
            active={activeFilter === 'needs_review'}
            onClick={() => setActiveFilter('needs_review')}
            icon={<AlertCircle className="w-3 h-3 text-amber-400" />}
          />
          <FilterChip
            label="At-Risk"
            active={activeFilter === 'at_risk'}
            onClick={() => setActiveFilter('at_risk')}
            icon={<Clock className="w-3 h-3 text-orange-400" />}
          />
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          role="listbox"
          aria-label="Command suggestions"
          className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar min-h-[220px]"
        >
          {filteredResults.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <Search className="w-6 h-6 text-[var(--text-muted)] mx-auto opacity-50" />
              <p className="text-sm font-medium text-[var(--text-secondary)]">No matching results found</p>
              <p className="text-xs text-[var(--text-muted)]">
                Try searching for a course title, course code (e.g. CS101), or clear active filters.
              </p>
            </div>
          ) : (
            filteredResults.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  role="option"
                  aria-selected={isSelected}
                  data-result-index={idx}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-[var(--accent-subtle)] text-[var(--text-primary)] border border-emerald-500/40 shadow-xs'
                      : 'hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <ItemIcon type={item.type} actionId={item.actionId} isCompleted={item.isCompleted} isLab={item.isLab} />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {item.code && (
                          <span className="px-1.5 py-0.2 text-[10px] font-mono tabular-nums font-semibold rounded bg-blue-500/10 text-blue-600 dark:text-blue-300 border border-blue-500/20">
                            {item.code}
                          </span>
                        )}
                        <span className="text-xs font-medium text-[var(--text-primary)] truncate">
                          {item.title}
                        </span>

                        {item.isLab && (
                          <span className="px-1.5 py-0.2 text-[9px] font-medium rounded bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-500/20">
                            Lab
                          </span>
                        )}

                        {item.needsReview && (
                          <span className="px-1.5 py-0.2 text-[9px] font-medium rounded bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-500/20">
                            Review
                          </span>
                        )}

                        {item.pacingStatus === 'at_risk' && (
                          <span className="px-1.5 py-0.2 text-[9px] font-medium rounded bg-orange-500/10 text-orange-600 dark:text-orange-300 border border-orange-500/20">
                            At Risk
                          </span>
                        )}
                      </div>

                      {item.breadcrumb && (
                        <p className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">
                          {item.breadcrumb}
                        </p>
                      )}

                      {item.subtitle && !item.breadcrumb && (
                        <p className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">
                          {item.subtitle}
                        </p>
                      )}
                    </div>
                  </div>

                  <span className="ml-2 text-[10px] uppercase font-semibold tracking-wider text-[var(--text-muted)] shrink-0 hidden sm:inline">
                    {item.category}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] text-[11px] text-[var(--text-muted)]">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="font-mono bg-[var(--bg-surface-hover)] px-1 rounded border border-[var(--border-subtle)]">↑</kbd>{' '}
              <kbd className="font-mono bg-[var(--bg-surface-hover)] px-1 rounded border border-[var(--border-subtle)]">↓</kbd>{' '}
              Navigate
            </span>
            <span>
              <kbd className="font-mono bg-[var(--bg-surface-hover)] px-1.5 rounded border border-[var(--border-subtle)]">↵</kbd>{' '}
              Select
            </span>
            <span>
              <kbd className="font-mono bg-[var(--bg-surface-hover)] px-1 rounded border border-[var(--border-subtle)]">esc</kbd>{' '}
              Close
            </span>
          </div>
          <span className="hidden sm:inline">
            Active Theme: <strong className="capitalize text-[var(--text-primary)]">{currentTheme}</strong>
          </span>
        </div>
      </div>
    </div>
  );
};

interface FilterChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
}

const FilterChip: React.FC<FilterChipProps> = ({ label, active, onClick, icon }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
        active
          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40 font-semibold'
          : 'bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)] hover:border-[var(--border-subtle)]'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
};

function ItemIcon({
  type,
  actionId,
  isCompleted,
  isLab,
}: {
  type: CommandItemType;
  actionId?: string;
  isCompleted?: boolean;
  isLab?: boolean;
}) {
  if (type === 'action') {
    if (actionId === 'import') return <Upload className="w-4 h-4 text-emerald-500 shrink-0" />;
    if (actionId === 'electives') return <BookOpen className="w-4 h-4 text-indigo-400 shrink-0" />;
    if (actionId === 'export_md') return <Download className="w-4 h-4 text-teal-400 shrink-0" />;
    if (actionId === 'theme_dark') return <Moon className="w-4 h-4 text-purple-400 shrink-0" />;
    if (actionId === 'theme_light') return <Sun className="w-4 h-4 text-amber-400 shrink-0" />;
    if (actionId === 'theme_system') return <Monitor className="w-4 h-4 text-blue-400 shrink-0" />;
    return <Sparkles className="w-4 h-4 text-emerald-500 shrink-0" />;
  }

  if (type === 'year') return <Layers className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />;
  if (type === 'semester') return <Calendar className="w-4 h-4 text-teal-500 shrink-0" />;
  if (type === 'subject') {
    return isLab ? (
      <FlaskConical className="w-4 h-4 text-purple-500 dark:text-purple-400 shrink-0" />
    ) : (
      <BookOpen className="w-4 h-4 text-blue-500 dark:text-blue-400 shrink-0" />
    );
  }
  if (type === 'module') return <Folder className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />;
  if (type === 'topic') {
    return isCompleted ? (
      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
    ) : (
      <Circle className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
    );
  }
  if (type === 'note') return <FileText className="w-4 h-4 text-amber-500 shrink-0" />;
  if (type === 'resource') return <Link2 className="w-4 h-4 text-indigo-400 shrink-0" />;

  return <FileCode className="w-4 h-4 text-gray-400 shrink-0" />;
}
