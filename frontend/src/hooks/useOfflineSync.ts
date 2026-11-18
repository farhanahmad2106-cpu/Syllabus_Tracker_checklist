/**
 * Offline Synchronization Engine
 * Handles online/offline detection, background sync queue replay, and conflict reconciliation.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  addTopicResource,
  clearNodeDeadline,
  deleteTopicNote,
  deleteTopicResource,
  fetchHealth,
  renameSyllabus,
  saveTopicNote,
  setNodeDeadline,
  submitRevisionReview,
  toggleBranch,
  toggleLeaf,
} from '../lib/api';
import {
  DEFAULT_USER_ID,
  deleteMutation,
  getOutboxCount,
  getPendingMutations,
  getUnresolvedConflicts,
  markConflictResolved,
  recordConflict,
  type SyncConflictRecord,
  updateMutationStatus,
} from '../lib/offlineStore';

export type SyncStatus =
  | 'online'
  | 'offline'
  | 'syncing'
  | 'sync_error'
  | 'conflict'
  | 'storage_error';

export interface UseOfflineSyncOptions {
  userId?: string;
  onSyncComplete?: (syllabusIds: string[]) => void;
  onSyncError?: (error: Error) => void;
}

// Module-level lock to prevent concurrent tab sync execution
let isSyncInProgress = false;

export function useOfflineSync(options?: UseOfflineSyncOptions) {
  const userId = options?.userId || DEFAULT_USER_ID;

  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('online');
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [conflicts, setConflicts] = useState<SyncConflictRecord[]>([]);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);

  const isReplayingRef = useRef<boolean>(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Refresh outbox and conflict count
  const refreshStats = useCallback(async () => {
    try {
      const count = await getOutboxCount(userId);
      setPendingCount(count);
      const unresolvedConflicts = await getUnresolvedConflicts(userId);
      setConflicts(unresolvedConflicts);
      if (unresolvedConflicts.length > 0) {
        setSyncStatus('conflict');
      }
    } catch (err) {
      console.warn('[Sync] Failed to read IndexedDB stats:', err);
    }
  }, [userId]);

  // Ping health endpoint to confirm actual internet/backend connectivity
  const verifyConnectivity = useCallback(async (): Promise<boolean> => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return false;
    }
    try {
      // 3.5s timeout for network check
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);
      await fetchHealth();
      clearTimeout(timer);
      return true;
    } catch {
      return false;
    }
  }, []);

  // Sequential replay execution
  const replayOutbox = useCallback(async () => {
    if (isSyncInProgress || isReplayingRef.current) {
      return;
    }

    const actuallyOnline = await verifyConnectivity();
    if (!actuallyOnline) {
      setIsOnline(false);
      setSyncStatus('offline');
      return;
    }

    setIsOnline(true);
    isSyncInProgress = true;
    isReplayingRef.current = true;
    setSyncStatus('syncing');
    setLastSyncError(null);

    const affectedSyllabusIds = new Set<string>();

    try {
      const pending = await getPendingMutations(userId);
      if (pending.length === 0) {
        setSyncStatus('online');
        await refreshStats();
        return;
      }

      for (const mutation of pending) {
        affectedSyllabusIds.add(mutation.syllabusId);
        await updateMutationStatus(mutation.id, 'syncing');

        try {
          switch (mutation.type) {
            case 'TOGGLE_LEAF':
              await toggleLeaf(
                mutation.syllabusId,
                mutation.payload.leafId,
                mutation.payload.isCompleted
              );
              break;

            case 'BULK_TOGGLE':
              await toggleBranch(
                mutation.syllabusId,
                mutation.payload.nodeId,
                mutation.payload.isCompleted
              );
              break;

            case 'SAVE_NOTE':
              await saveTopicNote(
                mutation.syllabusId,
                mutation.payload.leafId,
                mutation.payload.content
              );
              break;

            case 'DELETE_NOTE':
              await deleteTopicNote(mutation.syllabusId, mutation.payload.leafId);
              break;

            case 'ADD_RESOURCE':
              await addTopicResource(mutation.syllabusId, mutation.payload);
              break;

            case 'DELETE_RESOURCE':
              await deleteTopicResource(mutation.syllabusId, mutation.payload.resourceId);
              break;

            case 'SET_DEADLINE':
              await setNodeDeadline(mutation.syllabusId, mutation.payload);
              break;

            case 'CLEAR_DEADLINE':
              await clearNodeDeadline(mutation.syllabusId, mutation.payload.nodeId);
              break;

            case 'RENAME_SYLLABUS':
              await renameSyllabus(mutation.syllabusId, mutation.payload.title);
              break;

            case 'SUBMIT_REVISION_REVIEW':
              await submitRevisionReview(
                mutation.syllabusId,
                mutation.payload.leafId,
                {
                  quality: mutation.payload.quality,
                  idempotency_key: mutation.id,
                  client_review_date: mutation.payload.clientReviewDate,
                }
              );
              break;

            default:
              console.warn('[Sync] Unknown mutation type:', mutation.type);
          }

          // Successfully processed: remove from outbox
          await deleteMutation(mutation.id);
        } catch (err: any) {
          const status = err?.status;
          const msg = err instanceof Error ? err.message : 'Synchronization failed';

          console.error(`[Sync] Mutation ${mutation.id} (${mutation.type}) failed:`, err);

          // Conflict detection (404 Not Found or 409 Conflict)
          if (status === 404 || status === 409) {
            await recordConflict({
              userId,
              syllabusId: mutation.syllabusId,
              mutationId: mutation.id,
              mutationType: mutation.type,
              clientPayload: mutation.payload,
              serverErrorStatus: status,
              errorMessage: msg,
            });
            await deleteMutation(mutation.id);
            setSyncStatus('conflict');
          } else if (status === 401 || status === 403) {
            // Authentication issue: keep mutation pending, pause sync
            await updateMutationStatus(mutation.id, 'failed', msg);
            setSyncStatus('sync_error');
            setLastSyncError('Authentication required to synchronize changes.');
            break;
          } else if (status === 422) {
            // Validation error: invalid data, record conflict and drop
            await recordConflict({
              userId,
              syllabusId: mutation.syllabusId,
              mutationId: mutation.id,
              mutationType: mutation.type,
              clientPayload: mutation.payload,
              serverErrorStatus: status,
              errorMessage: `Validation error: ${msg}`,
            });
            await deleteMutation(mutation.id);
          } else {
            // Network failure or 5xx server error: increment retry with backoff and stop
            await updateMutationStatus(mutation.id, 'failed', msg, true);
            setSyncStatus('sync_error');
            setLastSyncError(msg);
            optionsRef.current?.onSyncError?.(err);
            break;
          }
        }
      }

      await refreshStats();

      // Check remaining conflicts or pending items
      const remainingConflicts = await getUnresolvedConflicts(userId);
      const remainingPending = await getPendingMutations(userId);

      if (remainingConflicts.length > 0) {
        setSyncStatus('conflict');
      } else if (remainingPending.length > 0) {
        setSyncStatus('sync_error');
      } else {
        setSyncStatus('online');
        optionsRef.current?.onSyncComplete?.(Array.from(affectedSyllabusIds));
      }
    } catch (err) {
      console.error('[Sync] Fatal replay error:', err);
      setSyncStatus('storage_error');
      setLastSyncError(err instanceof Error ? err.message : 'Storage access error');
    } finally {
      isSyncInProgress = false;
      isReplayingRef.current = false;
    }
  }, [userId, verifyConnectivity, refreshStats]);

  // Window event listeners for online/offline
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      replayOutbox();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setSyncStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    refreshStats();
    if (navigator.onLine) {
      replayOutbox();
    } else {
      setSyncStatus('offline');
    }

    // Periodic heartbeat sync every 60 seconds if online
    const interval = setInterval(() => {
      if (navigator.onLine && !isSyncInProgress) {
        getOutboxCount(userId).then((cnt) => {
          if (cnt > 0) {
            replayOutbox();
          }
        });
      }
    }, 60000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [userId, refreshStats, replayOutbox]);

  const resolveConflict = useCallback(
    async (conflictId: string) => {
      try {
        await markConflictResolved(conflictId);
        await refreshStats();
        const remaining = await getUnresolvedConflicts(userId);
        if (remaining.length === 0) {
          setSyncStatus(isOnline ? 'online' : 'offline');
        }
      } catch (err) {
        console.error('[Sync] Failed to mark conflict resolved:', err);
      }
    },
    [userId, isOnline, refreshStats]
  );

  const dismissError = useCallback(() => {
    setLastSyncError(null);
    setSyncStatus(isOnline ? 'online' : 'offline');
  }, [isOnline]);

  return {
    isOnline,
    syncStatus,
    pendingCount,
    conflicts,
    lastSyncError,
    triggerSync: replayOutbox,
    resolveConflict,
    dismissError,
    refreshStats,
  };
}
