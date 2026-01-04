import { useCallback, useEffect, useState, useRef } from 'react';
import type { User } from '@supabase/supabase-js';
import {
  fetchCloudCollections,
  getLocalCollections,
  hasLocalOnlyData,
  requestPersistence,
  saveAllCollections,
  saveCollection,
  getSeedVersion,
  setSeedVersion,
  setRecoveryCallback,
  setSyncStatusCallback,
  syncPendingChanges,
  type RecoveryEvent,
  type SyncStatus,
} from '../services/db';
import type { UserCollection } from '../types';
import { CURRENT_SEED_VERSION, INITIAL_COLLECTIONS } from '../services/seedCollections';
import type { StatusTone } from '../components/StatusToast';

type UseCollectionsArgs = {
  user: User | null;
  isAdmin: boolean;
  isSupabaseReady: boolean;
  fallbackSampleCollections: UserCollection[];
  t: (key: string) => string;
  showStatus: (message: string, tone?: StatusTone) => void;
};

type UseCollectionsResult = {
  collections: UserCollection[];
  isLoading: boolean;
  loadError: string | null;
  hasLocalImport: boolean;
  syncStatus: SyncStatus;
  refreshCollections: () => Promise<void>;
};

export const useCollections = ({
  user,
  isAdmin,
  isSupabaseReady,
  fallbackSampleCollections,
  t,
  showStatus,
}: UseCollectionsArgs): UseCollectionsResult => {
  const [collections, setCollections] = useState<UserCollection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasLocalImport, setHasLocalImport] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const showStatusRef = useRef(showStatus);
  const tRef = useRef(t);

  // Keep refs up to date
  useEffect(() => {
    showStatusRef.current = showStatus;
    tRef.current = t;
  }, [showStatus, t]);

  // Set up recovery callback to notify user of IndexedDB issues
  useEffect(() => {
    const handleRecovery = (event: RecoveryEvent) => {
      const t = tRef.current;
      const showStatus = showStatusRef.current;
      if (event.type === 'corruption_detected') {
        showStatus(t('localCacheCorrupted'), 'warning');
      } else if (event.type === 'recovery_complete') {
        showStatus(t('localCacheRecovered'), 'info');
      } else if (event.type === 'recovery_failed') {
        showStatus(t('localCacheRecoveryFailed'), 'error');
      }
    };

    setRecoveryCallback(handleRecovery);
    return () => setRecoveryCallback(null);
  }, []);

  // Set up sync status callback to track sync state
  useEffect(() => {
    const handleSyncStatus = (status: SyncStatus, error?: string) => {
      setSyncStatus(status);
      const t = tRef.current;
      const showStatus = showStatusRef.current;

      if (status === 'error' && error) {
        showStatus(t('statusSyncError').replace('{error}', error), 'error');
      }
    };

    setSyncStatusCallback(handleSyncStatus);
    return () => setSyncStatusCallback(null);
  }, []);

  // Sync pending changes when coming back online
  useEffect(() => {
    const handleOnline = async () => {
      const synced = await syncPendingChanges();
      if (synced > 0) {
        const t = tRef.current;
        const showStatus = showStatusRef.current;
        showStatus(t('statusPendingSynced').replace('{count}', String(synced)), 'success');
        setSyncStatus('synced');
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  const withTimeout = useCallback(
    async <T>(promise: Promise<T>, ms: number, message: string): Promise<T> => {
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      const timeoutPromise = new Promise<T>((_resolve, reject) => {
        timeoutId = setTimeout(() => reject(new Error(message)), ms);
      });
      try {
        return await Promise.race([promise, timeoutPromise]);
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    },
    [],
  );

  const refreshCollections = useCallback(async () => {
    if (!isSupabaseReady) {
      setCollections([]);
      setIsLoading(false);
      setLoadError(null);
      setHasLocalImport(false);
      return;
    }
    setIsLoading(true);
    setLoadError(null);
    try {
      await withTimeout(requestPersistence(), 4000, 'Persistence request timed out');

      const localCollections = await withTimeout(
        getLocalCollections(),
        4000,
        'Local cache load timed out',
      );
      let cloudCollections: UserCollection[] = [];
      try {
        cloudCollections = await withTimeout(
          fetchCloudCollections({ userId: user?.id ?? null, includePublic: true }),
          12000,
          'Cloud fetch timed out',
        );
      } catch (e) {
        console.warn('Supabase cloud fetch failed:', e);
        setHasLocalImport(false);
        setCollections(localCollections);
        setLoadError('Unable to sync with Supabase. Check your connection and Supabase settings.');
        showStatus(t('statusSyncPaused'), 'error');
        return;
      }

      if (!user) {
        setHasLocalImport(false);
        if (cloudCollections.length === 0 && localCollections.length === 0) {
          setCollections(fallbackSampleCollections);
        } else {
          setCollections(cloudCollections);
        }
        return;
      }

      const localOnly = hasLocalOnlyData(localCollections, cloudCollections);
      setHasLocalImport(localOnly);

      if (cloudCollections.length === 0 && localCollections.length === 0 && isAdmin) {
        const localSeedVersion = await getSeedVersion();
        if (localSeedVersion < CURRENT_SEED_VERSION) {
          const seededCollections = INITIAL_COLLECTIONS.map((seed) => ({
            ...seed,
            isPublic: true,
            ownerId: user.id,
          }));
          for (const seedCollection of seededCollections) {
            await saveCollection(seedCollection);
          }
          await setSeedVersion(CURRENT_SEED_VERSION);
          cloudCollections = [...seededCollections];
        }
      }

      if (!localOnly) {
        await saveAllCollections(cloudCollections);
      }

      setCollections(cloudCollections);
      if (cloudCollections.length + localCollections.length > 0) {
        showStatus(t('statusSynced'), 'success');
      }
    } catch (e) {
      console.error('Initialization failed:', e);
      setLoadError('Failed to load collections. Please try again.');
      showStatus(t('statusSyncPaused'), 'error');
      setCollections([]);
    } finally {
      setIsLoading(false);
    }
  }, [fallbackSampleCollections, isAdmin, isSupabaseReady, showStatus, t, user, withTimeout]);

  useEffect(() => {
    if (!isSupabaseReady) {
      setCollections([]);
      setIsLoading(false);
      setHasLocalImport(false);
      setLoadError(null);
      return;
    }
    refreshCollections();
  }, [isAdmin, isSupabaseReady, user?.id]);

  return { collections, isLoading, loadError, hasLocalImport, syncStatus, refreshCollections };
};
