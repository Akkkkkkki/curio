/**
 * Phase 2.1: `services/db.ts` — Merge Logic (Integration Contract)
 *
 * This suite is intentionally written TDD-first based on `docs/TESTING_ROADMAP.md`.
 * Some tests will FAIL until the roadmap-specified APIs are exported/implemented.
 *
 * Success criteria (roadmap):
 * - Merge logic passes all conflict resolution scenarios
 * - No data loss in 100 randomized sync scenarios
 */

import { describe, it, expect, afterEach, vi } from 'vitest';

async function importDbModuleFresh(env: { supabaseUrl?: string; supabaseKey?: string } = {}) {
  vi.resetModules();
  vi.unstubAllEnvs();

  // Keep Supabase disabled by default for merge logic tests.
  vi.stubEnv('VITE_SUPABASE_URL', env.supabaseUrl ?? '');
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY', env.supabaseKey ?? '');

  return await import('@/services/db');
}

function isoAt(hoursFromEpoch: number) {
  return new Date(hoursFromEpoch * 60 * 60 * 1000).toISOString();
}

describe('Phase 2.1 — services/db.ts merge logic (roadmap contract)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('exports mergeCollections(localCollections, cloudCollections, cloudDeletedIds?) as a function', async () => {
    /**
     * Verifies the roadmap API exists. This SHOULD FAIL until `mergeCollections`
     * is exported from `services/db.ts`.
     */
    const mod = await importDbModuleFresh();
    expect(typeof (mod as any).mergeCollections).toBe('function');
  });

  it('exports mergeItems(localItems, cloudItems, cloudDeletedIds?) as a function', async () => {
    /**
     * Verifies the roadmap API exists. This SHOULD FAIL until `mergeItems`
     * is exported from `services/db.ts`.
     */
    const mod = await importDbModuleFresh();
    expect(typeof (mod as any).mergeItems).toBe('function');
  });

  it('Scenario: cloud newer -> cloud wins for conflicting collection metadata', async () => {
    /**
     * If the same collection exists locally and in cloud, and cloud has a newer `updatedAt`,
     * the merged result should prefer cloud metadata (name/icon/template/settings, etc.).
     */
    const mod = await importDbModuleFresh();
    const mergeCollections = (mod as any).mergeCollections as undefined | ((a: any, b: any) => any);
    if (typeof mergeCollections !== 'function') {
      throw new Error('mergeCollections is not implemented/exported yet (TDD).');
    }

    const local = [
      {
        id: 'col-1',
        templateId: 'vinyl',
        name: 'Local Name',
        icon: '🎵',
        customFields: [],
        items: [],
        settings: { displayFields: [], badgeFields: [] },
        updatedAt: isoAt(1),
      },
    ];

    const cloud = [
      {
        id: 'col-1',
        templateId: 'vinyl',
        name: 'Cloud Name',
        icon: '☁️',
        customFields: [],
        items: [],
        settings: { displayFields: [], badgeFields: [] },
        updatedAt: isoAt(2),
      },
    ];

    const merged = mergeCollections(local, cloud);
    expect(merged).toHaveLength(1);
    expect(merged[0].name).toBe('Cloud Name');
    expect(merged[0].icon).toBe('☁️');
  });

  it('Scenario: local newer -> local wins for conflicting item fields (same item id)', async () => {
    /**
     * When an item exists both locally and in cloud, `updatedAt` (or fallback timestamp)
     * should decide the winner. If local is newer, merged should use local item data.
     */
    const mod = await importDbModuleFresh();
    const mergeItems = (mod as any).mergeItems as undefined | ((a: any, b: any) => any);
    if (typeof mergeItems !== 'function') {
      throw new Error('mergeItems is not implemented/exported yet (TDD).');
    }

    const localItems = [
      {
        id: 'item-1',
        collectionId: 'col-1',
        photoUrl: 'local.jpg',
        title: 'Local Title',
        rating: 5,
        data: {},
        createdAt: isoAt(0),
        updatedAt: isoAt(10),
        notes: '',
      },
    ];
    const cloudItems = [
      {
        id: 'item-1',
        collectionId: 'col-1',
        photoUrl: 'cloud.jpg',
        title: 'Cloud Title',
        rating: 1,
        data: {},
        createdAt: isoAt(0),
        updatedAt: isoAt(2),
        notes: '',
      },
    ];

    const merged = mergeItems(localItems, cloudItems);
    expect(merged).toHaveLength(1);
    expect(merged[0].title).toBe('Local Title');
    expect(merged[0].photoUrl).toBe('local.jpg');
    expect(merged[0].rating).toBe(5);
  });

  it('Scenario: cloud deletion list removes local entities (collections/items) and prevents resurrection', async () => {
    /**
     * Roadmap specifies a `cloudDeletedIds?` parameter to ensure deleted records do not
     * reappear from local cache.
     */
    const mod = await importDbModuleFresh();
    const mergeCollections = (mod as any).mergeCollections as
      | undefined
      | ((local: any[], cloud: any[], cloudDeletedIds?: string[]) => any[]);

    if (typeof mergeCollections !== 'function') {
      throw new Error('mergeCollections is not implemented/exported yet (TDD).');
    }

    const local = [
      {
        id: 'deleted-col',
        templateId: 'vinyl',
        name: 'Local Deleted',
        icon: '🗑️',
        customFields: [],
        items: [
          {
            id: 'deleted-item',
            collectionId: 'deleted-col',
            photoUrl: 'local.jpg',
            title: 'Should be deleted',
            rating: 0,
            data: {},
            createdAt: isoAt(0),
            notes: '',
          },
        ],
        settings: { displayFields: [], badgeFields: [] },
        updatedAt: isoAt(1),
      },
    ];

    const cloud: any[] = []; // Cloud no longer has it
    const merged = mergeCollections(local, cloud, ['deleted-col', 'deleted-item']);

    expect(merged.find((c) => c.id === 'deleted-col')).toBeUndefined();
  });

  it('Edge case: empty inputs return empty outputs (no exceptions)', async () => {
    /**
     * Merge helpers should be safe for empty arrays, returning empty arrays.
     */
    const mod = await importDbModuleFresh();
    const mergeCollections = (mod as any).mergeCollections as undefined | ((a: any[], b: any[]) => any[]);
    const mergeItems = (mod as any).mergeItems as undefined | ((a: any[], b: any[]) => any[]);
    if (typeof mergeCollections !== 'function' || typeof mergeItems !== 'function') {
      throw new Error('mergeCollections/mergeItems are not implemented/exported yet (TDD).');
    }

    expect(mergeCollections([], [])).toEqual([]);
    expect(mergeItems([], [])).toEqual([]);
  });

  it('Property test: 100 randomized scenarios never lose local-only records unless cloud deleted', async () => {
    /**
     * Roadmap success criteria: “No data loss in 100 randomized sync scenarios”.
     *
     * Contract: any local-only collection/item IDs (not present in cloud) should remain
     * present after merge, unless explicitly present in `cloudDeletedIds`.
     */
    const mod = await importDbModuleFresh();
    const mergeCollections = (mod as any).mergeCollections as
      | undefined
      | ((local: any[], cloud: any[], cloudDeletedIds?: string[]) => any[]);
    if (typeof mergeCollections !== 'function') {
      throw new Error('mergeCollections is not implemented/exported yet (TDD).');
    }

    const rand = (seed: number) => {
      // Deterministic linear congruential generator for reproducible tests
      let s = seed >>> 0;
      return () => {
        s = (1664525 * s + 1013904223) >>> 0;
        return s / 2 ** 32;
      };
    };

    const r = rand(42);
    for (let i = 0; i < 100; i++) {
      const localOnlyCount = 1 + Math.floor(r() * 5);
      const sharedCount = 1 + Math.floor(r() * 5);

      const localOnly = Array.from({ length: localOnlyCount }, (_, idx) => ({
        id: `local-only-${i}-${idx}`,
        templateId: 'vinyl',
        name: `Local Only ${idx}`,
        customFields: [],
        items: [],
        settings: { displayFields: [], badgeFields: [] },
        updatedAt: isoAt(1),
      }));

      const sharedLocal = Array.from({ length: sharedCount }, (_, idx) => ({
        id: `shared-${i}-${idx}`,
        templateId: 'vinyl',
        name: `Shared Local ${idx}`,
        customFields: [],
        items: [],
        settings: { displayFields: [], badgeFields: [] },
        updatedAt: isoAt(2 + Math.floor(r() * 3)),
      }));

      const sharedCloud = sharedLocal.map((c) => ({
        ...c,
        name: `Shared Cloud ${c.id}`,
        updatedAt: isoAt(2 + Math.floor(r() * 3)),
      }));

      const merged = mergeCollections([...localOnly, ...sharedLocal], sharedCloud, []);
      for (const col of localOnly) {
        expect(merged.some((m: any) => m.id === col.id)).toBe(true);
      }
    }
  });
});


