import { UserCollection, CollectionItem, FieldDefinition } from '../types';
import { supabase, isSupabaseConfigured } from './supabase';
import { TEMPLATES } from '../constants';

const DB_NAME = 'CurioDatabase';
const DB_VERSION = 6;
const COLLECTIONS_STORE = 'collections';
const ASSETS_STORE = 'assets';
const DISPLAY_STORE = 'display';
const ENHANCED_STORE = 'enhanced';
const SETTINGS_STORE = 'settings';
const SUPABASE_SYNC_TIMESTAMPS = import.meta.env.VITE_SUPABASE_SYNC_TIMESTAMPS === 'true';

type ItemImageRole = 'original' | 'display' | 'enhanced' | 'thumbnail' | 'poster';
type ItemImageStatus = 'none' | 'processing' | 'ready' | 'failed';

// Keys for pending sync tracking
const PENDING_SYNC_KEY = 'pending_sync_ids';
const PENDING_ASSET_UPLOADS_KEY = 'pending_asset_uploads';
const PENDING_DELETE_KEY = 'pending_deletes';

// Pending delete entry: tracks items that need to be deleted from cloud
export type PendingDelete =
  | {
      type: 'item';
      collectionId: string;
      itemId: string;
      createdAt: string; // ISO timestamp when delete was first attempted
    }
  | {
      type: 'collection';
      collectionId: string;
      createdAt: string; // ISO timestamp when delete was first attempted
    };

type LegacyPendingDelete = {
  collectionId: string;
  itemId: string;
  createdAt: string;
};

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
let lastSyncStatus: SyncStatus | null = null;

export const setSyncStatusCallback = (cb: SyncStatusCallback | null) => {
  onSyncStatusChange = cb;
};

const notifySyncStatus = (status: SyncStatus, error?: string) => {
  if (lastSyncStatus !== status) {
    const timestamp = new Date().toISOString();
    if (status === 'error') {
      console.info(
        JSON.stringify({
          event: 'sync_status_error',
          status,
          previousStatus: lastSyncStatus,
          error: error || null,
          timestamp,
        }),
      );
    } else if (lastSyncStatus === 'error' && status === 'synced') {
      console.info(
        JSON.stringify({
          event: 'sync_status_recovered',
          status,
          previousStatus: lastSyncStatus,
          timestamp,
        }),
      );
    }
    lastSyncStatus = status;
  }
  onSyncStatusChange?.(status, error);
};

export type AssetSyncStatus = 'queued' | 'synced' | 'error';

type AssetSyncStatusCallback = (
  status: AssetSyncStatus,
  details?: { count?: number; error?: string },
) => void;
let onAssetSyncStatusChange: AssetSyncStatusCallback | null = null;

export const setAssetSyncStatusCallback = (cb: AssetSyncStatusCallback | null) => {
  onAssetSyncStatusChange = cb;
};

const notifyAssetSyncStatus = (
  status: AssetSyncStatus,
  details?: { count?: number; error?: string },
) => {
  onAssetSyncStatusChange?.(status, details);
};

type PendingAssetUpload = {
  collectionId: string;
  itemId: string;
  createdAt?: string;
  attemptCount?: number;
  lastError?: string;
  nextRetryAt?: string;
};

const ASSET_UPLOAD_BACKOFF_BASE_MS = 30_000;
const ASSET_UPLOAD_BACKOFF_MAX_MS = 10 * 60_000;

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

const isFieldDefinition = (field: any): field is FieldDefinition => {
  if (!field || typeof field !== 'object') return false;
  return (
    typeof field.id === 'string' &&
    typeof field.label === 'string' &&
    typeof field.type === 'string' &&
    typeof field.displayMode === 'string'
  );
};

const normalizeCustomFields = (fields?: any[] | null): FieldDefinition[] | null => {
  if (!Array.isArray(fields)) return null;
  const cleaned = fields.filter(isFieldDefinition);
  return cleaned.length > 0 ? cleaned : null;
};

const normalizeCollection = (collection: UserCollection): UserCollection => {
  const template = TEMPLATES.find((t) => t.id === collection.templateId);
  const customFields = collection.customFields?.length
    ? collection.customFields
    : template?.fields || [];
  return { ...collection, customFields };
};

type MergeItemsOptions = {
  preserveLocalOnly?: boolean;
  pendingDeletes?: PendingDelete[];
};

export const mergeItems = (
  localItems: CollectionItem[],
  cloudItems: CollectionItem[],
  options: MergeItemsOptions = {},
) => {
  const { preserveLocalOnly = true, pendingDeletes = [] } = options;
  // Create a set of item IDs that are pending deletion (deleted locally but not yet synced)
  const pendingDeleteIds = new Set(
    pendingDeletes.filter((d) => d.type === 'item').map((d) => d.itemId),
  );

  // Cloud is the source of truth for what items EXIST
  // Local can have newer data for items that exist in cloud
  const localMap = new Map(localItems.map((item) => [item.id, item]));
  const cloudIds = new Set(cloudItems.map((item) => item.id));

  // Start with cloud items, but filter out items pending deletion
  // This prevents deleted items from resurrecting when cloud still has them
  const merged = cloudItems
    .filter((cloudItem) => !pendingDeleteIds.has(cloudItem.id))
    .map((cloudItem) => {
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

  if (preserveLocalOnly) {
    // Add local-only items that haven't been synced yet (new items created offline)
    // These are items that exist locally but NOT in cloud
    localItems.forEach((localItem) => {
      if (!cloudIds.has(localItem.id) && !pendingDeleteIds.has(localItem.id)) {
        // This is a new local item that needs to sync to cloud
        merged.push(localItem);
      }
    });
  }

  return merged;
};

export const mergeCollections = (
  localCollections: UserCollection[],
  cloudCollections: UserCollection[],
  options: {
    includeLocalOnly?: (collection: UserCollection) => boolean;
    pendingDeletes?: PendingDelete[];
  } = {},
) => {
  const { includeLocalOnly = () => true, pendingDeletes = [] } = options;
  // Cloud is the source of truth for what collections EXIST
  const localMap = new Map(localCollections.map((col) => [col.id, normalizeCollection(col)]));
  const pendingCollectionDeletes = new Set(
    pendingDeletes.filter((d) => d.type === 'collection').map((d) => d.collectionId),
  );
  const cloudIds = new Set(cloudCollections.map((col) => col.id));

  // Start with cloud collections (ensures deleted collections don't come back)
  const merged = cloudCollections
    .filter((cloudCol) => !pendingCollectionDeletes.has(cloudCol.id))
    .map((cloudCol) => {
      const localCol = localMap.get(cloudCol.id);
      if (!localCol) {
        return normalizeCollection(cloudCol);
      }
      const localStamp = localCol.updatedAt;
      const cloudStamp = cloudCol.updatedAt;
      const useLocal = compareTimestamps(localStamp, cloudStamp) > 0;
      const base = useLocal ? localCol : cloudCol;
      // Filter pending deletes to only those for this collection
      const collectionPendingDeletes = pendingDeletes.filter(
        (d) => d.type === 'item' && d.collectionId === cloudCol.id,
      );
      const mergedItems = mergeItems(localCol.items, cloudCol.items, {
        preserveLocalOnly: includeLocalOnly(localCol),
        pendingDeletes: collectionPendingDeletes,
      });
      return { ...normalizeCollection(base), items: mergedItems };
    });

  // Add local-only collections that haven't been synced yet
  localCollections.forEach((localCol) => {
    if (
      !cloudIds.has(localCol.id) &&
      includeLocalOnly(localCol) &&
      !pendingCollectionDeletes.has(localCol.id)
    ) {
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

const normalizeStoragePath = (value?: string | null): string | null => {
  if (!value) return null;
  return extractCurioAssetPath(value) || value;
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
      if (!db.objectStoreNames.contains(ENHANCED_STORE)) {
        db.createObjectStore(ENHANCED_STORE);
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

export const getPendingSyncIds = async (): Promise<string[]> => {
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

const getPendingAssetUploads = async (): Promise<PendingAssetUpload[]> => {
  const db = await initDB();
  return new Promise((resolve) => {
    const tx = db.transaction(SETTINGS_STORE, 'readonly');
    const req = tx.objectStore(SETTINGS_STORE).get(PENDING_ASSET_UPLOADS_KEY);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });
};

const addToPendingAssetUploads = async (collectionId: string, itemId: string): Promise<void> => {
  const db = await initDB();
  const pending = await getPendingAssetUploads();
  const exists = pending.some(
    (entry) => entry.collectionId === collectionId && entry.itemId === itemId,
  );
  if (!exists) {
    pending.push({
      collectionId,
      itemId,
      createdAt: new Date().toISOString(),
      attemptCount: 0,
    });
    const tx = db.transaction(SETTINGS_STORE, 'readwrite');
    tx.objectStore(SETTINGS_STORE).put(pending, PENDING_ASSET_UPLOADS_KEY);
  }
};

const getAssetUploadBackoffMs = (attemptCount: number): number => {
  if (attemptCount <= 0) return ASSET_UPLOAD_BACKOFF_BASE_MS;
  const backoff = ASSET_UPLOAD_BACKOFF_BASE_MS * Math.pow(2, attemptCount - 1);
  return Math.min(backoff, ASSET_UPLOAD_BACKOFF_MAX_MS);
};

const markPendingAssetUploadFailure = async (
  collectionId: string,
  itemId: string,
  errorMessage?: string,
): Promise<void> => {
  const db = await initDB();
  const pending = await getPendingAssetUploads();
  const now = Date.now();
  const updated = pending.map((entry) => {
    if (entry.collectionId === collectionId && entry.itemId === itemId) {
      const nextAttempt = (entry.attemptCount ?? 0) + 1;
      const delayMs = getAssetUploadBackoffMs(nextAttempt);
      return {
        ...entry,
        attemptCount: nextAttempt,
        lastError: errorMessage || entry.lastError,
        nextRetryAt: new Date(now + delayMs).toISOString(),
      };
    }
    return entry;
  });
  const tx = db.transaction(SETTINGS_STORE, 'readwrite');
  tx.objectStore(SETTINGS_STORE).put(updated, PENDING_ASSET_UPLOADS_KEY);
};

const removeFromPendingAssetUploads = async (
  collectionId: string,
  itemId: string,
): Promise<void> => {
  const db = await initDB();
  const pending = await getPendingAssetUploads();
  const filtered = pending.filter(
    (entry) => !(entry.collectionId === collectionId && entry.itemId === itemId),
  );
  const tx = db.transaction(SETTINGS_STORE, 'readwrite');
  tx.objectStore(SETTINGS_STORE).put(filtered, PENDING_ASSET_UPLOADS_KEY);
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

const readAssetFromStore = async (storeName: string, id: string): Promise<Blob | null> => {
  const db = await initDB();
  return new Promise((resolve) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => resolve(null);
  });
};

const uploadAssetToCloud = async (
  collectionId: string,
  itemId: string,
  original: Blob,
  display: Blob,
): Promise<void> => {
  if (!isSupabaseConfigured() || !supabase) return;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('No authenticated user session');
  }

  const basePath = `${user.id}/collections/${collectionId}/${itemId}`;
  const originalPath = `${basePath}/original.jpg`;
  const displayPath = `${basePath}/display.jpg`;

  const [originalUpload, displayUpload] = await Promise.all([
    supabase.storage.from('curio-assets').upload(originalPath, original, {
      upsert: true,
      contentType: original.type || 'image/jpeg',
    }),
    supabase.storage.from('curio-assets').upload(displayPath, display, {
      upsert: true,
      contentType: display.type || 'image/jpeg',
    }),
  ]);

  if (originalUpload?.error || displayUpload?.error) {
    throw new Error(`Storage upload failed: ${originalUpload?.error || displayUpload?.error}`);
  }

  await recordItemImage({
    itemId,
    role: 'original',
    storagePath: originalPath,
    isCurrent: true,
  });
  await recordItemImage({
    itemId,
    role: 'display',
    storagePath: displayPath,
    isCurrent: true,
  });
};

export const syncPendingAssetUploads = async (): Promise<number> => {
  if (!isSupabaseConfigured() || !supabase) return 0;
  const pendingUploads = await getPendingAssetUploads();
  if (pendingUploads.length === 0) return 0;

  const now = Date.now();
  const dueUploads = pendingUploads.filter((entry) => {
    if (!entry.nextRetryAt) return true;
    const retryAt = new Date(entry.nextRetryAt).getTime();
    return Number.isNaN(retryAt) || retryAt <= now;
  });
  if (dueUploads.length === 0) {
    return 0;
  }

  let synced = 0;
  let lastErrorMessage: string | null = null;
  for (const { collectionId, itemId } of dueUploads) {
    const [original, display] = await Promise.all([
      readAssetFromStore(ASSETS_STORE, itemId),
      readAssetFromStore(DISPLAY_STORE, itemId),
    ]);

    if (!original || !display) {
      await removeFromPendingAssetUploads(collectionId, itemId);
      continue;
    }

    try {
      await uploadAssetToCloud(collectionId, itemId, original, display);
      await removeFromPendingAssetUploads(collectionId, itemId);
      synced++;
    } catch (e) {
      console.warn(`Failed to sync pending asset for item ${itemId}:`, e);
      const errorMessage = e instanceof Error ? e.message : 'Unknown upload error';
      await markPendingAssetUploadFailure(collectionId, itemId, errorMessage);
      lastErrorMessage = errorMessage;
    }
  }

  if (synced > 0) {
    notifyAssetSyncStatus('synced', { count: synced });
  }
  if (lastErrorMessage) {
    notifyAssetSyncStatus('error', { error: lastErrorMessage });
  }

  return synced;
};

// ============================================================================
// P0 Fix: Pending Delete Queue (prevents deleted items from resurrecting)
// ============================================================================

const normalizePendingDeletes = (pending: (PendingDelete | LegacyPendingDelete)[]) =>
  pending.map((entry) => {
    if ('type' in entry) {
      return entry;
    }
    return {
      type: 'item',
      collectionId: entry.collectionId,
      itemId: entry.itemId,
      createdAt: entry.createdAt,
    } as PendingDelete;
  });

export const getPendingDeletes = async (): Promise<PendingDelete[]> => {
  const db = await initDB();
  return new Promise((resolve) => {
    const tx = db.transaction(SETTINGS_STORE, 'readonly');
    const req = tx.objectStore(SETTINGS_STORE).get(PENDING_DELETE_KEY);
    req.onsuccess = () => resolve(normalizePendingDeletes((req.result as PendingDelete[]) || []));
    req.onerror = () => resolve([]);
  });
};

export const addToPendingDeletes = async (entry: PendingDelete): Promise<void> => {
  const db = await initDB();
  const pending = await getPendingDeletes();
  // Avoid duplicates
  if (entry.type === 'item') {
    if (
      pending.some(
        (d) =>
          d.type === 'item' && d.collectionId === entry.collectionId && d.itemId === entry.itemId,
      )
    ) {
      return;
    }
  }
  if (entry.type === 'collection') {
    if (pending.some((d) => d.type === 'collection' && d.collectionId === entry.collectionId)) {
      return;
    }
  }
  pending.push({ ...entry, createdAt: entry.createdAt ?? new Date().toISOString() });
  const tx = db.transaction(SETTINGS_STORE, 'readwrite');
  tx.objectStore(SETTINGS_STORE).put(pending, PENDING_DELETE_KEY);
};

export const removeFromPendingDeletes = async (
  collectionId: string,
  itemId?: string,
): Promise<void> => {
  const db = await initDB();
  const pending = await getPendingDeletes();
  const filtered = pending.filter((d) => {
    if (d.type === 'collection') {
      return d.collectionId !== collectionId;
    }
    if (!itemId) {
      return d.collectionId !== collectionId;
    }
    return !(d.collectionId === collectionId && d.itemId === itemId);
  });
  const tx = db.transaction(SETTINGS_STORE, 'readwrite');
  tx.objectStore(SETTINGS_STORE).put(filtered, PENDING_DELETE_KEY);
};

export const syncPendingDeletes = async (): Promise<number> => {
  if (!isSupabaseConfigured() || !supabase) return 0;
  const pendingDeletes = await getPendingDeletes();
  if (pendingDeletes.length === 0) return 0;

  let synced = 0;
  for (const entry of pendingDeletes) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) continue;

      if (entry.type === 'collection') {
        const { error } = await supabase.from('collections').delete().eq('id', entry.collectionId);

        if (!error) {
          await removeFromPendingDeletes(entry.collectionId);
          synced++;
        }
      } else {
        const { error } = await supabase
          .from('items')
          .delete()
          .eq('id', entry.itemId)
          .eq('collection_id', entry.collectionId);

        if (!error) {
          await removeFromPendingDeletes(entry.collectionId, entry.itemId);
          synced++;
        }
      }
    } catch {
      // Continue with next delete, will retry later
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
        // Use explicit columns for storage paths.
        const photoPath = i.photo_display_path || i.photo_original_path || '';
        return {
          id: i.id,
          collectionId: i.collection_id,
          photoUrl: photoPath,
          photoEnhancedPath: i.photo_enhanced_path || undefined,
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
    const settingsFields = normalizeCustomFields(c.settings?.customFields);

    return normalizeCollection({
      id: c.id,
      ownerId: c.user_id,
      isPublic: Boolean(c.is_public),
      templateId: c.template_id,
      name: c.name,
      icon: c.icon,
      customFields: settingsFields || template?.fields || [],
      items: colItems,
      seedKey: c.seed_key,
      updatedAt: c.updated_at,
      collectionDescription: c.settings?.collectionDescription,
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
    seed_key: collection.seedKey,
    is_public: Boolean(collection.isPublic),
  };
  const settingsPayload: Record<string, any> = {};
  if (collection.collectionDescription) {
    settingsPayload.collectionDescription = collection.collectionDescription;
  }
  if (collection.customFields?.length) {
    settingsPayload.customFields = collection.customFields;
  }
  if (Object.keys(settingsPayload).length > 0) {
    collectionPayload.settings = settingsPayload;
  }
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
      const photoEnhancedPath = normalizeStoragePath(item.photoEnhancedPath) || null;
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
        photo_enhanced_path: photoEnhancedPath,
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

const recordItemImage = async ({
  itemId,
  role,
  storagePath,
  variant,
  status = 'ready',
  recipe = {},
  isCurrent = false,
  sourceImageId,
}: {
  itemId: string;
  role: ItemImageRole;
  storagePath: string;
  variant?: string | null;
  status?: ItemImageStatus;
  recipe?: Record<string, any>;
  isCurrent?: boolean;
  sourceImageId?: string | null;
}): Promise<void> => {
  if (!isSupabaseConfigured() || !supabase) return;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const normalizedPath = normalizeStoragePath(storagePath);
  if (!normalizedPath) return;

  if (isCurrent) {
    await supabase
      .from('item_images')
      .update({ is_current: false })
      .eq('item_id', itemId)
      .eq('role', role)
      .eq('is_current', true);
  }

  const payload = {
    id: normalizedPath,
    item_id: itemId,
    user_id: user.id,
    role,
    variant: variant || null,
    storage_path: normalizedPath,
    status,
    recipe,
    source_image_id: sourceImageId || null,
    is_current: isCurrent,
  };

  const { error } = await supabase.from('item_images').upsert(payload);
  if (error) {
    console.warn('Cloud item image sync failed:', error);
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
      await uploadAssetToCloud(collectionId, id, original, display);
      await removeFromPendingAssetUploads(collectionId, id);
    } catch (e) {
      console.warn('Cloud asset sync failed:', e);
      await addToPendingAssetUploads(collectionId, id);
      const errorMessage = e instanceof Error ? e.message : 'Unknown upload error';
      await markPendingAssetUploadFailure(collectionId, id, errorMessage);
      notifyAssetSyncStatus('queued');
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
      // Suppress expected 404/400 errors for missing assets (not an error condition)
      if (error && error.statusCode && [400, 404].includes(error.statusCode)) {
        // Asset doesn't exist in cloud - this is expected for new items or deleted assets
        return null;
      }
    } catch (e) {
      // Only log unexpected errors, not expected 404/400 from missing assets
      const err = e as any;
      if (!err?.statusCode || ![400, 404].includes(err.statusCode)) {
        console.warn('Cloud asset download failed:', e);
      }
    }
  }

  return null;
};

export const saveEnhancedAsset = async (
  collectionId: string,
  id: string,
  enhanced: Blob,
  options?: {
    metadata?: {
      model?: string;
      strength?: string;
      promptVersion?: number;
      timestamp?: string;
    };
    inputHash?: string;
  },
): Promise<{ enhancedPath: string | null }> => {
  const db = await initDB();

  // Save to Local (current enhancement only)
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(ENHANCED_STORE, 'readwrite');
    transaction.objectStore(ENHANCED_STORE).put(enhanced, id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });

  let enhancedPath: string | null = null;

  // Save to Cloud if available
  if (isSupabaseConfigured() && supabase) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return { enhancedPath: null };

      const imageId =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2);
      const basePath = `${user.id}/collections/${collectionId}/${id}`;
      enhancedPath = `${basePath}/enhanced/${imageId}.jpg`;

      const { error } = await supabase.storage.from('curio-assets').upload(enhancedPath, enhanced, {
        upsert: true,
        contentType: enhanced.type || 'image/jpeg',
      });
      if (error) {
        console.warn('Cloud enhanced asset sync failed:', error);
        return { enhancedPath: null };
      }

      const recipe = {
        model: options?.metadata?.model,
        strength: options?.metadata?.strength,
        promptVersion: options?.metadata?.promptVersion,
        timestamp: options?.metadata?.timestamp,
        inputHash: options?.inputHash,
      };

      await recordItemImage({
        itemId: id,
        role: 'enhanced',
        storagePath: enhancedPath,
        variant: options?.metadata?.strength || null,
        status: 'ready',
        recipe,
        isCurrent: true,
      });
    } catch (e) {
      console.warn('Cloud enhanced asset sync failed:', e);
      return { enhancedPath: null };
    }
  }

  return { enhancedPath };
};

export const getEnhancedAsset = async (
  id: string,
  options: {
    enhancedPath?: string | null;
    collectionId?: string;
    allowLegacy?: boolean;
  } = {},
): Promise<Blob | null> => {
  const db = await initDB();

  // Try Local First (current enhancement only)
  const localBlob = await new Promise<Blob | null>((resolve) => {
    const transaction = db.transaction(ENHANCED_STORE, 'readonly');
    const store = transaction.objectStore(ENHANCED_STORE);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => resolve(null);
  });

  if (localBlob) return localBlob;

  const normalizedEnhancedPath = normalizeStoragePath(options.enhancedPath);

  // Try Cloud if not local
  // Note: We only attempt cloud fetch if a path or collectionId is provided,
  // and we silently return null if the file doesn't exist (404/400)
  // since many items won't have enhanced versions.
  const shouldCheckCloud =
    Boolean(normalizedEnhancedPath) || Boolean(options.allowLegacy && options.collectionId);

  if (isSupabaseConfigured() && supabase && shouldCheckCloud) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      const fallbackPath =
        options.allowLegacy && options.collectionId
          ? `${user.id}/collections/${options.collectionId}/${id}/enhanced.jpg`
          : null;
      const enhancedPath = normalizedEnhancedPath || fallbackPath;
      if (!enhancedPath) return null;

      const { data, error } = await supabase.storage.from('curio-assets').download(enhancedPath);

      if (data && !error) {
        // Cache back to local for performance next time
        const transaction = db.transaction(ENHANCED_STORE, 'readwrite');
        transaction.objectStore(ENHANCED_STORE).put(data, id);
        return data;
      }
      // Suppress expected 404/400 errors for missing enhanced assets (not an error condition)
      if (error && error.statusCode && [400, 404].includes(error.statusCode)) {
        // Enhanced asset doesn't exist in cloud - this is expected for items without enhancement
        return null;
      }
    } catch (e) {
      // Only log unexpected errors, not expected 404/400 from missing assets
      const err = e as any;
      if (!err?.statusCode || ![400, 404].includes(err.statusCode)) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        if (!errorMessage.includes('404') && !errorMessage.includes('not found')) {
          console.warn('Cloud enhanced asset download failed:', e);
        }
      }
    }
  }

  return null;
};

export const deleteEnhancedAsset = async (
  collectionId: string,
  id: string,
  enhancedPath?: string | null,
): Promise<void> => {
  const db = await initDB();

  // Delete Local
  await new Promise<void>((resolve) => {
    const transaction = db.transaction(ENHANCED_STORE, 'readwrite');
    transaction.objectStore(ENHANCED_STORE).delete(id);
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
        const pathsToDelete = [
          normalizeStoragePath(enhancedPath),
          `${basePath}/enhanced.jpg`,
        ].filter(Boolean) as string[];
        if (pathsToDelete.length > 0) {
          await supabase.storage.from('curio-assets').remove(pathsToDelete);
        }
      }
    } catch (e) {
      console.warn('Cloud enhanced asset deletion failed:', e);
    }
  }
};

export const clearEnhancedReference = async (itemId: string): Promise<void> => {
  const db = await initDB();

  await new Promise<void>((resolve) => {
    const transaction = db.transaction(ENHANCED_STORE, 'readwrite');
    transaction.objectStore(ENHANCED_STORE).delete(itemId);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
  });

  if (isSupabaseConfigured() && supabase) {
    try {
      await supabase
        .from('item_images')
        .update({ is_current: false })
        .eq('item_id', itemId)
        .eq('role', 'enhanced')
        .eq('is_current', true);
    } catch (e) {
      console.warn('Cloud enhanced image status clear failed:', e);
    }
  }
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

      const enhancedPath = normalizeStoragePath(item.photoEnhancedPath);
      if (enhancedPath) {
        const enhanced = await getEnhancedAsset(item.id, { enhancedPath });
        if (enhanced) {
          await supabase.storage.from('curio-assets').upload(enhancedPath, enhanced, {
            upsert: true,
            contentType: enhanced.type || 'image/jpeg',
          });
          await recordItemImage({
            itemId: item.id,
            role: 'enhanced',
            storagePath: enhancedPath,
            status: 'ready',
            recipe: {},
            isCurrent: true,
          });
          assetUploads += 1;
        }
      }
    }
  }

  return { collections: localCollections.length, assets: assetUploads };
};

export const deleteAsset = async (collectionId: string, id: string): Promise<void> => {
  const db = await initDB();

  // Delete Local (including enhanced if exists)
  await new Promise<void>((resolve) => {
    const transaction = db.transaction([ASSETS_STORE, DISPLAY_STORE, ENHANCED_STORE], 'readwrite');
    transaction.objectStore(ASSETS_STORE).delete(id);
    transaction.objectStore(DISPLAY_STORE).delete(id);
    transaction.objectStore(ENHANCED_STORE).delete(id);
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
        let enhancedPaths: string[] = [];
        const { data: enhancedRows, error: enhancedError } = await supabase
          .from('item_images')
          .select('storage_path')
          .eq('item_id', id)
          .eq('role', 'enhanced');
        if (enhancedError) {
          console.warn('Cloud enhanced asset lookup failed:', enhancedError);
        } else {
          enhancedPaths = (enhancedRows || [])
            .map((row: { storage_path?: string }) => row.storage_path)
            .filter(Boolean) as string[];
        }

        const filesToDelete = [
          `${basePath}/original.jpg`,
          `${basePath}/display.jpg`,
          `${basePath}/enhanced.jpg`,
          ...enhancedPaths,
          // Legacy paths (safe cleanup; ignore if missing)
          `${user.id}/${id}_master.jpg`,
          `${user.id}/${id}_thumb.jpg`,
        ];

        const uniquePaths = Array.from(new Set(filesToDelete.filter(Boolean)));
        await supabase.storage.from('curio-assets').remove(uniquePaths);
      }
    } catch (e) {
      console.warn('Cloud asset deletion failed:', e);
    }
  }
};

export const deleteCloudItem = async (collectionId: string, itemId: string): Promise<void> => {
  // Always queue the delete first to prevent resurrection if we go offline
  await addToPendingDeletes({
    type: 'item',
    collectionId,
    itemId,
    createdAt: new Date().toISOString(),
  });

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
      console.warn('Cloud item deletion failed, will retry later:', error);
      // Keep in pending queue for retry
      return;
    }

    // Success - remove from pending queue
    await removeFromPendingDeletes(collectionId, itemId);
  } catch (e) {
    console.warn('Cloud item deletion failed, will retry later:', e);
    // Keep in pending queue for retry
  }
};

export const deleteCollection = async (collection: UserCollection): Promise<void> => {
  const db = await initDB();

  await addToPendingDeletes({
    type: 'collection',
    collectionId: collection.id,
    createdAt: new Date().toISOString(),
  });

  // 1. Delete all local assets for items in this collection
  const itemIds = collection.items.map((item) => item.id);
  if (itemIds.length > 0) {
    await new Promise<void>((resolve) => {
      const transaction = db.transaction(
        [ASSETS_STORE, DISPLAY_STORE, ENHANCED_STORE],
        'readwrite',
      );
      const assetsStore = transaction.objectStore(ASSETS_STORE);
      const displayStore = transaction.objectStore(DISPLAY_STORE);
      const enhancedStore = transaction.objectStore(ENHANCED_STORE);

      itemIds.forEach((id) => {
        assetsStore.delete(id);
        displayStore.delete(id);
        enhancedStore.delete(id);
      });

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
    });
  }

  // 2. Delete collection from local IndexedDB
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(COLLECTIONS_STORE, 'readwrite');
    const store = transaction.objectStore(COLLECTIONS_STORE);
    store.delete(collection.id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });

  // 3. Delete from cloud if configured
  if (isSupabaseConfigured() && supabase) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Delete collection (CASCADE will delete items)
      const { error: colError } = await supabase
        .from('collections')
        .delete()
        .eq('id', collection.id);

      if (colError) {
        console.warn('Cloud collection deletion failed:', colError);
      } else {
        await removeFromPendingDeletes(collection.id);
      }

      // Delete assets from storage
      if (itemIds.length > 0) {
        let enhancedPaths: string[] = [];
        const { data: enhancedRows, error: enhancedError } = await supabase
          .from('item_images')
          .select('storage_path')
          .in('item_id', itemIds)
          .eq('role', 'enhanced');
        if (enhancedError) {
          console.warn('Cloud enhanced asset lookup failed:', enhancedError);
        } else {
          enhancedPaths = (enhancedRows || [])
            .map((row: { storage_path?: string }) => row.storage_path)
            .filter(Boolean) as string[];
        }

        const filesToDelete = itemIds.flatMap((itemId) => [
          `${user.id}/collections/${collection.id}/${itemId}/original.jpg`,
          `${user.id}/collections/${collection.id}/${itemId}/display.jpg`,
          `${user.id}/collections/${collection.id}/${itemId}/enhanced.jpg`,
        ]);

        const uniquePaths = Array.from(
          new Set([...filesToDelete, ...enhancedPaths].filter(Boolean)),
        );
        await supabase.storage.from('curio-assets').remove(uniquePaths);
      }
    } catch (e) {
      console.warn('Cloud collection deletion failed:', e);
    }
  }

  // Remove from pending sync if present
  await removeFromPendingSync(collection.id);
};

export const loadCollections = async (): Promise<UserCollection[]> => {
  const localCollections = await loadLocalCollections();

  if (isSupabaseConfigured() && supabase) {
    try {
      const [pendingSyncIds, pendingDeletes] = await Promise.all([
        getPendingSyncIds(),
        getPendingDeletes(),
      ]);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const cloudCollections = await fetchCloudCollections();
      if (!user && cloudCollections.length === 0) {
        return localCollections;
      }

      const merged = mergeCollections(localCollections, cloudCollections, {
        includeLocalOnly: (collection) =>
          !collection.ownerId || pendingSyncIds.includes(collection.id),
        pendingDeletes,
      });
      await saveAllCollections(merged);
      return merged;
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

  const [assetKeys, displayKeys, enhancedKeys] = await Promise.all([
    getAssetKeys(ASSETS_STORE),
    getAssetKeys(DISPLAY_STORE),
    getAssetKeys(ENHANCED_STORE),
  ]);

  // Find orphaned keys (assets without corresponding items)
  const orphanedAssetKeys = assetKeys.filter((key) => !validItemIds.has(String(key)));
  const orphanedDisplayKeys = displayKeys.filter((key) => !validItemIds.has(String(key)));
  const orphanedEnhancedKeys = enhancedKeys.filter((key) => !validItemIds.has(String(key)));

  // Delete orphaned assets
  const totalOrphaned =
    orphanedAssetKeys.length + orphanedDisplayKeys.length + orphanedEnhancedKeys.length;
  if (totalOrphaned > 0) {
    await new Promise<void>((resolve) => {
      const transaction = db.transaction(
        [ASSETS_STORE, DISPLAY_STORE, ENHANCED_STORE],
        'readwrite',
      );
      const assetsStore = transaction.objectStore(ASSETS_STORE);
      const displayStore = transaction.objectStore(DISPLAY_STORE);
      const enhancedStore = transaction.objectStore(ENHANCED_STORE);

      orphanedAssetKeys.forEach((key) => assetsStore.delete(key));
      orphanedDisplayKeys.forEach((key) => displayStore.delete(key));
      orphanedEnhancedKeys.forEach((key) => enhancedStore.delete(key));

      transaction.oncomplete = () => {
        if (totalOrphaned > 0) {
          console.log(`Cleaned up ${totalOrphaned} orphaned assets`);
        }
        resolve();
      };
      transaction.onerror = () => resolve();
    });
  }
};
