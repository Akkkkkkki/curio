import { useCallback, useEffect, useState } from 'react';
import { fetchCloudCollections, getLocalCollections, hasLocalOnlyData, requestPersistence, saveAllCollections, saveCollection, getSeedVersion, setSeedVersion } from '../services/db';
import type { UserCollection } from '../types';
import { CURRENT_SEED_VERSION, INITIAL_COLLECTIONS } from '../services/seedCollections';
import type { StatusTone } from '../components/StatusToast';

type UseCollectionsArgs = {
  user: any;
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

  const withTimeout = useCallback(async <T,>(promise: Promise<T>, ms: number, message: string): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<T>((_resolve, reject) => {
      timeoutId = setTimeout(() => reject(new Error(message)), ms);
    });
    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }, []);

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

      const localCollections = await withTimeout(getLocalCollections(), 4000, 'Local cache load timed out');
      let cloudCollections: UserCollection[] = [];
      try {
        cloudCollections = await withTimeout(fetchCloudCollections({ userId: user?.id ?? null, includePublic: true }), 12000, 'Cloud fetch timed out');
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
          const seededCollections = INITIAL_COLLECTIONS.map(seed => ({
            ...seed,
            isPublic: true,
            ownerId: user.id
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

      if (user) {
        setCollections(cloudCollections);
      } else if (cloudCollections.length === 0 && localCollections.length === 0) {
        setCollections(fallbackSampleCollections);
      } else {
        setCollections(cloudCollections.length > 0 ? cloudCollections : localCollections);
      }
      if ((cloudCollections.length + localCollections.length) > 0) {
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
  }, [isSupabaseReady, user, refreshCollections]);

  return { collections, isLoading, loadError, hasLocalImport, refreshCollections };
};
