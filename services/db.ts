import { UserCollection, CollectionItem } from '../types';
import { supabase, isSupabaseConfigured } from './supabase';
import { TEMPLATES } from '../constants';

const DB_NAME = 'CurioDatabase';
const DB_VERSION = 5;
const COLLECTIONS_STORE = 'collections';
const ASSETS_STORE = 'assets';
const DISPLAY_STORE = 'display';
const SETTINGS_STORE = 'settings';
const SUPABASE_SYNC_TIMESTAMPS = import.meta.env.VITE_SUPABASE_SYNC_TIMESTAMPS === 'true';

// Keys for pending sync tracking
const PENDING_SYNC_KEY = 'pending_sync_ids';

let dbInstance: IDBDatabase | null = null;
let dbInitPromise: Promise<IDBDatabase> | null = null;

// ============================================================================
// P0 Fix #1: Recovery Event System
// ============================================================================

export type RecoveryEvent = {
  type: 'corruption_detected' | 'recovery_complete' | 'recovery_failed';
  lostData: boolean;
};

type RecoveryCallback = (event: RecoveryEvent) => void;
let onRecoveryCallback: RecoveryCallback | null = null;

export const setRecoveryCallback = (cb: RecoveryCallback | null) => {
  onRecoveryCallback = cb;
};

// ============================================================================
// P0 Fix #2: Sync Status Visibility
// ============================================================================

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

type SyncStatusCallback = (status: SyncStatus, error?: string) => void;
let onSyncStatusChange: SyncStatusCallback | null = null;

export const setSyncStatusCallback = (cb: SyncStatusCallback | null) => {
  onSyncStatusChange = cb;
};

const notifySyncStatus = (status: SyncStatus, error?: string) => {
  onSyncStatusChange?.(status, error);
};

// Exported for testing
export const compareTimestamps = (a?: string, b?: string) => {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  const aTime = new Date(a).getTime();
  const bTime = new Date(b).getTime();
  if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
  if (Number.isNaN(aTime)) return -1;
  if (Number.isNaN(bTime)) return 1;
  return aTime - bTime;
};

const normalizeCollection = (collection: UserCollection): UserCollection => {
  const template = TEMPLATES.find((t) => t.id === collection.templateId);
  const customFields = collection.customFields?.length
    ? collection.customFields
    : template?.fields || [];
  return { ...collection, customFields };
};

const mergeItems = (localItems: CollectionItem[], cloudItems: CollectionItem[]) => {
  // Cloud is the source of truth for what items EXIST
  // Local can have newer data for items that exist in cloud
  const localMap = new Map(localItems.map((item) => [item.id, item]));
  const cloudIds = new Set(cloudItems.map((item) => item.id));

  // Start with cloud items (this ensures deleted items don't come back)
  const merged = cloudItems.map((cloudItem) => {
    const localItem = localMap.get(cloudItem.id);
    if (!localItem) {
      return cloudItem;
    }
    // If local has newer timestamp, use local data
    const localStamp = localItem.updatedAt || localItem.createdAt;
    const cloudStamp = cloudItem.updatedAt || cloudItem.createdAt;
    const useLocal = compareTimestamps(localStamp, cloudStamp) > 0;
    return useLocal ? localItem : cloudItem;
  });

  // Add local-only items that haven't been synced yet (new items created offline)
  // These are items that exist locally but NOT in cloud
  localItems.forEach((localItem) => {
    if (!cloudIds.has(localItem.id)) {
      // This is a new local item that needs to sync to cloud
      merged.push(localItem);
    }
  });

  return merged;
};

const mergeCollections = (
  localCollections: UserCollection[],
  cloudCollections: UserCollection[],
) => {
  // Cloud is the source of truth for what collections EXIST
  const localMap = new Map(localCollections.map((col) => [col.id, normalizeCollection(col)]));
  const cloudIds = new Set(cloudCollections.map((col) => col.id));

  // Start with cloud collections (ensures deleted collections don't come back)
  const merged = cloudCollections.map((cloudCol) => {
    const localCol = localMap.get(cloudCol.id);
    if (!localCol) {
      return normalizeCollection(cloudCol);
    }
    const localStamp = localCol.updatedAt;
    const cloudStamp = cloudCol.updatedAt;
    const useLocal = compareTimestamps(localStamp, cloudStamp) > 0;
    const base = useLocal ? localCol : cloudCol;
    const mergedItems = mergeItems(localCol.items, cloudCol.items);
    return { ...normalizeCollection(base), items: mergedItems };
  });

  // Add local-only collections that haven't been synced yet
  localCollections.forEach((localCol) => {
    if (!cloudIds.has(localCol.id)) {
      merged.push(normalizeCollection(localCol));
    }
  });

  return merged;
};

export const extractCurioAssetPath = (value: string): string | null => {
  if (!value) return null;
  // Supports:
  // - .../storage/v1/object/curio-assets/<path>
  // - .../storage/v1/object/public/curio-assets/<path>
  // - .../storage/v1/object/sign/curio-assets/<path>?token=...
  const match = value.match(
    /^https?:\/\/[^/]+\.supabase\.co\/storage\/v1\/object\/(?:public\/|sign\/)?curio-assets\/(.+?)(?:\?.*)?$/,
  );
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
};

export const requestPersistence = async () => {
  if (navigator.storage && navigator.storage.persist) {
    const isPersisted = await navigator.storage.persist();
    return isPersisted;
  }
  return false;
};

// ============================================================================
// Database Initialization with Recovery
// ============================================================================

const openDatabase = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(COLLECTIONS_STORE)) {
        db.createObjectStore(COLLECTIONS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(ASSETS_STORE)) {
        db.createObjectStore(ASSETS_STORE);
      }
      if (!db.objectStoreNames.contains(DISPLAY_STORE)) {
        db.createObjectStore(DISPLAY_STORE);
      }
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE);
      }
    };
  });
};

const deleteDatabase = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      dbInstance.close();
      dbInstance = null;
    }
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      console.warn('Database deletion blocked - closing connections');
      resolve();
    };
  });
};

export const initDB = (): Promise<IDBDatabase> => {
  if (dbInstance) return Promise.resolve(dbInstance);
  if (dbInitPromise) return dbInitPromise;

  dbInitPromise = openDatabase().catch(async (error) => {
    console.warn('IndexedDB open failed, attempting recovery:', error);
    onRecoveryCallback?.({ type: 'corruption_detected', lostData: true });
    await deleteDatabase();
    dbInitPromise = null;
    const db = await openDatabase();
    onRecoveryCallback?.({ type: 'recovery_complete', lostData: true });
    return db;
  });

  return dbInitPromise;
};

export const getSeedVersion = async (): Promise<number> => {
  const db = await initDB();
  return new Promise((resolve) => {
    const transaction = db.transaction(SETTINGS_STORE, 'readonly');
    const request = transaction.objectStore(SETTINGS_STORE).get('seed_version');
    request.onsuccess = () => resolve(request.result || 0);
    request.onerror = () => resolve(0);
  });
};

export const setSeedVersion = async (version: number): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve) => {
    const transaction = db.transaction(SETTINGS_STORE, 'readwrite');
    transaction.objectStore(SETTINGS_STORE).put(version, 'seed_version');
    transaction.oncomplete = () => resolve();
  });
};

// ============================================================================
// P1 Fix #1: Offline Queue / Retry Logic
// ============================================================================

const getPendingSyncIds = async (): Promise<string[]> => {
  const db = await initDB();
  return new Promise((resolve) => {
    const tx = db.transaction(SETTINGS_STORE, 'readonly');
    const req = tx.objectStore(SETTINGS_STORE).get(PENDING_SYNC_KEY);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });
};

const addToPendingSync = async (collectionId: string): Promise<void> => {
  const db = await initDB();
  const pending = await getPendingSyncIds();
  if (!pending.includes(collectionId)) {
    pending.push(collectionId);
    const tx = db.transaction(SETTINGS_STORE, 'readwrite');
    tx.objectStore(SETTINGS_STORE).put(pending, PENDING_SYNC_KEY);
  }
};

const removeFromPendingSync = async (collectionId: string): Promise<void> => {
  const db = await initDB();
  const pending = await getPendingSyncIds();
  const filtered = pending.filter((id) => id !== collectionId);
  const tx = db.transaction(SETTINGS_STORE, 'readwrite');
  tx.objectStore(SETTINGS_STORE).put(filtered, PENDING_SYNC_KEY);
};

export const hasPendingSyncs = async (): Promise<boolean> => {
  const pending = await getPendingSyncIds();
  return pending.length > 0;
};

export const getPendingSyncCount = async (): Promise<number> => {
  const pending = await getPendingSyncIds();
  return pending.length;
};

export const syncPendingChanges = async (): Promise<number> => {
  const pendingIds = await getPendingSyncIds();
  if (pendingIds.length === 0) return 0;

  const localCollections = await loadLocalCollections();
  let synced = 0;

  for (const id of pendingIds) {
    const collection = localCollections.find((c) => c.id === id);
    if (collection) {
      try {
        // Attempt to sync - this will re-add to pending if it fails
        await saveCollectionToCloud(collection);
        await removeFromPendingSync(id);
        synced++;
      } catch (e) {
        console.warn(`Failed to sync pending collection ${id}:`, e);
        // Keep it in the pending list for next retry
      }
    } else {
      // Collection no longer exists locally, remove from pending
      await removeFromPendingSync(id);
    }
  }

  return synced;
};

const loadLocalCollections = async (isRetry = false): Promise<UserCollection[]> => {
  const db = await initDB();
  try {
    const localCollections = await new Promise<UserCollection[]>((resolve, reject) => {
      const transaction = db.transaction(COLLECTIONS_STORE, 'readonly');
      const store = transaction.objectStore(COLLECTIONS_STORE);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return localCollections.map(normalizeCollection);
  } catch (error) {
    // Handle corrupted IndexedDB - delete and recreate
    if (!isRetry) {
      console.warn('IndexedDB read failed, attempting recovery:', error);

      // Notify app about corruption BEFORE deleting
      onRecoveryCallback?.({ type: 'corruption_detected', lostData: true });

      await deleteDatabase();
      dbInstance = null;
      dbInitPromise = null;

      try {
        const result = await loadLocalCollections(true);
        // Only emit recovery_complete if retry succeeded
        onRecoveryCallback?.({ type: 'recovery_complete', lostData: true });
        return result;
      } catch {
        // Retry failed - recovery_failed already emitted by inner call
        return [];
      }
    }

    // If retry also fails, notify and return empty
    console.error('IndexedDB recovery failed, returning empty collections');
    onRecoveryCallback?.({ type: 'recovery_failed', lostData: true });
    throw error; // Re-throw so outer catch knows retry failed
  }
};

export const getLocalCollections = async (): Promise<UserCollection[]> => {
  return loadLocalCollections();
};

// Exported for testing
export const normalizePhotoPaths = (photoUrl: string) => {
  if (!photoUrl) {
    return { originalPath: '', displayPath: '' };
  }

  const extracted = extractCurioAssetPath(photoUrl);
  const normalizedUrl = extracted || photoUrl;

  // External URLs / local absolute paths: can't derive variants.
  // Note: Supabase Storage object URLs are extracted above and become bucket-relative paths.
  if (
    normalizedUrl.startsWith('http') ||
    normalizedUrl.startsWith('data:') ||
    normalizedUrl.startsWith('blob:') ||
    normalizedUrl.startsWith('/')
  ) {
    return { originalPath: normalizedUrl, displayPath: normalizedUrl };
  }

  const hasDisplay = /(?:\/display\.[^/.]+|_display\.[^/.]+)$/i.test(normalizedUrl);
  const hasOriginal = /(?:\/original\.[^/.]+|_original\.[^/.]+)$/i.test(normalizedUrl);
  const hasThumb = /(?:\/thumb\.[^/.]+|_thumb\.[^/.]+)$/i.test(normalizedUrl);
  const hasMaster = /(?:\/master\.[^/.]+|_master\.[^/.]+)$/i.test(normalizedUrl);

  if (hasDisplay) {
    return {
      displayPath: normalizedUrl,
      originalPath: normalizedUrl
        .replace(/\/display(\.[^/.]+)$/i, '/original$1')
        .replace(/_display(\.[^/.]+)$/i, '_original$1'),
    };
  }

  if (hasOriginal) {
    return {
      originalPath: normalizedUrl,
      displayPath: normalizedUrl
        .replace(/\/original(\.[^/.]+)$/i, '/display$1')
        .replace(/_original(\.[^/.]+)$/i, '_display$1'),
    };
  }

  // Legacy naming: thumb/master in path/filename
  if (hasThumb) {
    return {
      originalPath: normalizedUrl
        .replace(/\/thumb(\.[^/.]+)$/i, '/original$1')
        .replace(/_thumb(\.[^/.]+)$/i, '_original$1'),
      displayPath: normalizedUrl
        .replace(/\/thumb(\.[^/.]+)$/i, '/display$1')
        .replace(/_thumb(\.[^/.]+)$/i, '_display$1'),
    };
  }

  if (hasMaster) {
    return {
      originalPath: normalizedUrl
        .replace(/\/master(\.[^/.]+)$/i, '/original$1')
        .replace(/_master(\.[^/.]+)$/i, '_original$1'),
      displayPath: normalizedUrl
        .replace(/\/master(\.[^/.]+)$/i, '/display$1')
        .replace(/_master(\.[^/.]+)$/i, '_display$1'),
    };
  }

  // Our current canonical layout uses /original.jpg and /display.jpg; for unknown shapes, treat it as a single path.
  return { originalPath: normalizedUrl, displayPath: normalizedUrl };
};

const mapCloudCollections = (cols: any[], items: any[]): UserCollection[] => {
  return cols.map((c) => {
    const colItems: CollectionItem[] = (items || [])
      .filter((i) => i.collection_id === c.id)
      .map((i) => {
        // Prefer new explicit columns; avoid relying on legacy `photo_path`.
        const photoPath = i.photo_display_path || i.photo_original_path || '';
        return {
          id: i.id,
          collectionId: i.collection_id,
          photoUrl: photoPath,
          title: i.title,
          rating: i.rating,
          data: i.data,
          createdAt: i.created_at || new Date().toISOString(),
          updatedAt: i.updated_at,
          notes: i.notes,
          seedKey: i.seed_key,
        };
      });

    const template = TEMPLATES.find((t) => t.id === c.template_id);

    return normalizeCollection({
      id: c.id,
      ownerId: c.user_id,
      isPublic: Boolean(c.is_public),
      templateId: c.template_id,
      name: c.name,
      icon: c.icon,
      customFields: template ? template.fields : [],
      items: colItems,
      settings: c.settings || { displayFields: [], badgeFields: [] },
      seedKey: c.seed_key,
      updatedAt: c.updated_at,
    });
  });
};

type FetchCollectionsOptions = {
  userId?: string | null;
  includePublic?: boolean;
};

export const fetchCloudCollections = async (
  options: FetchCollectionsOptions = {},
): Promise<UserCollection[]> => {
  if (!isSupabaseConfigured() || !supabase) return [];

  const { userId = null, includePublic = true } = options;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const activeUserId = typeof userId === 'string' ? userId : user?.id || null;

  const collectionQuery = supabase.from('collections').select('*');
  if (activeUserId) {
    collectionQuery.or(
      includePublic ? `user_id.eq.${activeUserId},is_public.eq.true` : `user_id.eq.${activeUserId}`,
    );
  } else if (includePublic) {
    collectionQuery.eq('is_public', true);
  } else {
    return [];
  }

  const { data: cols, error: colError } = await collectionQuery;

  if (colError) throw colError;

  if (!cols || cols.length === 0) return [];

  const collectionIds = cols.map((col) => col.id);
  const { data: items, error: itemError } = await supabase
    .from('items')
    .select('*')
    .in('collection_id', collectionIds);

  if (itemError) throw itemError;

  return mapCloudCollections(cols, items || []);
};

export const hasLocalOnlyData = (
  localCollections: UserCollection[],
  cloudCollections: UserCollection[],
) => {
  if (localCollections.length === 0) return false;

  const cloudCollectionIds = new Set(cloudCollections.map((col) => col.id));
  const cloudItemIds = new Set(cloudCollections.flatMap((col) => col.items.map((item) => item.id)));

  return localCollections.some((localCol) => {
    if (!cloudCollectionIds.has(localCol.id)) return true;
    return localCol.items.some((item) => !cloudItemIds.has(item.id));
  });
};

// Internal function to sync a collection to cloud (used by both saveCollection and syncPendingChanges)
// Throws on failure so callers can retain pending syncs for retry
const saveCollectionToCloud = async (collection: UserCollection): Promise<void> => {
  if (!isSupabaseConfigured() || !supabase) {
    // No cloud configured - not an error, just skip
    return;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // No user session - throw so pending syncs are retained for retry
    throw new Error('No authenticated user session');
  }

  // Sync Collection Metadata
  const collectionPayload: Record<string, any> = {
    id: collection.id,
    user_id: collection.ownerId || user.id,
    template_id: collection.templateId,
    name: collection.name,
    icon: collection.icon,
    settings: collection.settings,
    seed_key: collection.seedKey,
    is_public: Boolean(collection.isPublic),
  };
  if (SUPABASE_SYNC_TIMESTAMPS && collection.updatedAt) {
    collectionPayload.updated_at = collection.updatedAt;
  }

  const { error: colError } = await supabase.from('collections').upsert(collectionPayload);

  if (colError) {
    throw new Error(`Collection sync failed: ${colError.message}`);
  }

  // Sync Items
  if (collection.items.length > 0) {
    const itemsToSync = collection.items.map((item) => {
      const basePath = `${user.id}/collections/${collection.id}/${item.id}`;
      const { originalPath, displayPath } = normalizePhotoPaths(item.photoUrl || '');
      const photoOriginalPath =
        item.photoUrl === 'asset' ? `${basePath}/original.jpg` : originalPath;
      const photoDisplayPath = item.photoUrl === 'asset' ? `${basePath}/display.jpg` : displayPath;
      const payload: Record<string, any> = {
        id: item.id,
        user_id: user.id,
        collection_id: collection.id,
        title: item.title,
        notes: item.notes,
        rating: item.rating,
        data: item.data,
        photo_original_path: photoOriginalPath,
        photo_display_path: photoDisplayPath,
        seed_key: item.seedKey,
      };
      if (SUPABASE_SYNC_TIMESTAMPS) {
        payload.created_at = item.createdAt;
        payload.updated_at = item.updatedAt || item.createdAt;
      }
      return payload;
    });

    const { error: itemsError } = await supabase.from('items').upsert(itemsToSync);

    if (itemsError) {
      throw new Error(`Items sync failed: ${itemsError.message}`);
    }
  }
};

export const saveCollection = async (collection: UserCollection): Promise<void> => {
  const db = await initDB();
  const collectionToSave = collection.updatedAt
    ? collection
    : { ...collection, updatedAt: new Date().toISOString() };

  // 1. Local Persistence (IndexedDB) - always succeeds
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(COLLECTIONS_STORE, 'readwrite');
    const store = transaction.objectStore(COLLECTIONS_STORE);
    store.put(collectionToSave);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });

  // 2. Cloud Sync (Supabase Normalized Mapping)
  if (isSupabaseConfigured() && supabase) {
    notifySyncStatus('syncing');
    try {
      await saveCollectionToCloud(collectionToSave);
      // Success - remove from pending queue if it was there
      await removeFromPendingSync(collectionToSave.id);
      notifySyncStatus('synced');
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Sync failed';
      console.warn('Supabase sync error:', errorMessage);
      // Add to pending queue for retry
      await addToPendingSync(collectionToSave.id);
      notifySyncStatus('error', errorMessage);
    }
  }
};

export const saveAsset = async (
  collectionId: string,
  id: string,
  original: Blob,
  display: Blob,
): Promise<void> => {
  const db = await initDB();

  // Save to Local
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([ASSETS_STORE, DISPLAY_STORE], 'readwrite');
    transaction.objectStore(ASSETS_STORE).put(original, id);
    transaction.objectStore(DISPLAY_STORE).put(display, id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });

  // Save to Cloud if available
  if (isSupabaseConfigured() && supabase) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const basePath = `${user.id}/collections/${collectionId}/${id}`;
      const originalPath = `${basePath}/original.jpg`;
      const displayPath = `${basePath}/display.jpg`;

      // Upload in parallel
      await Promise.all([
        supabase.storage.from('curio-assets').upload(originalPath, original, {
          upsert: true,
          contentType: original.type || 'image/jpeg',
        }),
        supabase.storage.from('curio-assets').upload(displayPath, display, {
          upsert: true,
          contentType: display.type || 'image/jpeg',
        }),
      ]);
    } catch (e) {
      console.warn('Cloud asset sync failed:', e);
    }
  }
};

export const getAsset = async (
  id: string,
  type: 'original' | 'display' = 'display',
  remotePath?: string,
  collectionId?: string,
): Promise<Blob | null> => {
  const db = await initDB();
  const storeName = type === 'display' ? DISPLAY_STORE : ASSETS_STORE;

  // Try Local First
  const localBlob = await new Promise<Blob | null>((resolve) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => resolve(null);
  });

  if (localBlob) return localBlob;

  // Try Cloud if not local
  if (isSupabaseConfigured() && supabase) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user && !remotePath) return null;

      const normalizedRemotePath = remotePath
        ? type === 'display'
          ? normalizePhotoPaths(remotePath).displayPath
          : normalizePhotoPaths(remotePath).originalPath
        : null;
      const fallbackPath = collectionId
        ? `${user!.id}/collections/${collectionId}/${id}/${type === 'display' ? 'display.jpg' : 'original.jpg'}`
        : // Legacy pre-folder layout fallback
          `${user!.id}/${id}_${type === 'display' ? 'thumb' : 'master'}.jpg`;
      const path = normalizedRemotePath || fallbackPath;
      const { data, error } = await supabase.storage.from('curio-assets').download(path);

      if (data && !error) {
        // Cache back to local for performance next time
        const transaction = db.transaction(storeName, 'readwrite');
        transaction.objectStore(storeName).put(data, id);
        return data;
      }
    } catch (e) {
      console.warn('Cloud asset download failed:', e);
    }
  }

  return null;
};

export const importLocalCollectionsToCloud = async (): Promise<{
  collections: number;
  assets: number;
}> => {
  if (!isSupabaseConfigured() || !supabase) {
    throw new Error('Supabase is not configured.');
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('You must be signed in to import local data.');
  }

  const localCollections = await loadLocalCollections();
  let assetUploads = 0;

  for (const collection of localCollections) {
    await saveCollection(collection);

    for (const item of collection.items) {
      if (item.photoUrl !== 'asset') continue;

      const original = await getAsset(item.id, 'original');
      const display = await getAsset(item.id, 'display');
      if (original && display) {
        await saveAsset(collection.id, item.id, original, display);
        assetUploads += 1;
      }
    }
  }

  return { collections: localCollections.length, assets: assetUploads };
};

export const deleteAsset = async (collectionId: string, id: string): Promise<void> => {
  const db = await initDB();

  // Delete Local
  await new Promise<void>((resolve) => {
    const transaction = db.transaction([ASSETS_STORE, DISPLAY_STORE], 'readwrite');
    transaction.objectStore(ASSETS_STORE).delete(id);
    transaction.objectStore(DISPLAY_STORE).delete(id);
    transaction.oncomplete = () => resolve();
  });

  // Delete Cloud
  if (isSupabaseConfigured() && supabase) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const basePath = `${user.id}/collections/${collectionId}/${id}`;
        await supabase.storage.from('curio-assets').remove([
          `${basePath}/original.jpg`,
          `${basePath}/display.jpg`,
          // Legacy paths (safe cleanup; ignore if missing)
          `${user.id}/${id}_master.jpg`,
          `${user.id}/${id}_thumb.jpg`,
        ]);
      }
    } catch (e) {
      console.warn('Cloud asset deletion failed:', e);
    }
  }
};

export const deleteCloudItem = async (collectionId: string, itemId: string): Promise<void> => {
  if (!isSupabaseConfigured() || !supabase) return;

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('items')
      .delete()
      .eq('id', itemId)
      .eq('collection_id', collectionId);

    if (error) {
      console.warn('Cloud item deletion failed:', error);
    }
  } catch (e) {
    console.warn('Cloud item deletion failed:', e);
  }
};

export const loadCollections = async (): Promise<UserCollection[]> => {
  const localCollections = await loadLocalCollections();

  if (isSupabaseConfigured() && supabase) {
    try {
      const cloudCollections = await fetchCloudCollections();
      if (cloudCollections.length > 0) {
        await saveAllCollections(cloudCollections);
        return cloudCollections;
      }
    } catch (e) {
      console.warn('Supabase cloud fetch failed:', e);
    }
  }

  return localCollections;
};

// P1 Fix #2: Atomic save using put() instead of clear() + add()
// This prevents data loss if a crash occurs between clear and add
export const saveAllCollections = async (collections: UserCollection[]): Promise<void> => {
  const db = await initDB();
  const newIds = new Set(collections.map((c) => c.id));

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(COLLECTIONS_STORE, 'readwrite');
    const store = transaction.objectStore(COLLECTIONS_STORE);

    // Get existing keys to find stale entries
    const keysRequest = store.getAllKeys();
    keysRequest.onsuccess = () => {
      const existingKeys = keysRequest.result as string[];

      // Delete stale entries (ones not in new collection set)
      existingKeys.forEach((key) => {
        if (!newIds.has(key)) {
          store.delete(key);
        }
      });

      // Upsert all new collections (put instead of add)
      collections.forEach((col) => store.put(col));
    };

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });

  // Clean up orphaned assets that no longer have a corresponding item
  await cleanupOrphanedAssets(collections);
};

// Remove assets from IndexedDB that don't have a corresponding item in collections
export const cleanupOrphanedAssets = async (collections: UserCollection[]): Promise<void> => {
  const db = await initDB();

  // Get all valid item IDs
  const validItemIds = new Set(collections.flatMap((col) => col.items.map((item) => item.id)));

  // Get all asset keys from both stores
  const getAssetKeys = (storeName: string): Promise<IDBValidKey[]> => {
    return new Promise((resolve) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAllKeys();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve([]);
    });
  };

  const [assetKeys, displayKeys] = await Promise.all([
    getAssetKeys(ASSETS_STORE),
    getAssetKeys(DISPLAY_STORE),
  ]);

  // Find orphaned keys (assets without corresponding items)
  const orphanedAssetKeys = assetKeys.filter((key) => !validItemIds.has(String(key)));
  const orphanedDisplayKeys = displayKeys.filter((key) => !validItemIds.has(String(key)));

  // Delete orphaned assets
  if (orphanedAssetKeys.length > 0 || orphanedDisplayKeys.length > 0) {
    await new Promise<void>((resolve) => {
      const transaction = db.transaction([ASSETS_STORE, DISPLAY_STORE], 'readwrite');
      const assetsStore = transaction.objectStore(ASSETS_STORE);
      const displayStore = transaction.objectStore(DISPLAY_STORE);

      orphanedAssetKeys.forEach((key) => assetsStore.delete(key));
      orphanedDisplayKeys.forEach((key) => displayStore.delete(key));

      transaction.oncomplete = () => {
        if (orphanedAssetKeys.length + orphanedDisplayKeys.length > 0) {
          console.log(
            `Cleaned up ${orphanedAssetKeys.length + orphanedDisplayKeys.length} orphaned assets`,
          );
        }
        resolve();
      };
      transaction.onerror = () => resolve();
    });
  }
};
