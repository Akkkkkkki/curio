/**
 * Phase 2.3: `services/db.ts` — Cleanup & Utilities (Integration)
 *
 * Focus: `cleanupOrphanedAssets(collections)`
 * - Removes orphaned blobs from IndexedDB asset stores
 * - Handles large cleanup batches
 *
 * IMPORTANT: TDD only — do not modify production implementations in these tests.
 */

import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import type { UserCollection } from '@/types';

let openDb: IDBDatabase | null = null;

/**
 * IMPORTANT:
 * These tests manipulate IndexedDB state and can conflict with other test files if run in parallel.
 * We remap the hardcoded production DB name to a per-file unique name to avoid cross-file blocking.
 */
const BASE_DB_NAME = 'CurioDatabase';
const TEST_DB_NAME = `${BASE_DB_NAME}__vitest_${Math.random().toString(16).slice(2)}`;
const originalOpen = indexedDB.open.bind(indexedDB);
const originalDeleteDatabase = indexedDB.deleteDatabase.bind(indexedDB);

Object.defineProperty(indexedDB, 'open', {
  configurable: true,
  value: ((name: string, version?: number) =>
    originalOpen(name === BASE_DB_NAME ? TEST_DB_NAME : name, version)) as any,
});
Object.defineProperty(indexedDB, 'deleteDatabase', {
  configurable: true,
  value: ((name: string) =>
    originalDeleteDatabase(name === BASE_DB_NAME ? TEST_DB_NAME : name)) as any,
});

afterAll(() => {
  Object.defineProperty(indexedDB, 'open', { configurable: true, value: originalOpen as any });
  Object.defineProperty(indexedDB, 'deleteDatabase', {
    configurable: true,
    value: originalDeleteDatabase as any,
  });
});

function deleteDatabase(name: string) {
  return new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

async function listKeys(db: IDBDatabase, storeName: string): Promise<string[]> {
  return await new Promise((resolve) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAllKeys();
    req.onsuccess = () => resolve((req.result || []).map((k) => String(k)));
    req.onerror = () => resolve([]);
  });
}

async function putBlobs(
  db: IDBDatabase,
  entries: Array<{ store: 'assets' | 'display'; key: string; value: Blob }>,
) {
  return await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['assets', 'display'], 'readwrite');
    const assets = tx.objectStore('assets');
    const display = tx.objectStore('display');

    for (const e of entries) {
      (e.store === 'assets' ? assets : display).put(e.value, e.key);
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function importDbModuleFresh() {
  vi.resetModules();
  vi.unstubAllEnvs();
  // Keep Supabase disabled for these tests.
  vi.stubEnv('VITE_SUPABASE_URL', '');
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY', '');
  return await import('@/services/db');
}

describe('Phase 2.3 — services/db.ts cleanup utilities', () => {
  beforeEach(async () => {
    if (openDb) {
      openDb.close();
      openDb = null;
    }
    await deleteDatabase('CurioDatabase');
  });

  afterEach(() => {
    if (openDb) {
      openDb.close();
      openDb = null;
    }
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('cleanupOrphanedAssets: deletes blobs whose keys do not map to any item id', async () => {
    /**
     * Scenario: an item was deleted but its blobs remain in IndexedDB.
     * Expected: orphaned keys are removed from both `assets` and `display` stores.
     */
    const dbMod = await importDbModuleFresh();
    const db = await dbMod.initDB();
    openDb = db;

    await putBlobs(db, [
      { store: 'assets', key: 'keep-1', value: new Blob(['a']) },
      { store: 'display', key: 'keep-1', value: new Blob(['d']) },
      { store: 'assets', key: 'orphan-1', value: new Blob(['a']) },
      { store: 'display', key: 'orphan-1', value: new Blob(['d']) },
    ]);

    const collections: UserCollection[] = [
      {
        id: 'col-1',
        templateId: 'vinyl',
        name: 'Col',
        customFields: [],
        items: [
          {
            id: 'keep-1',
            collectionId: 'col-1',
            photoUrl: 'asset',
            title: 'Kept',
            rating: 0,
            data: {},
            createdAt: new Date().toISOString(),
            notes: '',
          },
        ],
        settings: { displayFields: [], badgeFields: [] },
      },
    ];

    await expect(dbMod.cleanupOrphanedAssets(collections)).resolves.toBeUndefined();

    const assetKeys = await listKeys(db, 'assets');
    const displayKeys = await listKeys(db, 'display');

    expect(assetKeys).toContain('keep-1');
    expect(displayKeys).toContain('keep-1');
    expect(assetKeys).not.toContain('orphan-1');
    expect(displayKeys).not.toContain('orphan-1');
  });

  it('cleanupOrphanedAssets: with empty collections input, removes all asset keys (safe cleanup)', async () => {
    /**
     * Edge case: if no collections are valid, all asset keys are considered orphaned
     * and should be removed.
     */
    const dbMod = await importDbModuleFresh();
    const db = await dbMod.initDB();
    openDb = db;

    await putBlobs(db, [
      { store: 'assets', key: 'a1', value: new Blob(['a']) },
      { store: 'display', key: 'a1', value: new Blob(['d']) },
      { store: 'assets', key: 'a2', value: new Blob(['a']) },
      { store: 'display', key: 'a2', value: new Blob(['d']) },
    ]);

    await dbMod.cleanupOrphanedAssets([]);

    expect(await listKeys(db, 'assets')).toEqual([]);
    expect(await listKeys(db, 'display')).toEqual([]);
  });

  it('cleanupOrphanedAssets: handles large cleanup batches (100+ items) efficiently', async () => {
    /**
     * Performance/boundary: ensure large datasets are handled correctly.
     * We assert correctness (orphan keys removed) rather than timing.
     */
    const dbMod = await importDbModuleFresh();
    const db = await dbMod.initDB();
    openDb = db;

    const validCount = 120;
    const orphanCount = 30;

    const entries: Array<{ store: 'assets' | 'display'; key: string; value: Blob }> = [];
    for (let i = 0; i < validCount; i++) {
      entries.push({ store: 'assets', key: `valid-${i}`, value: new Blob(['a']) });
      entries.push({ store: 'display', key: `valid-${i}`, value: new Blob(['d']) });
    }
    for (let i = 0; i < orphanCount; i++) {
      entries.push({ store: 'assets', key: `orphan-${i}`, value: new Blob(['a']) });
      entries.push({ store: 'display', key: `orphan-${i}`, value: new Blob(['d']) });
    }
    await putBlobs(db, entries);

    const collections: UserCollection[] = [
      {
        id: 'col-batch',
        templateId: 'vinyl',
        name: 'Batch',
        customFields: [],
        items: Array.from({ length: validCount }, (_, i) => ({
          id: `valid-${i}`,
          collectionId: 'col-batch',
          photoUrl: 'asset',
          title: `Item ${i}`,
          rating: 0,
          data: {},
          createdAt: new Date().toISOString(),
          notes: '',
        })),
        settings: { displayFields: [], badgeFields: [] },
      },
    ];

    await dbMod.cleanupOrphanedAssets(collections);

    const assetKeys = await listKeys(db, 'assets');
    const displayKeys = await listKeys(db, 'display');
    expect(assetKeys.filter((k) => k.startsWith('orphan-'))).toHaveLength(0);
    expect(displayKeys.filter((k) => k.startsWith('orphan-'))).toHaveLength(0);
    expect(assetKeys.filter((k) => k.startsWith('valid-'))).toHaveLength(validCount);
    expect(displayKeys.filter((k) => k.startsWith('valid-'))).toHaveLength(validCount);
  });

  it('cleanupOrphanedAssets: rejects/throws on invalid input (null/undefined) rather than silently succeeding', async () => {
    /**
     * Error case: invalid inputs should fail fast; this prevents tests from masking bugs.
     */
    const dbMod = await importDbModuleFresh();
    await expect((dbMod as any).cleanupOrphanedAssets(null)).rejects.toBeTruthy();
    await expect((dbMod as any).cleanupOrphanedAssets(undefined)).rejects.toBeTruthy();
  });
});


