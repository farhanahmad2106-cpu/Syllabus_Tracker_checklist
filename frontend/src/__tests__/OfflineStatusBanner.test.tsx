import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OfflineStatusBanner } from '../components/OfflineStatusBanner';
import type { SyncConflictRecord } from '../lib/offlineStore';

describe('OfflineStatusBanner Component', () => {
  const defaultProps = {
    isOnline: true,
    syncStatus: 'online' as const,
    pendingCount: 0,
    conflicts: [] as SyncConflictRecord[],
    lastError: null,
    onRetry: vi.fn(),
    onDismissError: vi.fn(),
    onResolveConflict: vi.fn(),
  };

  it('renders nothing when online with zero pending changes and no conflicts', () => {
    const { container } = render(<OfflineStatusBanner {...defaultProps} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders offline banner with queued count and polite ARIA status when offline', () => {
    render(
      <OfflineStatusBanner
        {...defaultProps}
        isOnline={false}
        syncStatus="offline"
        pendingCount={4}
      />
    );

    const banner = screen.getByTestId('offline-banner');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveAttribute('role', 'status');
    expect(banner).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText('Offline Mode')).toBeInTheDocument();
    expect(screen.getByText('4 changes queued')).toBeInTheDocument();
  });

  it('renders active syncing banner during outbox replay', () => {
    render(
      <OfflineStatusBanner
        {...defaultProps}
        isOnline={true}
        syncStatus="syncing"
        pendingCount={2}
      />
    );

    const banner = screen.getByTestId('syncing-banner');
    expect(banner).toBeInTheDocument();
    expect(screen.getByText(/Synchronizing 2 offline changes with server/i)).toBeInTheDocument();
  });

  it('renders sync error banner with retry and dismiss triggers', () => {
    const onRetry = vi.fn();
    const onDismiss = vi.fn();

    render(
      <OfflineStatusBanner
        {...defaultProps}
        isOnline={true}
        syncStatus="sync_error"
        pendingCount={1}
        lastError="Network timeout"
        onRetry={onRetry}
        onDismissError={onDismiss}
      />
    );

    const banner = screen.getByTestId('sync-error-banner');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveAttribute('role', 'alert');
    expect(screen.getByText('Network timeout')).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /Retry/i });
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);

    const dismissBtn = screen.getByLabelText('Dismiss sync error');
    fireEvent.click(dismissBtn);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders conflict alert with dismiss conflict action when conflicts exist', () => {
    const onResolve = vi.fn();
    const mockConflict: SyncConflictRecord = {
      id: 'conf_1',
      userId: 'user_1',
      syllabusId: 'syl_1',
      mutationId: 'mut_1',
      mutationType: 'TOGGLE_LEAF',
      clientPayload: {},
      errorMessage: 'Topic deleted remotely',
      createdAt: Date.now(),
      resolved: false,
    };

    render(
      <OfflineStatusBanner
        {...defaultProps}
        isOnline={true}
        syncStatus="conflict"
        conflicts={[mockConflict]}
        onResolveConflict={onResolve}
      />
    );

    const banner = screen.getByTestId('sync-conflict-banner');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveAttribute('role', 'alert');

    const dismissConflictBtn = screen.getByRole('button', { name: /Dismiss Conflict/i });
    fireEvent.click(dismissConflictBtn);
    expect(onResolve).toHaveBeenCalledWith('conf_1');
  });
});
