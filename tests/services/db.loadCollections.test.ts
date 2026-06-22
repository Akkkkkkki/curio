/**
 * Phase 2.1: `services/db.ts` — loadCollections merge behavior (Integration Contract)
 */

import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import type { UserCollection } from '@/types';

let openDb: IDBDatabase | null = null;

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

const makeQuery = (
  data: any[],
  onAwait?: () => Promise<void>,
  upsert?: (payload: any) => Promise<{ error: Error | null }>,
) => {
  const query: any = {};
  query.select = vi.fn().mockReturnValue(query);
  query.or = vi.fn().mockReturnValue(query);
  query.eq = vi.fn().mockReturnValue(query);
  query.in = vi.fn().mockReturnValue(query);
  query.upsert = vi.fn(upsert ?? (async () => ({ error: null })));
  query.then = async (resolve: (value: any) => any) => {
    // Allow tests to simulate work that happens while the (awaited) cloud
    // query is in flight — e.g. a user creating a collection mid-fetch.
    if (onAwait) await onAwait();
    return resolve({ data, error: null });
  };
  return query;
};

function createSupabaseMock({
  collections,
  items,
  userId = 'user-123',
  itemsOnAwait,
  collectionsUpsert,
}: {
  collections: any[];
  items: any[];
  userId?: string | null;
  itemsOnAwait?: () => Promise<void>;
  collectionsUpsert?: (payload: any) => Promise<{ error: Error | null }>;
}) {
  const collectionsQuery = makeQuery(collections, undefined, collectionsUpsert);
  const itemsQuery = makeQuery(items, itemsOnAwait);
  const from = vi.fn((table: string) => (table === 'collections' ? collectionsQuery : itemsQuery));
  return {
    supabase: {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: userId ? { id: userId } : null },
          error: null,
        }),
      },
      from,
    },
  };
}

async function importDbModuleFresh(supabaseMock: any) {
  vi.resetModules();
  vi.unstubAllEnvs();

  vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY', 'test-key');
  vi.stubEnv('VITE_SUPABASE_SYNC_TIMESTAMPS', 'true');

  vi.doMock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => supabaseMock),
  }));

  return await import('@/services/db');
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

async function setPendingSyncIds(db: IDBDatabase, ids: string[]) {
  return await new Promise<void>((resolve) => {
    const tx = db.transaction('settings', 'readwrite');
    tx.objectStore('settings').put(ids, 'pending_sync_ids');
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

function baseCollection(overrides: Partial<UserCollection>): UserCollection {
  return {
    id: 'col-1',
    templateId: 'vinyl',
    name: 'Local Collection',
    icon: '🎵',
    customFields: [],
    items: [],
    updatedAt: new Date('2024-01-01T00:00:00Z').toISOString(),
    ...overrides,
  };
}

function baseItem(overrides: any) {
  return {
    id: 'item-1',
    collectionId: 'col-1',
    photoUrl: 'local.jpg',
    title: 'Local Item',
    rating: 3,
    data: {},
    createdAt: new Date('2024-01-01T00:00:00Z').toISOString(),
    updatedAt: new Date('2024-01-02T00:00:00Z').toISOString(),
    notes: '',
    ...overrides,
  };
}

describe('Phase 2.1 — services/db.ts loadCollections merge behavior', () => {
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

  it('preserves local-only items for pending sync collections', async () => {
    const cloudCollections = [
      {
        id: 'col-1',
        user_id: 'user-123',
        template_id: 'vinyl',
        name: 'Cloud Collection',
        icon: '☁️',
        is_public: false,
        updated_at: new Date('2024-01-03T00:00:00Z').toISOString(),
      },
    ];
    const cloudItems = [
      {
        id: 'cloud-item',
        collection_id: 'col-1',
        title: 'Cloud Item',
        photo_display_path: 'cloud.jpg',
        rating: 4,
        data: {},
        created_at: new Date('2024-01-01T00:00:00Z').toISOString(),
        updated_at: new Date('2024-01-03T00:00:00Z').toISOString(),
        notes: '',
      },
    ];

    const { supabase } = createSupabaseMock({
      collections: cloudCollections,
      items: cloudItems,
    });
    const dbMod = await importDbModuleFresh(supabase);

    const db = await dbMod.initDB();
    openDb = db;
    await clearStores(db, ['collections', 'assets', 'display', 'settings']);

    const localCollection = baseCollection({
      ownerId: 'user-123',
      items: [baseItem({ id: 'local-only-item', title: 'Offline Item' })],
    });

    await dbMod.saveAllCollections([localCollection]);
    await setPendingSyncIds(db, ['col-1']);

    const merged = await dbMod.loadCollections();

    expect(merged).toHaveLength(1);
    expect(merged[0].items.map((item) => item.id).sort()).toEqual([
      'cloud-item',
      'local-only-item',
    ]);
  });

  it('removes locally cached items that were deleted in the cloud when not pending', async () => {
    const cloudCollections = [
      {
        id: 'col-1',
        user_id: 'user-123',
        template_id: 'vinyl',
        name: 'Cloud Collection',
        icon: '☁️',
        is_public: false,
        updated_at: new Date('2024-01-03T00:00:00Z').toISOString(),
      },
    ];
    const cloudItems: any[] = [];

    const { supabase } = createSupabaseMock({
      collections: cloudCollections,
      items: cloudItems,
    });
    const dbMod = await importDbModuleFresh(supabase);

    const db = await dbMod.initDB();
    openDb = db;
    await clearStores(db, ['collections', 'assets', 'display', 'settings']);

    const localCollection = baseCollection({
      ownerId: 'user-123',
      items: [baseItem({ id: 'deleted-item', title: 'Stale Item' })],
    });

    await dbMod.saveAllCollections([localCollection]);

    const merged = await dbMod.loadCollections();

    expect(merged).toHaveLength(1);
    expect(merged[0].items).toHaveLength(0);
  });

  it('honors timestamp conflict resolution when merging cloud refresh', async () => {
    const cloudCollections = [
      {
        id: 'col-1',
        user_id: 'user-123',
        template_id: 'vinyl',
        name: 'Cloud Name',
        icon: '☁️',
        is_public: false,
        updated_at: new Date('2024-01-01T00:00:00Z').toISOString(),
      },
    ];
    const cloudItems: any[] = [];

    const { supabase } = createSupabaseMock({
      collections: cloudCollections,
      items: cloudItems,
    });
    const dbMod = await importDbModuleFresh(supabase);

    const db = await dbMod.initDB();
    openDb = db;
    await clearStores(db, ['collections', 'assets', 'display', 'settings']);

    const localCollection = baseCollection({
      ownerId: 'user-123',
      name: 'Local Name',
      updatedAt: new Date('2024-02-01T00:00:00Z').toISOString(),
    });

    await dbMod.saveAllCollections([localCollection]);

    const merged = await dbMod.loadCollections();

    expect(merged).toHaveLength(1);
    expect(merged[0].name).toBe('Local Name');
  });

  it('preserves a local-only collection created while the cloud fetch is in flight (CUR-37)', async () => {
    const cloudCollections = [
      {
        id: 'col-1',
        user_id: 'user-123',
        template_id: 'vinyl',
        name: 'Cloud Collection',
        icon: '☁️',
        is_public: false,
        updated_at: new Date('2024-01-03T00:00:00Z').toISOString(),
      },
    ];
    const cloudItems: any[] = [];

    // Declared up front so the mock's mid-fetch hook can reach the db module.
    let dbMod: typeof import('@/services/db');

    const { supabase } = createSupabaseMock({
      collections: cloudCollections,
      items: cloudItems,
      // Simulate the user creating a brand-new collection offline while the
      // (slow) cloud round-trip is still in flight. Before the fix this write
      // landed after loadCollections had already snapshotted local state, so
      // saveAllCollections(merged) clobbered it.
      itemsOnAwait: async () => {
        await dbMod.saveCollection(
          baseCollection({
            id: 'col-created-mid-fetch',
            name: 'Created During Sync',
            ownerId: undefined, // unsynced, local-only
            updatedAt: new Date('2024-06-01T00:00:00Z').toISOString(),
          }),
        );
      },
    });

    dbMod = await importDbModuleFresh(supabase);

    const db = await dbMod.initDB();
    openDb = db;
    await clearStores(db, ['collections', 'assets', 'display', 'settings']);

    // Start from a clean local cache that only has the cloud-backed collection.
    await dbMod.saveAllCollections([
      baseCollection({ id: 'col-1', name: 'Local Collection', ownerId: 'user-123' }),
    ]);

    const merged = await dbMod.loadCollections();

    const ids = merged.map((c) => c.id).sort();
    expect(ids).toContain('col-created-mid-fetch');
    expect(ids).toContain('col-1');

    // And it must actually be persisted (not just returned), so a subsequent
    // load without a cloud round-trip still sees it.
    const persisted = await dbMod.loadCollections();
    expect(persisted.map((c) => c.id)).toContain('col-created-mid-fetch');
  });

  it('preserves an owner-backed collection whose cloud sync is in flight when refresh starts', async () => {
    const cloudCollections = [
      {
        id: 'col-1',
        user_id: 'user-123',
        template_id: 'vinyl',
        name: 'Cloud Collection',
        icon: '☁️',
        is_public: false,
        updated_at: new Date('2024-01-03T00:00:00Z').toISOString(),
      },
    ];
    const cloudItems: any[] = [];

    let releaseUpsert!: () => void;
    const upsertReleased = new Promise<{ error: Error | null }>((resolve) => {
      releaseUpsert = () => resolve({ error: null });
    });
    let markUpsertStarted!: () => void;
    const upsertStarted = new Promise<void>((resolve) => {
      markUpsertStarted = resolve;
    });

    const { supabase } = createSupabaseMock({
      collections: cloudCollections,
      items: cloudItems,
      collectionsUpsert: async () => {
        markUpsertStarted();
        return upsertReleased;
      },
    });
    const dbMod = await importDbModuleFresh(supabase);

    const db = await dbMod.initDB();
    openDb = db;
    await clearStores(db, ['collections', 'assets', 'display', 'settings']);

    const savePromise = dbMod.saveCollection(
      baseCollection({
        id: 'col-saving-in-flight',
        name: 'Saving In Flight',
        ownerId: 'user-123',
        updatedAt: new Date('2024-06-01T00:00:00Z').toISOString(),
      }),
    );
    await upsertStarted;

    const merged = await dbMod.loadCollections();

    expect(merged.map((c) => c.id)).toContain('col-saving-in-flight');

    releaseUpsert();
    await savePromise;
  });

  it('preserves an owner-backed collection saved while a stale cloud fetch is in flight', async () => {
    const cloudCollections = [
      {
        id: 'col-1',
        user_id: 'user-123',
        template_id: 'vinyl',
        name: 'Cloud Collection',
        icon: '☁️',
        is_public: false,
        updated_at: new Date('2024-01-03T00:00:00Z').toISOString(),
      },
    ];
    const cloudItems: any[] = [];

    let dbMod: typeof import('@/services/db');

    const { supabase } = createSupabaseMock({
      collections: cloudCollections,
      items: cloudItems,
      itemsOnAwait: async () => {
        await dbMod.saveCollection(
          baseCollection({
            id: 'col-saved-mid-fetch',
            name: 'Saved During Sync',
            ownerId: 'user-123',
            updatedAt: new Date().toISOString(),
          }),
        );
      },
    });

    dbMod = await importDbModuleFresh(supabase);

    const db = await dbMod.initDB();
    openDb = db;
    await clearStores(db, ['collections', 'assets', 'display', 'settings']);
    await dbMod.saveAllCollections([
      baseCollection({ id: 'col-1', name: 'Local Collection', ownerId: 'user-123' }),
    ]);

    const merged = await dbMod.loadCollections();

    expect(merged.map((c) => c.id)).toContain('col-saved-mid-fetch');
  });

});
