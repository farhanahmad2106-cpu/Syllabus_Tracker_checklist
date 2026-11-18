/**
 * IndexedDB Local-First Persistence Layer for Syllabus Tracker
 * Database: syllabus_tracker_offline_v1
 */

import type {
  PacingMetrics,
  SyllabusResponse,
  TopicNote,
  TopicResource,
} from '../types/syllabus';

export const DB_NAME = 'syllabus_tracker_offline_v1';
export const DB_VERSION = 1;

export const DEFAULT_USER_ID = 'local_default_user';

export type MutationType =
  | 'TOGGLE_LEAF'
  | 'BULK_TOGGLE'
  | 'SAVE_NOTE'
  | 'DELETE_NOTE'
  | 'ADD_RESOURCE'
  | 'DELETE_RESOURCE'
  | 'SET_DEADLINE'
  | 'CLEAR_DEADLINE'
  | 'RENAME_SYLLABUS'
  | 'SUBMIT_REVISION_REVIEW';

export interface CachedSyllabusRecord {
  id: string; // syllabus ID
  userId: string;
  data: SyllabusResponse;
  pacing?: Record<string, PacingMetrics>;
  notes?: TopicNote[];
  resources?: TopicResource[];
  updatedAt: number;
}

export interface OutboxMutation {
  id: string;
  userId: string;
  syllabusId: string;
  type: MutationType;
  payload: any;
  createdAt: number;
  status: 'pending' | 'syncing' | 'failed';
  retryCount: number;
  lastError?: string;
}

export interface SyncConflictRecord {
  id: string;
  userId: string;
  syllabusId: string;
  mutationId: string;
  mutationType: MutationType;
  clientPayload: any;
  serverErrorStatus?: number;
  errorMessage: string;
  createdAt: number;
  resolved: boolean;
}

/**
 * Open or upgrade the IndexedDB database.
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 1. cached_syllabi
      if (!db.objectStoreNames.contains('cached_syllabi')) {
        const syllabusStore = db.createObjectStore('cached_syllabi', { keyPath: 'id' });
        syllabusStore.createIndex('userId', 'userId', { unique: false });
        syllabusStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      // 2. offline_outbox
      if (!db.objectStoreNames.contains('offline_outbox')) {
        const outboxStore = db.createObjectStore('offline_outbox', { keyPath: 'id' });
        outboxStore.createIndex('userId', 'userId', { unique: false });
        outboxStore.createIndex('syllabusId', 'syllabusId', { unique: false });
        outboxStore.createIndex('createdAt', 'createdAt', { unique: false });
        outboxStore.createIndex('status', 'status', { unique: false });
      }

      // 3. sync_conflicts
      if (!db.objectStoreNames.contains('sync_conflicts')) {
        const conflictStore = db.createObjectStore('sync_conflicts', { keyPath: 'id' });
        conflictStore.createIndex('userId', 'userId', { unique: false });
        conflictStore.createIndex('syllabusId', 'syllabusId', { unique: false });
        conflictStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
    request.onblocked = () => reject(new Error('IndexedDB blocked by another tab or process'));
  });
}

function runTransaction<T>(
  storeNames: string | string[],
  mode: IDBTransactionMode,
  fn: (stores: Record<string, IDBObjectStore>, transaction: IDBTransaction) => Promise<T> | T
): Promise<T> {
  return openDB().then((db) => {
    return new Promise<T>((resolve, reject) => {
      const names = Array.isArray(storeNames) ? storeNames : [storeNames];
      const tx = db.transaction(names, mode);
      const storeMap: Record<string, IDBObjectStore> = {};
      for (const name of names) {
        storeMap[name] = tx.objectStore(name);
      }

      let result: T;
      let fnResolved = false;
      let txCompleted = false;

      const finishIfDone = () => {
        if (fnResolved && (txCompleted || !tx.oncomplete)) {
          db.close();
          resolve(result);
        }
      };

      tx.oncomplete = () => {
        txCompleted = true;
        finishIfDone();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error || new Error('Transaction error'));
      };
      tx.onabort = () => {
        db.close();
        reject(tx.error || new Error('Transaction aborted'));
      };

      try {
        const fnResult = fn(storeMap, tx);
        if (fnResult instanceof Promise) {
          fnResult
            .then((res) => {
              result = res;
              fnResolved = true;
              finishIfDone();
            })
            .catch((err) => {
              tx.abort();
              db.close();
              reject(err);
            });
        } else {
          result = fnResult;
          fnResolved = true;
          finishIfDone();
        }
      } catch (err) {
        tx.abort();
        db.close();
        reject(err);
      }
    });
  });
}

// -----------------------------------------------------------------------------
// Syllabus Snapshot Operations
// -----------------------------------------------------------------------------

export async function saveSyllabusSnapshot(
  syllabusData: SyllabusResponse,
  extras?: {
    userId?: string;
    pacing?: Record<string, PacingMetrics>;
    notes?: TopicNote[];
    resources?: TopicResource[];
  }
): Promise<void> {
  const userId = extras?.userId || DEFAULT_USER_ID;
  const record: CachedSyllabusRecord = {
    id: syllabusData.syllabus.id,
    userId,
    data: syllabusData,
    pacing: extras?.pacing,
    notes: extras?.notes,
    resources: extras?.resources,
    updatedAt: Date.now(),
  };

  await runTransaction('cached_syllabi', 'readwrite', (stores) => {
    return new Promise<void>((resolve, reject) => {
      const req = stores.cached_syllabi.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });
}

export async function getCachedSyllabus(
  syllabusId: string,
  userId: string = DEFAULT_USER_ID
): Promise<CachedSyllabusRecord | null> {
  return runTransaction('cached_syllabi', 'readonly', (stores) => {
    return new Promise<CachedSyllabusRecord | null>((resolve, reject) => {
      const req = stores.cached_syllabi.get(syllabusId);
      req.onsuccess = () => {
        const record = req.result as CachedSyllabusRecord | undefined;
        if (!record || (record.userId && record.userId !== userId)) {
          resolve(null);
        } else {
          resolve(record);
        }
      };
      req.onerror = () => reject(req.error);
    });
  });
}

export async function getAllCachedSyllabi(
  userId: string = DEFAULT_USER_ID
): Promise<CachedSyllabusRecord[]> {
  return runTransaction('cached_syllabi', 'readonly', (stores) => {
    return new Promise<CachedSyllabusRecord[]>((resolve, reject) => {
      const req = stores.cached_syllabi.getAll();
      req.onsuccess = () => {
        const all = (req.result as CachedSyllabusRecord[]) || [];
        const filtered = all.filter((s) => !s.userId || s.userId === userId);
        resolve(filtered);
      };
      req.onerror = () => reject(req.error);
    });
  });
}

export async function deleteCachedSyllabus(syllabusId: string): Promise<void> {
  await runTransaction('cached_syllabi', 'readwrite', (stores) => {
    return new Promise<void>((resolve, reject) => {
      const req = stores.cached_syllabi.delete(syllabusId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });
}

// -----------------------------------------------------------------------------
// Outbox Mutation Queue Operations
// -----------------------------------------------------------------------------

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `mut_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Enqueue a mutation. Includes intelligent coalescing for notes and leaf toggles.
 */
export async function enqueueMutation(
  mutation: Omit<OutboxMutation, 'id' | 'createdAt' | 'status' | 'retryCount' | 'userId'> & {
    userId?: string;
  }
): Promise<OutboxMutation> {
  const userId = mutation.userId || DEFAULT_USER_ID;

  return runTransaction('offline_outbox', 'readwrite', async (stores) => {
    const outbox = stores.offline_outbox;

    // Fetch existing pending mutations for possible coalescing
    const allPending: OutboxMutation[] = await new Promise((resolve, reject) => {
      const req = outbox.getAll();
      req.onsuccess = () => {
        const list = (req.result as OutboxMutation[]) || [];
        resolve(list.filter((m) => m.userId === userId && m.status === 'pending'));
      };
      req.onerror = () => reject(req.error);
    });

    // 1. Note coalescing: update pending note for same leaf if present
    if (mutation.type === 'SAVE_NOTE') {
      const existingNoteMut = allPending.find(
        (m) =>
          m.type === 'SAVE_NOTE' &&
          m.syllabusId === mutation.syllabusId &&
          m.payload?.leafId === mutation.payload?.leafId
      );

      if (existingNoteMut) {
        existingNoteMut.payload = mutation.payload;
        existingNoteMut.createdAt = Date.now();
        await new Promise<void>((resolve, reject) => {
          const updateReq = outbox.put(existingNoteMut);
          updateReq.onsuccess = () => resolve();
          updateReq.onerror = () => reject(updateReq.error);
        });
        return existingNoteMut;
      }
    }

    // 2. Leaf toggle coalescing: update pending toggle for same leaf if present
    if (mutation.type === 'TOGGLE_LEAF') {
      const existingToggle = allPending.find(
        (m) =>
          m.type === 'TOGGLE_LEAF' &&
          m.syllabusId === mutation.syllabusId &&
          m.payload?.leafId === mutation.payload?.leafId
      );

      if (existingToggle) {
        existingToggle.payload = mutation.payload;
        existingToggle.createdAt = Date.now();
        await new Promise<void>((resolve, reject) => {
          const updateReq = outbox.put(existingToggle);
          updateReq.onsuccess = () => resolve();
          updateReq.onerror = () => reject(updateReq.error);
        });
        return existingToggle;
      }
    }

    // New mutation
    const newEntry: OutboxMutation = {
      id: generateId(),
      userId,
      syllabusId: mutation.syllabusId,
      type: mutation.type,
      payload: mutation.payload,
      createdAt: Date.now(),
      status: 'pending',
      retryCount: 0,
    };

    await new Promise<void>((resolve, reject) => {
      const addReq = outbox.add(newEntry);
      addReq.onsuccess = () => resolve();
      addReq.onerror = () => reject(addReq.error);
    });

    return newEntry;
  });
}

export async function getPendingMutations(
  userId: string = DEFAULT_USER_ID
): Promise<OutboxMutation[]> {
  return runTransaction('offline_outbox', 'readonly', (stores) => {
    return new Promise<OutboxMutation[]>((resolve, reject) => {
      const req = stores.offline_outbox.getAll();
      req.onsuccess = () => {
        const all = (req.result as OutboxMutation[]) || [];
        const pending = all
          .filter((m) => m.userId === userId && (m.status === 'pending' || m.status === 'failed'))
          .sort((a, b) => a.createdAt - b.createdAt);
        resolve(pending);
      };
      req.onerror = () => reject(req.error);
    });
  });
}

export async function getOutboxCount(userId: string = DEFAULT_USER_ID): Promise<number> {
  const pending = await getPendingMutations(userId);
  return pending.length;
}

export async function updateMutationStatus(
  id: string,
  status: 'pending' | 'syncing' | 'failed',
  lastError?: string,
  incrementRetry: boolean = false
): Promise<void> {
  await runTransaction('offline_outbox', 'readwrite', (stores) => {
    return new Promise<void>((resolve, reject) => {
      const getReq = stores.offline_outbox.get(id);
      getReq.onsuccess = () => {
        const mutation = getReq.result as OutboxMutation | undefined;
        if (!mutation) {
          resolve();
          return;
        }
        mutation.status = status;
        if (lastError !== undefined) {
          mutation.lastError = lastError;
        }
        if (incrementRetry) {
          mutation.retryCount += 1;
        }
        const putReq = stores.offline_outbox.put(mutation);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
    });
  });
}

export async function deleteMutation(id: string): Promise<void> {
  await runTransaction('offline_outbox', 'readwrite', (stores) => {
    return new Promise<void>((resolve, reject) => {
      const req = stores.offline_outbox.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });
}

export async function clearAllPendingMutations(userId: string = DEFAULT_USER_ID): Promise<void> {
  const pending = await getPendingMutations(userId);
  await runTransaction('offline_outbox', 'readwrite', async (stores) => {
    for (const m of pending) {
      stores.offline_outbox.delete(m.id);
    }
  });
}

// -----------------------------------------------------------------------------
// Conflict Recording & Management
// -----------------------------------------------------------------------------

export async function recordConflict(
  conflict: Omit<SyncConflictRecord, 'id' | 'createdAt' | 'resolved'> & {
    userId?: string;
  }
): Promise<SyncConflictRecord> {
  const userId = conflict.userId || DEFAULT_USER_ID;
  const record: SyncConflictRecord = {
    id: generateId(),
    userId,
    syllabusId: conflict.syllabusId,
    mutationId: conflict.mutationId,
    mutationType: conflict.mutationType,
    clientPayload: conflict.clientPayload,
    serverErrorStatus: conflict.serverErrorStatus,
    errorMessage: conflict.errorMessage,
    createdAt: Date.now(),
    resolved: false,
  };

  await runTransaction('sync_conflicts', 'readwrite', (stores) => {
    return new Promise<void>((resolve, reject) => {
      const req = stores.sync_conflicts.add(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });

  return record;
}

export async function getUnresolvedConflicts(
  userId: string = DEFAULT_USER_ID
): Promise<SyncConflictRecord[]> {
  return runTransaction('sync_conflicts', 'readonly', (stores) => {
    return new Promise<SyncConflictRecord[]>((resolve, reject) => {
      const req = stores.sync_conflicts.getAll();
      req.onsuccess = () => {
        const all = (req.result as SyncConflictRecord[]) || [];
        const unresolved = all.filter((c) => c.userId === userId && !c.resolved);
        resolve(unresolved);
      };
      req.onerror = () => reject(req.error);
    });
  });
}

export async function markConflictResolved(conflictId: string): Promise<void> {
  await runTransaction('sync_conflicts', 'readwrite', (stores) => {
    return new Promise<void>((resolve, reject) => {
      const getReq = stores.sync_conflicts.get(conflictId);
      getReq.onsuccess = () => {
        const conflict = getReq.result as SyncConflictRecord | undefined;
        if (!conflict) {
          resolve();
          return;
        }
        conflict.resolved = true;
        const putReq = stores.sync_conflicts.put(conflict);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
    });
  });
}
