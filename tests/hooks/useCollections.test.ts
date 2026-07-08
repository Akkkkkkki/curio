/**
 * Phase 3.3: hooks/useCollections.ts — Collection Management Tests
 *
 * Success criteria:
 * - Collection fetching handles offline/online transitions
 * - First-time admin seeding behavior works
 * - Offline mode falls back to local cache
 *
 * IMPORTANT (TDD): Do not modify production implementations while writing these tests.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { UserCollection } from '@/types';
import { CURRENT_SEED_VERSION, INITIAL_COLLECTIONS } from '@/services/seedCollections';

const dbMocks = {
  fetchCloudCollections: vi.fn(),
  getLocalCollections: vi.fn(),
  getPendingSyncIds: vi.fn(),
  getPendingDeletes: vi.fn(),
  hasLocalOnlyData: vi.fn(),
  mergeCollections: vi.fn(),
  requestPersistence: vi.fn(),
  saveAllCollections: vi.fn(),
  saveCollection: vi.fn(),
  getSeedVersion: vi.fn(),
  setSeedVersion: vi.fn(),
  setRecoveryCallback: vi.fn(),
  setAssetSyncStatusCallback: vi.fn(),
  setSyncStatusCallback: vi.fn(),
  syncPendingChanges: vi.fn(),
  syncPendingAssetUploads: vi.fn(),
  syncPendingDeletes: vi.fn(),
};

vi.mock('@/services/db', () => dbMocks);

function minimalCollection(overrides: Partial<UserCollection> = {}): UserCollection {
  return {
    id: 'c1',
    templateId: 'vinyl',
    name: 'Test Collection',
    icon: '🎷',
    customFields: [],
    items: [],
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as UserCollection;
}

describe('hooks/useCollections.ts (Phase 3.3)', () => {
  const t = (key: string) => key;
  const showStatus = vi.fn();
  const fallbackSampleCollections: UserCollection[] = [minimalCollection({ id: 'sample' })];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    // Reset all mocks with default values
    dbMocks.requestPersistence.mockResolvedValue(undefined);
    dbMocks.getLocalCollections.mockResolvedValue([]);
    dbMocks.fetchCloudCollections.mockResolvedValue([]);
    dbMocks.getPendingSyncIds.mockResolvedValue([]);
    dbMocks.getPendingDeletes.mockResolvedValue([]);
    dbMocks.hasLocalOnlyData.mockReturnValue(false);
    dbMocks.mergeCollections.mockImplementation(
      (local: UserCollection[], cloud: UserCollection[]) => (cloud.length ? cloud : local),
    );
    dbMocks.saveAllCollections.mockResolvedValue(undefined);
    dbMocks.saveCollection.mockResolvedValue(undefined);
    dbMocks.getSeedVersion.mockResolvedValue(CURRENT_SEED_VERSION);
    dbMocks.setSeedVersion.mockResolvedValue(undefined);
    dbMocks.setRecoveryCallback.mockImplementation(() => {});
    dbMocks.setAssetSyncStatusCallback.mockImplementation(() => {});
    dbMocks.setSyncStatusCallback.mockImplementation(() => {});
    dbMocks.syncPendingChanges.mockResolvedValue(0);
    dbMocks.syncPendingAssetUploads.mockResolvedValue(0);
    dbMocks.syncPendingDeletes.mockResolvedValue(0);
  });

  afterEach(() => {
    showStatus.mockClear();
  });

  it('offline: when cloud fetch fails but cache exists, shows cached collections without blocking on an error', async () => {
    /**
     * Verifies offline behavior:
     * - Cloud fetch failure does not blank the UI
     * - Local IndexedDB cache is used and rendered (not hidden behind a
     *   full-screen error)
     * - The sync problem is surfaced via a non-blocking status toast
     */
    const local = [minimalCollection({ id: 'local' })];
    dbMocks.getLocalCollections.mockResolvedValue(local);
    dbMocks.fetchCloudCollections.mockRejectedValue(new Error('Network down'));

    const { useCollections } = await import('@/hooks/useCollections');
    const { result } = renderHook(() =>
      useCollections({
        user: { id: 'u1' } as any,
        isAdmin: false,
        isSupabaseReady: true,
        fallbackSampleCollections,
        t,
        showStatus,
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.collections).toEqual(local);
    expect(result.current.loadError).toBeNull();
    expect(showStatus).toHaveBeenCalledWith('statusSyncPaused', 'error');
  });

  it('offline: when cloud fetch fails and there is no cache, surfaces a blocking sync-paused error', async () => {
    /**
     * Verifies the genuine dead-end case:
     * - No local cache AND cloud unreachable for a signed-in user
     * - A blocking error is shown so the user can retry
     */
    dbMocks.getLocalCollections.mockResolvedValue([]);
    dbMocks.fetchCloudCollections.mockRejectedValue(new Error('Network down'));

    const { useCollections } = await import('@/hooks/useCollections');
    const { result } = renderHook(() =>
      useCollections({
        user: { id: 'u1' } as any,
        isAdmin: false,
        isSupabaseReady: true,
        fallbackSampleCollections,
        t,
        showStatus,
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.collections).toEqual([]);
    expect(result.current.loadError).toContain('Unable to sync with Supabase');
    expect(showStatus).toHaveBeenCalledWith('statusSyncPaused', 'error');
  });

  it('happy path: with a user, merges local+cloud, persists merged snapshot, and reports synced', async () => {
    /**
     * Verifies standard online behavior:
     * - Loads local cache
     * - Fetches cloud collections
     * - Merges local/cloud collections and persists the merged snapshot
     * - Reports "synced" status
     */
    const local = [minimalCollection({ id: 'local' })];
    const cloud = [minimalCollection({ id: 'cloud' })];
    const merged = [...cloud];
    dbMocks.getLocalCollections.mockResolvedValue(local);
    dbMocks.fetchCloudCollections.mockResolvedValue(cloud);
    dbMocks.hasLocalOnlyData.mockReturnValue(false);
    dbMocks.getPendingSyncIds.mockResolvedValue([]);
    dbMocks.mergeCollections.mockReturnValue(merged);

    const { useCollections } = await import('@/hooks/useCollections');
    const { result } = renderHook(() =>
      useCollections({
        user: { id: 'u1' } as any,
        isAdmin: false,
        isSupabaseReady: true,
        fallbackSampleCollections,
        t,
        showStatus,
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.collections).toEqual(merged);
    expect(result.current.loadError).toBeNull();
    expect(result.current.hasLocalImport).toBe(false);
    expect(dbMocks.saveAllCollections).toHaveBeenCalledWith(merged);
    expect(showStatus).toHaveBeenCalledWith('statusSynced', 'success');
  });

  it('first-time admin: when local+cloud are empty and seed version is outdated, seeds INITIAL_COLLECTIONS and sets seed version', async () => {
    /**
     * Verifies first-time/admin seeding path:
     * - When both local and cloud are empty AND user is admin
     * - If local seed version < CURRENT_SEED_VERSION
     * - The hook saves each initial seed collection and updates seed version
     */
    dbMocks.getLocalCollections.mockResolvedValue([]);
    dbMocks.fetchCloudCollections.mockResolvedValue([]);
    dbMocks.hasLocalOnlyData.mockReturnValue(false);
    dbMocks.getSeedVersion.mockResolvedValue(0);

    const { useCollections } = await import('@/hooks/useCollections');
    const { result } = renderHook(() =>
      useCollections({
        user: { id: 'admin-1' } as any,
        isAdmin: true,
        isSupabaseReady: true,
        fallbackSampleCollections,
        t,
        showStatus,
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(dbMocks.saveCollection).toHaveBeenCalledTimes(INITIAL_COLLECTIONS.length);
    const firstCallArg = dbMocks.saveCollection.mock.calls[0]?.[0];
    expect(firstCallArg).toMatchObject({ ownerId: 'admin-1', isPublic: true });

    expect(dbMocks.setSeedVersion).toHaveBeenCalledWith(CURRENT_SEED_VERSION);
    expect(result.current.collections).toHaveLength(INITIAL_COLLECTIONS.length);
  });

  it('admin repair (CUR-143): a drifted cloud sample (private, partial) is re-upserted even when the seed version is current', async () => {
    /**
     * The cloud copy of the master sample can drift outside the app (toggled
     * private, seed items lost). The old empty-cloud-only gate could never
     * repair it. Verifies the admin load path reconciles a drifted copy.
     */
    const masterSeed = INITIAL_COLLECTIONS[0];
    const driftedSample: UserCollection = {
      ...masterSeed,
      ownerId: 'admin-1',
      isPublic: false, // drifted: should be public
      items: [{ ...masterSeed.items[0] }], // drifted: only 1 of 5 seed items
    };
    dbMocks.fetchCloudCollections.mockResolvedValue([driftedSample]);
    dbMocks.getSeedVersion.mockResolvedValue(CURRENT_SEED_VERSION);

    const { useCollections } = await import('@/hooks/useCollections');
    const { result } = renderHook(() =>
      useCollections({
        user: { id: 'admin-1' } as any,
        isAdmin: true,
        isSupabaseReady: true,
        fallbackSampleCollections,
        t,
        showStatus,
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(dbMocks.saveCollection).toHaveBeenCalledTimes(1);
    const repaired = dbMocks.saveCollection.mock.calls[0]?.[0];
    expect(repaired).toMatchObject({ id: masterSeed.id, ownerId: 'admin-1', isPublic: true });
    expect(repaired.items).toHaveLength(masterSeed.items.length);
    expect(dbMocks.setSeedVersion).toHaveBeenCalledWith(CURRENT_SEED_VERSION);
  });

  it('admin repair (CUR-143): a healthy cloud sample is a no-op — nothing is re-upserted on load', async () => {
    const masterSeed = INITIAL_COLLECTIONS[0];
    const healthySample: UserCollection = {
      ...masterSeed,
      ownerId: 'admin-1',
      isPublic: true,
      items: masterSeed.items.map((item) => ({ ...item })),
    };
    dbMocks.fetchCloudCollections.mockResolvedValue([healthySample]);
    dbMocks.getSeedVersion.mockResolvedValue(CURRENT_SEED_VERSION);

    const { useCollections } = await import('@/hooks/useCollections');
    const { result } = renderHook(() =>
      useCollections({
        user: { id: 'admin-1' } as any,
        isAdmin: true,
        isSupabaseReady: true,
        fallbackSampleCollections,
        t,
        showStatus,
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(dbMocks.saveCollection).not.toHaveBeenCalled();
    expect(dbMocks.setSeedVersion).not.toHaveBeenCalled();
  });

  it('edge case: when Supabase is not ready, returns an empty collection list and does not error', async () => {
    /**
     * Verifies a boundary condition:
     * - If Supabase is not ready, the hook should stop loading and return empty collections.
     */
    const { useCollections } = await import('@/hooks/useCollections');
    const { result } = renderHook(() =>
      useCollections({
        user: null,
        isAdmin: false,
        isSupabaseReady: false,
        fallbackSampleCollections,
        t,
        showStatus,
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.collections).toEqual([]);
    expect(result.current.loadError).toBeNull();
  });

  it('surfaces asset upload failures via status toasts', async () => {
    let assetStatusCallback: ((status: any, details?: any) => void) | null = null;
    dbMocks.setAssetSyncStatusCallback.mockImplementation((cb) => {
      assetStatusCallback = cb;
    });

    const { useCollections } = await import('@/hooks/useCollections');
    renderHook(() =>
      useCollections({
        user: { id: 'u1' } as any,
        isAdmin: false,
        isSupabaseReady: true,
        fallbackSampleCollections,
        t,
        showStatus,
      }),
    );

    await waitFor(() => expect(dbMocks.setAssetSyncStatusCallback).toHaveBeenCalled());
    expect(assetStatusCallback).toBeTruthy();

    assetStatusCallback?.('error', { error: 'Upload failed' });
    expect(showStatus).toHaveBeenCalledWith('statusPhotosSyncFailed', 'error');
  });

  it('edge case: signed-out user with no data uses fallback sample collections', async () => {
    /**
     * Verifies unauthenticated first-use behavior:
     * - If there is no cloud data and no local cache, show sample/fallback collections.
     */
    dbMocks.getLocalCollections.mockResolvedValue([]);
    dbMocks.fetchCloudCollections.mockResolvedValue([]);

    const { useCollections } = await import('@/hooks/useCollections');
    const { result } = renderHook(() =>
      useCollections({
        user: null,
        isAdmin: false,
        isSupabaseReady: true,
        fallbackSampleCollections,
        t,
        showStatus,
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.collections).toEqual(fallbackSampleCollections);
  });

  it('hasLocalImport is true when local-only data exists', async () => {
    /**
     * Verifies that the hook correctly identifies when there is local data
     * that hasn't been synced to cloud yet.
     */
    const local = [minimalCollection({ id: 'local-only' })];
    const cloud = [minimalCollection({ id: 'cloud' })];
    const merged = [...cloud, ...local];
    dbMocks.getLocalCollections.mockResolvedValue(local);
    dbMocks.fetchCloudCollections.mockResolvedValue(cloud);
    dbMocks.hasLocalOnlyData.mockReturnValue(true);
    dbMocks.getPendingSyncIds.mockResolvedValue(['local-only']);
    dbMocks.mergeCollections.mockReturnValue(merged);

    const { useCollections } = await import('@/hooks/useCollections');
    const { result } = renderHook(() =>
      useCollections({
        user: { id: 'u1' } as any,
        isAdmin: false,
        isSupabaseReady: true,
        fallbackSampleCollections,
        t,
        showStatus,
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasLocalImport).toBe(true);
    expect(result.current.collections).toEqual(merged);
    expect(dbMocks.saveAllCollections).toHaveBeenCalledWith(merged);
  });

  it('handleOnline: catches and reports errors during sync recovery', async () => {
    /**
     * Verifies that if syncPendingChanges throws during the online event,
     * the error is caught and reported to the user.
     */
    dbMocks.syncPendingChanges.mockRejectedValue(new Error('Sync failed'));

    const { useCollections } = await import('@/hooks/useCollections');
    renderHook(() =>
      useCollections({
        user: { id: 'u1' } as any,
        isAdmin: false,
        isSupabaseReady: true,
        fallbackSampleCollections,
        t,
        showStatus,
      }),
    );

    // Simulate online event
    window.dispatchEvent(new Event('online'));

    await waitFor(() => {
      expect(showStatus).toHaveBeenCalledWith(expect.stringContaining('statusSyncError'), 'error');
    });
  });
});
