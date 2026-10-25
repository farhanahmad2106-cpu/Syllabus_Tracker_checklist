import React, { useState } from 'react';
import * as Checkbox from '@radix-ui/react-checkbox';
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  Folder,
  Layers,
  Minus,
} from 'lucide-react';
import type {
  HierarchicalSyllabus,
  ProgressSummary,
  Semester,
  Topic,
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

export const SyllabusTree: React.FC<SyllabusTreeProps> = ({
  syllabus,
  completedLeafIds,
  nodeProgress,
  onToggleLeaf,
  onToggleBranch,
  isMutating = false,
}) => {
  const completedSet = new Set(completedLeafIds);

  // Default all years and semesters expanded
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    syllabus.years.forEach((yr) => {
      initial[yr.id] = true;
      yr.semesters.forEach((sem) => {
        initial[sem.id] = true;
        sem.topics.forEach((top) => {
          initial[top.id] = true;
        });
      });
    });
    return initial;
  });

  const toggleExpand = (id: string) => {
    setExpandedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Helper to compute tri-state branch checkbox status from descendant leaves
  const getBranchState = (descendantLeaves: string[]): boolean | 'indeterminate' => {
    if (descendantLeaves.length === 0) return false;
    const completedCount = descendantLeaves.filter((id) => completedSet.has(id)).length;
    if (completedCount === 0) return false;
    if (completedCount === descendantLeaves.length) return true;
    return 'indeterminate';
  };

  return (
    <div className="space-y-4">
      {syllabus.years.map((year) => {
        const yearLeaves = year.semesters.flatMap((s) =>
          s.topics.flatMap((t) => t.subtopics.map((sub) => sub.id))
        );
        const yearState = getBranchState(yearLeaves);
        const isExpanded = !!expandedNodes[year.id];
        const prog = nodeProgress[year.id];

        return (
          <div
            key={year.id}
            className="border border-gray-800 bg-gray-900/40 rounded-2xl overflow-hidden transition-all shadow-sm"
          >
            {/* Year Header */}
            <div className="flex items-center justify-between p-4 bg-gray-800/40 hover:bg-gray-800/60 border-b border-gray-800/80 transition-colors">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleExpand(year.id)}
                  aria-expanded={isExpanded}
                  className="p-1 rounded-lg hover:bg-gray-700/60 text-gray-400 hover:text-gray-200 transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5" />
                  ) : (
                    <ChevronRight className="w-5 h-5" />
                  )}
                </button>

                <BranchCheckbox
                  state={yearState}
                  disabled={isMutating}
                  onToggle={() => onToggleBranch(year.id, yearState !== true)}
                  ariaLabel={`Toggle ${year.title}`}
                />

                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-base font-semibold text-gray-100">{year.title}</h3>
                </div>
              </div>

              {prog && (
                <div className="w-36 hidden sm:block">
                  <ProgressBar progress={prog} size="sm" showLabel={true} />
                </div>
              )}
            </div>

            {/* Year Body */}
            {isExpanded && (
              <div className="p-3 sm:p-5 space-y-4">
                {year.semesters.map((sem) => (
                  <SemesterNode
                    key={sem.id}
                    sem={sem}
                    completedSet={completedSet}
                    nodeProgress={nodeProgress}
                    expandedNodes={expandedNodes}
                    onToggleExpand={toggleExpand}
                    onToggleLeaf={onToggleLeaf}
                    onToggleBranch={onToggleBranch}
                    getBranchState={getBranchState}
                    isMutating={isMutating}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

interface SemesterNodeProps {
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

const SemesterNode: React.FC<SemesterNodeProps> = ({
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
  const semLeaves = sem.topics.flatMap((t) => t.subtopics.map((sub) => sub.id));
  const semState = getBranchState(semLeaves);
  const isExpanded = !!expandedNodes[sem.id];
  const prog = nodeProgress[sem.id];

  return (
    <div className="border border-gray-800/90 bg-gray-950/40 rounded-xl overflow-hidden">
      {/* Semester Header */}
      <div className="flex items-center justify-between p-3.5 bg-gray-900/50 hover:bg-gray-900/80 border-b border-gray-800/60 transition-colors">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => onToggleExpand(sem.id)}
            aria-expanded={isExpanded}
            className="p-1 rounded-md hover:bg-gray-800 text-gray-400 hover:text-gray-200 transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>

          <BranchCheckbox
            state={semState}
            disabled={isMutating}
            onToggle={() => onToggleBranch(sem.id, semState !== true)}
            ariaLabel={`Toggle ${sem.title}`}
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

      {/* Semester Content: Topics */}
      {isExpanded && (
        <div className="p-3 space-y-3">
          {sem.topics.map((topic) => (
            <TopicNode
              key={topic.id}
              topic={topic}
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
      )}
    </div>
  );
};

interface TopicNodeProps {
  topic: Topic;
  completedSet: Set<string>;
  nodeProgress: Record<string, ProgressSummary>;
  expandedNodes: Record<string, boolean>;
  onToggleExpand: (id: string) => void;
  onToggleLeaf: (leafId: string, isCompleted: boolean) => void;
  onToggleBranch: (nodeId: string, isCompleted: boolean) => void;
  getBranchState: (leaves: string[]) => boolean | 'indeterminate';
  isMutating: boolean;
}

const TopicNode: React.FC<TopicNodeProps> = ({
  topic,
  completedSet,
  nodeProgress,
  expandedNodes,
  onToggleExpand,
  onToggleLeaf,
  onToggleBranch,
  getBranchState,
  isMutating,
}) => {
  const topicLeaves = topic.subtopics.map((s) => s.id);
  const topicState = getBranchState(topicLeaves);
  const isExpanded = !!expandedNodes[topic.id];
  const prog = nodeProgress[topic.id];

  return (
    <div className="border border-gray-800/80 bg-gray-900/30 rounded-lg overflow-hidden">
      {/* Topic Header */}
      <div className="flex items-center justify-between p-2.5 bg-gray-900/30 hover:bg-gray-800/40 border-b border-gray-800/40 transition-colors">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onToggleExpand(topic.id)}
            aria-expanded={isExpanded}
            className="p-1 rounded hover:bg-gray-800 text-gray-400 hover:text-gray-200 transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </button>

          <BranchCheckbox
            state={topicState}
            disabled={isMutating}
            onToggle={() => onToggleBranch(topic.id, topicState !== true)}
            ariaLabel={`Toggle ${topic.title}`}
          />

          <div className="flex items-center gap-1.5">
            <Folder className="w-3.5 h-3.5 text-emerald-400/80" />
            <h5 className="text-xs font-semibold text-gray-200">{topic.title}</h5>
          </div>
        </div>

        {prog && (
          <div className="w-28 hidden sm:block">
            <ProgressBar progress={prog} size="sm" showLabel={true} />
          </div>
        )}
      </div>

      {/* Leaf Subtopics */}
      {isExpanded && (
        <div className="divide-y divide-gray-800/50 bg-gray-950/20">
          {topic.subtopics.map((sub) => {
            const isCompleted = completedSet.has(sub.id);
            return (
              <div
                key={sub.id}
                className="flex items-center justify-between px-3 py-2 hover:bg-gray-800/30 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isCompleted}
                      disabled={isMutating}
                      onChange={(e) => onToggleLeaf(sub.id, e.target.checked)}
                      className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-emerald-500 focus:ring-emerald-400 focus:ring-offset-gray-900 cursor-pointer transition-colors"
                    />
                    <span
                      className={`text-xs transition-colors ${
                        isCompleted
                          ? 'line-through text-gray-500'
                          : 'text-gray-300 group-hover:text-gray-100'
                      }`}
                    >
                      {sub.title}
                    </span>
                  </label>
                </div>

                <SourceEvidence subtopic={sub} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

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
