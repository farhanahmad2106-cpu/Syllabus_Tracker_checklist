/**
 * Pure TypeScript progress calculation and cascading checklist engine.
 * Mirrors the backend progress module with deterministic integer counts and rounding.
 */

import type {
  CheckboxCheckedState,
  HierarchicalSyllabus,
  ProgressSummary,
} from '../types/syllabus';

/**
 * Helper to normalize subjects from a semester
 */
function getSubjects(sem: any): any[] {
  if (sem.subjects && sem.subjects.length > 0) {
    return sem.subjects;
  }
  if (sem.topics && sem.topics.length > 0) {
    return sem.topics.map((t: any) => ({
      id: `subj_${t.id}`,
      title: t.title,
      modules: [
        {
          id: t.id,
          title: 'Module 1',
          topics: t.subtopics || t.topics || [],
        },
      ],
    }));
  }
  return [];
}

/**
 * Collect all leaf subtopic IDs for a given syllabus or sub-tree.
 * Supports canonical 5-tier: Year -> Semester -> Subject -> Module -> Topic.
 */
export function getDescendantLeafIds(
  syllabus: HierarchicalSyllabus,
  targetNodeId?: string
): string[] {
  const getAllLeaves = (): string[] => {
    return (syllabus.years || []).flatMap((yr) =>
      (yr.semesters || []).flatMap((sem) =>
        getSubjects(sem).flatMap((subj: any) =>
          (subj.modules || []).flatMap((mod: any) =>
            (mod.topics || []).map((top: any) => top.id)
          )
        )
      )
    );
  };

  if (!targetNodeId || targetNodeId === syllabus.id) {
    return getAllLeaves();
  }

  for (const yr of syllabus.years || []) {
    if (yr.id === targetNodeId) {
      return (yr.semesters || []).flatMap((sem) =>
        getSubjects(sem).flatMap((subj: any) =>
          (subj.modules || []).flatMap((mod: any) =>
            (mod.topics || []).map((top: any) => top.id)
          )
        )
      );
    }
    for (const sem of yr.semesters || []) {
      if (sem.id === targetNodeId) {
        return getSubjects(sem).flatMap((subj: any) =>
          (subj.modules || []).flatMap((mod: any) =>
            (mod.topics || []).map((top: any) => top.id)
          )
        );
      }
      for (const subj of getSubjects(sem)) {
        if (subj.id === targetNodeId) {
          return (subj.modules || []).flatMap((mod: any) =>
            (mod.topics || []).map((top: any) => top.id)
          );
        }
        for (const mod of subj.modules || []) {
          if (mod.id === targetNodeId) {
            return (mod.topics || []).map((top: any) => top.id);
          }
          for (const top of mod.topics || []) {
            if (top.id === targetNodeId) {
              return [top.id];
            }
          }
        }
      }
    }
  }

  return [];
}

/**
 * Compute progress summary from counts without division by zero.
 */
export function getProgressSummary(
  completedCount: number,
  totalCount: number
): ProgressSummary {
  if (totalCount <= 0) {
    return {
      total_leaves: 0,
      completed_leaves: 0,
      progress_percent: 0.0,
    };
  }
  const completed = Math.max(0, Math.min(completedCount, totalCount));
  const percent = Math.round((completed / totalCount) * 100);
  return {
    total_leaves: totalCount,
    completed_leaves: completed,
    progress_percent: percent,
  };
}

/**
 * Derive tri-state checkbox state (checked, indeterminate, unchecked).
 */
export function getCheckboxState(
  descendantLeafIds: string[],
  completedLeafIds: Set<string> | string[]
): CheckboxCheckedState {
  if (descendantLeafIds.length === 0) {
    return false;
  }
  const completedSet =
    completedLeafIds instanceof Set ? completedLeafIds : new Set(completedLeafIds);

  const completedCount = descendantLeafIds.filter((id) => completedSet.has(id)).length;

  if (completedCount === 0) {
    return false;
  }
  if (completedCount === descendantLeafIds.length) {
    return true;
  }
  return 'indeterminate';
}

/**
 * Immutable toggle for a single leaf item.
 */
export function toggleLeafCompletion(
  currentCompleted: Set<string> | string[],
  leafId: string,
  isCompleted: boolean
): Set<string> {
  const next = new Set(currentCompleted);
  if (isCompleted) {
    next.add(leafId);
  } else {
    next.delete(leafId);
  }
  return next;
}

/**
 * Cascading toggle for all descendant leaves under a branch.
 */
export function toggleBranchCompletion(
  currentCompleted: Set<string> | string[],
  descendantLeafIds: string[],
  explicitState?: boolean
): Set<string> {
  const next = new Set(currentCompleted);
  const targetState =
    explicitState !== undefined
      ? explicitState
      : getCheckboxState(descendantLeafIds, next) !== true;

  if (targetState) {
    descendantLeafIds.forEach((id) => next.add(id));
  } else {
    descendantLeafIds.forEach((id) => next.delete(id));
  }
  return next;
}

/**
 * Filter out any completion IDs not belonging to valid leaves in the syllabus.
 */
export function sanitizeCompletedLeaves(
  syllabus: HierarchicalSyllabus,
  completedIds: string[]
): string[] {
  const validLeaves = new Set(getDescendantLeafIds(syllabus));
  return Array.from(new Set(completedIds.filter((id) => validLeaves.has(id))));
}
