import { useCallback, useEffect, useState } from 'react';
import {
  deleteSyllabus,
  fetchHealth,
  fetchSyllabiList,
  fetchSyllabus,
  renameSyllabus,
  toggleBranch,
  toggleLeaf,
  uploadSyllabusFile,
} from '../lib/api';
import type {
  HealthResponse,
  SyllabusResponse,
  SyllabusSummary,
  UploadProgress,
} from '../types/syllabus';

export function useSyllabus() {
  const [syllabi, setSyllabi] = useState<SyllabusSummary[]>([]);
  const [activeSyllabus, setActiveSyllabus] = useState<SyllabusResponse | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isMutating, setIsMutating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    refreshList();
    refreshHealth();
  }, [refreshList, refreshHealth]);

  const selectSyllabus = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchSyllabus(id);
      setActiveSyllabus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load syllabus');
      setActiveSyllabus(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

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
      setActiveSyllabus(result);
      await refreshList();
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
  }, [refreshList]);

  const handleToggleLeaf = useCallback(async (leafId: string, isCompleted: boolean) => {
    if (!activeSyllabus) return;
    setIsMutating(true);
    try {
      const updated = await toggleLeaf(activeSyllabus.syllabus.id, leafId, isCompleted);
      setActiveSyllabus(updated);
      await refreshList();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update leaf completion');
    } finally {
      setIsMutating(false);
    }
  }, [activeSyllabus, refreshList]);

  const handleToggleBranch = useCallback(async (nodeId: string, isCompleted: boolean) => {
    if (!activeSyllabus) return;
    setIsMutating(true);
    try {
      const updated = await toggleBranch(activeSyllabus.syllabus.id, nodeId, isCompleted);
      setActiveSyllabus(updated);
      await refreshList();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update branch completion');
    } finally {
      setIsMutating(false);
    }
  }, [activeSyllabus, refreshList]);

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
        setActiveSyllabus(null);
      }
      await refreshList();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete syllabus');
    }
  }, [activeSyllabus, refreshList]);

  const clearError = () => setError(null);

  return {
    syllabi,
    activeSyllabus,
    health,
    isLoading,
    isUploading,
    uploadProgress,
    isMutating,
    error,
    clearError,
    refreshList,
    refreshHealth,
    selectSyllabus,
    uploadFile,
    cancelUpload,
    handleToggleLeaf,
    handleToggleBranch,
    handleRename,
    handleDelete,
    clearActive: () => setActiveSyllabus(null),
  };
}
