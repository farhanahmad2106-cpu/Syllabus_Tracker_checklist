import React from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  CloudOff,
  RefreshCw,
  WifiOff,
  X,
} from 'lucide-react';
import type { SyncStatus } from '../hooks/useOfflineSync';
import type { SyncConflictRecord } from '../lib/offlineStore';

export interface OfflineStatusBannerProps {
  isOnline: boolean;
  syncStatus: SyncStatus;
  pendingCount: number;
  conflicts: SyncConflictRecord[];
  lastError: string | null;
  onRetry: () => void;
  onDismissError: () => void;
  onResolveConflict?: (conflictId: string) => void;
}

export const OfflineStatusBanner: React.FC<OfflineStatusBannerProps> = ({
  isOnline,
  syncStatus,
  pendingCount,
  conflicts,
  lastError,
  onRetry,
  onDismissError,
  onResolveConflict,
}) => {
  // If fully online with no pending mutations, no errors, and no conflicts, hide banner
  if (isOnline && syncStatus === 'online' && pendingCount === 0 && conflicts.length === 0) {
    return null;
  }

  // 1. Conflict Alert State
  if (conflicts.length > 0 || syncStatus === 'conflict') {
    return (
      <div
        role="alert"
        aria-live="assertive"
        data-testid="sync-conflict-banner"
        className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2.5 text-xs text-amber-700 dark:text-amber-200 flex items-center justify-between gap-3 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <div className="truncate">
            <span className="font-bold">Sync Conflict:</span>{' '}
            <span>
              {conflicts.length} local change(s) could not be applied because the remote item was
              modified or removed on the server.
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {conflicts.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onResolveConflict?.(c.id)}
              className="px-2.5 py-1 text-[11px] font-medium bg-amber-600 text-white dark:bg-amber-500 rounded-lg hover:bg-amber-700 transition-colors cursor-pointer"
            >
              Dismiss Conflict
            </button>
          ))}
        </div>
      </div>
    );
  }

  // 2. Active Syncing State
  if (syncStatus === 'syncing') {
    return (
      <div
        role="status"
        aria-live="polite"
        data-testid="syncing-banner"
        className="bg-emerald-500/15 border-b border-emerald-500/30 px-4 py-2 text-xs text-emerald-700 dark:text-emerald-300 flex items-center justify-between gap-3 transition-colors"
      >
        <div className="flex items-center gap-2">
          <RefreshCw className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 animate-spin shrink-0" />
          <span>
            Synchronizing {pendingCount} offline change{pendingCount !== 1 ? 's' : ''} with server...
          </span>
        </div>
      </div>
    );
  }

  // 3. Sync Error State
  if (syncStatus === 'sync_error' || syncStatus === 'storage_error') {
    return (
      <div
        role="alert"
        aria-live="assertive"
        data-testid="sync-error-banner"
        className="bg-red-500/15 border-b border-red-500/30 px-4 py-2 text-xs text-red-700 dark:text-red-300 flex items-center justify-between gap-3 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
          <div className="truncate">
            <span className="font-bold">Sync Error:</span>{' '}
            <span>{lastError || 'Failed to replay changes.'}</span>
            {pendingCount > 0 && (
              <span className="ml-1 opacity-80">
                ({pendingCount} pending in local outbox)
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onRetry}
            className="px-2.5 py-1 text-[11px] font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry</span>
          </button>
          <button
            type="button"
            onClick={onDismissError}
            className="p-1 text-red-600 dark:text-red-400 hover:text-red-800 rounded-md cursor-pointer"
            aria-label="Dismiss sync error"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // 4. Offline State
  if (!isOnline || syncStatus === 'offline') {
    return (
      <div
        role="status"
        aria-live="polite"
        data-testid="offline-banner"
        className="bg-[var(--bg-surface-elevated)] border-b border-[var(--border-subtle)] px-4 py-2 text-xs text-[var(--text-secondary)] flex items-center justify-between gap-3 transition-colors"
      >
        <div className="flex items-center gap-2">
          <WifiOff className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span>
            <strong className="text-[var(--text-primary)]">Offline Mode</strong> &bull; Changes are
            saved to local storage and will automatically synchronize when reconnected.
          </span>
        </div>
        {pendingCount > 0 && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
            {pendingCount} change{pendingCount !== 1 ? 's' : ''} queued
          </span>
        )}
      </div>
    );
  }

  return null;
};
