
import { UserCollection, CollectionItem } from '../types';
import { supabase, isSupabaseConfigured } from './supabase';
import { TEMPLATES } from '../constants';

const DB_NAME = 'CurioDatabase';
const DB_VERSION = 4;
const COLLECTIONS_STORE = 'collections';
const ASSETS_STORE = 'assets';
const THUMBNAILS_STORE = 'thumbnails';
const SETTINGS_STORE = 'settings';
const SUPABASE_SYNC_TIMESTAMPS = import.meta.env.VITE_SUPABASE_SYNC_TIMESTAMPS === 'true';

let dbInstance: IDBDatabase | null = null;

const compareTimestamps = (a?: string, b?: string) => {
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
  const template = TEMPLATES.find(t => t.id === collection.templateId);
  const customFields = collection.customFields?.length ? collection.customFields : (template?.fields || []);
  return { ...collection, customFields };
};

const mergeItems = (localItems: CollectionItem[], cloudItems: CollectionItem[]) => {
  const localMap = new Map(localItems.map(item => [item.id, item]));
  const merged = [...localItems];

  cloudItems.forEach(cloudItem => {
    const localItem = localMap.get(cloudItem.id);
    if (!localItem) {
      merged.push(cloudItem);
      return;
    }
    const localStamp = localItem.updatedAt || localItem.createdAt;
    const cloudStamp = cloudItem.updatedAt || cloudItem.createdAt;
    const useLocal = compareTimestamps(localStamp, cloudStamp) >= 0;
    const nextItem = useLocal ? localItem : cloudItem;
    const idx = merged.findIndex(item => item.id === cloudItem.id);
    merged[idx] = nextItem;
  });

  return merged;
};

const mergeCollections = (localCollections: UserCollection[], cloudCollections: UserCollection[]) => {
  const localMap = new Map(localCollections.map(col => [col.id, normalizeCollection(col)]));
  const merged = [...localCollections.map(normalizeCollection)];

  cloudCollections.forEach(cloudCol => {
    const localCol = localMap.get(cloudCol.id);
    if (!localCol) {
      merged.push(normalizeCollection(cloudCol));
      return;
    }
    const localStamp = localCol.updatedAt;
    const cloudStamp = cloudCol.updatedAt;
    const useLocal = compareTimestamps(localStamp, cloudStamp) >= 0;
    const base = useLocal ? localCol : cloudCol;
    const mergedItems = mergeItems(localCol.items, cloudCol.items);
    const idx = merged.findIndex(c => c.id === cloudCol.id);
    merged[idx] = { ...normalizeCollection(base), items: mergedItems };
  });

  return merged;
};

export const requestPersistence = async () => {
  if (navigator.storage && navigator.storage.persist) {
    const isPersisted = await navigator.storage.persist();
    return isPersisted;
  }
  return false;
};

export const initDB = (): Promise<IDBDatabase> => {
  if (dbInstance) return Promise.resolve(dbInstance);

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
      if (!db.objectStoreNames.contains(THUMBNAILS_STORE)) {
        db.createObjectStore(THUMBNAILS_STORE);
      }
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE);
      }
    };
  });
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

const loadLocalCollections = async (): Promise<UserCollection[]> => {
  const db = await initDB();
  const localCollections = await new Promise<UserCollection[]>((resolve, reject) => {
    const transaction = db.transaction(COLLECTIONS_STORE, 'readonly');
    const store = transaction.objectStore(COLLECTIONS_STORE);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return localCollections.map(normalizeCollection);
};

export const getLocalCollections = async (): Promise<UserCollection[]> => {
  return loadLocalCollections();
};

const mapCloudCollections = (cols: any[], items: any[]): UserCollection[] => {
  return cols.map(c => {
    const colItems: CollectionItem[] = (items || [])
      .filter(i => i.collection_id === c.id)
      .map(i => ({
        id: i.id,
        collectionId: i.collection_id,
        photoUrl: i.photo_path,
        title: i.title,
        rating: i.rating,
        data: i.data,
        createdAt: i.created_at || new Date().toISOString(),
        updatedAt: i.updated_at,
        notes: i.notes,
        seedKey: i.seed_key
      }));

    const template = TEMPLATES.find(t => t.id === c.template_id);

    return normalizeCollection({
      id: c.id,
      templateId: c.template_id,
      name: c.name,
      icon: c.icon,
      customFields: template ? template.fields : [],
      items: colItems,
      settings: c.settings || { displayFields: [], badgeFields: [] },
      seedKey: c.seed_key,
      updatedAt: c.updated_at
    });
  });
};

export const fetchCloudCollections = async (): Promise<UserCollection[]> => {
  if (!isSupabaseConfigured() || !supabase) return [];
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: cols, error: colError } = await supabase
    .from('collections')
    .select('*')
    .eq('user_id', user.id);

  if (colError) throw colError;

  const { data: items, error: itemError } = await supabase
    .from('items')
    .select('*')
    .eq('user_id', user.id);

  if (itemError) throw itemError;
  if (!cols) return [];

  return mapCloudCollections(cols, items || []);
};

export const hasLocalOnlyData = (localCollections: UserCollection[], cloudCollections: UserCollection[]) => {
  if (localCollections.length === 0) return false;

  const cloudCollectionIds = new Set(cloudCollections.map(col => col.id));
  const cloudItemIds = new Set(cloudCollections.flatMap(col => col.items.map(item => item.id)));

  return localCollections.some(localCol => {
    if (!cloudCollectionIds.has(localCol.id)) return true;
    return localCol.items.some(item => !cloudItemIds.has(item.id));
  });
};

export const saveCollection = async (collection: UserCollection): Promise<void> => {
  const db = await initDB();
  const collectionToSave = collection.updatedAt
    ? collection
    : { ...collection, updatedAt: new Date().toISOString() };
  
  // 1. Local Persistence (IndexedDB)
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(COLLECTIONS_STORE, 'readwrite');
    const store = transaction.objectStore(COLLECTIONS_STORE);
    store.put(collectionToSave);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });

  // 2. Cloud Sync (Supabase Normalized Mapping)
  if (isSupabaseConfigured() && supabase) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Sync Collection Metadata
      const collectionPayload: Record<string, any> = {
        id: collectionToSave.id,
        user_id: user.id,
        template_id: collectionToSave.templateId,
        name: collectionToSave.name,
        icon: collectionToSave.icon,
        settings: collectionToSave.settings,
        seed_key: collectionToSave.seedKey
      };
      if (SUPABASE_SYNC_TIMESTAMPS && collectionToSave.updatedAt) {
        collectionPayload.updated_at = collectionToSave.updatedAt;
      }

      const { error: colError } = await supabase
        .from('collections')
        .upsert(collectionPayload);

      if (colError) console.warn('Supabase sync collection error:', colError);

      // Sync Items
      if (collectionToSave.items.length > 0) {
        const itemsToSync = collectionToSave.items.map(item => {
          const payload: Record<string, any> = {
            id: item.id,
            user_id: user.id,
            collection_id: collectionToSave.id,
            title: item.title,
            notes: item.notes,
            rating: item.rating,
            data: item.data,
            photo_path: item.photoUrl,
            seed_key: item.seedKey
          };
          if (SUPABASE_SYNC_TIMESTAMPS) {
            payload.created_at = item.createdAt;
            payload.updated_at = item.updatedAt || item.createdAt;
          }
          return payload;
        });

        const { error: itemsError } = await supabase
          .from('items')
          .upsert(itemsToSync);

        if (itemsError) console.warn('Supabase sync items error:', itemsError);
      }
    } catch (e) {
      console.error('Unexpected Supabase sync error:', e);
    }
  }
};

export const saveAsset = async (id: string, master: Blob, thumb: Blob): Promise<void> => {
  const db = await initDB();
  
  // Save to Local
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([ASSETS_STORE, THUMBNAILS_STORE], 'readwrite');
    transaction.objectStore(ASSETS_STORE).put(master, id);
    transaction.objectStore(THUMBNAILS_STORE).put(thumb, id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });

  // Save to Cloud if available
  if (isSupabaseConfigured() && supabase) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const masterPath = `${user.id}/${id}_master.jpg`;
      const thumbPath = `${user.id}/${id}_thumb.jpg`;

      // Upload in parallel
      await Promise.all([
        supabase.storage.from('curio-assets').upload(masterPath, master, { upsert: true, contentType: 'image/jpeg' }),
        supabase.storage.from('curio-assets').upload(thumbPath, thumb, { upsert: true, contentType: 'image/jpeg' })
      ]);
    } catch (e) {
      console.warn('Cloud asset sync failed:', e);
    }
  }
};

export const getAsset = async (id: string, type: 'master' | 'thumb' = 'master'): Promise<Blob | null> => {
  const db = await initDB();
  const storeName = type === 'thumb' ? THUMBNAILS_STORE : ASSETS_STORE;
  
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const path = `${user.id}/${id}_${type}.jpg`;
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

export const importLocalCollectionsToCloud = async (): Promise<{ collections: number; assets: number }> => {
  if (!isSupabaseConfigured() || !supabase) {
    throw new Error('Supabase is not configured.');
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('You must be signed in to import local data.');
  }

  const localCollections = await loadLocalCollections();
  let assetUploads = 0;

  for (const collection of localCollections) {
    await saveCollection(collection);

    for (const item of collection.items) {
      if (item.photoUrl !== 'asset') continue;

      const master = await getAsset(item.id, 'master');
      const thumb = await getAsset(item.id, 'thumb');
      if (master && thumb) {
        await saveAsset(item.id, master, thumb);
        assetUploads += 1;
      }
    }
  }

  return { collections: localCollections.length, assets: assetUploads };
};

export const deleteAsset = async (id: string): Promise<void> => {
    const db = await initDB();
    
    // Delete Local
    await new Promise<void>((resolve) => {
      const transaction = db.transaction([ASSETS_STORE, THUMBNAILS_STORE], 'readwrite');
      transaction.objectStore(ASSETS_STORE).delete(id);
      transaction.objectStore(THUMBNAILS_STORE).delete(id);
      transaction.oncomplete = () => resolve();
    });

    // Delete Cloud
    if (isSupabaseConfigured() && supabase) {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await supabase.storage.from('curio-assets').remove([
                    `${user.id}/${id}_master.jpg`,
                    `${user.id}/${id}_thumb.jpg`
                ]);
            }
        } catch (e) {
            console.warn('Cloud asset deletion failed:', e);
        }
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

export const saveAllCollections = async (collections: UserCollection[]): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(COLLECTIONS_STORE, 'readwrite');
        const store = transaction.objectStore(COLLECTIONS_STORE);
        store.clear();
        collections.forEach(col => store.add(col));
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
};
