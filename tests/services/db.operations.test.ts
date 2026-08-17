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
const PENDING_DELETE_JOURNAL_KEY = 'curio_pending_delete_journal';
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

async function readFromStore<T>(
  db: IDBDatabase,
  storeName: string,
  key: IDBValidKey,
): Promise<T | null> {
  return await new Promise((resolve) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve((req.result as T) ?? null);
    req.onerror = () => resolve(null);
  });
}

async function writeToStore(
  db: IDBDatabase,
  storeName: string,
  key: IDBValidKey,
  value: unknown,
): Promise<void> {
  return await new Promise((resolve) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
    tx.onabort = () => resolve();
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
  const itemImagesUpsert = vi.fn().mockResolvedValue({ error: null });
  // Asset uploads check whether the item row has synced before recording
  // item_images rows; default to "row exists" so happy paths record inline.
  const itemsMaybeSingle = vi.fn().mockResolvedValue({ data: { id: 'exists' }, error: null });
  const upload = vi.fn().mockResolvedValue({ data: { path: 'ok' }, error: null });
  const update = vi.fn(() => {
    const chain: any = {};
    chain.eq = vi.fn().mockReturnValue(chain);
    return chain;
  });

  const itemsDelete = vi.fn(() => {
    const chain: any = { error: null };
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.then = (resolve: (value: { error: null }) => unknown) => resolve({ error: null });
    return chain;
  });

  const from = vi.fn((table: string) => {
    const upsertForTable =
      table === 'collections'
        ? collectionsUpsert
        : table === 'item_images'
          ? itemImagesUpsert
          : itemsUpsert;
    return {
      upsert: upsertForTable,
      update,
      delete: itemsDelete,
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ maybeSingle: itemsMaybeSingle })),
      })),
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
    itemImagesUpsert,
    itemsMaybeSingle,
    itemsDelete,
    upload,
    from,
  };
}

// Opens the transaction normally and fails only the `get()` request, matching a
// transient IndexedDB read failure (corrupt record, eviction mid-read).
function failAsyncGetFor(storeName: string, key: string) {
  const originalGet = IDBObjectStore.prototype.get;
  return vi.spyOn(IDBObjectStore.prototype, 'get').mockImplementation(function (
    this: IDBObjectStore,
    query: any,
  ) {
    if (this.name === storeName && query === key) {
      const request: any = {
        onsuccess: null,
        onerror: null,
        error: new DOMException(`IndexedDB ${storeName} read failed`, 'UnknownError'),
      };
      setTimeout(() => request.onerror?.(new Event('error')), 0);
      return request as IDBRequest;
    }
    return originalGet.call(this, query);
  } as IDBObjectStore['get']);
}

async function importDbModuleFreshWithSupabaseMock(
  supabaseMock: any,
  env?: { syncTimestamps?: 'true' | 'false' },
) {
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
    window.localStorage.removeItem(PENDING_DELETE_JOURNAL_KEY);
  });

  afterEach(() => {
    if (openDb) {
      openDb.close();
      openDb = null;
    }
    window.localStorage.removeItem(PENDING_DELETE_JOURNAL_KEY);
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
      customFields: [
        {
          id: 'artist',
          label: 'Artist',
          type: 'text',
          displayMode: 'primary',
        },
      ],
      items: [item],
      ownerId: 'test-user-id',
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
      settings: {
        customFields: collection.customFields,
      },
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
      updatedAt: new Date('2024-01-03T00:00:00Z').toISOString(),
    };

    await expect(dbMod.saveCollection(collection)).resolves.toBeUndefined();

    const saved = await readFromStore<UserCollection>(db, 'collections', 'col-2');
    expect(saved?.name).toBe('Local Only');

    consoleError.mockRestore();
  });

  it('saveAllCollections: preserves pending local writes missing from a stale snapshot', async () => {
    const { supabase, collectionsUpsert } = createSupabaseMock();
    collectionsUpsert.mockRejectedValueOnce(new Error('offline'));

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const dbMod = await importDbModuleFreshWithSupabaseMock(supabase);

    const db = await dbMod.initDB();
    openDb = db;
    await clearStores(db, ['collections', 'assets', 'display', 'enhanced', 'settings']);

    const pendingItem: CollectionItem = {
      id: 'item-pending',
      collectionId: 'col-pending',
      photoUrl: 'asset',
      title: 'Unsynced item',
      rating: 4,
      data: {},
      createdAt: '2026-07-13T00:00:00.000Z',
      updatedAt: '2026-07-13T00:00:00.000Z',
      notes: '',
    };
    const pendingCollection: UserCollection = {
      id: 'col-pending',
      templateId: 'vinyl',
      name: 'Queued local collection',
      icon: 'C',
      customFields: [],
      items: [pendingItem],
      ownerId: 'test-user-id',
      updatedAt: '2026-07-13T00:00:00.000Z',
    };

    await dbMod.saveCollection(pendingCollection);
    await dbMod.saveAsset(
      'col-pending',
      'item-pending',
      new Blob(['orig'], { type: 'image/jpeg' }),
      new Blob(['display'], { type: 'image/jpeg' }),
    );

    const pendingSync = await readFromStore<any[]>(db, 'settings', 'pending_sync_ids');
    expect(pendingSync?.map((entry) => (typeof entry === 'string' ? entry : entry.id))).toContain(
      'col-pending',
    );

    await dbMod.saveAllCollections([
      {
        id: 'col-cloud',
        templateId: 'vinyl',
        name: 'Older cloud snapshot',
        icon: 'S',
        customFields: [],
        items: [],
        ownerId: 'test-user-id',
        updatedAt: '2026-07-12T00:00:00.000Z',
      },
    ]);

    const localIds = (await dbMod.getLocalCollections()).map((collection) => collection.id);
    expect(localIds).toEqual(expect.arrayContaining(['col-cloud', 'col-pending']));
    expect(await readFromStore<Blob>(db, 'assets', 'item-pending')).toBeTruthy();
    expect(await readFromStore<Blob>(db, 'display', 'item-pending')).toBeTruthy();

    consoleError.mockRestore();
  });

  it('saveAllCollections: does not overwrite a pending local edit present in a stale snapshot', async () => {
    // The sibling case to the test above. There, the queued collection was
    // absent from the snapshot; here it is present but at an older revision.
    // The snapshot must not be written over the newer queued row, and the newly
    // added item's blobs must survive orphan cleanup.
    const { supabase, collectionsUpsert } = createSupabaseMock();
    collectionsUpsert.mockRejectedValue(new Error('offline'));

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const dbMod = await importDbModuleFreshWithSupabaseMock(supabase);

    const db = await dbMod.initDB();
    openDb = db;
    await clearStores(db, ['collections', 'assets', 'display', 'enhanced', 'settings']);

    const makeItem = (id: string, title: string): CollectionItem => ({
      id,
      collectionId: 'col-pending',
      photoUrl: 'asset',
      title,
      rating: 4,
      data: {},
      createdAt: '2026-07-13T00:00:00.000Z',
      updatedAt: '2026-07-13T00:00:00.000Z',
      notes: '',
    });

    // The user's latest local edit: renamed, plus a second item added.
    await dbMod.saveCollection({
      id: 'col-pending',
      templateId: 'vinyl',
      name: 'Renamed locally',
      icon: 'C',
      customFields: [],
      items: [makeItem('item-original', 'Original'), makeItem('item-added', 'Added while syncing')],
      ownerId: 'test-user-id',
      updatedAt: '2026-07-13T12:00:00.000Z',
    });
    for (const itemId of ['item-original', 'item-added']) {
      await dbMod.saveAsset(
        'col-pending',
        itemId,
        new Blob(['orig'], { type: 'image/jpeg' }),
        new Blob(['display'], { type: 'image/jpeg' }),
      );
    }

    // A background refresh finishes with a snapshot taken before that edit.
    await dbMod.saveAllCollections([
      {
        id: 'col-pending',
        templateId: 'vinyl',
        name: 'Stale name from cloud',
        icon: 'C',
        customFields: [],
        items: [makeItem('item-original', 'Original')],
        ownerId: 'test-user-id',
        updatedAt: '2026-07-13T00:00:00.000Z',
      },
    ]);

    const stored = await readFromStore<UserCollection>(db, 'collections', 'col-pending');
    expect(stored?.name).toBe('Renamed locally');
    expect(stored?.items.map((item) => item.id)).toEqual(['item-original', 'item-added']);
    expect(await readFromStore<Blob>(db, 'assets', 'item-added')).toBeTruthy();
    expect(await readFromStore<Blob>(db, 'display', 'item-added')).toBeTruthy();

    consoleError.mockRestore();
  });

  it('deleteCloudItem: still records the tombstone when the queue read fails', async () => {
    // The guard path must abort on an unreadable tombstone queue, but the append
    // path must not: the item is already gone locally by the time this runs and
    // deleteItem swallows the failure, so refusing to queue would lose the
    // deletion outright — no tombstone, no cloud delete, item back on refresh.
    const { supabase } = createSupabaseMock();
    // No session, so the cloud delete cannot complete and the tombstone has to
    // survive for a later retry — the state Codex flagged as lost.
    supabase.auth.getUser = vi.fn().mockResolvedValue({ data: { user: null }, error: null });
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const dbMod = await importDbModuleFreshWithSupabaseMock(supabase);

    const db = await dbMod.initDB();
    openDb = db;
    await clearStores(db, ['collections', 'assets', 'display', 'enhanced', 'settings']);
    window.localStorage.removeItem('curio_pending_delete_journal');

    const getSpy = failAsyncGetFor('settings', 'pending_deletes');
    try {
      await expect(dbMod.deleteCloudItem('col-1', 'item-deleted')).resolves.toBeUndefined();
    } finally {
      getSpy.mockRestore();
    }

    // Once reads recover the tombstone is back in the canonical queue, so the
    // retry path can still delete it from the cloud.
    await expect(dbMod.getPendingDeletes()).resolves.toEqual([
      expect.objectContaining({ type: 'item', collectionId: 'col-1', itemId: 'item-deleted' }),
    ]);

    consoleWarn.mockRestore();
  });

  it('deleteCloudItem: does not erase existing tombstones when the queue read fails', async () => {
    // The recovery path must not rewrite the queue from a guessed base: the
    // entries it could not read are exactly the ones a blind rewrite destroys,
    // which would let their cloud rows survive and reappear on a later refresh.
    const { supabase } = createSupabaseMock();
    supabase.auth.getUser = vi.fn().mockResolvedValue({ data: { user: null }, error: null });
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const dbMod = await importDbModuleFreshWithSupabaseMock(supabase);

    const db = await dbMod.initDB();
    openDb = db;
    await clearStores(db, ['collections', 'assets', 'display', 'enhanced', 'settings']);

    // An older tombstone is already queued, and the journal is gone — so the
    // IndexedDB queue is the only copy of it.
    await dbMod.addToPendingDeletes({
      type: 'item',
      collectionId: 'col-1',
      itemId: 'item-older',
      createdAt: '2026-07-13T00:00:00.000Z',
    });
    window.localStorage.removeItem('curio_pending_delete_journal');

    const getSpy = failAsyncGetFor('settings', 'pending_deletes');
    try {
      await expect(dbMod.deleteCloudItem('col-1', 'item-newer')).resolves.toBeUndefined();
    } finally {
      getSpy.mockRestore();
    }

    const queued = await dbMod.getPendingDeletes();
    expect(queued.map((entry: any) => entry.itemId).sort()).toEqual(['item-newer', 'item-older']);

    consoleWarn.mockRestore();
  });

  it('saveAllCollections: does not resurrect a queued deletion on an equal timestamp', async () => {
    // Two versions that are indistinguishable by recency: a snapshot captured
    // moments before a local item deletion carries the same collection
    // `updatedAt`. Ties must fall to the queued local row, or the deleted item
    // is written back and reappears on the next cache-backed startup.
    const { supabase, collectionsUpsert } = createSupabaseMock();
    collectionsUpsert.mockRejectedValue(new Error('offline'));

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const dbMod = await importDbModuleFreshWithSupabaseMock(supabase);

    const db = await dbMod.initDB();
    openDb = db;
    await clearStores(db, ['collections', 'assets', 'display', 'enhanced', 'settings']);

    const sharedTimestamp = '2026-07-13T00:00:00.000Z';
    const survivingItem: CollectionItem = {
      id: 'item-kept',
      collectionId: 'col-pending',
      photoUrl: 'asset',
      title: 'Kept',
      rating: 4,
      data: {},
      createdAt: sharedTimestamp,
      updatedAt: sharedTimestamp,
      notes: '',
    };

    // Local state after the deletion: the item is gone, but `updatedAt` matches
    // the snapshot's.
    await dbMod.saveCollection({
      id: 'col-pending',
      templateId: 'vinyl',
      name: 'Queued deletion',
      icon: 'C',
      customFields: [],
      items: [survivingItem],
      ownerId: 'test-user-id',
      updatedAt: sharedTimestamp,
    });

    await dbMod.saveAllCollections([
      {
        id: 'col-pending',
        templateId: 'vinyl',
        name: 'Queued deletion',
        icon: 'C',
        customFields: [],
        items: [survivingItem, { ...survivingItem, id: 'item-deleted', title: 'Deleted' }],
        ownerId: 'test-user-id',
        updatedAt: sharedTimestamp,
      },
    ]);

    const stored = await readFromStore<UserCollection>(db, 'collections', 'col-pending');
    expect(stored?.items.map((item) => item.id)).toEqual(['item-kept']);

    consoleError.mockRestore();
  });

  it('saveCollection: removes stale cloud metadata if collection is deleted mid-upsert', async () => {
    let releaseUpsert!: () => void;
    const upsertReleased = new Promise<{ error: null }>((resolve) => {
      releaseUpsert = () => resolve({ error: null });
    });
    let markUpsertStarted!: () => void;
    const upsertStarted = new Promise<void>((resolve) => {
      markUpsertStarted = resolve;
    });

    const { supabase, collectionsUpsert, itemsDelete } = createSupabaseMock();
    collectionsUpsert.mockImplementation(async () => {
      markUpsertStarted();
      return upsertReleased;
    });

    const dbMod = await importDbModuleFreshWithSupabaseMock(supabase);

    const db = await dbMod.initDB();
    openDb = db;
    await clearStores(db, ['collections', 'assets', 'display', 'enhanced', 'settings']);

    const collection: UserCollection = {
      id: 'col-delete-mid-upsert',
      templateId: 'vinyl',
      name: 'Deleted During Upsert',
      icon: 'D',
      customFields: [],
      items: [],
      ownerId: 'test-user-id',
      updatedAt: '2026-07-13T00:00:00.000Z',
    };

    const savePromise = dbMod.saveCollection(collection);
    await upsertStarted;

    await dbMod.deleteCollection(collection);
    expect(itemsDelete).toHaveBeenCalledTimes(1);
    await expect(dbMod.getPendingDeletes()).resolves.toEqual([]);

    releaseUpsert();
    await savePromise;

    expect(itemsDelete).toHaveBeenCalledTimes(2);
    await expect(dbMod.getPendingDeletes()).resolves.toEqual([]);
    await expect(
      readFromStore<UserCollection>(db, 'collections', collection.id),
    ).resolves.toBeNull();
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

    await expect(
      dbMod.saveAsset('col-1', 'item-asset-1', original, display),
    ).resolves.toBeUndefined();

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

  it('saveAsset: cloud upload failure queues retry and syncPendingAssetUploads retries after backoff', async () => {
    const { supabase, upload } = createSupabaseMock();
    upload
      .mockResolvedValueOnce({ data: null, error: new Error('Upload failed') })
      .mockResolvedValueOnce({ data: { path: 'ok' }, error: null });
    const dbMod = await importDbModuleFreshWithSupabaseMock(supabase);

    const db = await dbMod.initDB();
    openDb = db;
    await clearStores(db, ['collections', 'assets', 'display', 'settings']);

    const original = new Blob(['orig'], { type: 'image/jpeg' });
    const display = new Blob(['disp'], { type: 'image/jpeg' });

    await expect(
      dbMod.saveAsset('col-1', 'item-asset-2', original, display),
    ).resolves.toBeUndefined();

    const pendingAfterSave = await readFromStore<any[]>(db, 'settings', 'pending_asset_uploads');
    expect(pendingAfterSave).toEqual([
      expect.objectContaining({
        collectionId: 'col-1',
        itemId: 'item-asset-2',
        attemptCount: 1,
        nextRetryAt: expect.any(String),
      }),
    ]);

    upload.mockClear();
    upload.mockResolvedValue({ data: { path: 'ok' }, error: null });

    await expect(dbMod.syncPendingAssetUploads()).resolves.toBe(0);
    expect(upload).not.toHaveBeenCalled();

    const tx = db.transaction('settings', 'readwrite');
    const nextRetryAt = new Date(Date.now() - 1000).toISOString();
    tx.objectStore('settings').put(
      [
        {
          ...pendingAfterSave[0],
          nextRetryAt,
        },
      ],
      'pending_asset_uploads',
    );
    await new Promise((resolve) => {
      tx.oncomplete = () => resolve(null);
      tx.onerror = () => resolve(null);
      tx.onabort = () => resolve(null);
    });

    await expect(dbMod.syncPendingAssetUploads()).resolves.toBe(1);

    const pendingAfterSync = await readFromStore<any[]>(db, 'settings', 'pending_asset_uploads');
    expect(pendingAfterSync).toEqual([]);
    expect(upload).toHaveBeenCalledTimes(2);
  });

  it('syncPendingAssetUploads: repeated failures surface as stalled and force retry bypasses backoff (#149)', async () => {
    const { supabase, upload } = createSupabaseMock();
    upload.mockResolvedValue({ data: null, error: new Error('Upload failed') });
    const dbMod = await importDbModuleFreshWithSupabaseMock(supabase);

    const db = await dbMod.initDB();
    openDb = db;
    await clearStores(db, ['collections', 'assets', 'display', 'settings']);

    const original = new Blob(['orig'], { type: 'image/jpeg' });
    const display = new Blob(['disp'], { type: 'image/jpeg' });

    // Attempt 1 fails during save and queues the upload with a backoff window.
    await expect(
      dbMod.saveAsset('col-1', 'item-asset-stalled', original, display),
    ).resolves.toBeUndefined();
    await expect(dbMod.getPendingAssetUploadSummary()).resolves.toEqual({ total: 1, stalled: 0 });

    // A scheduled pass respects the backoff window and attempts nothing.
    upload.mockClear();
    await expect(dbMod.syncPendingAssetUploads()).resolves.toBe(0);
    expect(upload).not.toHaveBeenCalled();

    // A user-initiated retry runs immediately; attempts 2 and 3 fail too.
    await expect(dbMod.syncPendingAssetUploads({ force: true })).resolves.toBe(0);
    expect(upload).toHaveBeenCalled();
    await expect(dbMod.syncPendingAssetUploads({ force: true })).resolves.toBe(0);

    // Three consecutive failures cross the stalled threshold.
    await expect(dbMod.getPendingAssetUploadSummary()).resolves.toEqual({ total: 1, stalled: 1 });

    // A later forced retry that succeeds clears the queue and the stalled state.
    upload.mockResolvedValue({ data: { path: 'ok' }, error: null });
    await expect(dbMod.syncPendingAssetUploads({ force: true })).resolves.toBe(1);
    await expect(dbMod.getPendingAssetUploadSummary()).resolves.toEqual({ total: 0, stalled: 0 });
  });

  it('saveAsset: defers item_images rows for a brand-new item until its items row syncs (CUR-155)', async () => {
    /**
     * New items upload their photos before the `items` row syncs with the
     * collection save. Upserting item_images at that point always fails with
     * the DB trigger's "Invalid item_id" — instead the rows must be queued and
     * recorded right after the collection sync lands the item row.
     */
    const { supabase, itemImagesUpsert, itemsMaybeSingle, upload } = createSupabaseMock();
    // The items row has not synced yet.
    itemsMaybeSingle.mockResolvedValue({ data: null, error: null });
    const dbMod = await importDbModuleFreshWithSupabaseMock(supabase);

    const db = await dbMod.initDB();
    openDb = db;
    await clearStores(db, ['collections', 'assets', 'display', 'settings']);

    const original = new Blob(['orig'], { type: 'image/jpeg' });
    const display = new Blob(['disp'], { type: 'image/jpeg' });

    await expect(
      dbMod.saveAsset('col-1', 'item-new-1', original, display),
    ).resolves.toBeUndefined();

    // Files are uploaded, but no item_images upsert is attempted (it would 400).
    expect(upload).toHaveBeenCalledTimes(2);
    expect(itemImagesUpsert).not.toHaveBeenCalled();

    const queued = await readFromStore<any[]>(db, 'settings', 'pending_image_records');
    expect(queued).toEqual([
      expect.objectContaining({ collectionId: 'col-1', itemId: 'item-new-1', role: 'original' }),
      expect.objectContaining({ collectionId: 'col-1', itemId: 'item-new-1', role: 'display' }),
    ]);

    // The collection save now syncs the items row; the deferred registry rows
    // must be recorded in the same flow.
    itemsMaybeSingle.mockResolvedValue({ data: { id: 'item-new-1' }, error: null });
    const collection: UserCollection = {
      id: 'col-1',
      templateId: 'vinyl',
      name: 'My Collection',
      icon: '🎵',
      customFields: [],
      items: [
        {
          id: 'item-new-1',
          collectionId: 'col-1',
          photoUrl: 'asset',
          title: 'New item',
          rating: 0,
          data: {},
          createdAt: new Date('2024-01-01T00:00:00Z').toISOString(),
          updatedAt: new Date('2024-01-01T00:00:00Z').toISOString(),
          notes: '',
        },
      ],
      ownerId: 'test-user-id',
      updatedAt: new Date('2024-01-01T00:00:00Z').toISOString(),
    };
    await expect(dbMod.saveCollection(collection)).resolves.toBeUndefined();

    expect(itemImagesUpsert).toHaveBeenCalledTimes(2);
    const payloads = itemImagesUpsert.mock.calls.map((c) => c[0]);
    expect(payloads).toEqual([
      expect.objectContaining({
        item_id: 'item-new-1',
        role: 'original',
        storage_path: 'test-user-id/collections/col-1/item-new-1/original.jpg',
        is_current: true,
      }),
      expect.objectContaining({
        item_id: 'item-new-1',
        role: 'display',
        storage_path: 'test-user-id/collections/col-1/item-new-1/display.jpg',
        is_current: true,
      }),
    ]);

    const drained = await readFromStore<any[]>(db, 'settings', 'pending_image_records');
    expect(drained).toEqual([]);
  });

  it('syncPendingImageRecords: retries a transient item_images failure after backoff', async () => {
    const { supabase, itemImagesUpsert } = createSupabaseMock();
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const dbMod = await importDbModuleFreshWithSupabaseMock(supabase);

    const db = await dbMod.initDB();
    openDb = db;
    await clearStores(db, ['collections', 'assets', 'display', 'settings']);

    const original = new Blob(['orig'], { type: 'image/jpeg' });
    const display = new Blob(['disp'], { type: 'image/jpeg' });

    // Item row exists (mock default), but the first registry upsert fails.
    itemImagesUpsert.mockResolvedValueOnce({ error: { message: 'transient' } });
    await dbMod.saveAsset('col-1', 'item-retry-1', original, display);

    const queued = await readFromStore<any[]>(db, 'settings', 'pending_image_records');
    expect(queued).toEqual([
      expect.objectContaining({
        itemId: 'item-retry-1',
        role: 'original',
        attemptCount: 0,
      }),
    ]);

    // A fresh queue entry is immediately due; the flush retries and succeeds.
    itemImagesUpsert.mockClear();
    await expect(dbMod.syncPendingImageRecords()).resolves.toBe(1);
    expect(itemImagesUpsert).toHaveBeenCalledTimes(1);

    const drained = await readFromStore<any[]>(db, 'settings', 'pending_image_records');
    expect(drained).toEqual([]);

    consoleWarn.mockRestore();
  });

  it('syncPendingImageRecords: ignores malformed persisted queue values', async () => {
    const { supabase, itemImagesUpsert } = createSupabaseMock();
    const dbMod = await importDbModuleFreshWithSupabaseMock(supabase);

    const db = await dbMod.initDB();
    openDb = db;
    await clearStores(db, ['collections', 'assets', 'display', 'settings']);
    await writeToStore(db, 'settings', 'pending_image_records', { stale: true });

    await expect(dbMod.syncPendingImageRecords()).resolves.toBe(0);

    expect(itemImagesUpsert).not.toHaveBeenCalled();
    await expect(readFromStore(db, 'settings', 'pending_image_records')).resolves.toEqual([]);
  });

  it('syncPendingImageRecords: drops malformed queued rows while syncing valid rows', async () => {
    const { supabase, itemImagesUpsert } = createSupabaseMock();
    const dbMod = await importDbModuleFreshWithSupabaseMock(supabase);

    const db = await dbMod.initDB();
    openDb = db;
    await clearStores(db, ['collections', 'assets', 'display', 'settings']);
    await writeToStore(db, 'display', 'item-valid-1', new Blob(['disp'], { type: 'image/jpeg' }));
    await writeToStore(db, 'settings', 'pending_image_records', [
      null,
      {
        collectionId: 'col-1',
        itemId: 'item-invalid-role',
        role: 'avatar',
        storagePath: 'bad.jpg',
      },
      { collectionId: 'col-1', itemId: 'item-missing-path', role: 'display' },
      {
        collectionId: 'col-1',
        itemId: 'item-valid-1',
        role: 'display',
        storagePath: 'test-user-id/collections/col-1/item-valid-1/display.jpg',
        createdAt: new Date('2024-01-01T00:00:00Z').toISOString(),
        attemptCount: 2,
        lastError: 'previous failure',
        nextRetryAt: new Date(Date.now() - 1000).toISOString(),
      },
    ]);

    await expect(dbMod.syncPendingImageRecords()).resolves.toBe(1);

    expect(itemImagesUpsert).toHaveBeenCalledTimes(1);
    expect(itemImagesUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        item_id: 'item-valid-1',
        role: 'display',
        storage_path: 'test-user-id/collections/col-1/item-valid-1/display.jpg',
        is_current: true,
      }),
    );
    await expect(readFromStore(db, 'settings', 'pending_image_records')).resolves.toEqual([]);
  });

  it('syncPendingImageRecords: drops queued rows for items deleted before the registry synced', async () => {
    const { supabase, itemImagesUpsert, itemsMaybeSingle, upload } = createSupabaseMock();
    itemsMaybeSingle.mockResolvedValue({ data: null, error: null });
    // deleteAsset's cloud cleanup exercises chains this mock does not model.
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const dbMod = await importDbModuleFreshWithSupabaseMock(supabase);

    const db = await dbMod.initDB();
    openDb = db;
    await clearStores(db, ['collections', 'assets', 'display', 'settings']);

    const original = new Blob(['orig'], { type: 'image/jpeg' });
    const display = new Blob(['disp'], { type: 'image/jpeg' });
    await dbMod.saveAsset('col-1', 'item-deleted-1', original, display);
    expect(upload).toHaveBeenCalledTimes(2);

    // The user deletes the item before its rows are recorded.
    await dbMod.deleteAsset('col-1', 'item-deleted-1');

    itemsMaybeSingle.mockResolvedValue({ data: { id: 'item-deleted-1' }, error: null });
    await expect(dbMod.syncPendingImageRecords()).resolves.toBe(0);

    expect(itemImagesUpsert).not.toHaveBeenCalled();
    const drained = await readFromStore<any[]>(db, 'settings', 'pending_image_records');
    expect(drained).toEqual([]);

    consoleWarn.mockRestore();
  });

  it.todo('exports saveItem(item, session) as a function (roadmap API - not yet implemented)');
});

describe('deleteCollection', () => {
  beforeEach(async () => {
    if (openDb) {
      openDb.close();
      openDb = null;
    }
    window.localStorage.removeItem(PENDING_DELETE_JOURNAL_KEY);
  });

  afterEach(() => {
    if (openDb) {
      openDb.close();
      openDb = null;
    }
    window.localStorage.removeItem(PENDING_DELETE_JOURNAL_KEY);
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  function createDeleteSupabaseMock() {
    const collectionsDelete = vi.fn().mockReturnThis();
    const itemsDelete = vi.fn().mockReturnThis();
    const storageRemove = vi.fn().mockResolvedValue({ data: [], error: null });

    const eqMock = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => {
      const chain: any = {};
      chain.eq = vi.fn().mockReturnValue(chain);
      return chain;
    });

    const from = vi.fn((table: string) => {
      return {
        delete: () => ({
          eq: eqMock,
        }),
        update,
        upsert: vi.fn().mockResolvedValue({ error: null }),
        select: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
      };
    });

    return {
      supabase: {
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: { id: 'test-user-id' } }, error: null }),
        },
        from,
        storage: {
          from: vi.fn(() => ({
            remove: storageRemove,
            upload: vi.fn().mockResolvedValue({ data: {}, error: null }),
          })),
        },
      },
      collectionsDelete,
      itemsDelete,
      storageRemove,
      from,
      eqMock,
    };
  }

  it('pending item delete survives IndexedDB maintenance and still filters the cloud item', async () => {
    const { supabase } = createDeleteSupabaseMock();
    const dbMod = await importDbModuleFreshWithSupabaseMock(supabase);

    const db = await dbMod.initDB();
    openDb = db;
    await clearStores(db, ['collections', 'assets', 'display', 'settings']);

    await dbMod.addToPendingDeletes({
      type: 'item',
      collectionId: 'col-offline',
      itemId: 'item-offline',
      createdAt: '2026-06-22T00:00:00.000Z',
    });

    await clearStores(db, ['settings']);

    const pendingDeletes = await dbMod.getPendingDeletes();
    expect(pendingDeletes).toEqual([
      {
        type: 'item',
        collectionId: 'col-offline',
        itemId: 'item-offline',
        createdAt: '2026-06-22T00:00:00.000Z',
      },
    ]);

    const cloudCollection: UserCollection = {
      id: 'col-offline',
      templateId: 'vinyl',
      name: 'Cloud collection',
      icon: '☁️',
      customFields: [],
      items: [
        {
          id: 'item-offline',
          collectionId: 'col-offline',
          photoUrl: 'cloud.jpg',
          title: 'Deleted offline',
          rating: 3,
          data: {},
          createdAt: '2026-06-21T00:00:00.000Z',
          notes: '',
        },
      ],
    };

    const merged = dbMod.mergeCollections([], [cloudCollection], { pendingDeletes });
    expect(merged[0]?.items).toEqual([]);
  });

  it('falls back to IndexedDB when browser storage access is blocked', async () => {
    const { supabase } = createDeleteSupabaseMock();
    const dbMod = await importDbModuleFreshWithSupabaseMock(supabase);

    const db = await dbMod.initDB();
    openDb = db;
    await clearStores(db, ['collections', 'assets', 'display', 'settings']);

    const blockedLocalStorage = vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });

    try {
      await dbMod.addToPendingDeletes({
        type: 'item',
        collectionId: 'col-blocked-storage',
        itemId: 'item-blocked-storage',
        createdAt: '2026-06-23T00:00:00.000Z',
      });

      await expect(dbMod.getPendingDeletes()).resolves.toEqual([
        {
          type: 'item',
          collectionId: 'col-blocked-storage',
          itemId: 'item-blocked-storage',
          createdAt: '2026-06-23T00:00:00.000Z',
        },
      ]);

      await dbMod.removeFromPendingDeletes('col-blocked-storage', 'item-blocked-storage');
      await expect(dbMod.getPendingDeletes()).resolves.toEqual([]);
    } finally {
      blockedLocalStorage.mockRestore();
    }
  });

  it('keeps the durable delete journal until a retry confirms the cloud delete', async () => {
    const deleteResults = [{ error: new Error('offline') }, { error: null }];
    const deleteQuery: any = {};
    deleteQuery.eq = vi.fn().mockReturnValue(deleteQuery);
    deleteQuery.then = (resolve: (value: { error: Error | null }) => unknown) =>
      resolve(deleteResults.shift() ?? { error: null });

    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } }, error: null }),
      },
      from: vi.fn(() => ({
        delete: vi.fn(() => deleteQuery),
      })),
      storage: {
        from: vi.fn(() => ({
          upload: vi.fn().mockResolvedValue({ data: {}, error: null }),
        })),
      },
    };
    const dbMod = await importDbModuleFreshWithSupabaseMock(supabase);

    const db = await dbMod.initDB();
    openDb = db;
    await clearStores(db, ['collections', 'assets', 'display', 'settings']);

    await dbMod.deleteCloudItem('col-retry', 'item-retry');

    expect(await dbMod.getPendingDeletes()).toHaveLength(1);
    expect(
      JSON.parse(window.localStorage.getItem(PENDING_DELETE_JOURNAL_KEY) || '[]'),
    ).toHaveLength(1);

    await expect(dbMod.syncPendingDeletes()).resolves.toBe(1);
    expect(await dbMod.getPendingDeletes()).toEqual([]);
    expect(JSON.parse(window.localStorage.getItem(PENDING_DELETE_JOURNAL_KEY) || '[]')).toEqual([]);
  });

  it('deleteCollection: removes collection from IndexedDB', async () => {
    const { supabase } = createDeleteSupabaseMock();
    const dbMod = await importDbModuleFreshWithSupabaseMock(supabase);

    const db = await dbMod.initDB();
    openDb = db;
    await clearStores(db, ['collections', 'assets', 'display', 'settings']);

    const collection: UserCollection = {
      id: 'col-delete-1',
      templateId: 'vinyl',
      name: 'To Delete',
      icon: '🗑️',
      customFields: [],
      items: [],
      ownerId: 'test-user-id',
    };

    // First save the collection
    await dbMod.saveCollection(collection);

    // Verify it exists
    let saved = await readFromStore<UserCollection>(db, 'collections', 'col-delete-1');
    expect(saved?.id).toBe('col-delete-1');

    // Now delete it
    await dbMod.deleteCollection(collection);

    // Verify it's gone
    saved = await readFromStore<UserCollection>(db, 'collections', 'col-delete-1');
    expect(saved).toBeNull();
  });

  it('deleteCollection: removes associated assets from IndexedDB', async () => {
    const { supabase } = createDeleteSupabaseMock();
    const dbMod = await importDbModuleFreshWithSupabaseMock(supabase);

    const db = await dbMod.initDB();
    openDb = db;
    await clearStores(db, ['collections', 'assets', 'display', 'settings']);

    const item: CollectionItem = {
      id: 'item-to-delete',
      collectionId: 'col-delete-2',
      photoUrl: 'asset',
      title: 'Item with asset',
      rating: 5,
      data: {},
      createdAt: new Date().toISOString(),
      notes: '',
    };

    const collection: UserCollection = {
      id: 'col-delete-2',
      templateId: 'vinyl',
      name: 'Collection with assets',
      icon: '📀',
      customFields: [],
      items: [item],
      ownerId: 'test-user-id',
    };

    // Save collection and assets
    await dbMod.saveCollection(collection);
    const original = new Blob(['orig'], { type: 'image/jpeg' });
    const display = new Blob(['disp'], { type: 'image/jpeg' });
    await dbMod.saveAsset('col-delete-2', 'item-to-delete', original, display);

    // Verify assets exist
    let savedOriginal = await readFromStore<Blob>(db, 'assets', 'item-to-delete');
    let savedDisplay = await readFromStore<Blob>(db, 'display', 'item-to-delete');
    expect(savedOriginal).toBeTruthy();
    expect(savedDisplay).toBeTruthy();

    // Delete the collection
    await dbMod.deleteCollection(collection);

    // Verify assets are gone
    savedOriginal = await readFromStore<Blob>(db, 'assets', 'item-to-delete');
    savedDisplay = await readFromStore<Blob>(db, 'display', 'item-to-delete');
    expect(savedOriginal).toBeNull();
    expect(savedDisplay).toBeNull();
  });

  it('deleteCollection: calls Supabase to delete collection from cloud', async () => {
    const { supabase, from } = createDeleteSupabaseMock();
    const dbMod = await importDbModuleFreshWithSupabaseMock(supabase);

    const db = await dbMod.initDB();
    openDb = db;
    await clearStores(db, ['collections', 'assets', 'display', 'settings']);

    const collection: UserCollection = {
      id: 'col-delete-cloud',
      templateId: 'vinyl',
      name: 'Cloud Delete',
      icon: '☁️',
      customFields: [],
      items: [],
      ownerId: 'test-user-id',
    };

    await dbMod.saveCollection(collection);
    await dbMod.deleteCollection(collection);

    // Verify Supabase was called for collections table delete
    expect(from).toHaveBeenCalledWith('collections');
  });

  it('deleteCollection: removes assets from Supabase Storage', async () => {
    const { supabase, storageRemove } = createDeleteSupabaseMock();
    const dbMod = await importDbModuleFreshWithSupabaseMock(supabase);

    const db = await dbMod.initDB();
    openDb = db;
    await clearStores(db, ['collections', 'assets', 'display', 'settings']);

    const item: CollectionItem = {
      id: 'item-cloud-delete',
      collectionId: 'col-storage-delete',
      photoUrl: 'asset',
      title: 'Item',
      rating: 3,
      data: {},
      createdAt: new Date().toISOString(),
      notes: '',
    };

    const collection: UserCollection = {
      id: 'col-storage-delete',
      templateId: 'vinyl',
      name: 'Storage Delete',
      icon: '🗄️',
      customFields: [],
      items: [item],
      ownerId: 'test-user-id',
    };

    await dbMod.saveCollection(collection);
    await dbMod.deleteCollection(collection);

    // Verify storage.remove was called with correct paths
    expect(storageRemove).toHaveBeenCalledTimes(1);
    const [removedPaths] = storageRemove.mock.calls[0];
    expect(removedPaths).toContain(
      'test-user-id/collections/col-storage-delete/item-cloud-delete/original.jpg',
    );
    expect(removedPaths).toContain(
      'test-user-id/collections/col-storage-delete/item-cloud-delete/display.jpg',
    );
    expect(removedPaths).toContain(
      'test-user-id/collections/col-storage-delete/item-cloud-delete/enhanced.jpg',
    );
  });

  it('deleteCollection: handles collection with multiple items', async () => {
    const { supabase, storageRemove } = createDeleteSupabaseMock();
    const dbMod = await importDbModuleFreshWithSupabaseMock(supabase);

    const db = await dbMod.initDB();
    openDb = db;
    await clearStores(db, ['collections', 'assets', 'display', 'settings']);

    const items: CollectionItem[] = [
      {
        id: 'item-1',
        collectionId: 'col-multi',
        photoUrl: 'asset',
        title: 'Item 1',
        rating: 5,
        data: {},
        createdAt: new Date().toISOString(),
        notes: '',
      },
      {
        id: 'item-2',
        collectionId: 'col-multi',
        photoUrl: 'asset',
        title: 'Item 2',
        rating: 4,
        data: {},
        createdAt: new Date().toISOString(),
        notes: '',
      },
      {
        id: 'item-3',
        collectionId: 'col-multi',
        photoUrl: 'asset',
        title: 'Item 3',
        rating: 3,
        data: {},
        createdAt: new Date().toISOString(),
        notes: '',
      },
    ];

    const collection: UserCollection = {
      id: 'col-multi',
      templateId: 'vinyl',
      name: 'Multi Item Collection',
      icon: '📚',
      customFields: [],
      items,
      ownerId: 'test-user-id',
    };

    // Save collection and assets for all items
    await dbMod.saveCollection(collection);
    for (const item of items) {
      const original = new Blob(['orig'], { type: 'image/jpeg' });
      const display = new Blob(['disp'], { type: 'image/jpeg' });
      await dbMod.saveAsset('col-multi', item.id, original, display);
    }

    // Verify all assets exist
    for (const item of items) {
      const savedOriginal = await readFromStore<Blob>(db, 'assets', item.id);
      expect(savedOriginal).toBeTruthy();
    }

    // Delete collection
    await dbMod.deleteCollection(collection);

    // Verify collection is gone
    const saved = await readFromStore<UserCollection>(db, 'collections', 'col-multi');
    expect(saved).toBeNull();

    // Verify all assets are gone
    for (const item of items) {
      const savedOriginal = await readFromStore<Blob>(db, 'assets', item.id);
      const savedDisplay = await readFromStore<Blob>(db, 'display', item.id);
      expect(savedOriginal).toBeNull();
      expect(savedDisplay).toBeNull();
    }

    // Verify storage.remove was called with all 9 paths (3 per item)
    const [removedPaths] = storageRemove.mock.calls[0];
    expect(removedPaths).toHaveLength(9);
  });
});
