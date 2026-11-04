import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clearNodeDeadline,
  deleteSyllabus,
  fetchHealth,
  fetchParseReview,
  fetchSyllabiList,
  fetchSyllabus,
  fetchSyllabusNotes,
  fetchSyllabusPacing,
  fetchSyllabusResources,
  finalizeEnrollment,
  renameSyllabus,
  setNodeDeadline,
  toggleBranch,
  toggleLeaf,
  uploadSyllabusFile,
} from '../lib/api';
import {
  getDescendantLeafIds,
  getProgressSummary,
  toggleBranchCompletion,
  toggleLeafCompletion,
} from '../lib/progress';
import type {
  HealthResponse,
  PacingMetrics,
  ParseReviewResponse,
  SetTargetDatePayload,
  SyllabusResponse,
  SyllabusSummary,
  UploadProgress,
} from '../types/syllabus';

export function useSyllabus() {
  const [syllabi, setSyllabi] = useState<SyllabusSummary[]>([]);
  const [activeSyllabus, setActiveSyllabus] = useState<SyllabusResponse | null>(null);
  const [pacingData, setPacingData] = useState<Record<string, PacingMetrics>>({});
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isMutating, setIsMutating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const activeSyllabusIdRef = useRef<string | null>(null);

  // Elective confirmation workflow state
  const [reviewData, setReviewData] = useState<ParseReviewResponse | null>(null);
  const [showElectiveModal, setShowElectiveModal] = useState<boolean>(false);

  // Option-B: Notes & Resources State
  const [noteLeafIds, setNoteLeafIds] = useState<Set<string>>(new Set());
  const [resourceCounts, setResourceCounts] = useState<Record<string, number>>({});
  const [activeNoteLeaf, setActiveNoteLeaf] = useState<{ id: string; title: string } | null>(null);
  const [activeResourceNode, setActiveResourceNode] = useState<{
    id: string;
    type: 'subtopic' | 'module';
    title: string;
  } | null>(null);

  const refreshNotesAndResources = useCallback(async (targetId?: string) => {
    const sId = targetId || activeSyllabusIdRef.current;
    if (!sId) {
      setNoteLeafIds(new Set());
      setResourceCounts({});
      return;
    }
    try {
      const [notes, resources] = await Promise.all([
        fetchSyllabusNotes(sId).catch(() => []),
        fetchSyllabusResources(sId).catch(() => []),
      ]);

      if (activeSyllabusIdRef.current === sId) {
        setNoteLeafIds(new Set(notes.filter((n) => n.content.trim().length > 0).map((n) => n.leaf_id)));
        const counts: Record<string, number> = {};
        resources.forEach((r) => {
          counts[r.node_id] = (counts[r.node_id] || 0) + 1;
        });
        setResourceCounts(counts);
      }
    } catch (err) {
      console.error('Failed to load notes or resources:', err);
    }
  }, []);

  const refreshList = useCallback(async () => {
    try {
      const list = await fetchSyllabiList();
      setSyllabi(list);
    } catch (err) {
      console.error('Failed to load syllabi list:', err);
    }
  }, []);

  const refreshHealth = useCallback(async () => {
    try {
      const h = await fetchHealth();
      setHealth(h);
    } catch {
      setHealth(null);
    }
  }, []);

  const refreshPacing = useCallback(async (targetId?: string) => {
    const sId = targetId || activeSyllabusIdRef.current;
    if (!sId) {
      setPacingData({});
      return;
    }
    try {
      const pacing = await fetchSyllabusPacing(sId);
      if (activeSyllabusIdRef.current === sId) {
        setPacingData(pacing.deadlines || {});
      }
    } catch (err) {
      console.error('Failed to load pacing data:', err);
      if (activeSyllabusIdRef.current === sId) {
        setPacingData({});
      }
    }
  }, []);

  useEffect(() => {
    refreshList();
    refreshHealth();
  }, [refreshList, refreshHealth]);

  const selectSyllabus = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    activeSyllabusIdRef.current = id;
    setPacingData({});
    try {
      const data = await fetchSyllabus(id);
      setActiveSyllabus(data);
      try {
        const pacing = await fetchSyllabusPacing(id);
        if (activeSyllabusIdRef.current === id) {
          setPacingData(pacing.deadlines || {});
        }
      } catch (pacingErr) {
        console.error('Failed to load pacing summary:', pacingErr);
        if (activeSyllabusIdRef.current === id) {
          setPacingData({});
        }
      }
      refreshNotesAndResources(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load syllabus');
      setActiveSyllabus(null);
      setPacingData({});
      setNoteLeafIds(new Set());
      setResourceCounts({});
    } finally {
      setIsLoading(false);
    }
  }, [refreshNotesAndResources]);

  const [activeUploadController, setActiveUploadController] = useState<AbortController | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);

  const cancelUpload = useCallback(() => {
    if (activeUploadController) {
      activeUploadController.abort('UPLOAD_CANCELLED');
      setActiveUploadController(null);
      setIsUploading(false);
      setUploadProgress(null);
      setError('Upload cancelled.');
    }
  }, [activeUploadController]);

  const openElectiveModalForSyllabus = useCallback(async (targetSyllabusId?: string) => {
    const sId = targetSyllabusId || activeSyllabus?.syllabus.id;
    if (!sId) return;
    try {
      const review = await fetchParseReview(sId);
      setReviewData(review);
      setShowElectiveModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retrieve elective choices');
    }
  }, [activeSyllabus]);

  const closeElectiveModal = useCallback(() => {
    setShowElectiveModal(false);
    setReviewData(null);
  }, []);

  const handleFinalizeEnrollment = useCallback(async (enrolledSubjectIds: string[]) => {
    const sId = reviewData?.syllabus_id || activeSyllabus?.syllabus.id;
    if (!sId) return;
    setIsMutating(true);
    try {
      const updated = await finalizeEnrollment(sId, enrolledSubjectIds);
      setActiveSyllabus(updated);
      setShowElectiveModal(false);
      setReviewData(null);
      await refreshList();
      await refreshPacing(sId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to finalize elective choices');
      throw err;
    } finally {
      setIsMutating(false);
    }
  }, [reviewData, activeSyllabus, refreshList, refreshPacing]);

  const uploadFile = useCallback(async (file: File) => {
    const controller = new AbortController();
    setActiveUploadController(controller);
    setIsUploading(true);
    setUploadProgress({
      job_id: '',
      stage: 'queued',
      percent: 0,
      message: `Uploading ${file.name}...`,
      result: null,
      error: null,
    });
    setError(null);
    try {
      const result = await uploadSyllabusFile(file, {
        signal: controller.signal,
        onProgress: (p) => {
          setUploadProgress(p);
        },
      });

      activeSyllabusIdRef.current = result.syllabus.id;
      setActiveSyllabus(result);
      await refreshList();
      await refreshPacing(result.syllabus.id);
      await refreshNotesAndResources(result.syllabus.id);

      // If elective choices require confirmation, open modal immediately
      if (result.syllabus.requires_enrollment_confirmation) {
        try {
          const review = await fetchParseReview(result.syllabus.id);
          setReviewData(review);
          setShowElectiveModal(true);
        } catch {
          // Non-blocking fallback
        }
      }

      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload and extraction failed';
      setError(msg);
      throw err;
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
      setActiveUploadController(null);
    }
  }, [refreshList, refreshPacing, refreshNotesAndResources]);

  const handleToggleLeaf = useCallback(async (leafId: string, isCompleted: boolean) => {
    if (!activeSyllabus) return;
    const prev = activeSyllabus;

    // Optimistic update
    const nextCompleted = toggleLeafCompletion(
      prev.completed_leaf_ids,
      leafId,
      isCompleted
    );
    const enrolledLeaves = getDescendantLeafIds(prev.syllabus, undefined, true);
    const nextProg = getProgressSummary(
      enrolledLeaves.filter((id) => nextCompleted.has(id)).length,
      enrolledLeaves.length
    );

    setActiveSyllabus({
      ...prev,
      completed_leaf_ids: Array.from(nextCompleted),
      progress: nextProg,
    });

    setIsMutating(true);
    try {
      const updated = await toggleLeaf(prev.syllabus.id, leafId, isCompleted);
      setActiveSyllabus(updated);
      await refreshList();
      await refreshPacing(prev.syllabus.id);
    } catch (err) {
      // Rollback on failure
      setActiveSyllabus(prev);
      setError(err instanceof Error ? err.message : 'Failed to update leaf completion');
    } finally {
      setIsMutating(false);
    }
  }, [activeSyllabus, refreshList, refreshPacing]);

  const handleToggleBranch = useCallback(async (nodeId: string, isCompleted: boolean) => {
    if (!activeSyllabus) return;
    const prev = activeSyllabus;

    // Optimistic update
    const branchLeaves = getDescendantLeafIds(prev.syllabus, nodeId, true);
    const nextCompleted = toggleBranchCompletion(
      prev.completed_leaf_ids,
      branchLeaves,
      isCompleted
    );
    const enrolledLeaves = getDescendantLeafIds(prev.syllabus, undefined, true);
    const nextProg = getProgressSummary(
      enrolledLeaves.filter((id) => nextCompleted.has(id)).length,
      enrolledLeaves.length
    );

    setActiveSyllabus({
      ...prev,
      completed_leaf_ids: Array.from(nextCompleted),
      progress: nextProg,
    });

    setIsMutating(true);
    try {
      const updated = await toggleBranch(prev.syllabus.id, nodeId, isCompleted);
      setActiveSyllabus(updated);
      await refreshList();
      await refreshPacing(prev.syllabus.id);
    } catch (err) {
      // Rollback on failure
      setActiveSyllabus(prev);
      setError(err instanceof Error ? err.message : 'Failed to update branch completion');
    } finally {
      setIsMutating(false);
    }
  }, [activeSyllabus, refreshList, refreshPacing]);

  const handleRename = useCallback(async (newTitle: string) => {
    if (!activeSyllabus) return;
    try {
      const updated = await renameSyllabus(activeSyllabus.syllabus.id, newTitle);
      setActiveSyllabus(updated);
      await refreshList();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename syllabus');
    }
  }, [activeSyllabus, refreshList]);

  const handleDelete = useCallback(async (syllabusId: string) => {
    try {
      await deleteSyllabus(syllabusId);
      if (activeSyllabus?.syllabus.id === syllabusId) {
        activeSyllabusIdRef.current = null;
        setActiveSyllabus(null);
        setPacingData({});
      }
      await refreshList();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete syllabus');
    }
  }, [activeSyllabus, refreshList]);

  const handleSetDeadline = useCallback(async (payload: SetTargetDatePayload) => {
    const sId = activeSyllabus?.syllabus.id;
    if (!sId) return;
    try {
      const metrics = await setNodeDeadline(sId, payload);
      setPacingData((prev) => ({
        ...prev,
        [metrics.node_id]: metrics,
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to set deadline';
      setError(msg);
      throw err;
    }
  }, [activeSyllabus]);

  const handleClearDeadline = useCallback(async (nodeId: string) => {
    const sId = activeSyllabus?.syllabus.id;
    if (!sId) return;
    try {
      await clearNodeDeadline(sId, nodeId);
      setPacingData((prev) => {
        const copy = { ...prev };
        delete copy[nodeId];
        return copy;
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to clear deadline';
      setError(msg);
      throw err;
    }
  }, [activeSyllabus]);

  // Option-B: Drawer and modal actions
  const openNoteDrawer = useCallback((leafId: string, leafTitle: string) => {
    setActiveNoteLeaf({ id: leafId, title: leafTitle });
  }, []);

  const closeNoteDrawer = useCallback(() => {
    setActiveNoteLeaf(null);
  }, []);

  const handleNoteChange = useCallback((leafId: string, hasContent: boolean) => {
    setNoteLeafIds((prev) => {
      const next = new Set(prev);
      if (hasContent) {
        next.add(leafId);
      } else {
        next.delete(leafId);
      }
      return next;
    });
  }, []);

  const openResourceModal = useCallback(
    (nodeId: string, nodeType: 'subtopic' | 'module', nodeTitle: string) => {
      setActiveResourceNode({ id: nodeId, type: nodeType, title: nodeTitle });
    },
    []
  );

  const closeResourceModal = useCallback(() => {
    setActiveResourceNode(null);
  }, []);

  const handleResourceCountChange = useCallback((nodeId: string, count: number) => {
    setResourceCounts((prev) => ({
      ...prev,
      [nodeId]: count,
    }));
  }, []);

  const clearError = () => setError(null);

  return {
    syllabi,
    activeSyllabus,
    pacingData,
    noteLeafIds,
    resourceCounts,
    activeNoteLeaf,
    activeResourceNode,
    health,
    isLoading,
    isUploading,
    uploadProgress,
    isMutating,
    error,
    clearError,
    refreshList,
    refreshHealth,
    refreshPacing,
    refreshNotesAndResources,
    selectSyllabus,
    uploadFile,
    cancelUpload,
    handleToggleLeaf,
    handleToggleBranch,
    handleRename,
    handleDelete,
    handleSetDeadline,
    handleClearDeadline,
    openNoteDrawer,
    closeNoteDrawer,
    handleNoteChange,
    openResourceModal,
    closeResourceModal,
    handleResourceCountChange,
    clearActive: () => {
      activeSyllabusIdRef.current = null;
      setActiveSyllabus(null);
      setPacingData({});
      setNoteLeafIds(new Set());
      setResourceCounts({});
      setActiveNoteLeaf(null);
      setActiveResourceNode(null);
    },
    // Elective onboarding support
    reviewData,
    showElectiveModal,
    openElectiveModal: openElectiveModalForSyllabus,
    closeElectiveModal,
    handleFinalizeEnrollment,
  };
}
