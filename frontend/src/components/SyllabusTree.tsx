import React, { useState, useId } from 'react';
import * as Checkbox from '@radix-ui/react-checkbox';
import {
  AlertCircle,
  BookOpen,
  Calendar,
  Check,
  ChevronDown,
  Folder,
  Layers,
  Minus,
} from 'lucide-react';
import type {
  AcademicYear,
  HierarchicalSyllabus,
  Module,
  ProgressSummary,
  Semester,
  Subject,
  Subtopic,
} from '../types/syllabus';
import { ProgressBar } from './ProgressBar';
import { SourceEvidence } from './SourceEvidence';

interface SyllabusTreeProps {
  syllabus: HierarchicalSyllabus;
  completedLeafIds: string[];
  nodeProgress: Record<string, ProgressSummary>;
  onToggleLeaf: (leafId: string, isCompleted: boolean) => void;
  onToggleBranch: (nodeId: string, isCompleted: boolean) => void;
  isMutating?: boolean;
}

// Helper to normalize subjects from either 5-level canonical subjects or legacy 4-level topics
function getSemesterSubjects(sem: Semester): Subject[] {
  if (sem.subjects && sem.subjects.length > 0) {
    return sem.subjects;
  }
  if (sem.topics && sem.topics.length > 0) {
    return sem.topics.map((t, idx) => ({
      id: `subj_${t.id}`,
      code: null,
      title: t.title,
      order_index: t.order_index ?? idx,
      modules: [
        {
          id: t.id, // preserve legacy topic id so existing leaf resolution and node_progress match
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

// Helper to collect all descendant topic leaf IDs for a module
function getModuleLeaves(mod: Module): string[] {
  return (mod.topics || []).map((t) => t.id);
}

// Helper to collect all descendant topic leaf IDs for a subject
function getSubjectLeaves(subj: Subject): string[] {
  return (subj.modules || []).flatMap(getModuleLeaves);
}

// Helper to collect all descendant topic leaf IDs for a semester
function getSemesterLeaves(sem: Semester): string[] {
  return getSemesterSubjects(sem).flatMap(getSubjectLeaves);
}

// Helper to collect all descendant topic leaf IDs for a year
function getYearLeaves(year: AcademicYear): string[] {
  return (year.semesters || []).flatMap(getSemesterLeaves);
}

export const SyllabusTree: React.FC<SyllabusTreeProps> = ({
  syllabus,
  completedLeafIds,
  nodeProgress,
  onToggleLeaf,
  onToggleBranch,
  isMutating = false,
}) => {
  const completedSet = new Set(completedLeafIds);

  // Initialize all containers as expanded by default
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    syllabus.years.forEach((yr) => {
      initial[yr.id] = true;
      (yr.semesters || []).forEach((sem) => {
        initial[sem.id] = true;
        const subjects = getSemesterSubjects(sem);
        subjects.forEach((subj) => {
          initial[subj.id] = true;
          (subj.modules || []).forEach((mod) => {
            initial[mod.id] = true;
          });
        });
      });
    });
    return initial;
  });

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
            onToggleExpand={toggleExpand}
            onToggleLeaf={onToggleLeaf}
            onToggleBranch={onToggleBranch}
            getBranchState={getBranchState}
            isMutating={isMutating}
          />
        );
      })}
    </div>
  );
};

function computeLocalProgress(
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
      role="region"
      aria-hidden={!isExpanded}
      className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out motion-reduce:transition-none ${
        isExpanded
          ? 'grid-rows-[1fr] opacity-100'
          : 'grid-rows-[0fr] opacity-0 pointer-events-none'
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
  progress?: ProgressSummary;
  completedSet: Set<string>;
  nodeProgress: Record<string, ProgressSummary>;
  expandedNodes: Record<string, boolean>;
  onToggleExpand: (id: string) => void;
  onToggleLeaf: (leafId: string, isCompleted: boolean) => void;
  onToggleBranch: (nodeId: string, isCompleted: boolean) => void;
  getBranchState: (leaves: string[]) => boolean | 'indeterminate';
  isMutating: boolean;
}

const YearCard: React.FC<YearCardProps> = ({
  year,
  yearLeaves,
  yearState,
  isExpanded,
  progress,
  completedSet,
  nodeProgress,
  expandedNodes,
  onToggleExpand,
  onToggleLeaf,
  onToggleBranch,
  getBranchState,
  isMutating,
}) => {
  const contentId = `year-content-${year.id}`;

  return (
    <div
      data-testid={`year-card-${year.id}`}
      className="border border-gray-800 bg-gray-900/40 rounded-2xl overflow-hidden transition-all shadow-sm"
    >
      {/* Year Header */}
      <div className="flex items-center justify-between p-4 bg-gray-800/40 hover:bg-gray-800/60 border-b border-gray-800/80 transition-colors">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onToggleExpand(year.id)}
            aria-expanded={isExpanded}
            aria-controls={contentId}
            aria-label={`Toggle ${year.title}`}
            className="p-1 rounded-lg hover:bg-gray-700/60 text-gray-400 hover:text-gray-200 transition-colors focus:outline-hidden focus:ring-2 focus:ring-emerald-500/50"
          >
            <ChevronDown
              className={`w-5 h-5 transition-transform duration-300 ease-in-out motion-reduce:transition-none ${
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

          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-400" />
            <h3 className="text-base font-semibold text-gray-100">{year.title}</h3>
          </div>
        </div>

        {progress && (
          <div className="w-36 hidden sm:block">
            <ProgressBar progress={progress} size="sm" showLabel={true} />
          </div>
        )}
      </div>

      {/* Year Body */}
      <CollapsibleWrapper isExpanded={isExpanded} contentId={contentId}>
        <div className="p-3 sm:p-5 space-y-4">
          {(year.semesters || []).map((sem) => (
            <SemesterCard
              key={sem.id}
              sem={sem}
              completedSet={completedSet}
              nodeProgress={nodeProgress}
              expandedNodes={expandedNodes}
              onToggleExpand={onToggleExpand}
              onToggleLeaf={onToggleLeaf}
              onToggleBranch={onToggleBranch}
              getBranchState={getBranchState}
              isMutating={isMutating}
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
  expandedNodes: Record<string, boolean>;
  onToggleExpand: (id: string) => void;
  onToggleLeaf: (leafId: string, isCompleted: boolean) => void;
  onToggleBranch: (nodeId: string, isCompleted: boolean) => void;
  getBranchState: (leaves: string[]) => boolean | 'indeterminate';
  isMutating: boolean;
}

const SemesterCard: React.FC<SemesterCardProps> = ({
  sem,
  completedSet,
  nodeProgress,
  expandedNodes,
  onToggleExpand,
  onToggleLeaf,
  onToggleBranch,
  getBranchState,
  isMutating,
}) => {
  const semLeaves = getSemesterLeaves(sem);
  const semState = getBranchState(semLeaves);
  const isExpanded = !!expandedNodes[sem.id];
  const prog =
    nodeProgress[sem.id] || computeLocalProgress(semLeaves, completedSet);
  const subjects = getSemesterSubjects(sem);
  const contentId = `semester-content-${sem.id}`;

  return (
    <div
      data-testid={`semester-card-${sem.id}`}
      className="border border-gray-800/90 bg-gray-950/40 rounded-xl overflow-hidden transition-all"
    >
      {/* Semester Header */}
      <div className="flex items-center justify-between p-3.5 bg-gray-900/50 hover:bg-gray-900/80 border-b border-gray-800/60 transition-colors">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => onToggleExpand(sem.id)}
            aria-expanded={isExpanded}
            aria-controls={contentId}
            aria-label={`Toggle ${sem.title}`}
            className="p-1 rounded-md hover:bg-gray-800 text-gray-400 hover:text-gray-200 transition-colors focus:outline-hidden focus:ring-2 focus:ring-teal-500/50"
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

          <div className="flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-teal-400" />
            <h4 className="text-sm font-medium text-gray-200">{sem.title}</h4>
          </div>
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
              expandedNodes={expandedNodes}
              onToggleExpand={onToggleExpand}
              onToggleLeaf={onToggleLeaf}
              onToggleBranch={onToggleBranch}
              getBranchState={getBranchState}
              isMutating={isMutating}
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
  expandedNodes: Record<string, boolean>;
  onToggleExpand: (id: string) => void;
  onToggleLeaf: (leafId: string, isCompleted: boolean) => void;
  onToggleBranch: (nodeId: string, isCompleted: boolean) => void;
  getBranchState: (leaves: string[]) => boolean | 'indeterminate';
  isMutating: boolean;
}

const SubjectCard: React.FC<SubjectCardProps> = ({
  subj,
  completedSet,
  nodeProgress,
  expandedNodes,
  onToggleExpand,
  onToggleLeaf,
  onToggleBranch,
  getBranchState,
  isMutating,
}) => {
  const subjLeaves = getSubjectLeaves(subj);
  const subjState = getBranchState(subjLeaves);
  const isExpanded = !!expandedNodes[subj.id];
  const prog =
    nodeProgress[subj.id] || computeLocalProgress(subjLeaves, completedSet);
  const contentId = `subject-content-${subj.id}`;

  return (
    <div
      data-testid={`subject-card-${subj.id}`}
      className="border border-gray-800/80 bg-gray-900/30 rounded-xl overflow-hidden transition-all"
    >
      {/* Subject Header */}
      <div className="flex items-center justify-between p-3 bg-gray-900/40 hover:bg-gray-800/50 border-b border-gray-800/50 transition-colors">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onToggleExpand(subj.id)}
            aria-expanded={isExpanded}
            aria-controls={contentId}
            aria-label={`Toggle ${subj.title}`}
            className="p-1 rounded hover:bg-gray-800 text-gray-400 hover:text-gray-200 transition-colors focus:outline-hidden focus:ring-2 focus:ring-blue-500/50"
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

          <div className="flex items-center gap-2">
            <BookOpen className="w-3.5 h-3.5 text-blue-400" />
            {subj.code && (
              <span className="px-1.5 py-0.5 text-[11px] font-mono font-medium rounded bg-blue-950/80 text-blue-300 border border-blue-800/50">
                {subj.code}
              </span>
            )}
            <h5 className="text-xs font-semibold text-gray-200">{subj.title}</h5>
          </div>
        </div>

        {prog && (
          <div className="w-28 hidden sm:block">
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
              onToggleExpand={onToggleExpand}
              onToggleLeaf={onToggleLeaf}
              onToggleBranch={onToggleBranch}
              getBranchState={getBranchState}
              isMutating={isMutating}
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
  onToggleExpand: (id: string) => void;
  onToggleLeaf: (leafId: string, isCompleted: boolean) => void;
  onToggleBranch: (nodeId: string, isCompleted: boolean) => void;
  getBranchState: (leaves: string[]) => boolean | 'indeterminate';
  isMutating: boolean;
}

const ModuleCard: React.FC<ModuleCardProps> = ({
  mod,
  completedSet,
  nodeProgress,
  expandedNodes,
  onToggleExpand,
  onToggleLeaf,
  onToggleBranch,
  getBranchState,
  isMutating,
}) => {
  const modLeaves = getModuleLeaves(mod);
  const modState = getBranchState(modLeaves);
  const isExpanded = !!expandedNodes[mod.id];
  const prog =
    nodeProgress[mod.id] || computeLocalProgress(modLeaves, completedSet);
  const contentId = `module-content-${mod.id}`;

  return (
    <div
      data-testid={`module-card-${mod.id}`}
      className="border border-gray-800/70 bg-gray-900/20 rounded-lg overflow-hidden transition-all"
    >
      {/* Module Header */}
      <div className="flex items-center justify-between p-2.5 bg-gray-900/30 hover:bg-gray-800/40 border-b border-gray-800/40 transition-colors">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onToggleExpand(mod.id)}
            aria-expanded={isExpanded}
            aria-controls={contentId}
            aria-label={`Toggle ${mod.title}`}
            className="p-1 rounded hover:bg-gray-800 text-gray-400 hover:text-gray-200 transition-colors focus:outline-hidden focus:ring-2 focus:ring-emerald-500/50"
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

          <div className="flex items-center gap-1.5">
            <Folder className="w-3.5 h-3.5 text-emerald-400/80" />
            {mod.module_number && (
              <span className="text-[11px] font-mono text-emerald-400 font-medium">
                {mod.module_number}:
              </span>
            )}
            <h6 className="text-xs font-semibold text-gray-200">{mod.title}</h6>
          </div>
        </div>

        {prog && (
          <div className="w-24 hidden sm:block">
            <ProgressBar progress={prog} size="sm" showLabel={true} />
          </div>
        )}
      </div>

      {/* Module Content: Topic Leaf Rows */}
      <CollapsibleWrapper isExpanded={isExpanded} contentId={contentId}>
        <div className="divide-y divide-gray-800/50 bg-gray-950/20">
          {(mod.topics || []).map((topic) => (
            <TopicLeafRow
              key={topic.id}
              topic={topic}
              isCompleted={completedSet.has(topic.id)}
              disabled={isMutating}
              onToggleLeaf={onToggleLeaf}
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
  onToggleLeaf: (leafId: string, isCompleted: boolean) => void;
}

const TopicLeafRow: React.FC<TopicLeafRowProps> = ({
  topic,
  isCompleted,
  disabled,
  onToggleLeaf,
}) => {
  const checkboxId = useId();
  const isVerified =
    (topic.grounding_status || topic.evidence_status) === 'verified';

  return (
    <div
      data-testid={`topic-row-${topic.id}`}
      className="flex items-center justify-between px-3 py-2 hover:bg-gray-800/30 transition-colors group"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <label
          htmlFor={checkboxId}
          className="flex items-center gap-2.5 cursor-pointer select-none min-w-0"
        >
          <input
            id={checkboxId}
            type="checkbox"
            checked={isCompleted}
            disabled={disabled}
            onChange={(e) => onToggleLeaf(topic.id, e.target.checked)}
            className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-emerald-500 focus:ring-emerald-400 focus:ring-offset-gray-900 cursor-pointer transition-colors shrink-0"
          />
          <span
            className={`text-xs transition-colors truncate ${
              isCompleted
                ? 'line-through text-gray-500'
                : 'text-gray-300 group-hover:text-gray-100'
            }`}
            title={topic.title}
          >
            {topic.title}
          </span>
        </label>

        {!isVerified && (
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-amber-950/60 text-amber-300 border border-amber-800/50 shrink-0"
            title="Extraction is not fully verified; evidence review suggested"
          >
            <AlertCircle className="w-2.5 h-2.5" />
            <span>Needs Review</span>
          </span>
        )}
      </div>

      <div className="shrink-0 ml-2">
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
    <Checkbox.Root
      checked={state}
      disabled={disabled}
      onCheckedChange={onToggle}
      aria-label={ariaLabel}
      className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
        state === true
          ? 'bg-emerald-500 border-emerald-500 text-gray-950 shadow-[0_0_8px_rgba(16,185,129,0.4)]'
          : state === 'indeterminate'
          ? 'bg-emerald-950/80 border-emerald-500 text-emerald-400'
          : 'bg-gray-800/80 border-gray-600 hover:border-gray-400'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <Checkbox.Indicator>
        {state === true && <Check className="w-3 h-3 stroke-[3]" />}
        {state === 'indeterminate' && <Minus className="w-3 h-3 stroke-[3]" />}
      </Checkbox.Indicator>
    </Checkbox.Root>
  );
};

