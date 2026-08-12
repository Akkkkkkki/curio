import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { User } from '@supabase/supabase-js';
import {
  HashRouter,
  Routes,
  Route,
  useNavigate,
  useNavigationType,
  useLocation,
  Link,
  Navigate,
} from 'react-router-dom';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { Analytics } from '@vercel/analytics/react';
import { Layout } from './components/Layout';
import { ExplorePlaceholder } from './components/ExplorePlaceholder';
import { LegalPage } from './components/LegalPage';
import { AddItemModal } from './components/AddItemModal';
import { CreateCollectionModal } from './components/CreateCollectionModal';
import { AuthModal } from './components/AuthModal';
import { UserCollection, CollectionItem, FieldDefinition } from './types';
import { CUSTOM_TEMPLATE_ID, TEMPLATES } from './constants';
import { getOnThisDayItems } from './utils/onThisDay';
import { Loader2, Sparkles, Lock, Landmark } from 'lucide-react';
import { Button } from './components/ui/Button';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import {
  fetchCloudCollections,
  getLocalCollections,
  getPendingAssetUploadSummary,
  getPendingDeletes,
  getPendingSyncIds,
  hasLocalOnlyData,
  importLocalCollectionsToCloud,
  mergeCollections,
  saveCollection,
  shouldPreserveLocalOnlyCollection,
  saveAllCollections,
  saveAsset,
  isQuotaExceededError,
  deleteAsset,
  deleteCloudItem,
  deleteCollection,
  requestPersistence,
  getSeedVersion,
  setSeedVersion,
  initDB,
  setAssetSyncStatusCallback,
  setSyncStatusCallback,
  syncPendingChanges,
  syncPendingAssetUploads,
  syncPendingDeletes,
  type PendingAssetUploadSummary,
  type SyncStatus,
} from './services/db';
import { processImage } from './services/imageProcessor';
import { LanguageProvider, useTranslation } from './i18n';
import { supabase, isSupabaseConfigured, signOutUser } from './services/supabase';
import { ThemeProvider, useTheme, typographyClasses } from './theme';
import { StatusToast, StatusTone, getStatusToastDurationMs } from './components/StatusToast';
import { StatusBanner } from './components/StatusBanner';
import { LanguageToggle } from './components/LanguageToggle';
import { ConflictResolutionModal } from './components/ConflictResolutionModal';
import {
  buildSeedRepairs,
  CURRENT_SEED_VERSION,
  INITIAL_COLLECTIONS,
} from './services/seedCollections';
import { trackEvent } from './services/analytics';

// Sentinel for "the admin lookup has settled for a signed-out session" so the
// app-shell readiness marker can distinguish it from "lookup still pending".
const ANONYMOUS_ADMIN_SCOPE = 'anonymous';

import {
  getEnvValidationErrors,
  isStorageNearLimit,
  STORAGE_QUOTA_CHECK_INTERVAL_MS,
} from './config';
import { detectConflicts } from './utils/conflictDetection';
import { HomeScreen } from './components/HomeScreen';
import { CollectionScreen } from './components/CollectionScreen';
import { ItemDetailScreen, type ItemSaveState } from './components/ItemDetailScreen';
import { useAndroidBackButton } from './hooks/useAndroidBackButton';

export const AppContent: React.FC = () => {
  const { t, language } = useTranslation();
  const { theme, setTheme } = useTheme();
  useAndroidBackButton();
  const [collections, setCollections] = useState<UserCollection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  // Which user the async admin-profile lookup has settled for, and which
  // user/role identity the last completed collections refresh served. Both
  // feed the app-shell readiness marker so E2E waits can't race the admin
  // lookup → re-refresh → seed sequence on an authenticated first run.
  const [adminCheckedFor, setAdminCheckedFor] = useState<string | null>(null);
  const [refreshedForKey, setRefreshedForKey] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  // CUR-152: the auth modal opens in the mode matching the triggering intent.
  // First-run CTAs ("Add your first item", "Start a collection") greet a
  // brand-new user with sign-up; header/profile entry points keep sign-in.
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup'>('signin');
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [allowPublicBrowse, setAllowPublicBrowse] = useState(false);
  const [hasLocalImport, setHasLocalImport] = useState(false);
  const [importState, setImportState] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addModalDefaultCollectionId, setAddModalDefaultCollectionId] = useState<
    string | undefined
  >();
  const [isCreateCollectionOpen, setIsCreateCollectionOpen] = useState(false);
  const [status, setStatus] = useState<{
    message: string;
    tone: StatusTone;
    actionLabel?: string;
    onAction?: () => void;
  } | null>(null);
  const tRef = useRef(t);
  const showStatusRef = useRef<(message: string, tone?: StatusTone) => void>(() => undefined);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [itemSaveStates, setItemSaveStates] = useState<Record<string, ItemSaveState>>({});
  const [pendingAssetUploads, setPendingAssetUploads] = useState<PendingAssetUploadSummary>({
    total: 0,
    stalled: 0,
  });
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [conflicts, setConflicts] = useState<ReturnType<typeof detectConflicts>>([]);
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const [pendingAuthAction, setPendingAuthAction] = useState<
    'add-item' | 'create-collection' | null
  >(null);
  const [authActionQueue, setAuthActionQueue] = useState<'add-item' | 'create-collection' | null>(
    null,
  );
  const openAuthModal = useCallback((mode: 'signin' | 'signup') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  }, []);
  const saveTimeoutRef = useRef<Record<string, any>>({});
  const pendingEditedFieldsRef = useRef<Record<string, Set<string>>>({});
  const pendingEditedItemIdsRef = useRef<Record<string, Set<string>>>({});
  // Every Item Detail edit bumps the item's revision. A save records the
  // revision it carries when it starts, so a generic sync event only resolves
  // the badge when no newer edit is still waiting to be backed up.
  const itemSaveRevisionRef = useRef<Record<string, number>>({});
  const pendingDetailSavesRef = useRef<Map<string, number>>(new Map());
  const statusTimeoutRef = useRef<number | null>(null);
  const pendingSyncToastRef = useRef(false);
  const hasQuotaWarningRef = useRef(false);
  const resolvedConflictIdsRef = useRef<Set<string>>(new Set());
  const isSupabaseReady = isSupabaseConfigured();
  const envErrors = useMemo(() => getEnvValidationErrors(), []);
  const fallbackSampleCollections = useMemo(
    () =>
      INITIAL_COLLECTIONS.map((collection) => ({
        ...collection,
        isPublic: true,
        ownerId: collection.ownerId || null,
      })),
    [],
  );

  const showStatus = useCallback(
    (
      message: string,
      tone: StatusTone = 'info',
      options?: { actionLabel?: string; onAction?: () => void; durationMs?: number },
    ) => {
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current);
      }
      setStatus({
        message,
        tone,
        actionLabel: options?.actionLabel,
        onAction: options?.onAction,
      });
      const durationMs = getStatusToastDurationMs(tone, options);
      statusTimeoutRef.current = window.setTimeout(() => setStatus(null), durationMs);
    },
    [],
  );

  const refreshPendingAssetUploads = useCallback(async () => {
    try {
      const summary = await getPendingAssetUploadSummary();
      setPendingAssetUploads(summary);
    } catch (error) {
      console.warn('Pending upload count check failed:', error);
    }
  }, []);

  const setItemSaveState = useCallback(
    (itemIds: Iterable<string>, status: ItemSaveState['status'], error?: string) => {
      const ids = [...itemIds];
      if (ids.length === 0) return;
      setItemSaveStates((prev) => {
        const next = { ...prev };
        ids.forEach((itemId) => {
          next[itemId] = error ? { status, error } : { status };
        });
        return next;
      });
    },
    [],
  );

  const checkStorageQuota = useCallback(async () => {
    if (!navigator.storage?.estimate) return;
    try {
      const isLow = isStorageNearLimit(await navigator.storage.estimate());
      if (isLow && !hasQuotaWarningRef.current) {
        showStatus(t('statusStorageNearLimit'), 'warning');
        hasQuotaWarningRef.current = true;
        return;
      }
      if (!isLow && hasQuotaWarningRef.current) {
        hasQuotaWarningRef.current = false;
      }
    } catch (error) {
      console.warn('Storage quota check failed:', error);
    }
  }, [showStatus, t]);

  const handleRetrySync = useCallback(async () => {
    try {
      const synced = await syncPendingChanges({ force: true });
      const assetsSynced = await syncPendingAssetUploads({ force: true });
      const deletesSynced = await syncPendingDeletes();
      void refreshPendingAssetUploads();
      const dataSynced = synced + deletesSynced;
      if (dataSynced > 0) {
        showStatus(t('statusPendingSynced').replace('{count}', String(dataSynced)), 'success');
      }
      if (dataSynced === 0 && assetsSynced === 0) {
        showStatus(t('statusWillSync'), 'warning');
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : t('statusSyncPaused');
      trackEvent('sync_failed', {
        operation: 'manual_retry',
        online: navigator.onLine,
      });
      showStatus(t('statusSyncError').replace('{error}', errorMessage), 'error', {
        actionLabel: t('actionRetry'),
        onAction: () => handleRetrySync(),
      });
    }
  }, [refreshPendingAssetUploads, showStatus, t]);

  useEffect(() => {
    checkStorageQuota();
    const intervalId = window.setInterval(() => {
      checkStorageQuota();
    }, STORAGE_QUOTA_CHECK_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [checkStorageQuota]);

  useEffect(() => {
    void refreshPendingAssetUploads();
    const handleAssetSyncStatus = (
      status: 'queued' | 'synced' | 'error',
      details?: { count?: number; error?: string },
    ) => {
      if (status === 'error') {
        trackEvent('upload_failed', {
          operation: 'pending_asset_sync',
          retryable: true,
          has_error_message: Boolean(details?.error),
        });
      }
      void refreshPendingAssetUploads();
    };
    setAssetSyncStatusCallback(handleAssetSyncStatus);
    return () => setAssetSyncStatusCallback(null);
  }, [refreshPendingAssetUploads]);

  useEffect(() => {
    tRef.current = t;
    showStatusRef.current = showStatus;
  }, [t, showStatus]);

  useEffect(() => {
    return () => {
      if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const handleSyncStatus = (status: SyncStatus, error?: string) => {
      setSyncStatus(status);
      setSyncError(error ?? null);
      if (status === 'synced' || status === 'error') {
        // Only resolve items whose recorded save revision is still the latest;
        // an item edited again since this save started stays "Saving" until
        // its own save reports back.
        const resolvedIds: string[] = [];
        pendingDetailSavesRef.current.forEach((revision, itemId) => {
          if (revision === (itemSaveRevisionRef.current[itemId] ?? 0)) {
            resolvedIds.push(itemId);
          }
        });
        pendingDetailSavesRef.current.clear();
        if (status === 'synced') {
          setItemSaveState(resolvedIds, 'saved');
        } else {
          setItemSaveState(resolvedIds, 'error', error || tRef.current('statusSyncPaused'));
        }
      }
      if (status === 'error') {
        trackEvent('sync_failed', {
          operation: 'collection_sync',
          online: navigator.onLine,
          has_error_message: Boolean(error),
        });
      }
    };
    setSyncStatusCallback(handleSyncStatus);
    return () => setSyncStatusCallback(null);
  }, [setItemSaveState]);

  useEffect(() => {
    if (conflicts.length === 0) {
      setIsConflictModalOpen(false);
    }
  }, [conflicts.length]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      // Fire-and-forget: a failed tombstone read now rejects rather than
      // reporting "nothing pending", so swallow it here. The deletes stay
      // queued and the next sync attempt retries them.
      void syncPendingDeletes().catch((e) =>
        console.warn('Pending delete sync on reconnect failed:', e),
      );
    };
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!pendingSyncToastRef.current) return;

    if (syncStatus === 'synced') {
      showStatus(t('statusSynced'), 'success');
      pendingSyncToastRef.current = false;
    }

    if (syncStatus === 'offline') {
      showStatus(t('statusWillSync'), 'warning');
      pendingSyncToastRef.current = false;
    }

    if (syncStatus === 'error') {
      const errorMessage = syncError || t('statusSyncPaused');
      if (!navigator.onLine) {
        showStatus(t('statusWillSync'), 'warning');
      } else {
        showStatus(t('statusSyncError').replace('{error}', errorMessage), 'error', {
          actionLabel: t('actionRetry'),
          onAction: () => handleRetrySync(),
        });
      }
      pendingSyncToastRef.current = false;
    }
  }, [handleRetrySync, showStatus, syncError, syncStatus, t]);

  useEffect(() => {
    if (!isSupabaseReady || !supabase) {
      setUser(null);
      setAuthReady(true);
      return;
    }

    let unsubscribe: (() => void) | undefined;
    const initAuth = async () => {
      // Subscribe before reading the session so PASSWORD_RECOVERY emitted
      // during Supabase's URL-detection phase isn't missed.
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        setUser(session?.user || null);
        if (event === 'PASSWORD_RECOVERY') {
          setIsPasswordRecovery(true);
          setIsAuthModalOpen(true);
        }
      });
      unsubscribe = () => subscription.unsubscribe();

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        setUser(session?.user || null);
      } catch (e) {
        console.warn('Auth init failed:', e);
        setUser(null);
      } finally {
        setAuthReady(true);
      }
    };

    initAuth();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isSupabaseReady]);

  useEffect(() => {
    let isMounted = true;
    if (!isSupabaseReady || !supabase || !user) {
      setIsAdmin(false);
      setAdminCheckedFor(ANONYMOUS_ADMIN_SCOPE);
      return () => {
        isMounted = false;
      };
    }

    const loadAdminStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', user.id)
          .single();
        if (!isMounted) return;
        if (error) {
          console.warn('Admin status check failed:', error);
          setIsAdmin(false);
          return;
        }
        setIsAdmin(Boolean(data?.is_admin));
      } catch (e) {
        console.warn('Admin status check failed:', e);
        if (isMounted) setIsAdmin(false);
      } finally {
        if (isMounted) setAdminCheckedFor(user.id);
      }
    };

    loadAdminStatus();
    return () => {
      isMounted = false;
    };
  }, [isSupabaseReady, user]);

  const withTimeout = useCallback(
    async <T,>(promise: Promise<T>, ms: number, message: string): Promise<T> => {
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

  const loadLocalCollectionsWithTimeout = useCallback(
    () => withTimeout(getLocalCollections(), 4000, 'Local cache load timed out'),
    [withTimeout],
  );

  const loadCloudCollectionsWithTimeout = useCallback(
    (userId: string | null) =>
      withTimeout(
        fetchCloudCollections({
          userId,
          includePublic: true,
        }),
        12000,
        'Cloud fetch timed out',
      ),
    [withTimeout],
  );

  const maybeSeedCollections = useCallback(
    async ({
      user,
      isAdmin,
      cloudCollections,
    }: {
      user: { id: string } | null;
      isAdmin: boolean;
      cloudCollections: UserCollection[];
    }) => {
      if (!user || !isAdmin) {
        return cloudCollections;
      }

      // Reconcile the cloud copy of the master sample against the code-defined
      // seed on every admin load, not just when the cloud is empty — a drifted
      // copy (toggled private, missing items) could otherwise never self-heal
      // (CUR-143). A healthy cloud copy makes this a no-op.
      // A fresh or cleared device reports seed version 0, which says nothing
      // about the cloud — only a device that recorded an older version forces
      // a content re-push; otherwise structural drift alone decides.
      const localSeedVersion = await getSeedVersion();
      const seedRepairs = buildSeedRepairs(cloudCollections, user.id, {
        force: localSeedVersion > 0 && localSeedVersion < CURRENT_SEED_VERSION,
      });
      if (seedRepairs.length === 0) {
        if (localSeedVersion < CURRENT_SEED_VERSION) {
          await setSeedVersion(CURRENT_SEED_VERSION);
        }
        return cloudCollections;
      }

      for (const seedCollection of seedRepairs) {
        await saveCollection(seedCollection);
      }
      await setSeedVersion(CURRENT_SEED_VERSION);
      const repairedIds = new Set(seedRepairs.map((collection) => collection.id));
      return [
        ...cloudCollections.filter((collection) => !repairedIds.has(collection.id)),
        ...seedRepairs,
      ];
    },
    [],
  );

  const resolveCollectionsForUser = useCallback(
    ({
      user,
      localCollections,
      cloudCollections,
      fallbackSampleCollections,
      mergedCollections,
    }: {
      user: { id: string } | null;
      localCollections: UserCollection[];
      cloudCollections: UserCollection[];
      fallbackSampleCollections: UserCollection[];
      mergedCollections: UserCollection[];
    }) => {
      if (!user) {
        // For unauthenticated users:
        // 1. If cloud has public collections, show those
        // 2. Otherwise, fall back to sample collections (never show blank)
        const publicCloudCollections = cloudCollections.filter((c) => c.isPublic);
        const collections =
          publicCloudCollections.length > 0 ? publicCloudCollections : fallbackSampleCollections;
        return {
          collections,
          hasLocalImport: false,
          shouldPersist: false,
          showSyncedStatus: publicCloudCollections.length > 0,
        };
      }

      const localOnly = hasLocalOnlyData(localCollections, cloudCollections);
      return {
        collections: mergedCollections,
        hasLocalImport: localOnly,
        shouldPersist: true,
        showSyncedStatus: cloudCollections.length + localCollections.length > 0,
      };
    },
    [],
  );

  const refreshCollections = useCallback(async () => {
    // Records which user/role identity this refresh serves; the app-shell
    // readiness marker requires the last completed refresh to match the
    // current identity so an admin's post-lookup re-refresh (which seeds the
    // sample data) can't be raced by tests waiting on readiness.
    const refreshIdentityKey = `${user?.id ?? 'anon'}:${isAdmin ? 'admin' : 'member'}`;
    if (!isSupabaseReady) {
      setCollections(fallbackSampleCollections);
      setLoadError(null);
      setConflicts([]);
      setIsConflictModalOpen(false);
      setIsLoading(false);
      setRefreshedForKey(refreshIdentityKey);
      return;
    }
    setIsLoading(true);
    setLoadError(null);

    // Persistent storage is best-effort; never let it block or fail the load.
    try {
      await withTimeout(requestPersistence(), 4000, 'Persistence request timed out');
    } catch (e) {
      console.warn('Persistent storage request failed (continuing):', e);
    }

    // Local cache is a fallback; a slow/corrupt read must not abort the load.
    let localCollections: UserCollection[] = [];
    try {
      localCollections = await loadLocalCollectionsWithTimeout();
    } catch (e) {
      console.warn('Local cache load failed (continuing):', e);
    }

    let cloudCollections: UserCollection[] = [];
    let pendingSyncIdsAtFetchStart: string[] = [];
    try {
      pendingSyncIdsAtFetchStart = await getPendingSyncIds();
    } catch (e) {
      console.warn('Pending sync snapshot failed (continuing):', e);
    }
    const cloudFetchStartedAt = new Date().toISOString();
    try {
      cloudCollections = await loadCloudCollectionsWithTimeout(user?.id ?? null);
    } catch (e) {
      console.warn('Supabase cloud fetch failed:', e);
      setHasLocalImport(false);
      setConflicts([]);
      setIsConflictModalOpen(false);
      // Prefer showing whatever we already have (cached or sample) over a
      // blocking error screen. Only hard-block when there is genuinely nothing
      // to display so the user can retry.
      if (localCollections.length > 0) {
        setCollections(localCollections);
        setLoadError(null);
      } else if (!user) {
        setCollections(fallbackSampleCollections);
        setLoadError(null);
      } else {
        setCollections([]);
        setLoadError(tRef.current('loadErrorCloudFetch'));
      }
      showStatusRef.current(tRef.current('statusSyncPaused'), 'error');
      setIsLoading(false);
      setRefreshedForKey(refreshIdentityKey);
      return;
    }

    try {
      cloudCollections = await maybeSeedCollections({
        user,
        isAdmin,
        cloudCollections,
      });

      // Re-read local state AFTER the slow, network-bound cloud fetch (and any
      // seeding) so that collections/items the user created or edited while the
      // round-trip was in flight are included in the merge. Merging against the
      // pre-fetch snapshot would let saveAllCollections() overwrite — and
      // effectively delete — that just-written local data. (CUR-37)
      const freshLocalCollections = await loadLocalCollectionsWithTimeout();
      const [pendingSyncIds, pendingDeletes] = await Promise.all([
        getPendingSyncIds(),
        getPendingDeletes(),
      ]);
      const mergedCollections = mergeCollections(freshLocalCollections, cloudCollections, {
        includeLocalOnly: (collection) =>
          shouldPreserveLocalOnlyCollection(collection, {
            pendingSyncIds,
            pendingSyncIdsAtFetchStart,
            cloudFetchStartedAt,
          }),
        pendingDeletes,
      });

      const detectedConflicts = detectConflicts(freshLocalCollections, cloudCollections);
      const unresolvedConflicts = detectedConflicts.filter(
        (conflict) => !resolvedConflictIdsRef.current.has(conflict.id),
      );
      setConflicts(unresolvedConflicts);

      const {
        collections: resolvedCollections,
        hasLocalImport: resolvedHasLocalImport,
        shouldPersist,
        showSyncedStatus,
      } = resolveCollectionsForUser({
        user,
        localCollections: freshLocalCollections,
        cloudCollections,
        fallbackSampleCollections,
        mergedCollections,
      });

      setHasLocalImport(resolvedHasLocalImport);

      // Render the result and clear loading immediately. Cache persistence and
      // pending-sync flushing run in the background so a slow IndexedDB write or
      // a stalled upload can never keep the user stuck on the loading screen.
      setCollections(resolvedCollections);
      setLoadError(null);
      setIsLoading(false);
      setRefreshedForKey(refreshIdentityKey);
      if (showSyncedStatus) {
        showStatusRef.current(tRef.current('statusSynced'), 'success');
      }

      void (async () => {
        try {
          if (shouldPersist) {
            await saveAllCollections(mergedCollections);
          }
          if (user && navigator.onLine) {
            const synced = await syncPendingChanges();
            if (synced > 0) {
              showStatusRef.current(
                tRef.current('statusPendingSynced').replace('{count}', String(synced)),
                'success',
              );
            }
            await syncPendingAssetUploads();
            await syncPendingDeletes();
            void refreshPendingAssetUploads();
          }
        } catch (e) {
          console.warn('Background cache persistence/sync failed:', e);
        }
      })();
    } catch (e) {
      console.error('Initialization failed:', e);
      setConflicts([]);
      setIsConflictModalOpen(false);
      // Fall back to cached data rather than blanking the UI when possible.
      if (localCollections.length > 0) {
        setCollections(localCollections);
        setLoadError(null);
      } else {
        setCollections([]);
        setLoadError(tRef.current('loadErrorGeneric'));
      }
      showStatusRef.current(tRef.current('statusSyncPaused'), 'error');
      setIsLoading(false);
      setRefreshedForKey(refreshIdentityKey);
    }
  }, [
    user,
    isAdmin,
    isSupabaseReady,
    withTimeout,
    refreshPendingAssetUploads,
    fallbackSampleCollections,
    loadLocalCollectionsWithTimeout,
    loadCloudCollectionsWithTimeout,
    maybeSeedCollections,
    resolveCollectionsForUser,
  ]);

  useEffect(() => {
    if (!isSupabaseReady) {
      setCollections(fallbackSampleCollections);
      setIsLoading(false);
      setHasLocalImport(false);
      setImportState('idle');
      setImportMessage(null);
      setLoadError(null);
      setConflicts([]);
      setIsConflictModalOpen(false);
    }
  }, [fallbackSampleCollections, isSupabaseReady]);

  useEffect(() => {
    if (!isSupabaseReady || !authReady) {
      return;
    }
    refreshCollections();
  }, [authReady, isSupabaseReady, refreshCollections]);

  const handleImportLocal = async () => {
    setImportState('running');
    setImportMessage(null);
    try {
      await importLocalCollectionsToCloud();
      setImportState('done');
      setImportMessage(t('importComplete'));
      showStatus(t('statusImportComplete'), 'success');
      await refreshCollections();
    } catch (e) {
      console.error('Local import failed:', e);
      setImportState('error');
      setImportMessage(t('importFailed'));
      showStatus(t('statusImportFailed'), 'error');
    }
  };

  const debouncedSaveCollection = useCallback(
    (collection: UserCollection, changedFields: string[], changedItemIds: string[] = []) => {
      if (saveTimeoutRef.current[collection.id]) {
        clearTimeout(saveTimeoutRef.current[collection.id]);
      }
      // Accumulate field names across the debounce window so edits to several
      // fields within 1.5s are all reflected in the single `item_edited` event.
      const accumulated = pendingEditedFieldsRef.current[collection.id] ?? new Set<string>();
      changedFields.forEach((field) => accumulated.add(field));
      pendingEditedFieldsRef.current[collection.id] = accumulated;
      const pendingItemIds = pendingEditedItemIdsRef.current[collection.id] ?? new Set<string>();
      changedItemIds.forEach((itemId) => pendingItemIds.add(itemId));
      pendingEditedItemIdsRef.current[collection.id] = pendingItemIds;
      saveTimeoutRef.current[collection.id] = setTimeout(() => {
        delete saveTimeoutRef.current[collection.id];
        const editedFields = pendingEditedFieldsRef.current[collection.id];
        const detailItemIds = pendingEditedItemIdsRef.current[collection.id] ?? new Set<string>();
        delete pendingEditedFieldsRef.current[collection.id];
        delete pendingEditedItemIdsRef.current[collection.id];
        const saveRevisions = new Map<string, number>();
        detailItemIds.forEach((itemId) => {
          const revision = itemSaveRevisionRef.current[itemId] ?? 0;
          saveRevisions.set(itemId, revision);
          pendingDetailSavesRef.current.set(itemId, revision);
        });
        // Resolve only items this save still speaks for — an item edited again
        // after this save started keeps its "Saving" badge for the newer save.
        const settleItems = (status: 'saved' | 'error', error?: string) => {
          const settledIds: string[] = [];
          saveRevisions.forEach((revision, itemId) => {
            if (pendingDetailSavesRef.current.get(itemId) === revision) {
              pendingDetailSavesRef.current.delete(itemId);
            }
            if (revision === (itemSaveRevisionRef.current[itemId] ?? 0)) {
              settledIds.push(itemId);
            }
          });
          setItemSaveState(settledIds, status, error);
        };
        saveCollection(collection)
          .then(() => {
            trackEvent('item_edited', {
              fields: [...(editedFields ?? [])].sort().join(','),
              surface: 'item_detail',
            });
            if (!isSupabaseReady) {
              settleItems('saved');
            }
          })
          .catch((err) => {
            settleItems('error', err instanceof Error ? err.message : t('statusSyncPaused'));
            console.warn('Sync failed', err);
            showStatus(
              t('statusSyncError').replace('{error}', err.message || 'Unknown error'),
              'error',
            );
          });
      }, 1500);
    },
    [isSupabaseReady, setItemSaveState, showStatus, t],
  );

  const clearPendingCollectionSave = useCallback((collectionId: string) => {
    if (saveTimeoutRef.current[collectionId]) {
      clearTimeout(saveTimeoutRef.current[collectionId]);
      delete saveTimeoutRef.current[collectionId];
    }
    delete pendingEditedFieldsRef.current[collectionId];
    delete pendingEditedItemIdsRef.current[collectionId];
  }, []);

  // CUR-149: ItemDetailScreen lives outside AppContent; it retries a failed
  // save through this callback so the save-revision bookkeeping stays next
  // to the refs it guards.
  const retryItemSave = useCallback(
    (collection: UserCollection, itemId: string) => {
      const revision = itemSaveRevisionRef.current[itemId] ?? 0;
      setItemSaveState([itemId], 'saving');
      pendingDetailSavesRef.current.set(itemId, revision);
      const settleRetry = (status: 'saved' | 'error', error?: string) => {
        if (pendingDetailSavesRef.current.get(itemId) === revision) {
          pendingDetailSavesRef.current.delete(itemId);
        }
        if (revision === (itemSaveRevisionRef.current[itemId] ?? 0)) {
          setItemSaveState([itemId], status, error);
        }
      };
      saveCollection(collection)
        .then(() => {
          if (!isSupabaseReady) {
            settleRetry('saved');
          }
        })
        .catch((err) => {
          settleRetry('error', err instanceof Error ? err.message : t('statusSyncPaused'));
        });
    },
    [isSupabaseReady, setItemSaveState, t],
  );

  const removeCollection = useCallback(
    async (collection: UserCollection) => {
      clearPendingCollectionSave(collection.id);
      await deleteCollection(collection);
      setCollections((prev) => prev.filter((c) => c.id !== collection.id));
    },
    [clearPendingCollectionSave],
  );

  const openAddItemModal = useCallback((collectionId: string) => {
    setAddModalDefaultCollectionId(collectionId);
    setIsAddModalOpen(true);
  }, []);

  const canEditCollection = useCallback(
    (collectionId: string) => {
      const target = collections.find((c) => c.id === collectionId);
      if (!target) return false;
      return !target.isPublic || isAdmin;
    },
    [collections, isAdmin],
  );

  const handleAddItem = async (
    collectionId: string,
    itemData: Omit<CollectionItem, 'id' | 'createdAt' | 'updatedAt'>,
  ) => {
    const exists = collections.some((c) => c.id === collectionId);
    if (!exists) {
      console.warn('handleAddItem: target collection not found', collectionId);
      const message = t('statusSaveFailedMissingCollection');
      showStatus(message, 'error');
      throw new Error(message);
    }
    if (!canEditCollection(collectionId)) {
      const message = t('readOnlyControls');
      showStatus(message, 'error');
      throw new Error(message);
    }
    pendingSyncToastRef.current = true;
    if (!isSupabaseReady) pendingSyncToastRef.current = false;
    const itemId = Math.random().toString(36).substr(2, 9);
    const now = new Date().toISOString();
    let hasPhoto = false;
    const targetCollection = collections.find((c) => c.id === collectionId);
    const isPublicCollection = Boolean(targetCollection?.isPublic);

    if (!isPublicCollection && itemData.photoUrl.startsWith('data:')) {
      try {
        const { original, display } = await processImage(itemData.photoUrl);
        await saveAsset(collectionId, itemId, original, display);
        await checkStorageQuota();
        hasPhoto = true;
      } catch (e) {
        console.error('Image processing failed', e);
        // CUR-38: a full device disk (IndexedDB quota) never recovers on retry,
        // so surface an honest "free up space" message instead of the generic
        // "please try again" — the latter implies a transient failure.
        const storageFull = isQuotaExceededError(e);
        trackEvent('upload_failed', {
          operation: 'local_image_processing',
          retryable: !storageFull,
        });
        const message = storageFull ? t('statusStorageFull') : t('saveImageFailed');
        showStatus(message, 'error');
        throw new Error(message);
      }
    }

    const newItem: CollectionItem = {
      ...itemData,
      id: itemId,
      photoUrl: hasPhoto ? 'asset' : itemData.photoUrl,
      createdAt: now,
      updatedAt: now,
    };

    let added = false;
    setCollections((prev) => {
      const target = prev.find((c) => c.id === collectionId);
      if (!target) return prev;
      added = true;
      const newC = { ...target, items: [newItem, ...target.items], updatedAt: now };
      saveCollection(newC).catch((e) => {
        console.error('Save failed:', e);
        showStatus(t('statusSyncError').replace('{error}', e.message), 'error');
      });
      return prev.map((c) => (c.id === collectionId ? newC : c));
    });
    if (added) {
      showStatus(t('statusSaved'), 'success');
    } else {
      console.warn('handleAddItem: target collection not found', collectionId);
      const message = t('statusSaveFailedMissingCollection');
      showStatus(message, 'error');
      throw new Error(message);
    }
  };

  const updateItem = (collectionId: string, itemId: string, updates: Partial<CollectionItem>) => {
    if (!canEditCollection(collectionId)) return;
    itemSaveRevisionRef.current[itemId] = (itemSaveRevisionRef.current[itemId] ?? 0) + 1;
    setItemSaveState([itemId], 'saving');
    const now = new Date().toISOString();
    setCollections((prev) =>
      prev.map((c) => {
        if (c.id === collectionId) {
          const newC = {
            ...c,
            updatedAt: now,
            items: c.items.map((item) =>
              item.id === itemId ? { ...item, ...updates, updatedAt: now } : item,
            ),
          };
          debouncedSaveCollection(newC, Object.keys(updates), [itemId]);
          return newC;
        }
        return c;
      }),
    );
  };

  const updateCollectionMeta = useCallback(
    (collectionId: string, updates: Partial<UserCollection>) => {
      if (!canEditCollection(collectionId)) return;
      const now = new Date().toISOString();
      setCollections((prev) => {
        const target = prev.find((c) => c.id === collectionId);
        if (target) {
          const newC = { ...target, ...updates, updatedAt: now };
          saveCollection(newC).catch((e) => {
            console.error('Update collection failed:', e);
            showStatus(t('statusSyncError').replace('{error}', e.message), 'error');
          });
          return prev.map((c) => (c.id === collectionId ? newC : c));
        }
        return prev;
      });
    },
    [canEditCollection],
  );

  const buildFieldId = (label: string, used: Set<string>) => {
    const base =
      label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'field';
    let id = base;
    let index = 2;
    while (used.has(id)) {
      id = `${base}_${index}`;
      index += 1;
    }
    used.add(id);
    return id;
  };

  const buildCustomFields = (
    fields: string[],
    pinnedFields: string[],
    templateFields: FieldDefinition[] | null,
  ) => {
    const used = new Set<string>();
    const pinnedSet = new Set(pinnedFields.map((field) => field.trim().toLowerCase()));
    return fields.map((field) => {
      const label = field.trim().replace(/\s+/g, ' ');
      const templateMatch = templateFields?.find(
        (templateField) => templateField.label.toLowerCase() === label.toLowerCase(),
      );
      const baseField = templateMatch
        ? { ...templateMatch }
        : { id: '', label, type: 'text' as const, displayMode: 'detail' as const };
      const id = templateMatch?.id || buildFieldId(label, used);
      return {
        ...baseField,
        id,
        label,
        displayMode: pinnedSet.has(label.toLowerCase()) ? 'primary' : 'detail',
      };
    });
  };

  const handleCreateCollection = ({
    templateId,
    name,
    icon,
    fields,
    pinnedFields,
    description,
  }: {
    templateId?: string;
    name: string;
    icon?: string;
    fields: string[];
    pinnedFields: string[];
    description?: string;
  }): string | null => {
    if (!isAuthenticated) {
      setPendingAuthAction('create-collection');
      openAuthModal('signup');
      setIsCreateCollectionOpen(false);
      return null;
    }
    pendingSyncToastRef.current = true;
    if (!isSupabaseReady) pendingSyncToastRef.current = false;
    const template = TEMPLATES.find((t) => t.id === templateId) || null;
    const normalizedFields = fields.map((field) => field.trim()).filter(Boolean);
    const normalizedPinned = pinnedFields.map((field) => field.trim()).filter(Boolean);
    const customFields = buildCustomFields(
      normalizedFields,
      normalizedPinned,
      template?.fields ?? null,
    );
    const newTemplateId = template ? template.id : CUSTOM_TEMPLATE_ID;
    const newCol: UserCollection = {
      id: Math.random().toString(36).substr(2, 9),
      templateId: newTemplateId,
      name: name,
      icon: icon || template?.icon || TEMPLATES[0].icon,
      customFields,
      items: [],
      isPublic: false,
      ownerId: user?.id,
      updatedAt: new Date().toISOString(),
      collectionDescription: description?.trim() || undefined,
    };
    setCollections((prev) => {
      const updated = [...prev, newCol];
      saveCollection(newCol).catch((e) => {
        console.error('Create collection failed:', e);
        showStatus(t('statusSyncError').replace('{error}', e.message), 'error');
      });
      return updated;
    });
    showStatus(t('statusSaved'), 'success');
    return newCol.id;
  };

  const deleteItem = (collectionId: string, itemId: string) => {
    if (!canEditCollection(collectionId)) return false;
    clearPendingCollectionSave(collectionId);
    setCollections((prev) => {
      const target = prev.find((c) => c.id === collectionId);
      if (target) {
        const newC = {
          ...target,
          items: target.items.filter((i) => i.id !== itemId),
        };
        saveCollection(newC).catch((e) => {
          console.error('Delete item save failed:', e);
          showStatus(t('statusSyncError').replace('{error}', e.message), 'error');
        });
        deleteAsset(collectionId, itemId);
        deleteCloudItem(collectionId, itemId).catch((e) => {
          console.warn('Delete cloud item failed:', e);
          // We don't show an error here as it's queued for retry, but we log it.
        });
        return prev.map((c) => (c.id === collectionId ? newC : c));
      }
      return prev;
    });
    return true;
  };

  const handleResolveConflict = useCallback((conflictId: string) => {
    resolvedConflictIdsRef.current.add(conflictId);
    setConflicts((prev) => prev.filter((conflict) => conflict.id !== conflictId));
  }, []);

  const handleUseLocalConflict = useCallback(
    (conflict: (typeof conflicts)[number]) => {
      if (conflict.type === 'item' && conflict.itemId) {
        const localItem = conflict.local as CollectionItem;
        updateItem(conflict.collectionId, conflict.itemId, {
          title: localItem.title,
          notes: localItem.notes,
          rating: localItem.rating,
          data: localItem.data,
          photoUrl: localItem.photoUrl,
          photoEnhancedPath: localItem.photoEnhancedPath,
        });
      } else if (conflict.type === 'collection') {
        const localCollection = conflict.local as UserCollection;
        updateCollectionMeta(conflict.collectionId, {
          name: localCollection.name,
          icon: localCollection.icon,
          customFields: localCollection.customFields,
          collectionDescription: localCollection.collectionDescription,
          templateId: localCollection.templateId,
          isPublic: localCollection.isPublic,
          isLocked: localCollection.isLocked,
        });
      }
      handleResolveConflict(conflict.id);
      showStatus(t('conflictApplied'), 'success');
    },
    [handleResolveConflict, showStatus, t, updateCollectionMeta, updateItem],
  );

  const stats = useMemo(() => {
    const privateCollections = collections.filter((c) => !c.isPublic);
    const statCollections =
      privateCollections.length > 0 ? privateCollections : collections.filter((c) => c.isPublic);
    const totalItems = statCollections.reduce((acc, c) => acc + c.items.length, 0);
    const avgRating =
      totalItems > 0
        ? (
            statCollections.reduce(
              (acc, c) => acc + c.items.reduce((iacc, i) => iacc + i.rating, 0),
              0,
            ) / totalItems
          ).toFixed(1)
        : 0;
    const allItems = statCollections.flatMap((c) => c.items);
    const featured =
      allItems.length > 0 ? allItems[Math.floor(Math.random() * allItems.length)] : null;

    // Archeology: Find items created on this day in prior years (local date),
    // falling back to last-month/last-week additions when no anniversary exists
    const history = getOnThisDayItems(allItems);

    return {
      totalItems,
      avgRating,
      totalCollections: statCollections.length,
      featured,
      historyItems: history.items,
      historyMatchType: history.matchType,
    };
  }, [collections]);

  const editableCollections = useMemo(() => {
    return collections.filter((c) => !c.isPublic || isAdmin);
  }, [collections, isAdmin]);

  const themeColors = {
    gallery: 'bg-stone-50',
    vault: 'bg-stone-950',
    atelier: 'bg-[#faf9f6]',
  };

  const conflictModalEntries = useMemo(() => {
    return conflicts.map((conflict) => {
      if (conflict.type === 'item') {
        const cloudItem = conflict.cloud as CollectionItem;
        const localItem = conflict.local as CollectionItem;
        const label = cloudItem.title || localItem.title || t('untitled');
        return {
          id: conflict.id,
          type: 'item' as const,
          collectionId: conflict.collectionId,
          itemId: conflict.itemId,
          localLabel: localItem.title || t('untitled'),
          cloudLabel: label,
          localUpdatedAt: localItem.updatedAt || localItem.createdAt,
          cloudUpdatedAt: cloudItem.updatedAt || cloudItem.createdAt,
          localPayload: localItem,
          cloudPayload: cloudItem,
        };
      }
      const cloudCollection = conflict.cloud as UserCollection;
      const localCollection = conflict.local as UserCollection;
      const label = cloudCollection.name || localCollection.name || t('newArchive');
      return {
        id: conflict.id,
        type: 'collection' as const,
        collectionId: conflict.collectionId,
        localLabel: localCollection.name || t('newArchive'),
        cloudLabel: label,
        localUpdatedAt: localCollection.updatedAt || localCollection.createdAt,
        cloudUpdatedAt: cloudCollection.updatedAt || cloudCollection.createdAt,
        localPayload: localCollection,
        cloudPayload: cloudCollection,
      };
    });
  }, [conflicts, t]);

  const isAuthenticated = Boolean(user);
  const sampleCollection = useMemo(() => collections.find((c) => c.isPublic), [collections]);
  const showAccessGate = isSupabaseReady && !isAuthenticated && !allowPublicBrowse;
  const isExploreRoute = location.pathname === '/explore';
  const isLegalRoute = location.pathname.startsWith('/legal/');
  // CUR-144: shared collection links are the product's sharing pillar — a
  // signed-out visitor opening /collection/:id must reach the content (or
  // CollectionScreen's not-available state), never the generic welcome gate
  // rendered under the collection URL.
  const isCollectionRoute = location.pathname.startsWith('/collection/');
  const shouldShowAccessGate =
    showAccessGate && !isExploreRoute && !isLegalRoute && !isCollectionRoute;
  // A signed-out visitor who arrives on a collection deep link is already
  // exploring, so latch public browsing — the same contract as the Explore
  // CTAs (handleExploreSamples / handleExploreFromNav). Navigating Home from
  // the shared collection then lands on the sample-aware Home, not the gate.
  // Latch only once auth has settled signed-out: a signed-in visit must not
  // set the flag, or the welcome gate would stay suppressed after a later
  // sign-out (Codex review on #340).
  useEffect(() => {
    if (isCollectionRoute && authReady && !isAuthenticated && !allowPublicBrowse) {
      setAllowPublicBrowse(true);
    }
  }, [isCollectionRoute, authReady, isAuthenticated, allowPublicBrowse]);
  const fallbackSampleCollectionId = fallbackSampleCollections[0]?.id ?? null;
  // Only expose a sample collection id that is actually present in `collections`.
  // The fallback sample is not part of merged cloud state for an authenticated
  // user with only private collections, so linking to it would bounce off
  // CollectionScreen back to Home (a dead Explore tab). Fall back to null in that
  // case so the bottom-nav Explore tab hides instead of dead-linking.
  const sampleCollectionId = useMemo(() => {
    if (sampleCollection) return sampleCollection.id;
    return collections.some((c) => c.id === fallbackSampleCollectionId)
      ? fallbackSampleCollectionId
      : null;
  }, [sampleCollection, collections, fallbackSampleCollectionId]);

  const statusBanner = useMemo(() => {
    if (!isSupabaseReady) {
      return (
        <StatusBanner title={t('sampleModeTitle')} message={t('sampleModeDesc')} tone="info" />
      );
    }
    if (envErrors.length > 0 && isSupabaseReady) {
      return (
        <StatusBanner
          title={t('configMissingTitle')}
          message={t('configMissingDesc', { keys: envErrors.join(', ') })}
          tone="error"
        />
      );
    }
    if (conflicts.length > 0) {
      return (
        <StatusBanner
          title={t('conflictBannerTitle')}
          message={t('conflictBannerDesc')}
          tone="warning"
          actionLabel={t('reviewUpdates')}
          onAction={() => setIsConflictModalOpen(true)}
        />
      );
    }
    if (syncStatus === 'error' && !isOffline) {
      return (
        <StatusBanner
          title={t('syncIssueTitle')}
          message={t('syncIssueDesc')}
          tone="error"
          actionLabel={t('actionRetry')}
          onAction={handleRetrySync}
        />
      );
    }
    if (isOffline || syncStatus === 'offline') {
      return <StatusBanner title={t('offlineTitle')} message={t('offlineDesc')} tone="warning" />;
    }
    if (pendingAssetUploads.stalled > 0) {
      return (
        <StatusBanner
          title={t('pendingUploadsErrorTitle', { count: pendingAssetUploads.stalled })}
          message={t('pendingUploadsErrorDesc')}
          tone="error"
          actionLabel={t('actionRetry')}
          onAction={handleRetrySync}
        />
      );
    }
    if (pendingAssetUploads.total > 0) {
      return (
        <StatusBanner
          title={t('pendingUploadsTitle', { count: pendingAssetUploads.total })}
          message={t('pendingUploadsDesc', { count: pendingAssetUploads.total })}
          tone="warning"
          actionLabel={t('actionRetry')}
          onAction={handleRetrySync}
        />
      );
    }
    return null;
  }, [
    conflicts.length,
    envErrors,
    handleRetrySync,
    isOffline,
    isSupabaseReady,
    pendingAssetUploads,
    syncStatus,
    t,
  ]);

  const handleExploreSamples = () => {
    setAllowPublicBrowse(true);
    // Deep-link straight into the sample exhibition when one is resolvable, so
    // the access-gate "Explore sample" CTA honors the single-path first-run
    // contract instead of dropping the visitor on an intermediate home grid.
    // When the sample isn't resolvable yet (network race) we keep the existing
    // refresh-and-stay-on-home fallback. Skipping refreshCollections() in the
    // navigate path mirrors handleExploreFromNav: a transient cloud failure
    // during that click-time refresh could replace `collections` with
    // local-only data and bounce the user off the just-opened collection.
    if (sampleCollectionId) {
      navigate(`/collection/${sampleCollectionId}`);
      return;
    }
    if (isSupabaseReady) {
      refreshCollections();
    }
  };

  // The bottom-nav Explore tab is only rendered when the sample collection is
  // already present in `collections` (see `sampleCollectionId`), so it just
  // needs to clear the access gate and let the <Link> navigate. We deliberately
  // skip refreshCollections() here: a transient cloud failure during that
  // click-time refresh would replace `collections` with local-only data and
  // drop the already-loaded target, turning this one-tap link back into the
  // dead link we set out to remove.
  const handleExploreFromNav = useCallback(() => {
    setAllowPublicBrowse(true);
  }, []);

  const handleAddAction = useCallback(() => {
    if (!isAuthenticated) {
      setPendingAuthAction('add-item');
      openAuthModal('signup');
      return;
    }
    if (editableCollections.length === 0) {
      setIsCreateCollectionOpen(true);
      return;
    }
    // When the bottom-nav Add is tapped from inside a collection (or one of
    // its items), inherit that collection so the modal opens on the upload
    // step instead of forcing a redundant picker pass — same behavior as the
    // in-screen "Add Item" button. Read-only samples are filtered by
    // editableCollections.some(...), so a visitor inside a public sample
    // still gets the picker.
    const collectionInPath = location.pathname.match(/^\/collection\/([^/]+)/)?.[1];
    const presetCollectionId =
      collectionInPath && editableCollections.some((c) => c.id === collectionInPath)
        ? collectionInPath
        : undefined;
    setAddModalDefaultCollectionId(presetCollectionId);
    setIsAddModalOpen(true);
  }, [editableCollections, isAuthenticated, location.pathname, openAuthModal]);

  const handleCreateCollectionAction = useCallback(() => {
    if (!isAuthenticated) {
      setPendingAuthAction('create-collection');
      openAuthModal('signup');
      return;
    }
    setIsCreateCollectionOpen(true);
  }, [isAuthenticated, openAuthModal]);

  const handleSignOut = async () => {
    await signOutUser();
  };

  const handleAuthClose = () => {
    setIsAuthModalOpen(false);
    setIsPasswordRecovery(false);
  };

  const handleAuthSuccess = () => {
    if (isPasswordRecovery) {
      setIsPasswordRecovery(false);
      showStatus(t('passwordUpdated'), 'success');
    }
    if (pendingAuthAction) {
      setAuthActionQueue(pendingAuthAction);
      setPendingAuthAction(null);
    }
  };

  useEffect(() => {
    if (!isAuthenticated || !authActionQueue) return;
    if (authActionQueue === 'add-item') {
      handleAddAction();
    } else if (authActionQueue === 'create-collection') {
      setIsCreateCollectionOpen(true);
    }
    setAuthActionQueue(null);
  }, [isAuthenticated, authActionQueue, handleAddAction]);

  const renderAccessGate = () => (
    <div
      className="flex flex-col items-center justify-center px-4 py-16 sm:py-24"
      data-testid="access-gate"
    >
      <div
        className={`max-w-md w-full text-center border rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-10 shadow-xl ${theme === 'vault' ? 'bg-white/5 border-white/10' : theme === 'atelier' ? 'bg-[#EDE4D3]/70 border-[#D4C9B8]' : 'bg-white/70 border-stone-200'}`}
      >
        <div
          className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 sm:mb-6 ${theme === 'vault' ? 'bg-white/10 text-stone-400' : theme === 'atelier' ? 'bg-[#D4C9B8]/50 text-[#8C7B6B]' : 'bg-stone-100 text-stone-500'}`}
        >
          {!authReady && isSupabaseReady ? (
            <Loader2 size={24} className="animate-spin" />
          ) : isSupabaseReady ? (
            <Landmark size={24} />
          ) : (
            <Lock size={24} />
          )}
        </div>
        <h1
          className={`font-serif text-2xl font-bold mb-2 ${theme === 'vault' ? 'text-white' : theme === 'atelier' ? 'text-[#3D3530]' : 'text-stone-900'}`}
        >
          {!authReady && isSupabaseReady
            ? t('authLoading')
            : isSupabaseReady
              ? t('authRequiredTitle')
              : t('cloudRequiredTitle')}
        </h1>
        {authReady && isSupabaseReady && (
          <p
            className={`font-serif italic text-base mb-4 ${theme === 'vault' ? 'text-stone-300' : theme === 'atelier' ? 'text-[#6B5344]' : 'text-stone-600'}`}
          >
            {t('accessGateTagline')}
          </p>
        )}
        <p
          className={`text-sm mb-6 ${theme === 'vault' ? 'text-stone-400' : theme === 'atelier' ? 'text-[#8C7B6B]' : 'text-stone-500'}`}
        >
          {!authReady && isSupabaseReady
            ? t('authLoadingDesc')
            : isSupabaseReady
              ? t('authRequiredDesc')
              : t('cloudRequiredDesc')}
        </p>
        <div className="space-y-2" data-testid="first-run-ctas">
          <Button
            onClick={handleAddAction}
            size="lg"
            className="w-full"
            data-testid="cta-primary-add-first"
          >
            {t('ctaAddFirst')}
          </Button>
          {isSupabaseReady && (
            <Button
              onClick={handleExploreSamples}
              size="lg"
              variant="secondary"
              className="w-full"
              data-testid="cta-secondary-explore-sample"
            >
              {t('exploreSample')}
            </Button>
          )}
          {!isSupabaseReady ? (
            <div
              className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${theme === 'vault' ? 'text-stone-500' : theme === 'atelier' ? 'text-[#8C7B6B]' : 'text-stone-400'}`}
            >
              {t('cloudRequiredAction')}
            </div>
          ) : null}
        </div>
        <p
          className={`text-[12px] mt-5 leading-relaxed ${theme === 'vault' ? 'text-stone-500' : theme === 'atelier' ? 'text-[#8C7B6B]' : 'text-stone-500'}`}
        >
          {t('ctaPromise')}
        </p>
      </div>
    </div>
  );

  // Ready means: initial load settled, auth settled, the admin-profile lookup
  // settled for the current session, and the last completed collections
  // refresh served the current user/role identity. The identity key flips in
  // the same render as an isAdmin/user change, so the marker can never show
  // ready during the window between an admin lookup resolving and the seeding
  // re-refresh it triggers.
  const currentIdentityKey = `${user?.id ?? 'anon'}:${isAdmin ? 'admin' : 'member'}`;
  const adminLookupSettled = adminCheckedFor === (user ? user.id : ANONYMOUS_ADMIN_SCOPE);
  const appReady =
    !isLoading &&
    (!isSupabaseReady ||
      (authReady && adminLookupSettled && refreshedForKey === currentIdentityKey));

  return (
    <div
      className={`min-h-screen transition-colors duration-1000 ${themeColors[theme]}`}
      data-theme={theme}
      data-testid="app-shell"
      data-ready={appReady ? 'true' : 'false'}
    >
      <Layout
        onOpenAuth={() => openAuthModal('signin')}
        onSignOut={handleSignOut}
        sampleCollectionId={sampleCollectionId}
        user={user}
        isSupabaseConfigured={isSupabaseReady}
        hasLocalImport={hasLocalImport}
        importState={importState}
        importMessage={importMessage}
        onImportLocal={handleImportLocal}
        statusBanner={statusBanner}
        onAddItem={handleAddAction}
        onExploreSamples={handleExploreFromNav}
        headerExtras={
          <div className="flex items-center gap-2 sm:gap-3">
            {sampleCollection && (
              <Link to={`/collection/${sampleCollection.id}`}>
                <Button
                  variant="secondary"
                  size="sm"
                  className="hidden sm:inline-flex motion-fade"
                  icon={<Sparkles size={14} />}
                >
                  {t('exploreSample')}
                </Button>
              </Link>
            )}
            {/* CUR-157: the signed-out sign-in entry point lives on the header
                account pill (label + status badge + dropdown). A second ghost
                "Sign In" button here read as a duplicate CTA and worked against
                the single-path first-run principle, so it was removed. */}
            <LanguageToggle />
          </div>
        }
      >
        {shouldShowAccessGate ? (
          renderAccessGate()
        ) : (
          <>
            <Routes>
              <Route
                path="/"
                element={
                  <HomeScreen
                    collections={editableCollections}
                    stats={stats}
                    isLoading={isLoading}
                    loadError={loadError}
                    sampleCollection={sampleCollection}
                    refreshCollections={refreshCollections}
                    handleAddAction={handleAddAction}
                    handleCreateCollectionAction={handleCreateCollectionAction}
                  />
                }
              />
              <Route
                path="/explore"
                element={
                  <ExplorePlaceholder
                    sampleCollectionId={sampleCollectionId}
                    onExploreSamples={handleExploreSamples}
                  />
                }
              />
              <Route path="/legal/:doc" element={<LegalPage />} />
              <Route
                path="/collection/:id"
                element={
                  <ErrorBoundary>
                    <CollectionScreen
                      collections={collections}
                      isAdmin={isAdmin}
                      isLoading={isLoading}
                      isAuthenticated={isAuthenticated}
                      isSupabaseReady={isSupabaseReady}
                      sampleCollectionId={sampleCollectionId}
                      openAuthModal={openAuthModal}
                      openAddItemModal={openAddItemModal}
                      deleteItem={deleteItem}
                      removeCollection={removeCollection}
                      showStatus={showStatus}
                    />
                  </ErrorBoundary>
                }
              />
              <Route
                path="/collection/:id/item/:itemId"
                element={
                  <ErrorBoundary>
                    <ItemDetailScreen
                      collections={collections}
                      isAdmin={isAdmin}
                      isLoading={isLoading}
                      itemSaveStates={itemSaveStates}
                      updateItem={updateItem}
                      deleteItem={deleteItem}
                      retryItemSave={retryItemSave}
                      checkStorageQuota={checkStorageQuota}
                      showStatus={showStatus}
                    />
                  </ErrorBoundary>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <AddItemModal
              isOpen={isAddModalOpen}
              onClose={() => setIsAddModalOpen(false)}
              collections={editableCollections}
              defaultCollectionId={addModalDefaultCollectionId}
              onSave={handleAddItem}
            />
            <CreateCollectionModal
              isOpen={isCreateCollectionOpen}
              onClose={() => setIsCreateCollectionOpen(false)}
              onCreate={handleCreateCollection}
              onAddFirstItem={(collectionId) => {
                setAddModalDefaultCollectionId(collectionId);
                setIsAddModalOpen(true);
              }}
            />
          </>
        )}
      </Layout>
      {/* On mobile the bottom nav is fixed to the viewport bottom with a fixed
          height of var(--bottom-nav-height); a plain bottom-6 toast lands on top
          of it, hiding the nav and letting the pointer-events-auto toast
          intercept nav taps. Lift the toast one gap above the nav's top edge on
          mobile; the nav is sm:hidden, so revert to bottom-6 from sm up. The
          nav's safe-area inset is padded inside its fixed height (Layout.tsx),
          so its top edge sits exactly var(--bottom-nav-height) above the
          viewport bottom — do not add the inset again here or the gap grows by
          the inset on notched devices. */}
      <div
        role="status"
        aria-live="polite"
        className="fixed bottom-[calc(var(--bottom-nav-height,5.5rem)+1rem)] sm:bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
      >
        {status && (
          <StatusToast
            message={status.message}
            tone={status.tone}
            actionLabel={status.actionLabel}
            onAction={status.onAction}
            onDismiss={() => setStatus(null)}
          />
        )}
      </div>
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={handleAuthClose}
        onAuthSuccess={handleAuthSuccess}
        initialMode={isPasswordRecovery ? 'set-password' : authModalMode}
      />
      <ConflictResolutionModal
        isOpen={isConflictModalOpen}
        conflicts={conflictModalEntries}
        onClose={() => setIsConflictModalOpen(false)}
        onKeepCloud={handleResolveConflict}
        onUseLocal={handleUseLocalConflict}
      />
    </div>
  );
};

const LocalizedErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation();
  return (
    <ErrorBoundary
      labels={{
        title: t('errorBoundaryTitle'),
        description: t('errorBoundaryDesc'),
        reload: t('errorBoundaryReload'),
        showDetails: t('errorBoundaryShowDetails'),
        hideDetails: t('errorBoundaryHideDetails'),
      }}
    >
      {children}
    </ErrorBoundary>
  );
};

// Reset scroll on forward navigation so a new screen opens at the top, while
// leaving POP (browser back/forward) alone to preserve the list position the
// user is returning to.
const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  useEffect(() => {
    if (navigationType !== 'POP') {
      window.scrollTo(0, 0);
    }
  }, [pathname, navigationType]);
  return null;
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <LocalizedErrorBoundary>
          <HashRouter>
            <ScrollToTop />
            <AppContent />
          </HashRouter>
          <SpeedInsights />
          <Analytics />
        </LocalizedErrorBoundary>
      </LanguageProvider>
    </ThemeProvider>
  );
};
