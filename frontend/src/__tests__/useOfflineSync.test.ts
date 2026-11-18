import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useOfflineSync } from '../hooks/useOfflineSync';
import * as api from '../lib/api';
import * as offlineStore from '../lib/offlineStore';

vi.mock('../lib/api', () => ({
  fetchHealth: vi.fn(),
  toggleLeaf: vi.fn(),
  toggleBranch: vi.fn(),
  saveTopicNote: vi.fn(),
  deleteTopicNote: vi.fn(),
  addTopicResource: vi.fn(),
  deleteTopicResource: vi.fn(),
  setNodeDeadline: vi.fn(),
  clearNodeDeadline: vi.fn(),
  renameSyllabus: vi.fn(),
}));

vi.mock('../lib/offlineStore', () => ({
  DEFAULT_USER_ID: 'local_default_user',
  getOutboxCount: vi.fn(),
  getPendingMutations: vi.fn(),
  updateMutationStatus: vi.fn(),
  deleteMutation: vi.fn(),
  recordConflict: vi.fn(),
  getUnresolvedConflicts: vi.fn(),
  markConflictResolved: vi.fn(),
}));

describe('useOfflineSync Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
    vi.mocked(api.fetchHealth).mockResolvedValue({
      status: 'ok',
      version: '1.0.0',
      database: 'connected',
    } as any);
    vi.mocked(offlineStore.getOutboxCount).mockResolvedValue(0);
    vi.mocked(offlineStore.getUnresolvedConflicts).mockResolvedValue([]);
    vi.mocked(offlineStore.getPendingMutations).mockResolvedValue([]);
  });

  it('initializes in online state when navigator is online and backend responds', async () => {
    const { result } = renderHook(() => useOfflineSync());

    await waitFor(() => {
      expect(result.current.isOnline).toBe(true);
      expect(result.current.syncStatus).toBe('online');
      expect(result.current.pendingCount).toBe(0);
    });
  });

  it('transitions to offline state when offline event fires', async () => {
    const { result } = renderHook(() => useOfflineSync());

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    await waitFor(() => {
      expect(result.current.isOnline).toBe(false);
      expect(result.current.syncStatus).toBe('offline');
    });
  });

  it('replays pending outbox mutations when connectivity returns', async () => {
    const mockMutation: offlineStore.OutboxMutation = {
      id: 'mut_101',
      userId: 'local_default_user',
      syllabusId: 'syl_1',
      type: 'TOGGLE_LEAF',
      payload: { leafId: 'top_1', isCompleted: true },
      createdAt: Date.now(),
      status: 'pending',
      retryCount: 0,
    };

    vi.mocked(offlineStore.getPendingMutations).mockResolvedValueOnce([mockMutation]).mockResolvedValue([]);
    vi.mocked(offlineStore.getOutboxCount).mockResolvedValue(1);
    vi.mocked(api.toggleLeaf).mockResolvedValue({} as any);

    const onSyncComplete = vi.fn();
    const { result } = renderHook(() => useOfflineSync({ onSyncComplete }));

    await act(async () => {
      await result.current.triggerSync();
    });

    await waitFor(() => {
      expect(api.toggleLeaf).toHaveBeenCalledWith('syl_1', 'top_1', true);
      expect(offlineStore.deleteMutation).toHaveBeenCalledWith('mut_101');
      expect(onSyncComplete).toHaveBeenCalledWith(['syl_1']);
    });
  });

  it('records conflict when server returns 404 for an outbox mutation', async () => {
    const mockMutation: offlineStore.OutboxMutation = {
      id: 'mut_102',
      userId: 'local_default_user',
      syllabusId: 'syl_1',
      type: 'TOGGLE_LEAF',
      payload: { leafId: 'deleted_topic', isCompleted: true },
      createdAt: Date.now(),
      status: 'pending',
      retryCount: 0,
    };

    vi.mocked(offlineStore.getPendingMutations).mockResolvedValue([mockMutation]);
    const error404: any = new Error('Topic not found');
    error404.status = 404;
    vi.mocked(api.toggleLeaf).mockRejectedValue(error404);

    const { result } = renderHook(() => useOfflineSync());

    await act(async () => {
      await result.current.triggerSync();
    });

    await waitFor(() => {
      expect(offlineStore.recordConflict).toHaveBeenCalledWith(
        expect.objectContaining({
          mutationId: 'mut_102',
          serverErrorStatus: 404,
        })
      );
      expect(offlineStore.deleteMutation).toHaveBeenCalledWith('mut_102');
    });
  });
});
