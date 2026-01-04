/**
 * Phase 2.2: `services/db.ts` — Dual-Write Operations (Integration)
 *
 * These tests validate that DB operations write to IndexedDB and attempt to sync to Supabase
 * when configured, with correct rollback / eventual consistency behavior.
 *
 * IMPORTANT: TDD only — do not modify production implementations in these tests.
 */

import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import type { UserCollection, CollectionItem } from '@/types';

let openDb: IDBDatabase | null = null;

/**
 * IMPORTANT:
 * `services/db.ts` uses a fixed database name ("CurioDatabase").
 * Vitest runs test files in parallel by default, so IndexedDB tests that delete/reset the same DB
 * can block each other and cause timeouts.
 *
 * To make these tests deterministic, we map "CurioDatabase" -> a per-file unique DB name.
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

async function readFromStore<T>(db: IDBDatabase, storeName: string, key: IDBValidKey): Promise<T | null> {
  return await new Promise((resolve) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve((req.result as T) ?? null);
    req.onerror = () => resolve(null);
  });
}

async function clearStores(db: IDBDatabase, storeNames: string[]) {
  return await new Promise<void>((resolve) => {
    const tx = db.transaction(storeNames, 'readwrite');
    storeNames.forEach((name) => tx.objectStore(name).clear());
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
    tx.onabort = () => resolve();
  });
}

function createSupabaseMock() {
  const collectionsUpsert = vi.fn().mockResolvedValue({ error: null });
  const itemsUpsert = vi.fn().mockResolvedValue({ error: null });
  const upload = vi.fn().mockResolvedValue({ data: { path: 'ok' }, error: null });

  const from = vi.fn((table: string) => {
    return {
      upsert: table === 'collections' ? collectionsUpsert : itemsUpsert,
      // present for completeness; not used directly by these tests
      select: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
    };
  });

  return {
    supabase: {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } }, error: null }),
      },
      from,
      storage: {
        from: vi.fn(() => ({ upload })),
      },
    },
    collectionsUpsert,
    itemsUpsert,
    upload,
    from,
  };
}

async function importDbModuleFreshWithSupabaseMock(supabaseMock: any, env?: { syncTimestamps?: 'true' | 'false' }) {
  vi.resetModules();
  vi.unstubAllEnvs();

  vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY', 'test-key');
  vi.stubEnv('VITE_SUPABASE_SYNC_TIMESTAMPS', env?.syncTimestamps ?? 'true');

  // Ensure the Supabase client created inside `services/supabase.ts` is our controlled mock.
  vi.doMock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => supabaseMock),
  }));

  return await import('@/services/db');
}

describe('Phase 2.2 — services/db.ts dual-write operations', () => {
  beforeEach(async () => {
    if (openDb) {
      openDb.close();
      openDb = null;
    }
  });

  afterEach(() => {
    if (openDb) {
      openDb.close();
      openDb = null;
    }
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('saveCollection: happy path writes to IndexedDB and upserts to Supabase (collections + items)', async () => {
    /**
     * Verifies the dual-write contract for collections:
     * - Local persistence always happens (IndexedDB)
     * - Cloud upserts are attempted when Supabase is configured + user exists
     */
    const { supabase, collectionsUpsert, itemsUpsert, from } = createSupabaseMock();
    const dbMod = await importDbModuleFreshWithSupabaseMock(supabase);

    // Ensure a clean local DB baseline without relying on deleteDatabase (which can block).
    const db = await dbMod.initDB();
    openDb = db;
    await clearStores(db, ['collections', 'assets', 'display', 'settings']);

    const item: CollectionItem = {
      id: 'item-1',
      collectionId: 'col-1',
      photoUrl: 'asset',
      title: 'Offline item',
      rating: 3,
      data: { a: 1 },
      createdAt: new Date('2024-01-01T00:00:00Z').toISOString(),
      updatedAt: new Date('2024-01-02T00:00:00Z').toISOString(),
      notes: 'notes',
    };

    const collection: UserCollection = {
      id: 'col-1',
      templateId: 'vinyl',
      name: 'My Collection',
      icon: '🎵',
      customFields: [],
      items: [item],
      ownerId: 'test-user-id',
      settings: { displayFields: [], badgeFields: [] },
      updatedAt: new Date('2024-01-03T00:00:00Z').toISOString(),
    };

    await expect(dbMod.saveCollection(collection)).resolves.toBeUndefined();

    // Local persistence: collection exists in IndexedDB.
    const saved = await readFromStore<UserCollection>(db, 'collections', 'col-1');
    expect(saved?.id).toBe('col-1');
    expect(saved?.items?.[0]?.id).toBe('item-1');

    // Cloud sync: correct tables targeted
    expect(from).toHaveBeenCalledWith('collections');
    expect(from).toHaveBeenCalledWith('items');
    expect(collectionsUpsert).toHaveBeenCalledTimes(1);
    expect(itemsUpsert).toHaveBeenCalledTimes(1);

    // Cloud payload includes normalized fields and timestamp mapping when enabled.
    const [collectionPayload] = collectionsUpsert.mock.calls[0];
    expect(collectionPayload).toMatchObject({
      id: 'col-1',
      user_id: 'test-user-id',
      template_id: 'vinyl',
      name: 'My Collection',
      icon: '🎵',
      is_public: false,
    });
    expect(collectionPayload.updated_at).toBeDefined();

    const [itemsPayload] = itemsUpsert.mock.calls[0];
    expect(Array.isArray(itemsPayload)).toBe(true);
    expect(itemsPayload[0]).toMatchObject({
      id: 'item-1',
      user_id: 'test-user-id',
      collection_id: 'col-1',
      title: 'Offline item',
      photo_original_path: 'test-user-id/collections/col-1/item-1/original.jpg',
      photo_display_path: 'test-user-id/collections/col-1/item-1/display.jpg',
    });
    expect(itemsPayload[0].created_at).toBeDefined();
    expect(itemsPayload[0].updated_at).toBeDefined();
  });

  it('saveCollection: cloud failure does not rollback local save (eventual consistency)', async () => {
    /**
     * Roadmap expectation: if cloud fails, local succeeds; callers get eventual consistency.
     * Current implementation swallows cloud errors and logs instead of throwing.
     */
    const { supabase, collectionsUpsert } = createSupabaseMock();
    collectionsUpsert.mockRejectedValueOnce(new Error('network timeout'));

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const dbMod = await importDbModuleFreshWithSupabaseMock(supabase);

    const db = await dbMod.initDB();
    openDb = db;
    await clearStores(db, ['collections', 'assets', 'display', 'settings']);

    const collection: UserCollection = {
      id: 'col-2',
      templateId: 'vinyl',
      name: 'Local Only',
      icon: '📦',
      customFields: [],
      items: [],
      ownerId: 'test-user-id',
      settings: { displayFields: [], badgeFields: [] },
      updatedAt: new Date('2024-01-03T00:00:00Z').toISOString(),
    };

    await expect(dbMod.saveCollection(collection)).resolves.toBeUndefined();

    const saved = await readFromStore<UserCollection>(db, 'collections', 'col-2');
    expect(saved?.name).toBe('Local Only');

    consoleError.mockRestore();
  });

  it('saveCollection: invalid collection object (missing id) rejects and does not attempt cloud writes', async () => {
    /**
     * Error case: IndexedDB keyPath is `id`; objects without `id` should fail local persistence,
     * and cloud sync should not run.
     */
    const { supabase, collectionsUpsert, from } = createSupabaseMock();
    const dbMod = await importDbModuleFreshWithSupabaseMock(supabase);

    const db = await dbMod.initDB();
    openDb = db;
    await clearStores(db, ['collections', 'assets', 'display', 'settings']);

    const invalid: any = {
      templateId: 'vinyl',
      name: 'Missing id',
      customFields: [],
      items: [],
      settings: { displayFields: [], badgeFields: [] },
    };

    await expect(dbMod.saveCollection(invalid)).rejects.toBeTruthy();
    expect(from).not.toHaveBeenCalled();
    expect(collectionsUpsert).not.toHaveBeenCalled();
  });

  it('saveAsset: happy path writes original+display blobs to IndexedDB and uploads both to Supabase Storage', async () => {
    /**
     * Verifies the dual-write contract for assets:
     * - Local writes are atomic across `assets` + `display` stores
     * - Cloud uploads are attempted in parallel when configured
     */
    const { supabase, upload } = createSupabaseMock();
    const dbMod = await importDbModuleFreshWithSupabaseMock(supabase);

    const db = await dbMod.initDB();
    openDb = db;
    await clearStores(db, ['collections', 'assets', 'display', 'settings']);

    const original = new Blob(['orig'], { type: 'image/jpeg' });
    const display = new Blob(['disp'], { type: 'image/jpeg' });

    await expect(dbMod.saveAsset('col-1', 'item-asset-1', original, display)).resolves.toBeUndefined();

    const savedOriginal = await readFromStore<Blob>(db, 'assets', 'item-asset-1');
    const savedDisplay = await readFromStore<Blob>(db, 'display', 'item-asset-1');
    // In happy-dom/fake-indexeddb, returned values may be Blob-like rather than a real `Blob` instance.
    expect(savedOriginal).toBeTruthy();
    expect(savedDisplay).toBeTruthy();
    expect((savedOriginal as any).type).toBe('image/jpeg');
    expect((savedDisplay as any).type).toBe('image/jpeg');

    // Cloud upload called twice: original + display
    expect(upload).toHaveBeenCalledTimes(2);
    const calledPaths = upload.mock.calls.map((c) => c[0]);
    expect(calledPaths).toContain('test-user-id/collections/col-1/item-asset-1/original.jpg');
    expect(calledPaths).toContain('test-user-id/collections/col-1/item-asset-1/display.jpg');
  });

  it('saveAsset: cloud upload failure should trigger retry logic (roadmap requirement)', async () => {
    /**
     * Roadmap calls out “Upload retries”. This test defines a retry contract:
     * - If an upload fails transiently, the operation should retry at least once.
     *
     * This SHOULD FAIL until retry logic is implemented.
     */
    const { supabase, upload } = createSupabaseMock();

    // Fail first, succeed second.
    upload.mockRejectedValueOnce(new Error('transient'));
    upload.mockResolvedValueOnce({ data: { path: 'ok' }, error: null });

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const dbMod = await importDbModuleFreshWithSupabaseMock(supabase);

    const db = await dbMod.initDB();
    openDb = db;
    await clearStores(db, ['collections', 'assets', 'display', 'settings']);

    const original = new Blob(['orig'], { type: 'image/jpeg' });
    const display = new Blob(['disp'], { type: 'image/jpeg' });

    await dbMod.saveAsset('col-1', 'retry-asset', original, display);

    // Contract: there must be more than 2 calls if retries occur (2 uploads baseline: original+display).
    expect(upload.mock.calls.length).toBeGreaterThan(2);

    warn.mockRestore();
  });

  it('exports saveItem(item, session) as a function (roadmap API)', async () => {
    /**
     * Roadmap requires `saveItem(item, session)` for dual-write item persistence.
     * This SHOULD FAIL until `saveItem` exists/exports from `services/db.ts`.
     */
    const { supabase } = createSupabaseMock();
    const dbMod = await importDbModuleFreshWithSupabaseMock(supabase);
    expect(typeof (dbMod as any).saveItem).toBe('function');
  });
});


