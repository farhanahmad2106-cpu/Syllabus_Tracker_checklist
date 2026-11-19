import React, { useState, useId, useEffect, useRef } from 'react';
import * as Checkbox from '@radix-ui/react-checkbox';
import {
  AlertCircle,
  BookOpen,
  Bot,
  Check,
  ChevronDown,
  FileText,
  Folder,
  GraduationCap,
  Layers,
  Link2,
  Minus,
  Sparkles,
} from 'lucide-react';
import type {
  AcademicYear,
  HierarchicalSyllabus,
  Module,
  PacingMetrics,
  ProgressSummary,
  Semester,
  SetTargetDatePayload,
  Subject,
  SubjectAcademicPlanItem,
  Subtopic,
} from '../types/syllabus';
import { PacingBadge } from './PacingBadge';
import { ProgressBar } from './ProgressBar';
import { SourceEvidence } from './SourceEvidence';

export interface SyllabusTreeProps {
  syllabus: HierarchicalSyllabus;
  completedLeafIds: string[];
  nodeProgress: Record<string, ProgressSummary>;
  pacingData?: Record<string, PacingMetrics>;
  onSetDeadline?: (payload: SetTargetDatePayload) => Promise<void>;
  onClearDeadline?: (nodeId: string) => Promise<void>;
  onToggleLeaf: (leafId: string, isCompleted: boolean) => void;
  onToggleBranch: (nodeId: string, isCompleted: boolean) => void;
  isMutating?: boolean;
  noteLeafIds?: Set<string>;
  resourceCounts?: Record<string, number>;
  onOpenNote?: (leafId: string, leafTitle: string) => void;
  onOpenResource?: (nodeId: string, nodeType: 'subtopic' | 'module', nodeTitle: string) => void;
  targetNodeId?: string | null;
  onTargetNodeNavigated?: (nodeId: string) => void;
  academicPlansMap?: Record<string, SubjectAcademicPlanItem>;
  onOpenAcademicPlan?: (subj: Subject) => void;
  onOpenFlashcards?: (leafId: string, leafTitle: string) => void;
  onOpenStudyAssistant?: (leafId: string, leafTitle: string) => void;
}


// Helper to normalize subjects from either 5-level canonical subjects or legacy 4-level topics
export function getSemesterSubjects(sem: Semester): Subject[] {
  if (sem.subjects && sem.subjects.length > 0) {
    return sem.subjects;
  }
  if (sem.topics && sem.topics.length > 0) {
    return sem.topics.map((t, idx) => ({
      id: `subj_${t.id}`,
      code: null,
      title: t.title,
      is_enrolled: true,
      enrollment_status: 'mandatory',
      order_index: t.order_index ?? idx,
      modules: [
        {
          id: t.id,
          module_number: null,
          title: 'Module 1',
          topics: t.subtopics || t.topics || [],
          order_index: 0,
        },
      ],
    }));
  }
  return [];
}

// Helper to check if a subject is enrolled
export function isSubjectEnrolled(subj: Subject): boolean {
  if (subj.enrollment_status === 'excluded' || subj.enrollment_status === 'pending') {
    return false;
  }
  if (subj.enrollment_status === 'mandatory' || subj.enrollment_status === 'selected') {
    return true;
  }
  return subj.is_enrolled !== false;
}

// Helper to collect all descendant topic leaf IDs for a module
export function getModuleLeaves(mod: Module): string[] {
  return (mod.topics || []).map((t) => t.id);
}

// Helper to collect all descendant topic leaf IDs for a subject (only if enrolled)
export function getSubjectLeaves(subj: Subject, enrolledOnly: boolean = true): string[] {
  if (enrolledOnly && !isSubjectEnrolled(subj)) {
    return [];
  }
  return (subj.modules || []).flatMap(getModuleLeaves);
}

// Helper to collect all descendant topic leaf IDs for a semester
export function getSemesterLeaves(sem: Semester): string[] {
  return getSemesterSubjects(sem).flatMap((s) => getSubjectLeaves(s, true));
}

// Helper to collect all descendant topic leaf IDs for a year
export function getYearLeaves(year: AcademicYear): string[] {
  return (year.semesters || []).flatMap(getSemesterLeaves);
}

export function computeLocalProgress(
  leaves: string[],
  completedSet: Set<string>
): ProgressSummary {
  const total = leaves.length;
  const completed = leaves.filter((id) => completedSet.has(id)).length;
  const percent = total > 0 ? Math.round((completed / total) * 1000) / 10 : 0.0;
  return {
    total_leaves: total,
    completed_leaves: completed,
    progress_percent: percent,
  };
}

/**
 * Traverses the 5-tier syllabus hierarchy to locate a target node ID and resolve its complete ancestor chain.
 */
export function findAncestorNodeIds(syllabus: HierarchicalSyllabus, targetId: string): string[] {
  const ancestors: string[] = [];

  for (const yr of syllabus.years) {
    if (yr.id === targetId) return [];
    for (const sem of yr.semesters || []) {
      if (sem.id === targetId) return [yr.id];
      const subjects = getSemesterSubjects(sem);
      for (const subj of subjects) {
        if (subj.id === targetId) return [yr.id, sem.id];
        for (const mod of subj.modules || []) {
          if (mod.id === targetId) return [yr.id, sem.id, subj.id];
          for (const top of mod.topics || []) {
            if (top.id === targetId) {
              return [yr.id, sem.id, subj.id, mod.id];
            }
          }
        }
      }
    }
  }

  return ancestors;
}

export const SyllabusTree: React.FC<SyllabusTreeProps> = ({
  syllabus,
  completedLeafIds,
  nodeProgress,
  pacingData,
  onSetDeadline,
  onClearDeadline,
  onToggleLeaf,
  onToggleBranch,
  isMutating = false,
  noteLeafIds,
  resourceCounts,
  onOpenNote,
  onOpenResource,
  targetNodeId,
  onTargetNodeNavigated,
  academicPlansMap,
  onOpenAcademicPlan,
  onOpenFlashcards,
  onOpenStudyAssistant,
}) => {
  const completedSet = new Set(completedLeafIds);

  // Initialize expansion: lab courses initialize collapsed by default; non-labs expanded
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    syllabus.years.forEach((yr) => {
      initial[yr.id] = true;
      (yr.semesters || []).forEach((sem) => {
        initial[sem.id] = true;
        const subjects = getSemesterSubjects(sem);
        subjects.forEach((subj) => {
          // Lab courses initialize collapsed by default
          initial[subj.id] = subj.is_lab ? false : true;
          (subj.modules || []).forEach((mod) => {
            initial[mod.id] = true;
          });
        });
      });
    });
    return initial;
  });

  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getBranchState = (descendantLeaves: string[]): boolean | 'indeterminate' => {
    if (descendantLeaves.length === 0) return false;
    const completedCount = descendantLeaves.filter((id) => completedSet.has(id)).length;
    if (completedCount === 0) return false;
    if (completedCount === descendantLeaves.length) return true;
    return 'indeterminate';
  };

  // Deep Hierarchical Navigation & Auto-expansion
  useEffect(() => {
    if (!targetNodeId) return;

    // 1. Resolve ancestor chain
    const ancestors = findAncestorNodeIds(syllabus, targetNodeId);

    // 2. Expand all necessary ancestor containers + target container if relevant
    setExpandedNodes((prev) => {
      const next = { ...prev };
      ancestors.forEach((ancId) => {
        next[ancId] = true;
      });
      // Also ensure target container itself is expanded if it's an ancestor-level node
      next[targetNodeId] = true;
      return next;
    });

    // 3. Set temporary visual highlight
    setHighlightedNodeId(targetNodeId);
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedNodeId(null);
    }, 2200);

    // 4. Scroll into view and focus post-render
    const frameId = requestAnimationFrame(() => {
      const selector = `[data-node-id="${CSS.escape(targetNodeId)}"]`;
      const targetEl = document.querySelector<HTMLElement>(selector);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Make focusable if not naturally focusable and focus
        if (!targetEl.getAttribute('tabIndex')) {
          targetEl.setAttribute('tabindex', '-1');
        }
        targetEl.focus({ preventScroll: true });
        if (onTargetNodeNavigated) {
          onTargetNodeNavigated(targetNodeId);
        }
      }
    });

    return () => {
      cancelAnimationFrame(frameId);
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, [targetNodeId, syllabus, onTargetNodeNavigated]);

  return (
    <div className="space-y-4" data-testid="syllabus-tree-root">
      {syllabus.years.map((year) => {
        const yearLeaves = getYearLeaves(year);
        const yearState = getBranchState(yearLeaves);
        const isExpanded = !!expandedNodes[year.id];
        const prog =
          nodeProgress[year.id] ||
          computeLocalProgress(yearLeaves, completedSet);

        return (
          <YearCard
            key={year.id}
            year={year}
            yearLeaves={yearLeaves}
            yearState={yearState}
            isExpanded={isExpanded}
            progress={prog}
            completedSet={completedSet}
            nodeProgress={nodeProgress}
            expandedNodes={expandedNodes}
            highlightedNodeId={highlightedNodeId}
            onToggleExpand={toggleExpand}
            onToggleLeaf={onToggleLeaf}
            onToggleBranch={onToggleBranch}
            getBranchState={getBranchState}
            pacingData={pacingData}
            onSetDeadline={onSetDeadline}
            onClearDeadline={onClearDeadline}
            isMutating={isMutating}
            noteLeafIds={noteLeafIds}
            resourceCounts={resourceCounts}
            onOpenNote={onOpenNote}
            onOpenResource={onOpenResource}
            academicPlansMap={academicPlansMap}
            onOpenAcademicPlan={onOpenAcademicPlan}
            onOpenFlashcards={onOpenFlashcards}
            onOpenStudyAssistant={onOpenStudyAssistant}
          />
        );
      })}
    </div>
  );
};

/* ========================================================================= */
/* Animated Collapse Wrapper                                                 */
/* ========================================================================= */
interface CollapsibleWrapperProps {
  isExpanded: boolean;
  contentId: string;
  children: React.ReactNode;
}

const CollapsibleWrapper: React.FC<CollapsibleWrapperProps> = ({
  isExpanded,
  contentId,
  children,
}) => {
  return (
    <div
      id={contentId}
      className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out motion-reduce:transition-none ${
        isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
      }`}
    >
      <div className="overflow-hidden min-h-0">{children}</div>
    </div>
  );
};

/* ========================================================================= */
/* 1. Academic Year Card                                                     */
/* ========================================================================= */
interface YearCardProps {
  year: AcademicYear;
  yearLeaves: string[];
  yearState: boolean | 'indeterminate';
  isExpanded: boolean;
  progress: ProgressSummary;
  completedSet: Set<string>;
  nodeProgress: Record<string, ProgressSummary>;
  pacingData?: Record<string, PacingMetrics>;
  onSetDeadline?: (payload: SetTargetDatePayload) => Promise<void>;
  onClearDeadline?: (nodeId: string) => Promise<void>;
  expandedNodes: Record<string, boolean>;
  highlightedNodeId: string | null;
  onToggleExpand: (id: string) => void;
  onToggleLeaf: (leafId: string, isCompleted: boolean) => void;
  onToggleBranch: (nodeId: string, isCompleted: boolean) => void;
  getBranchState: (leaves: string[]) => boolean | 'indeterminate';
  isMutating: boolean;
  noteLeafIds?: Set<string>;
  resourceCounts?: Record<string, number>;
  onOpenNote?: (leafId: string, leafTitle: string) => void;
  onOpenResource?: (nodeId: string, nodeType: 'subtopic' | 'module', nodeTitle: string) => void;
  academicPlansMap?: Record<string, SubjectAcademicPlanItem>;
  onOpenAcademicPlan?: (subj: Subject) => void;
  onOpenFlashcards?: (leafId: string, leafTitle: string) => void;
  onOpenStudyAssistant?: (leafId: string, leafTitle: string) => void;
}

const YearCard: React.FC<YearCardProps> = ({
  year,
  yearLeaves,
  yearState,
  isExpanded,
  progress,
  completedSet,
  nodeProgress,
  pacingData,
  onSetDeadline,
  onClearDeadline,
  expandedNodes,
  highlightedNodeId,
  onToggleExpand,
  onToggleLeaf,
  onToggleBranch,
  getBranchState,
  isMutating,
  noteLeafIds,
  resourceCounts,
  onOpenNote,
  onOpenResource,
  academicPlansMap,
  onOpenAcademicPlan,
  onOpenFlashcards,
  onOpenStudyAssistant,
}) => {
  const contentId = `year-content-${year.id}`;
  const isTarget = highlightedNodeId === year.id;

  return (
    <div
      data-node-id={year.id}
      data-testid={`year-card-${year.id}`}
      className={`border rounded-2xl shadow-xs overflow-hidden transition-all duration-200 pl-0 ${
        isTarget
          ? 'ring-2 ring-emerald-500/80 shadow-[0_0_20px_rgba(16,185,129,0.3)] highlight-target border-emerald-500/50'
          : 'border-[var(--border-subtle)] bg-[var(--bg-surface)]'
      }`}
    >
      {/* Year Header */}
      <div className="flex items-center justify-between p-3.5 sm:p-4 bg-[var(--bg-surface-elevated)] border-b border-[var(--border-subtle)] transition-colors">
        <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap min-w-0">
          <button
            type="button"
            onClick={() => onToggleExpand(year.id)}
            aria-expanded={isExpanded}
            aria-controls={contentId}
            aria-label={`Toggle ${year.title}`}
            className="p-2 sm:p-1 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center rounded-md hover:bg-[var(--bg-surface-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors focus:outline-hidden focus:ring-2 focus:ring-emerald-500/50 cursor-pointer"
          >
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-300 ease-in-out motion-reduce:transition-none ${
                isExpanded ? 'rotate-0' : '-rotate-90'
              }`}
            />
          </button>

          <BranchCheckbox
            state={yearState}
            disabled={isMutating || yearLeaves.length === 0}
            onToggle={() => onToggleBranch(year.id, yearState !== true)}
            ariaLabel={`Select all topics in ${year.title}`}
          />

          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Tier 1 &bull;
            </span>
            <h3 className="text-base font-bold text-[var(--text-primary)] break-words break-anywhere">
              {year.title}
            </h3>
          </div>
        </div>

        {progress && (
          <div className="w-36 hidden sm:block">
            <ProgressBar progress={progress} size="sm" showLabel={true} />
          </div>
        )}
      </div>

      {/* Year Content: Semesters */}
      <CollapsibleWrapper isExpanded={isExpanded} contentId={contentId}>
        <div className="p-4 space-y-4">
          {(year.semesters || []).map((sem) => (
            <SemesterCard
              key={sem.id}
              sem={sem}
              completedSet={completedSet}
              nodeProgress={nodeProgress}
              pacingData={pacingData}
              onSetDeadline={onSetDeadline}
              onClearDeadline={onClearDeadline}
              expandedNodes={expandedNodes}
              highlightedNodeId={highlightedNodeId}
              onToggleExpand={onToggleExpand}
              onToggleLeaf={onToggleLeaf}
              onToggleBranch={onToggleBranch}
              getBranchState={getBranchState}
              isMutating={isMutating}
              noteLeafIds={noteLeafIds}
              resourceCounts={resourceCounts}
              onOpenNote={onOpenNote}
              onOpenResource={onOpenResource}
              academicPlansMap={academicPlansMap}
              onOpenAcademicPlan={onOpenAcademicPlan}
              onOpenFlashcards={onOpenFlashcards}
              onOpenStudyAssistant={onOpenStudyAssistant}
            />
          ))}
        </div>
      </CollapsibleWrapper>
    </div>
  );
};

/* ========================================================================= */
/* 2. Semester Card                                                          */
/* ========================================================================= */
interface SemesterCardProps {
  sem: Semester;
  completedSet: Set<string>;
  nodeProgress: Record<string, ProgressSummary>;
  pacingData?: Record<string, PacingMetrics>;
  onSetDeadline?: (payload: SetTargetDatePayload) => Promise<void>;
  onClearDeadline?: (nodeId: string) => Promise<void>;
  expandedNodes: Record<string, boolean>;
  highlightedNodeId: string | null;
  onToggleExpand: (id: string) => void;
  onToggleLeaf: (leafId: string, isCompleted: boolean) => void;
  onToggleBranch: (nodeId: string, isCompleted: boolean) => void;
  getBranchState: (leaves: string[]) => boolean | 'indeterminate';
  isMutating: boolean;
  noteLeafIds?: Set<string>;
  resourceCounts?: Record<string, number>;
  onOpenNote?: (leafId: string, leafTitle: string) => void;
  onOpenResource?: (nodeId: string, nodeType: 'subtopic' | 'module', nodeTitle: string) => void;
  academicPlansMap?: Record<string, SubjectAcademicPlanItem>;
  onOpenAcademicPlan?: (subj: Subject) => void;
  onOpenFlashcards?: (leafId: string, leafTitle: string) => void;
  onOpenStudyAssistant?: (leafId: string, leafTitle: string) => void;
}

const SemesterCard: React.FC<SemesterCardProps> = ({
  sem,
  completedSet,
  nodeProgress,
  pacingData,
  onSetDeadline,
  onClearDeadline,
  expandedNodes,
  highlightedNodeId,
  onToggleExpand,
  onToggleLeaf,
  onToggleBranch,
  getBranchState,
  isMutating,
  noteLeafIds,
  resourceCounts,
  onOpenNote,
  onOpenResource,
  academicPlansMap,
  onOpenAcademicPlan,
  onOpenFlashcards,
  onOpenStudyAssistant,
}) => {
  const semLeaves = getSemesterLeaves(sem);
  const semState = getBranchState(semLeaves);
  const isExpanded = !!expandedNodes[sem.id];
  const prog =
    nodeProgress[sem.id] || computeLocalProgress(semLeaves, completedSet);
  const contentId = `semester-content-${sem.id}`;
  const subjects = getSemesterSubjects(sem);
  const isTarget = highlightedNodeId === sem.id;

  return (
    <div
      data-node-id={sem.id}
      data-testid={`semester-card-${sem.id}`}
      className={`border rounded-xl overflow-hidden transition-all duration-200 ml-2.5 md:ml-4 ${
        isTarget
          ? 'ring-2 ring-emerald-500/80 shadow-[0_0_20px_rgba(16,185,129,0.3)] highlight-target border-emerald-500/50'
          : 'border-[var(--border-subtle)] bg-[var(--bg-surface)]'
      }`}
    >
      {/* Semester Header */}
      <div className="flex items-center justify-between p-3 sm:p-3.5 bg-[var(--bg-surface-elevated)]/80 border-b border-[var(--border-subtle)] transition-colors">
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap min-w-0">
          <button
            type="button"
            onClick={() => onToggleExpand(sem.id)}
            aria-expanded={isExpanded}
            aria-controls={contentId}
            aria-label={`Toggle ${sem.title}`}
            className="p-2 sm:p-1 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center rounded-md hover:bg-[var(--bg-surface-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors focus:outline-hidden focus:ring-2 focus:ring-emerald-500/50 cursor-pointer"
          >
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-300 ease-in-out motion-reduce:transition-none ${
                isExpanded ? 'rotate-0' : '-rotate-90'
              }`}
            />
          </button>

          <BranchCheckbox
            state={semState}
            disabled={isMutating || semLeaves.length === 0}
            onToggle={() => onToggleBranch(sem.id, semState !== true)}
            ariaLabel={`Select all topics in ${sem.title}`}
          />

          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <Layers className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <h4 className="text-sm font-bold text-[var(--text-primary)] break-words break-anywhere">
              {sem.title}
            </h4>
          </div>

          {/* Option-A: Semester Pacing Badge */}
          {onSetDeadline && onClearDeadline && (
            <PacingBadge
              metrics={pacingData?.[sem.id]}
              nodeId={sem.id}
              nodeType="semester"
              onSetDeadline={onSetDeadline}
              onClearDeadline={onClearDeadline}
            />
          )}
        </div>

        {prog && (
          <div className="w-32 hidden sm:block">
            <ProgressBar progress={prog} size="sm" showLabel={true} />
          </div>
        )}
      </div>

      {/* Semester Content: Subjects */}
      <CollapsibleWrapper isExpanded={isExpanded} contentId={contentId}>
        <div className="p-3 space-y-3">
          {subjects.map((subj) => (
            <SubjectCard
              key={subj.id}
              subj={subj}
              completedSet={completedSet}
              nodeProgress={nodeProgress}
              pacingData={pacingData}
              onSetDeadline={onSetDeadline}
              onClearDeadline={onClearDeadline}
              expandedNodes={expandedNodes}
              highlightedNodeId={highlightedNodeId}
              onToggleExpand={onToggleExpand}
              onToggleLeaf={onToggleLeaf}
              onToggleBranch={onToggleBranch}
              getBranchState={getBranchState}
              isMutating={isMutating}
              noteLeafIds={noteLeafIds}
              resourceCounts={resourceCounts}
              onOpenNote={onOpenNote}
              onOpenResource={onOpenResource}
              academicPlansMap={academicPlansMap}
              onOpenAcademicPlan={onOpenAcademicPlan}
              onOpenFlashcards={onOpenFlashcards}
              onOpenStudyAssistant={onOpenStudyAssistant}
            />
          ))}
        </div>
      </CollapsibleWrapper>
    </div>
  );
};

/* ========================================================================= */
/* 3. Subject Card                                                           */
/* ========================================================================= */
interface SubjectCardProps {
  subj: Subject;
  completedSet: Set<string>;
  nodeProgress: Record<string, ProgressSummary>;
  pacingData?: Record<string, PacingMetrics>;
  onSetDeadline?: (payload: SetTargetDatePayload) => Promise<void>;
  onClearDeadline?: (nodeId: string) => Promise<void>;
  expandedNodes: Record<string, boolean>;
  highlightedNodeId: string | null;
  onToggleExpand: (id: string) => void;
  onToggleLeaf: (leafId: string, isCompleted: boolean) => void;
  onToggleBranch: (nodeId: string, isCompleted: boolean) => void;
  getBranchState: (leaves: string[]) => boolean | 'indeterminate';
  isMutating: boolean;
  noteLeafIds?: Set<string>;
  resourceCounts?: Record<string, number>;
  onOpenNote?: (leafId: string, leafTitle: string) => void;
  onOpenResource?: (nodeId: string, nodeType: 'subtopic' | 'module', nodeTitle: string) => void;
  academicPlansMap?: Record<string, SubjectAcademicPlanItem>;
  onOpenAcademicPlan?: (subj: Subject) => void;
  onOpenFlashcards?: (leafId: string, leafTitle: string) => void;
  onOpenStudyAssistant?: (leafId: string, leafTitle: string) => void;
}

const SubjectCard: React.FC<SubjectCardProps> = ({
  subj,
  completedSet,
  nodeProgress,
  pacingData,
  onSetDeadline,
  onClearDeadline,
  expandedNodes,
  highlightedNodeId,
  onToggleExpand,
  onToggleLeaf,
  onToggleBranch,
  getBranchState,
  isMutating,
  noteLeafIds,
  resourceCounts,
  onOpenNote,
  onOpenResource,
  academicPlansMap,
  onOpenAcademicPlan,
  onOpenFlashcards,
  onOpenStudyAssistant,
}) => {
  const isEnrolled = isSubjectEnrolled(subj);
  const subjLeaves = getSubjectLeaves(subj, isEnrolled);
  const subjState = getBranchState(subjLeaves);
  const isExpanded = !!expandedNodes[subj.id];
  const prog =
    nodeProgress[subj.id] || computeLocalProgress(subjLeaves, completedSet);
  const contentId = `subject-content-${subj.id}`;
  const isTarget = highlightedNodeId === subj.id;

  const plan = academicPlansMap?.[subj.id];
  const effectiveCredits =
    plan?.effective_credits !== undefined && plan?.effective_credits !== null
      ? plan.effective_credits
      : subj.credits !== undefined && subj.credits !== null
      ? subj.credits
      : null;

  const needsReview = Boolean(
    (subj as unknown as { evidence_status?: string }).evidence_status === 'needs_review' ||
    (subj as unknown as { grounding_status?: string }).grounding_status === 'needs_review'
  );

  return (
    <div
      data-node-id={subj.id}
      data-testid={`subject-card-${subj.id}`}
      className={`border rounded-xl overflow-hidden transition-all duration-200 ml-2.5 md:ml-4 ${
        isTarget
          ? 'ring-2 ring-emerald-500/80 shadow-[0_0_20px_rgba(16,185,129,0.3)] highlight-target border-emerald-500/50'
          : isEnrolled
          ? 'border-[var(--border-subtle)] bg-[var(--bg-surface)]'
          : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)]/60 opacity-75'
      }`}
    >
      {/* Subject Header */}
      <div className="flex items-center justify-between p-2.5 sm:p-3 bg-[var(--bg-surface-elevated)]/60 hover:bg-[var(--bg-surface-hover)] border-b border-[var(--border-subtle)] transition-colors">
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onToggleExpand(subj.id)}
            aria-expanded={isExpanded}
            aria-controls={contentId}
            aria-label={`Toggle ${subj.title}`}
            className="p-2 sm:p-1 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center rounded-md hover:bg-[var(--bg-surface-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors focus:outline-hidden focus:ring-2 focus:ring-blue-500/50 cursor-pointer"
          >
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-300 ease-in-out motion-reduce:transition-none ${
                isExpanded ? 'rotate-0' : '-rotate-90'
              }`}
            />
          </button>

          <BranchCheckbox
            state={subjState}
            disabled={isMutating || subjLeaves.length === 0}
            onToggle={() => onToggleBranch(subj.id, subjState !== true)}
            ariaLabel={`Select all topics in ${subj.title}`}
          />

          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0 flex-1">
            <BookOpen className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 shrink-0" />
            {subj.code && (
              <span className="px-1.5 py-0.5 text-[11px] font-mono tabular-nums font-medium rounded bg-blue-500/10 text-blue-600 dark:text-blue-300 border border-blue-500/20 shrink-0">
                {subj.code}
              </span>
            )}
            <h5 className="text-xs font-semibold text-[var(--text-primary)] break-words break-anywhere">{subj.title}</h5>

            {/* Credit Badge: show compact monospace badge like '4 Cr' only when effective credits > 0 */}
            {effectiveCredits !== null && effectiveCredits > 0 && (
              <span
                data-testid={`badge-credit-${subj.id}`}
                className="px-1.5 py-0.5 text-[10px] font-mono tabular-nums font-semibold rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0"
                title={`Academic Weight: ${effectiveCredits} Credits`}
              >
                {effectiveCredits} Cr
              </span>
            )}

            {/* Academic Plan Modal Trigger */}
            {isEnrolled && onOpenAcademicPlan && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenAcademicPlan(subj);
                }}
                data-testid={`btn-academic-plan-${subj.id}`}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded hover:bg-[var(--bg-surface-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-transparent hover:border-[var(--border-subtle)] transition-colors cursor-pointer shrink-0"
                title="Configure Credits and Target Grade"
                aria-label={`Configure Credits and Grade for ${subj.title}`}
              >
                <GraduationCap className="w-3 h-3 text-emerald-500" />
                <span className="hidden sm:inline">Credits / GPA</span>
              </button>
            )}


            {/* Badges */}
            {subj.is_lab && (
              <span
                data-testid={`badge-lab-${subj.id}`}
                className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-500/20 shrink-0"
              >
                Lab Course
              </span>
            )}

            {subj.is_elective && (
              <span
                data-testid={`badge-elective-${subj.id}`}
                className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20 shrink-0"
              >
                {subj.elective_group || 'Elective'}
              </span>
            )}

            {!isEnrolled && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-[var(--bg-surface-hover)] text-[var(--text-muted)] border border-[var(--border-subtle)] shrink-0">
                Excluded
              </span>
            )}

            {needsReview && (
              <span
                data-testid={`badge-needs-review-${subj.id}`}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-500/20 shrink-0"
                title="This heading or extracted snippet has low structural confidence and may require manual verification."
                role="status"
              >
                <AlertCircle className="w-2.5 h-2.5" />
                <span>Needs Review</span>
              </span>
            )}

            {/* Pacing Badge for Enrolled Subject */}
            {isEnrolled && onSetDeadline && onClearDeadline && (
              <PacingBadge
                metrics={pacingData?.[subj.id]}
                nodeId={subj.id}
                nodeType="subject"
                onSetDeadline={onSetDeadline}
                onClearDeadline={onClearDeadline}
              />
            )}
          </div>
        </div>

        {prog && isEnrolled && (
          <div className="w-28 hidden sm:block shrink-0">
            <ProgressBar progress={prog} size="sm" showLabel={true} />
          </div>
        )}
      </div>

      {/* Subject Content: Modules */}
      <CollapsibleWrapper isExpanded={isExpanded} contentId={contentId}>
        <div className="p-2.5 space-y-2.5">
          {(subj.modules || []).map((mod) => (
            <ModuleCard
              key={mod.id}
              mod={mod}
              completedSet={completedSet}
              nodeProgress={nodeProgress}
              expandedNodes={expandedNodes}
              highlightedNodeId={highlightedNodeId}
              onToggleExpand={onToggleExpand}
              onToggleLeaf={onToggleLeaf}
              onToggleBranch={onToggleBranch}
              getBranchState={getBranchState}
              isMutating={isMutating}
              noteLeafIds={noteLeafIds}
              resourceCounts={resourceCounts}
              onOpenNote={onOpenNote}
              onOpenResource={onOpenResource}
              academicPlansMap={academicPlansMap}
              onOpenAcademicPlan={onOpenAcademicPlan}
              onOpenFlashcards={onOpenFlashcards}
              onOpenStudyAssistant={onOpenStudyAssistant}
            />
          ))}
        </div>
      </CollapsibleWrapper>
    </div>
  );
};

/* ========================================================================= */
/* 4. Module Card                                                            */
/* ========================================================================= */
interface ModuleCardProps {
  mod: Module;
  completedSet: Set<string>;
  nodeProgress: Record<string, ProgressSummary>;
  expandedNodes: Record<string, boolean>;
  highlightedNodeId: string | null;
  onToggleExpand: (id: string) => void;
  onToggleLeaf: (leafId: string, isCompleted: boolean) => void;
  onToggleBranch: (nodeId: string, isCompleted: boolean) => void;
  getBranchState: (leaves: string[]) => boolean | 'indeterminate';
  isMutating: boolean;
  noteLeafIds?: Set<string>;
  resourceCounts?: Record<string, number>;
  onOpenNote?: (leafId: string, leafTitle: string) => void;
  onOpenResource?: (nodeId: string, nodeType: 'subtopic' | 'module', nodeTitle: string) => void;
  onOpenFlashcards?: (leafId: string, leafTitle: string) => void;
  onOpenStudyAssistant?: (leafId: string, leafTitle: string) => void;
}

const ModuleCard: React.FC<ModuleCardProps> = ({
  mod,
  completedSet,
  nodeProgress,
  expandedNodes,
  highlightedNodeId,
  onToggleExpand,
  onToggleLeaf,
  onToggleBranch,
  getBranchState,
  isMutating,
  noteLeafIds,
  resourceCounts,
  onOpenNote,
  onOpenResource,
  onOpenFlashcards,
  onOpenStudyAssistant,
}) => {
  const modLeaves = getModuleLeaves(mod);
  const modState = getBranchState(modLeaves);
  const isExpanded = !!expandedNodes[mod.id];
  const prog =
    nodeProgress[mod.id] || computeLocalProgress(modLeaves, completedSet);
  const contentId = `module-content-${mod.id}`;
  const isTarget = highlightedNodeId === mod.id;

  // Contact hour badge hygiene: strictly conditional on positive finite number
  const shouldRenderContactHours =
    typeof mod.contact_hours === 'number' &&
    Number.isFinite(mod.contact_hours) &&
    mod.contact_hours > 0;

  const needsReview = Boolean(
    (mod as unknown as { evidence_status?: string }).evidence_status === 'needs_review' ||
    (mod as unknown as { grounding_status?: string }).grounding_status === 'needs_review'
  );

  const modResCount = resourceCounts?.[mod.id] || 0;

  return (
    <div
      data-node-id={mod.id}
      data-testid={`module-card-${mod.id}`}
      className={`border rounded-lg overflow-hidden transition-all duration-200 ml-2 md:ml-4 ${
        isTarget
          ? 'ring-2 ring-emerald-500/80 shadow-[0_0_20px_rgba(16,185,129,0.3)] highlight-target border-emerald-500/50'
          : 'border-[var(--border-hairline)] bg-[var(--bg-surface-elevated)]/40'
      }`}
    >
      {/* Module Header */}
      <div className="flex items-center justify-between p-2.5 bg-[var(--bg-surface-elevated)]/70 hover:bg-[var(--bg-surface-hover)] border-b border-[var(--border-hairline)] transition-colors">
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onToggleExpand(mod.id)}
            aria-expanded={isExpanded}
            aria-controls={contentId}
            aria-label={`Toggle ${mod.title}`}
            className="p-2 sm:p-1 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center rounded-md hover:bg-[var(--bg-surface-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors focus:outline-hidden focus:ring-2 focus:ring-emerald-500/50 cursor-pointer"
          >
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-300 ease-in-out motion-reduce:transition-none ${
                isExpanded ? 'rotate-0' : '-rotate-90'
              }`}
            />
          </button>

          <BranchCheckbox
            state={modState}
            disabled={isMutating || modLeaves.length === 0}
            onToggle={() => onToggleBranch(mod.id, modState !== true)}
            ariaLabel={`Select all topics in ${mod.title}`}
          />

          <div className="flex items-center gap-1.5 flex-wrap min-w-0 flex-1">
            <Folder className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400/80 shrink-0" />
            {mod.module_number && (
              <span className="text-[11px] font-mono tabular-nums text-emerald-600 dark:text-emerald-400 font-medium shrink-0">
                {mod.module_number}:
              </span>
            )}
            <h6 className="text-xs font-semibold text-[var(--text-primary)] break-words break-anywhere">{mod.title}</h6>

            {/* Contact hours badge: strictly rendered when positive finite number, NO negative placeholders */}
            {shouldRenderContactHours && (
              <span
                data-testid={`badge-contact-hours-${mod.id}`}
                className="px-1.5 py-0.5 text-[10px] font-mono tabular-nums rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border border-emerald-500/20 shrink-0"
              >
                {mod.contact_hours} Contact Hrs
              </span>
            )}

            {needsReview && (
              <span
                data-testid={`badge-needs-review-${mod.id}`}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-500/20 shrink-0"
                title="This heading or extracted snippet has low structural confidence and may require manual verification."
                role="status"
              >
                <AlertCircle className="w-2.5 h-2.5" />
                <span>Needs Review</span>
              </span>
            )}

            {/* Module Resources Button */}
            {onOpenResource && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenResource(mod.id, 'module', mod.title);
                }}
                className={`px-2 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                  modResCount > 0
                    ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/20'
                    : 'text-[var(--text-muted)] hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-[var(--bg-surface-hover)] border border-transparent'
                }`}
                title={modResCount > 0 ? `${modResCount} resource(s) attached` : 'Add module resources'}
                aria-label={`Open resources for module ${mod.title}`}
              >
                <Link2 className="w-3 h-3" />
                <span>Resources</span>
                {modResCount > 0 && (
                  <span className="ml-0.5 px-1 py-0.2 text-[9px] font-bold rounded-full bg-indigo-600 text-white">
                    {modResCount}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>

        {prog && (
          <div className="w-24 hidden sm:block shrink-0">
            <ProgressBar progress={prog} size="sm" showLabel={true} />
          </div>
        )}
      </div>

      {/* Module Content: Topic Leaf Rows */}
      <CollapsibleWrapper isExpanded={isExpanded} contentId={contentId}>
        <div className="divide-y divide-[var(--border-hairline)] bg-[var(--bg-canvas)]/30">
          {(mod.topics || []).map((topic) => (
            <TopicLeafRow
              key={topic.id}
              topic={topic}
              isCompleted={completedSet.has(topic.id)}
              disabled={isMutating}
              highlightedNodeId={highlightedNodeId}
              onToggleLeaf={onToggleLeaf}
              hasNote={noteLeafIds ? noteLeafIds.has(topic.id) : false}
              resourceCount={resourceCounts ? resourceCounts[topic.id] || 0 : 0}
              onOpenNote={onOpenNote}
              onOpenResource={onOpenResource}
              onOpenFlashcards={onOpenFlashcards}
              onOpenStudyAssistant={onOpenStudyAssistant}
            />
          ))}
        </div>
      </CollapsibleWrapper>
    </div>
  );
};

/* ========================================================================= */
/* 5. Topic Leaf Row                                                         */
/* ========================================================================= */
interface TopicLeafRowProps {
  topic: Subtopic;
  isCompleted: boolean;
  disabled: boolean;
  highlightedNodeId: string | null;
  onToggleLeaf: (leafId: string, isCompleted: boolean) => void;
  hasNote?: boolean;
  resourceCount?: number;
  onOpenNote?: (leafId: string, leafTitle: string) => void;
  onOpenResource?: (nodeId: string, nodeType: 'subtopic' | 'module', nodeTitle: string) => void;
  onOpenFlashcards?: (leafId: string, leafTitle: string) => void;
  onOpenStudyAssistant?: (leafId: string, leafTitle: string) => void;
}

const TopicLeafRow: React.FC<TopicLeafRowProps> = ({
  topic,
  isCompleted,
  disabled,
  highlightedNodeId,
  onToggleLeaf,
  hasNote = false,
  resourceCount = 0,
  onOpenNote,
  onOpenResource,
  onOpenFlashcards,
  onOpenStudyAssistant,
}) => {
  const checkboxId = useId();
  const isTarget = highlightedNodeId === topic.id;

  const rawStatus = topic.grounding_status || topic.evidence_status;
  const isNeedsReview =
    rawStatus === 'needs_review' ||
    rawStatus === 'review_required' ||
    (rawStatus && rawStatus !== 'verified');

  return (
    <div
      data-node-id={topic.id}
      data-testid={`topic-row-${topic.id}`}
      className={`flex items-center justify-between px-2.5 py-1.5 sm:px-3 sm:py-2 pl-2 md:pl-4 transition-all duration-200 group min-h-[44px] ${
        isTarget
          ? 'ring-2 ring-emerald-500/80 bg-emerald-500/10 shadow-[0_0_16px_rgba(16,185,129,0.25)] highlight-target'
          : 'hover:bg-[var(--bg-surface-hover)]'
      }`}
    >
      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
        <label
          htmlFor={checkboxId}
          className="flex items-center gap-2.5 cursor-pointer select-none min-w-0 flex-1 min-h-[44px] py-1"
        >
          <input
            id={checkboxId}
            type="checkbox"
            checked={isCompleted}
            disabled={disabled}
            onChange={(e) => onToggleLeaf(topic.id, e.target.checked)}
            className="w-4 h-4 rounded border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] text-emerald-600 dark:text-emerald-500 focus:ring-emerald-500/50 focus:ring-offset-[var(--bg-canvas)] cursor-pointer transition-colors shrink-0"
          />
          <span
            className={`text-xs transition-colors break-words break-anywhere leading-snug ${
              isCompleted
                ? 'line-through text-[var(--text-muted)]'
                : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'
            }`}
            title={topic.title}
          >
            {topic.title}
          </span>
        </label>

        {isNeedsReview && (
          <span
            data-testid={`badge-needs-review-${topic.id}`}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-500/20 shrink-0"
            title="This heading or extracted snippet has low structural confidence and may require manual verification."
            role="status"
          >
            <AlertCircle className="w-2.5 h-2.5" />
            <span className="hidden sm:inline">Needs Review</span>
          </span>
        )}
      </div>

      {/* Modernized Compact Right-Aligned Action Cluster with accessible touch targets */}
      <div className="shrink-0 ml-2 flex items-center gap-1 sm:gap-1.5">
        {onOpenNote && (
          <button
            type="button"
            data-testid={`note-btn-${topic.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onOpenNote(topic.id, topic.title);
            }}
            className={`min-h-[44px] min-w-[36px] sm:min-h-0 sm:min-w-0 p-2 sm:p-1 rounded-md transition-colors cursor-pointer flex items-center justify-center focus:outline-hidden focus:ring-2 focus:ring-amber-500/50 ${
              hasNote
                ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20'
                : 'text-[var(--text-muted)] hover:text-amber-600 dark:hover:text-amber-300 hover:bg-[var(--bg-surface-hover)]'
            }`}
            title={hasNote ? 'Edit study notes (Notes present)' : 'Add study notes'}
            aria-label={`Notes for ${topic.title}`}
          >
            <FileText className="w-3.5 h-3.5" />
          </button>
        )}

        {onOpenResource && (
          <button
            type="button"
            data-testid={`resource-btn-${topic.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onOpenResource(topic.id, 'subtopic', topic.title);
            }}
            className={`min-h-[44px] min-w-[36px] sm:min-h-0 sm:min-w-0 px-2 sm:px-1.5 py-1 sm:py-0.5 rounded-md text-[10px] flex items-center justify-center gap-1 transition-colors cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50 ${
              resourceCount > 0
                ? 'text-indigo-600 dark:text-indigo-300 bg-indigo-500/10 border border-indigo-500/30 hover:bg-indigo-500/20'
                : 'text-[var(--text-muted)] hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-[var(--bg-surface-hover)] border border-transparent'
            }`}
            title={resourceCount > 0 ? `${resourceCount} resource(s) attached` : 'Add learning resource'}
            aria-label={`Resources for ${topic.title}`}
          >
            <Link2 className="w-3.5 h-3.5" />
            {resourceCount > 0 && <span className="font-semibold text-[9px] tabular-nums">{resourceCount}</span>}
          </button>
        )}

        {onOpenFlashcards && (
          <button
            type="button"
            data-testid={`flashcards-btn-${topic.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onOpenFlashcards(topic.id, topic.title);
            }}
            className="min-h-[44px] min-w-[36px] sm:min-h-0 sm:min-w-0 p-2 sm:p-1 rounded-md text-[var(--text-muted)] hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors cursor-pointer flex items-center justify-center focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50"
            title="Active Recall Flashcards"
            aria-label={`Flashcards for ${topic.title}`}
          >
            <Sparkles className="w-3.5 h-3.5" />
          </button>
        )}

        {onOpenStudyAssistant && (
          <button
            type="button"
            data-testid={`ask-assistant-btn-${topic.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onOpenStudyAssistant(topic.id, topic.title);
            }}
            className="min-h-[44px] min-w-[36px] sm:min-h-0 sm:min-w-0 p-2 sm:p-1 rounded-md text-[var(--text-muted)] hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer flex items-center justify-center focus:outline-hidden focus:ring-2 focus:ring-emerald-500/50"
            title="Ask AI about this topic"
            aria-label={`Ask AI about ${topic.title}`}
          >
            <Bot className="w-3.5 h-3.5" />
          </button>
        )}

        <SourceEvidence subtopic={topic} />
      </div>
    </div>
  );
};

/* ========================================================================= */
/* Radix UI Tri-State Branch Checkbox                                        */
/* ========================================================================= */
interface BranchCheckboxProps {
  state: boolean | 'indeterminate';
  disabled?: boolean;
  onToggle: () => void;
  ariaLabel: string;
}

const BranchCheckbox: React.FC<BranchCheckboxProps> = ({
  state,
  disabled = false,
  onToggle,
  ariaLabel,
}) => {
  return (
    <div className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center shrink-0 -m-2 sm:m-0">
      <Checkbox.Root
        checked={state}
        disabled={disabled}
        onCheckedChange={onToggle}
        aria-label={ariaLabel}
        className={`w-4 h-4 rounded-md flex items-center justify-center border transition-colors ${
          state === true
            ? 'bg-emerald-600 dark:bg-emerald-500 border-emerald-600 dark:border-emerald-500 text-white dark:text-gray-950 shadow-[0_0_8px_rgba(16,185,129,0.4)]'
            : state === 'indeterminate'
            ? 'bg-emerald-950/80 border-emerald-500 text-emerald-400'
            : 'bg-[var(--bg-surface-elevated)] border-[var(--border-strong)] hover:border-[var(--text-muted)]'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <Checkbox.Indicator>
          {state === true && <Check className="w-3 h-3 stroke-[3]" />}
          {state === 'indeterminate' && <Minus className="w-3 h-3 stroke-[3]" />}
        </Checkbox.Indicator>
      </Checkbox.Root>
    </div>
  );
};
