
import { UserCollection } from '../types';

const DB_NAME = 'CurioDatabase';
const DB_VERSION = 3; // Bumped for thumbnails store
const COLLECTIONS_STORE = 'collections';
const ASSETS_STORE = 'assets';
const THUMBNAILS_STORE = 'thumbnails';

let dbInstance: IDBDatabase | null = null;

/**
 * Requests persistent storage from the browser.
 * This prevents the browser from silently deleting IndexedDB data 
 * when the device is low on storage.
 */
export const requestPersistence = async () => {
  if (navigator.storage && navigator.storage.persist) {
    const isPersisted = await navigator.storage.persist();
    console.log(`Storage persistence ${isPersisted ? 'granted' : 'denied'}.`);
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
    };
  });
};

export const saveCollection = async (collection: UserCollection): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(COLLECTIONS_STORE, 'readwrite');
    const store = transaction.objectStore(COLLECTIONS_STORE);
    store.put(collection);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

export const saveAsset = async (id: string, master: Blob, thumb: Blob): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([ASSETS_STORE, THUMBNAILS_STORE], 'readwrite');
    transaction.objectStore(ASSETS_STORE).put(master, id);
    transaction.objectStore(THUMBNAILS_STORE).put(thumb, id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

export const getAsset = async (id: string, type: 'master' | 'thumb' = 'master'): Promise<Blob | null> => {
  const db = await initDB();
  const storeName = type === 'thumb' ? THUMBNAILS_STORE : ASSETS_STORE;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(transaction.error);
  });
};

export const deleteAsset = async (id: string): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([ASSETS_STORE, THUMBNAILS_STORE], 'readwrite');
      transaction.objectStore(ASSETS_STORE).delete(id);
      transaction.objectStore(THUMBNAILS_STORE).delete(id);
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
