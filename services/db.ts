import { UserCollection } from '../types';

const DB_NAME = 'CurioDatabase';
const DB_VERSION = 2; // Incremented version for new schema
const COLLECTIONS_STORE = 'collections';
const ASSETS_STORE = 'assets';

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Store for metadata
      if (!db.objectStoreNames.contains(COLLECTIONS_STORE)) {
        db.createObjectStore(COLLECTIONS_STORE, { keyPath: 'id' });
      }
      
      // Store for large binary assets (images)
      if (!db.objectStoreNames.contains(ASSETS_STORE)) {
        db.createObjectStore(ASSETS_STORE);
      }
    };
  });
};

/**
 * Saves or updates a single collection (incremental update).
 * Industry best practice: avoid clearing the whole store.
 */
export const saveCollection = async (collection: UserCollection): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(COLLECTIONS_STORE, 'readwrite');
    const store = transaction.objectStore(COLLECTIONS_STORE);
    const request = store.put(collection);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

/**
 * Deletes a collection
 */
export const deleteCollectionFromDB = async (id: string): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(COLLECTIONS_STORE, 'readwrite');
      const store = transaction.objectStore(COLLECTIONS_STORE);
      store.delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
};

/**
 * Asset Storage: Storing Blobs is more efficient than Base64 strings in IndexedDB.
 */
export const saveAsset = async (id: string, data: Blob): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(ASSETS_STORE, 'readwrite');
    const store = transaction.objectStore(ASSETS_STORE);
    store.put(data, id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

export const getAsset = async (id: string): Promise<Blob | null> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(ASSETS_STORE, 'readonly');
    const store = transaction.objectStore(ASSETS_STORE);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(transaction.error);
  });
};

export const deleteAsset = async (id: string): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(ASSETS_STORE, 'readwrite');
      const store = transaction.objectStore(ASSETS_STORE);
      store.delete(id);
      transaction.oncomplete = () => resolve();
    });
};

export const loadCollections = async (): Promise<UserCollection[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(COLLECTIONS_STORE, 'readonly');
    const store = transaction.objectStore(COLLECTIONS_STORE);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Full state save (utility for backups/imports)
 */
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
