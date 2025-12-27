
import { UserCollection, CollectionItem } from '../types';
import { supabase, isSupabaseConfigured } from './supabase';
import { TEMPLATES } from '../constants';

const DB_NAME = 'CurioDatabase';
const DB_VERSION = 4;
const COLLECTIONS_STORE = 'collections';
const ASSETS_STORE = 'assets';
const THUMBNAILS_STORE = 'thumbnails';
const SETTINGS_STORE = 'settings';

let dbInstance: IDBDatabase | null = null;

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

export const saveCollection = async (collection: UserCollection): Promise<void> => {
  const db = await initDB();
  
  // 1. Local Persistence (IndexedDB)
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(COLLECTIONS_STORE, 'readwrite');
    const store = transaction.objectStore(COLLECTIONS_STORE);
    store.put(collection);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });

  // 2. Cloud Sync (Supabase Normalized Mapping)
  if (isSupabaseConfigured() && supabase) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Sync Collection Metadata
      const { error: colError } = await supabase
        .from('collections')
        .upsert({
          id: collection.id,
          user_id: user.id,
          template_id: collection.templateId,
          name: collection.name,
          icon: collection.icon,
          settings: collection.settings,
          seed_key: collection.seedKey
        });

      if (colError) console.warn('Supabase sync collection error:', colError);

      // Sync Items
      if (collection.items.length > 0) {
        const itemsToSync = collection.items.map(item => ({
          id: item.id,
          user_id: user.id,
          collection_id: collection.id,
          title: item.title,
          notes: item.notes,
          rating: item.rating,
          data: item.data,
          photo_path: item.photoUrl,
          seed_key: item.seedKey
        }));

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
  const db = await initDB();
  
  // Load Local
  const localCollections = await new Promise<UserCollection[]>((resolve, reject) => {
    const transaction = db.transaction(COLLECTIONS_STORE, 'readonly');
    const store = transaction.objectStore(COLLECTIONS_STORE);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  // If Supabase is configured, always attempt a background refresh or hydrate if local is empty
  if (isSupabaseConfigured() && supabase) {
    try {
      const { data: cols, error: colError } = await supabase
        .from('collections')
        .select('*');
      
      if (colError) throw colError;

      const { data: items, error: itemError } = await supabase
        .from('items')
        .select('*');
      
      if (itemError) throw itemError;

      if (cols) {
        const cloudCollections: UserCollection[] = cols.map(c => {
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
              notes: i.notes,
              seedKey: i.seed_key
            }));

          const template = TEMPLATES.find(t => t.id === c.template_id);

          return {
            id: c.id,
            templateId: c.template_id,
            name: c.name,
            icon: c.icon,
            customFields: template ? template.fields : [],
            items: colItems,
            settings: c.settings || { displayFields: [], badgeFields: [] },
            seedKey: c.seed_key
          };
        });

        // Simple strategy: If local is empty or different, overwrite with cloud.
        // In a real prod app, you'd do a more complex merge.
        if (localCollections.length === 0 && cloudCollections.length > 0) {
            await saveAllCollections(cloudCollections);
            return cloudCollections;
        }
        
        // Return local if it's already populated, assuming IndexedDB is the source of truth for the current session.
        return localCollections.length > 0 ? localCollections : cloudCollections;
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
