/**
 * Phase 3.3: hooks/useCollections.ts — Collection Management Tests
 *
 * Success criteria (from docs/TESTING_ROADMAP.md Phase 3):
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
  hasLocalOnlyData: vi.fn(),
  requestPersistence: vi.fn(),
  saveAllCollections: vi.fn(),
  saveCollection: vi.fn(),
  getSeedVersion: vi.fn(),
  setSeedVersion: vi.fn(),
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
    settings: { displayFields: [], badgeFields: [] },
    ...overrides,
  } as UserCollection;
}

describe('hooks/useCollections.ts (Phase 3.3)', () => {
  const t = (key: string) => key;
  const showStatus = vi.fn();
  const fallbackSampleCollections: UserCollection[] = [minimalCollection({ id: 'sample' })];

  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.requestPersistence.mockResolvedValue(undefined);
    dbMocks.getLocalCollections.mockResolvedValue([]);
    dbMocks.fetchCloudCollections.mockResolvedValue([]);
    dbMocks.hasLocalOnlyData.mockReturnValue(false);
    dbMocks.saveAllCollections.mockResolvedValue(undefined);
    dbMocks.saveCollection.mockResolvedValue(undefined);
    dbMocks.getSeedVersion.mockResolvedValue(CURRENT_SEED_VERSION);
    dbMocks.setSeedVersion.mockResolvedValue(undefined);
  });

  afterEach(() => {
    showStatus.mockClear();
  });

  it('offline: when cloud fetch fails, falls back to local collections and exposes a sync-paused error', async () => {
    /**
     * Verifies offline behavior:
     * - Cloud fetch failure does not blank the UI
     * - Local IndexedDB cache is used
     * - loadError is set and showStatus is called with an error tone
     */
    const local = [minimalCollection({ id: 'local' })];
    dbMocks.getLocalCollections.mockResolvedValueOnce(local);
    dbMocks.fetchCloudCollections.mockRejectedValueOnce(new Error('Network down'));

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
    expect(result.current.loadError).toContain('Unable to sync with Supabase');
    expect(showStatus).toHaveBeenCalledWith('statusSyncPaused', 'error');
  });

  it('happy path: with a user, uses cloud collections, persists them locally, and reports synced', async () => {
    /**
     * Verifies standard online behavior:
     * - Loads local cache
     * - Fetches cloud collections
     * - When there is no local-only data, saves cloud collections to local storage
     * - Reports "synced" status
     */
    const local = [minimalCollection({ id: 'local' })];
    const cloud = [minimalCollection({ id: 'cloud' })];
    dbMocks.getLocalCollections.mockResolvedValueOnce(local);
    dbMocks.fetchCloudCollections.mockResolvedValueOnce(cloud);
    dbMocks.hasLocalOnlyData.mockReturnValueOnce(false);

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
    expect(result.current.collections).toEqual(cloud);
    expect(result.current.loadError).toBeNull();
    expect(result.current.hasLocalImport).toBe(false);
    expect(dbMocks.saveAllCollections).toHaveBeenCalledWith(cloud);
    expect(showStatus).toHaveBeenCalledWith('statusSynced', 'success');
  });

  it('first-time admin: when local+cloud are empty and seed version is outdated, seeds INITIAL_COLLECTIONS and sets seed version', async () => {
    /**
     * Verifies first-time/admin seeding path:
     * - When both local and cloud are empty AND user is admin
     * - If local seed version < CURRENT_SEED_VERSION
     * - The hook saves each initial seed collection and updates seed version
     */
    dbMocks.getLocalCollections.mockResolvedValueOnce([]);
    dbMocks.fetchCloudCollections.mockResolvedValueOnce([]);
    dbMocks.hasLocalOnlyData.mockReturnValueOnce(false);
    dbMocks.getSeedVersion.mockResolvedValueOnce(0);

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

  it('edge case: signed-out user with no data uses fallback sample collections', async () => {
    /**
     * Verifies unauthenticated first-use behavior:
     * - If there is no cloud data and no local cache, show sample/fallback collections.
     */
    dbMocks.getLocalCollections.mockResolvedValueOnce([]);
    dbMocks.fetchCloudCollections.mockResolvedValueOnce([]);

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
});


