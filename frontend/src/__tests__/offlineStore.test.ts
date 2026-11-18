import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as offlineStore from '../lib/offlineStore';
import type { SyllabusResponse } from '../types/syllabus';

describe('offlineStore - IndexedDB Local Persistence Layer', () => {
  const mockSyllabusData: SyllabusResponse = {
    syllabus: {
      id: 'syl_offline_1',
      title: 'Distributed Systems',
      source_filename: 'distributed.pdf',
      schema_version: 2,
      years: [],
    },
    completed_leaf_ids: ['top_1', 'top_2'],
    progress: {
      total_leaves: 10,
      completed_leaves: 2,
      progress_percent: 20.0,
      total_leaf_nodes: 10,
      completed_leaf_nodes: 2,
      percentage: 20.0,
    },
    node_progress: {},
    warnings: [],
  };

  // Mock in-memory indexedDB structures
  let mockStores: Record<string, Map<string, any>> = {};

  beforeEach(() => {
    mockStores = {
      cached_syllabi: new Map(),
      offline_outbox: new Map(),
      sync_conflicts: new Map(),
    };

    const createMockRequest = (result?: any) => {
      const req: any = {
        result,
        onsuccess: null,
        onerror: null,
      };
      setTimeout(() => {
        if (req.onsuccess) req.onsuccess({ target: req });
      }, 0);
      return req;
    };

    const mockIDBObjectStore = (storeName: string) => ({
      put: vi.fn((val: any) => {
        const key = val.id;
        mockStores[storeName].set(key, val);
        return createMockRequest(key);
      }),
      add: vi.fn((val: any) => {
        const key = val.id;
        mockStores[storeName].set(key, val);
        return createMockRequest(key);
      }),
      get: vi.fn((key: string) => {
        return createMockRequest(mockStores[storeName].get(key));
      }),
      getAll: vi.fn(() => {
        return createMockRequest(Array.from(mockStores[storeName].values()));
      }),
      delete: vi.fn((key: string) => {
        mockStores[storeName].delete(key);
        return createMockRequest(undefined);
      }),
    });

    const mockIDBTransaction = (storeNames: string | string[]) => {
      const names = Array.isArray(storeNames) ? storeNames : [storeNames];
      const tx: any = {
        objectStore: vi.fn((name: string) => mockIDBObjectStore(name)),
        oncomplete: null,
        onerror: null,
        onabort: null,
        abort: vi.fn(),
      };
      setTimeout(() => {
        if (tx.oncomplete) tx.oncomplete();
      }, 5);
      return tx;
    };

    const mockDB: any = {
      objectStoreNames: {
        contains: vi.fn((name: string) => true),
      },
      transaction: vi.fn((names, mode) => mockIDBTransaction(names)),
      close: vi.fn(),
    };

    const mockOpenRequest: any = {
      result: mockDB,
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null,
    };

    (window as any).indexedDB = {
      open: vi.fn(() => {
        setTimeout(() => {
          if (mockOpenRequest.onsuccess) {
            mockOpenRequest.onsuccess({ target: mockOpenRequest });
          }
        }, 0);
        return mockOpenRequest;
      }),
    };
  });

  it('saves and retrieves a syllabus snapshot with metadata and isolation', async () => {
    await offlineStore.saveSyllabusSnapshot(mockSyllabusData, {
      userId: 'user_alpha',
      notes: [{ leaf_id: 'top_1', content: 'Distributed Consensus', updated_at: null }],
    });

    const retrieved = await offlineStore.getCachedSyllabus('syl_offline_1', 'user_alpha');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe('syl_offline_1');
    expect(retrieved?.data.syllabus.title).toBe('Distributed Systems');
    expect(retrieved?.notes?.[0].content).toBe('Distributed Consensus');

    // Cross-user isolation verification
    const otherUserRetrieved = await offlineStore.getCachedSyllabus('syl_offline_1', 'user_beta');
    expect(otherUserRetrieved).toBeNull();
  });

  it('enqueues a leaf toggle mutation and returns pending items in FIFO order', async () => {
    const mut1 = await offlineStore.enqueueMutation({
      userId: 'user_alpha',
      syllabusId: 'syl_offline_1',
      type: 'TOGGLE_LEAF',
      payload: { leafId: 'top_1', isCompleted: true },
    });

    const pending = await offlineStore.getPendingMutations('user_alpha');
    expect(pending.length).toBe(1);
    expect(pending[0].id).toBe(mut1.id);
    expect(pending[0].payload.leafId).toBe('top_1');
    expect(pending[0].status).toBe('pending');
  });

  it('coalesces repeated note mutations for the same leaf node into a single pending mutation', async () => {
    // 1st note edit
    await offlineStore.enqueueMutation({
      userId: 'user_alpha',
      syllabusId: 'syl_offline_1',
      type: 'SAVE_NOTE',
      payload: { leafId: 'top_1', content: 'Draft 1' },
    });

    // 2nd note edit before syncing
    await offlineStore.enqueueMutation({
      userId: 'user_alpha',
      syllabusId: 'syl_offline_1',
      type: 'SAVE_NOTE',
      payload: { leafId: 'top_1', content: 'Draft 2 - finalized' },
    });

    const pending = await offlineStore.getPendingMutations('user_alpha');
    // Coalescing ensures only 1 pending mutation exists with latest content
    expect(pending.length).toBe(1);
    expect(pending[0].type).toBe('SAVE_NOTE');
    expect(pending[0].payload.content).toBe('Draft 2 - finalized');
  });

  it('records and resolves sync conflicts', async () => {
    const conflict = await offlineStore.recordConflict({
      userId: 'user_alpha',
      syllabusId: 'syl_offline_1',
      mutationId: 'mut_conflict_1',
      mutationType: 'TOGGLE_LEAF',
      clientPayload: { leafId: 'top_99', isCompleted: true },
      serverErrorStatus: 404,
      errorMessage: 'Topic no longer exists on server',
    });

    let unresolved = await offlineStore.getUnresolvedConflicts('user_alpha');
    expect(unresolved.length).toBe(1);
    expect(unresolved[0].errorMessage).toContain('Topic no longer exists');

    await offlineStore.markConflictResolved(conflict.id);
    unresolved = await offlineStore.getUnresolvedConflicts('user_alpha');
    expect(unresolved.length).toBe(0);
  });
});
