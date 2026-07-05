import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { User } from '@supabase/supabase-js';
import {
  HashRouter,
  Routes,
  Route,
  useNavigate,
  useParams,
  useLocation,
  Link,
  Navigate,
} from 'react-router-dom';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { Analytics } from '@vercel/analytics/react';
import { Layout } from './components/Layout';
import { ExplorePlaceholder } from './components/ExplorePlaceholder';
import { LegalPage } from './components/LegalPage';
import { CollectionCard } from './components/CollectionCard';
import { ItemCard } from './components/ItemCard';
import { AddItemModal } from './components/AddItemModal';
import { CreateCollectionModal } from './components/CreateCollectionModal';
import { AuthModal } from './components/AuthModal';
import { ImageEditModal } from './components/ImageEditModal';
import { UserCollection, CollectionItem, AppTheme, FieldDefinition } from './types';
import { CUSTOM_TEMPLATE_ID, TEMPLATES } from './constants';
import { getOnThisDayItems } from './utils/onThisDay';
import {
  Plus,
  SlidersHorizontal,
  ArrowLeft,
  Trash2,
  LayoutGrid,
  LayoutTemplate,
  Printer,
  Camera,
  Search,
  Loader2,
  Sparkles,
  Play,
  Quote,
  Calendar,
  Lock,
  Landmark,
  AlertCircle,
  X,
  CheckSquare,
  ListOrdered,
  Undo2,
  Redo2,
  Star,
} from 'lucide-react';
import { Button } from './components/ui/Button';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { CollectionScreenSkeleton, ItemDetailSkeleton } from './components/ui/Skeleton';
import {
  fetchCloudCollections,
  getLocalCollections,
  getPendingAssetUploadCount,
  getPendingDeletes,
  getPendingSyncIds,
  hasLocalOnlyData,
  importLocalCollectionsToCloud,
  mergeCollections,
  saveCollection,
  shouldPreserveLocalOnlyCollection,
  saveAllCollections,
  saveAsset,
  clearEnhancedReference,
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
  extractCurioAssetPath,
  type SyncStatus,
} from './services/db';
import { processImage } from './services/imageProcessor';
import { ItemImage } from './components/ItemImage';
import { ExhibitionView } from './components/ExhibitionView';
import { ExportModal } from './components/ExportModal';
import { FilterModal } from './components/FilterModal';
import { EnhanceImageModal } from './components/EnhanceImageModal';
import { fetchStoryPrompts, refreshAiImageEditEnabled } from './services/geminiService';
import { DeleteCollectionModal } from './components/DeleteCollectionModal';
import { DeleteItemModal } from './components/DeleteItemModal';
import { DeleteItemsModal } from './components/DeleteItemsModal';
import { LanguageProvider, useTranslation, getFieldTranslation } from './i18n';
import { supabase, isSupabaseConfigured, signOutUser } from './services/supabase';
import {
  ThemeProvider,
  useTheme,
  typographyClasses,
  labelColorClasses,
  mutedTextClasses,
  inputClasses,
  accentColorClasses,
  dividerClasses,
  cardHoverClasses,
  ratingColorClasses,
  ratingEmptyClasses,
} from './theme';
import { StatusToast, StatusTone, getStatusToastDurationMs } from './components/StatusToast';
import { StatusBanner } from './components/StatusBanner';
import { LanguageToggle } from './components/LanguageToggle';
import { ConflictResolutionModal } from './components/ConflictResolutionModal';
import { CURRENT_SEED_VERSION, INITIAL_COLLECTIONS } from './services/seedCollections';
import { trackEvent } from './services/analytics';

/**
 * CUR-13: items created before this timestamp may have AI-authored notes
 * ("Archive Narrative"). The legacy migration banner is offered for those
 * items only, exactly once each. New items default to user-authored Story.
 *
 * Setting this to the merge moment of the CUR-13 rollout PR — the cutoff
 * is conservative on purpose; the user can still dismiss the banner if
 * the heuristic mis-fires.
 */
const STORY_FEATURE_LAUNCHED_AT = '2026-05-16T00:00:00.000Z';

// CUR-135: Item Detail undo/redo can be reached from the keyboard.
// `navigator.platform` is deprecated but still populated in every browser
// Curio targets; jsdom exposes it too, so tests see a stable value.
const IS_MAC =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.platform || '');
const UNDO_SHORTCUT_LABEL = IS_MAC ? '⌘Z' : 'Ctrl+Z';
const REDO_SHORTCUT_LABEL = IS_MAC ? '⌘⇧Z' : 'Ctrl+Shift+Z';

type ItemSaveState = {
  status: 'saving' | 'saved' | 'error';
  error?: string;
};

// Sentinel for "the admin lookup has settled for a signed-out session" so the
// app-shell readiness marker can distinguish it from "lookup still pending".
const ANONYMOUS_ADMIN_SCOPE = 'anonymous';

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return target.isContentEditable;
};

// CUR-135: item modals (Export, Delete, Enhance, ImageEdit, …) mount above
// the item detail while it stays in the DOM. Focus inside a dialog must not
// silently mutate the item behind it — the app-level undo should only fire
// while the item detail itself is the active surface.
const isInsideModalDialog = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  return target.closest('[aria-modal="true"], [data-export-modal]') !== null;
};

const isLegacyAiNoteItem = (item: CollectionItem): boolean => {
  const story = item.notes;
  if (!story || !story.trim()) return false;
  const data = item.data || {};
  if (data._isLegacyAiNotes === false) return false; // explicit exemption (e.g. seed items)
  if (data._storyMigrationDismissed === true) return false;
  if (data._aiDescription) return false; // already on the new schema
  const createdAt = Date.parse(item.createdAt);
  if (Number.isNaN(createdAt)) return false;
  return createdAt < Date.parse(STORY_FEATURE_LAUNCHED_AT);
};
import {
  getEnvValidationErrors,
  STORAGE_QUOTA_CHECK_INTERVAL_MS,
  STORAGE_QUOTA_WARNING_THRESHOLD_BYTES,
  STORAGE_QUOTA_WARNING_THRESHOLD_RATIO,
} from './config';
import { detectConflicts } from './utils/conflictDetection';
import { sortCollectionItems, type ItemSort } from './utils/collectionSorting';
import { matchesItemFilters } from './utils/itemFilter';
import { HomeScreen } from './components/HomeScreen';
import { useDebouncedValue } from './hooks/useDebouncedValue';
import { useAndroidBackButton } from './hooks/useAndroidBackButton';

// CUR-93: Active filter chips and the "Clear all" link used to hardcode
// Gallery (light) tokens, so on Vault the amber-50 pills punched through
// the dark page and the stone-500 link collapsed against the page muted
// text. The palette here mirrors the warning tone in StatusBanner (CUR-81)
// and the muted link tones already used elsewhere in the file, so the
// chips read as one system across themes.
const filterChipClasses: Record<AppTheme, string> = {
  gallery: 'bg-amber-50 text-amber-800 border-amber-100',
  vault: 'bg-amber-500/10 text-amber-200 border-amber-400/20',
  atelier: 'bg-amber-100/70 text-amber-900 border-amber-300/60',
};

const filterChipSeparatorClasses: Record<AppTheme, string> = {
  gallery: 'text-amber-700/80',
  vault: 'text-amber-200/70',
  atelier: 'text-amber-800/70',
};

const filterChipIconClasses: Record<AppTheme, string> = {
  gallery: 'text-amber-600',
  vault: 'text-amber-200',
  atelier: 'text-amber-800',
};

const clearFiltersLinkClasses: Record<AppTheme, string> = {
  gallery: 'text-stone-500 hover:text-stone-800 decoration-stone-300',
  vault: 'text-stone-300 hover:text-white decoration-white/30',
  atelier: 'text-[#8C7B6B] hover:text-[#3D3530] decoration-[#D4C9B8]',
};

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
  const [pendingAssetUploads, setPendingAssetUploads] = useState(0);
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
      const count = await getPendingAssetUploadCount();
      setPendingAssetUploads(count);
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
      const { quota, usage } = await navigator.storage.estimate();
      if (typeof quota !== 'number' || typeof usage !== 'number') return;
      if (quota <= 0) return;
      const remaining = quota - usage;
      const remainingRatio = remaining / quota;
      const isLow =
        remaining <= STORAGE_QUOTA_WARNING_THRESHOLD_BYTES ||
        remainingRatio <= STORAGE_QUOTA_WARNING_THRESHOLD_RATIO;
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
      const assetsSynced = await syncPendingAssetUploads();
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
      void syncPendingDeletes();
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
      localCollections,
      cloudCollections,
    }: {
      user: { id: string } | null;
      isAdmin: boolean;
      localCollections: UserCollection[];
      cloudCollections: UserCollection[];
    }) => {
      if (!user || !isAdmin || cloudCollections.length > 0 || localCollections.length > 0) {
        return cloudCollections;
      }

      const localSeedVersion = await getSeedVersion();
      if (localSeedVersion >= CURRENT_SEED_VERSION) {
        return cloudCollections;
      }

      const seededCollections = INITIAL_COLLECTIONS.map((seed) => ({
        ...seed,
        isPublic: true,
        ownerId: user.id,
      }));
      for (const seedCollection of seededCollections) {
        await saveCollection(seedCollection);
      }
      await setSeedVersion(CURRENT_SEED_VERSION);
      return [...seededCollections];
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
        localCollections,
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
        trackEvent('upload_failed', {
          operation: 'local_image_processing',
          retryable: true,
        });
        showStatus(t('saveImageFailed'), 'error');
        throw new Error(t('saveImageFailed'));
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
  }): boolean => {
    if (!isAuthenticated) {
      setPendingAuthAction('create-collection');
      setIsAuthModalOpen(true);
      setIsCreateCollectionOpen(false);
      return false;
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
    return true;
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

    // Archeology: Find items created on this day in prior years (local date)
    const historyItems = getOnThisDayItems(allItems);

    return {
      totalItems,
      avgRating,
      totalCollections: statCollections.length,
      featured,
      historyItems,
    };
  }, [collections]);

  const editableCollections = useMemo(() => {
    return collections.filter((c) => !c.isPublic || isAdmin);
  }, [collections, isAdmin]);

  const CollectionScreen = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const collection = collections.find((c) => c.id === id);
    const isReadOnly = Boolean(collection?.isPublic) && !isAdmin;
    const isSample = Boolean(collection?.isPublic) || Boolean(collection?.id?.startsWith('sample'));
    const canAddItems = Boolean(collection) && !isReadOnly;
    const [filterInput, setFilterInput] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'waterfall'>('waterfall');
    const [sortBy, setSortBy] = useState<ItemSort>('newest');
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
    const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
    const [isExhibitionOpen, setIsExhibitionOpen] = useState(false);
    const [isDeleteCollectionModalOpen, setIsDeleteCollectionModalOpen] = useState(false);
    const [visibleCount, setVisibleCount] = useState(60);
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
    const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);

    const PAGINATION_THRESHOLD = 120;
    const PAGE_SIZE = 60;

    const debouncedFilter = useDebouncedValue(filterInput, 200);
    const hasFilterInput = filterInput.trim().length > 0;

    const filteredItems = useMemo(() => {
      if (!collection) return [];
      return collection.items.filter((item) => {
        const term = debouncedFilter.toLowerCase();
        const matchesSearch =
          !term ||
          item.title.toLowerCase().includes(term) ||
          item.notes?.toLowerCase().includes(term) ||
          Object.values(item.data).some((val) => String(val).toLowerCase().includes(term));
        return matchesSearch && matchesItemFilters(item, activeFilters, collection.customFields);
      });
    }, [collection, debouncedFilter, activeFilters]);

    const sortedItems = useMemo(
      () => sortCollectionItems(filteredItems, sortBy),
      [filteredItems, sortBy],
    );

    useEffect(() => {
      if (!collection) return;
      setVisibleCount(PAGE_SIZE);
      setSelectedItemIds([]);
      setIsSelectionMode(false);
    }, [collection?.id, debouncedFilter, activeFilters, sortBy]);

    const shouldPaginate = sortedItems.length > PAGINATION_THRESHOLD;
    const visibleItems = shouldPaginate ? sortedItems.slice(0, visibleCount) : sortedItems;
    const canLoadMore = shouldPaginate && visibleCount < sortedItems.length;

    const handleLoadMore = () => {
      setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, sortedItems.length));
    };

    const activeFilterCount = Object.values(activeFilters).filter(Boolean).length;
    const activeFilterEntries = Object.entries(activeFilters).filter(([, value]) => value);
    const selectedCount = selectedItemIds.length;
    const hasSelection = selectedCount > 0;

    const getFieldLabel = (fieldId: string) =>
      getFieldTranslation(
        t,
        fieldId,
        collection?.customFields.find((f) => f.id === fieldId)?.label,
      );

    const handleRemoveFilter = (key: string) => {
      setActiveFilters((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    };

    const handleClearFilters = () => setActiveFilters({});

    const toggleSelection = (itemId: string) => {
      setSelectedItemIds((prev) =>
        prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId],
      );
    };

    const handleToggleSelectionMode = () => {
      if (isReadOnly) return;
      setIsSelectionMode((prev) => !prev);
      setSelectedItemIds([]);
    };

    const handleSelectAll = () => {
      setSelectedItemIds(sortedItems.map((item) => item.id));
    };

    const handleClearSelection = () => setSelectedItemIds([]);

    const handleConfirmBulkDelete = () => {
      if (!collection || selectedItemIds.length === 0 || isReadOnly) return;
      selectedItemIds.forEach((itemId) => deleteItem(collection.id, itemId));
      setSelectedItemIds([]);
      setIsSelectionMode(false);
      setIsBulkDeleteOpen(false);
      showStatus(t('itemsDeleted', { count: selectedCount }), 'success');
    };

    const handleDeleteCollection = async () => {
      if (!collection || isReadOnly) return;
      try {
        clearPendingCollectionSave(collection.id);
        await deleteCollection(collection);
        setCollections((prev) => prev.filter((c) => c.id !== collection.id));
        setIsDeleteCollectionModalOpen(false);
        navigate('/');
        showStatus(t('collectionDeleted'), 'success');
      } catch (e) {
        console.error('Failed to delete collection:', e);
        showStatus(t('deleteCollectionFailed'), 'error');
      }
    };

    if (!collection) {
      // CUR-118: don't bounce a deep-link reload back to Home while the
      // initial cloud fetch is still in flight. Only redirect once loading
      // has settled and the id is genuinely absent.
      if (isLoading) return <CollectionScreenSkeleton label={t('restoringArchives')} />;
      return <Navigate to="/" replace />;
    }

    return (
      <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-500">
        {isReadOnly && (
          <div
            data-testid="read-only-banner"
            className={`flex items-center gap-3 p-4 rounded-2xl border shadow-sm ${theme === 'vault' ? 'bg-white/5 border-white/10' : 'bg-white/80 border-stone-100'}`}
          >
            <div className="p-2 rounded-xl bg-amber-50 text-amber-700 shadow-inner">
              <Lock size={16} />
            </div>
            <div>
              <p
                className={`text-sm font-semibold ${theme === 'vault' ? 'text-white' : 'text-stone-900'}`}
              >
                {t('readOnlyMode')}
              </p>
              <p className="text-xs text-stone-500">{t('readOnlyCollectionDesc')}</p>
            </div>
          </div>
        )}

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
          <div className="flex items-center gap-4 sm:gap-6">
            <Link
              to="/"
              className={`w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center border rounded-2xl shadow-md transition-all hover:scale-105 active:scale-95 ${theme === 'vault' ? 'bg-stone-900 border-white/5 text-stone-400' : 'bg-white border-stone-100 text-stone-400'}`}
            >
              <ArrowLeft size={20} className="sm:w-6 sm:h-6" />
            </Link>
            <div>
              <h1
                className={`${typographyClasses.titleHero} mb-2 ${theme === 'vault' ? 'text-white' : 'text-stone-900'}`}
              >
                {collection.name}
              </h1>
              <div className="flex items-center gap-4">
                <span className={`${typographyClasses.quote} ${labelColorClasses[theme]}`}>
                  {t('artifactsCataloged', { n: collection.items.length })}
                </span>
                {isSample && (
                  <span
                    className={`${typographyClasses.labelSmall} bg-white/40 text-stone-500 px-1.5 py-0.5 rounded border border-black/5`}
                  >
                    {t('sampleBadge')}
                  </span>
                )}
                {collection.isLocked && <Lock size={16} className="text-amber-500" />}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-3 w-full lg:w-auto">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 w-full">
              {canAddItems && (
                <Button
                  variant="primary"
                  onClick={() => {
                    setAddModalDefaultCollectionId(collection?.id);
                    setIsAddModalOpen(true);
                  }}
                  icon={<Plus size={16} />}
                  className="shadow-md w-full sm:w-auto"
                >
                  {t('addItem')}
                </Button>
              )}
              <Button
                variant="primary"
                onClick={() => setIsExhibitionOpen(true)}
                disabled={collection.items.length === 0}
                icon={<Play size={16} />}
                className="shadow-md w-full sm:w-auto"
              >
                {t('enterExhibition')}
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full">
              {!isReadOnly && (
                <button
                  onClick={() => setIsDeleteCollectionModalOpen(true)}
                  aria-label={t('deleteCollection')}
                  className={`w-11 h-11 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl transition-colors ${
                    theme === 'vault'
                      ? 'bg-stone-900 border border-white/10 text-stone-400 hover:text-red-400 hover:border-red-400/30'
                      : 'bg-white border border-stone-200 text-stone-400 hover:text-red-500 hover:border-red-200'
                  }`}
                  title={t('deleteCollection')}
                >
                  <Trash2 size={18} />
                </button>
              )}
              {!isReadOnly && (
                <Button
                  variant={isSelectionMode ? 'primary' : 'outline'}
                  onClick={handleToggleSelectionMode}
                  className={`${theme === 'vault' ? 'bg-stone-900 text-white border-white/10' : 'bg-white'} h-11`}
                  icon={<CheckSquare size={16} />}
                >
                  {isSelectionMode ? t('done') : t('selectItems')}
                </Button>
              )}
              <div
                className={`flex rounded-xl p-1 ${theme === 'vault' ? 'bg-white/5' : theme === 'atelier' ? 'bg-[#D4C9B8]/30' : 'bg-stone-200/50'}`}
              >
                <button
                  onClick={() => setViewMode('grid')}
                  aria-label={t('viewGrid')}
                  title={t('viewGrid')}
                  className={`w-11 h-11 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg transition-all ${viewMode === 'grid' ? (theme === 'vault' ? 'bg-white/10 text-white shadow-sm' : theme === 'atelier' ? 'bg-[#F5EFE4] text-[#3D3530] shadow-sm' : 'bg-white text-stone-900 shadow-sm') : theme === 'vault' ? 'text-stone-500 hover:text-stone-300' : theme === 'atelier' ? 'text-[#8C7B6B] hover:text-[#3D3530]' : 'text-stone-400 hover:text-stone-600'}`}
                >
                  <LayoutGrid size={18} />
                </button>
                <button
                  onClick={() => setViewMode('waterfall')}
                  aria-label={t('viewWaterfall')}
                  title={t('viewWaterfall')}
                  className={`w-11 h-11 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg transition-all ${viewMode === 'waterfall' ? (theme === 'vault' ? 'bg-white/10 text-white shadow-sm' : theme === 'atelier' ? 'bg-[#F5EFE4] text-[#3D3530] shadow-sm' : 'bg-white text-stone-900 shadow-sm') : theme === 'vault' ? 'text-stone-500 hover:text-stone-300' : theme === 'atelier' ? 'text-[#8C7B6B] hover:text-[#3D3530]' : 'text-stone-400 hover:text-stone-600'}`}
                >
                  <LayoutTemplate size={18} className="rotate-180" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <ListOrdered size={16} className="text-stone-400" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as ItemSort)}
                  className={`h-11 px-3 rounded-xl border text-sm font-semibold ${theme === 'vault' ? 'bg-stone-900 border-white/10 text-white' : 'bg-white border-stone-200 text-stone-700'}`}
                  aria-label={t('sortLabel')}
                >
                  <option value="newest">{t('sortNewest')}</option>
                  <option value="oldest">{t('sortOldest')}</option>
                  <option value="title">{t('sortTitle')}</option>
                  <option value="rating">{t('sortRating')}</option>
                </select>
              </div>
              <div className="flex gap-2 flex-1 min-w-[12rem]">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder={t('collectionSearchPlaceholder')}
                    aria-label={t('collectionSearchPlaceholder')}
                    value={filterInput}
                    onChange={(e) => setFilterInput(e.target.value)}
                    className={`pl-4 pr-11 py-2 rounded-xl border focus:ring-4 focus:ring-amber-500/5 outline-none text-sm w-full transition-all shadow-sm font-serif italic ${theme === 'vault' ? 'bg-stone-900 border-white/10 text-white' : 'bg-white border-stone-200 text-stone-900'}`}
                  />
                  {filterInput.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setFilterInput('')}
                      aria-label={t('clearSearch')}
                      title={t('clearSearch')}
                      data-testid="collection-search-clear"
                      className={`absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 w-11 h-11 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-colors ${theme === 'vault' ? 'text-stone-300 hover:bg-white/10' : 'text-stone-400 hover:bg-stone-100 hover:text-stone-600'}`}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
                <Button
                  variant={activeFilterCount > 0 ? 'primary' : 'outline'}
                  className={`w-11 h-11 sm:w-10 sm:h-10 flex items-center justify-center p-0 rounded-xl ${theme === 'vault' ? 'bg-stone-900 border-white/10' : activeFilterCount > 0 ? '' : 'bg-white'}`}
                  onClick={() => setIsFilterModalOpen(true)}
                  aria-label={t('filterCollection')}
                  title={t('filterCollection')}
                >
                  <SlidersHorizontal size={18} />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {activeFilterEntries.length > 0 && (
          <div className="flex items-center flex-wrap gap-2 mt-2 mb-1">
            <span
              className={`text-sm font-semibold ${theme === 'vault' ? 'text-white/70' : 'text-stone-500'}`}
            >
              {t('activeFilters')}
            </span>
            {activeFilterEntries.map(([key, value]) => (
              <button
                key={key}
                data-testid="active-filter-chip"
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border motion-chip ${filterChipClasses[theme]}`}
                onClick={() => handleRemoveFilter(key)}
                title={t('clearFilter')}
              >
                <span className="font-semibold">{getFieldLabel(key)}</span>
                <span className={filterChipSeparatorClasses[theme]}>·</span>
                <span className="font-medium">{value}</span>
                <X size={14} className={filterChipIconClasses[theme]} />
              </button>
            ))}
            <button
              data-testid="active-filter-clear-all"
              onClick={handleClearFilters}
              className={`text-sm font-semibold underline ${clearFiltersLinkClasses[theme]}`}
            >
              {t('clearAll')}
            </button>
          </div>
        )}

        {isReadOnly && (
          <p className="text-sm text-amber-600 font-semibold">{t('readOnlyCollectionNote')}</p>
        )}

        {isSelectionMode && (
          <div
            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border px-4 py-3 shadow-sm ${
              theme === 'vault'
                ? 'bg-white/5 border-white/10 text-white/80'
                : 'bg-white/80 border-stone-100'
            }`}
          >
            <span className="text-sm font-semibold">
              {t('selectedCount', { count: selectedCount })}
            </span>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleSelectAll}>
                {t('selectAll')}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleClearSelection}>
                {t('clear')}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsBulkDeleteOpen(true)}
                disabled={!hasSelection}
              >
                {t('deleteSelected')}
              </Button>
            </div>
          </div>
        )}

        {filteredItems.length === 0 ? (
          hasFilterInput || activeFilterCount > 0 ? (
            <div
              className={`rounded-[2rem] border p-6 sm:p-8 text-center shadow-sm ${theme === 'vault' ? 'bg-white/5 border-white/10 text-stone-200' : 'bg-white/80 border-stone-100 text-stone-700'}`}
            >
              <p className={`${typographyClasses.titleLarge} italic mb-2`}>
                {t('searchNoResultsTitle')}
              </p>
              <p className={typographyClasses.labelMuted}>
                {hasFilterInput
                  ? t('collectionSearchNoResults', { query: filterInput.trim() })
                  : t('collectionFilterNoResults')}
              </p>
              <div className="mt-6 flex justify-center gap-3">
                {hasFilterInput && (
                  <Button variant="outline" size="sm" onClick={() => setFilterInput('')}>
                    {t('clearSearch')}
                  </Button>
                )}
                {activeFilterCount > 0 && (
                  <Button variant="outline" size="sm" onClick={handleClearFilters}>
                    {t('clearAll')}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div
              className={`text-center py-32 rounded-[3rem] border shadow-sm ${theme === 'vault' ? 'bg-white/5 border-white/5' : 'bg-white/50 border-stone-100'}`}
            >
              <div className="text-8xl mb-8 grayscale opacity-10">🏛️</div>
              <h3
                className={`text-3xl font-serif font-bold mb-2 italic tracking-tight ${theme === 'vault' ? 'text-white' : 'text-stone-800'}`}
              >
                {t('galleryAwaits')}
              </h3>
              <p
                className={`${theme === 'vault' ? 'text-white/60' : 'text-stone-400'} mb-10 max-w-sm mx-auto leading-relaxed font-serif text-lg`}
              >
                {t('museumDefinition')}
              </p>
              {!isReadOnly && (
                <Button
                  size="lg"
                  className="px-12 py-4 text-lg rounded-2xl shadow-xl"
                  onClick={() => {
                    setAddModalDefaultCollectionId(collection?.id);
                    setIsAddModalOpen(true);
                  }}
                >
                  {t('catalogFirst')}
                </Button>
              )}
            </div>
          )
        ) : (
          <>
            <div
              className={`${
                viewMode === 'grid'
                  ? 'grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5'
                  : 'columns-2 sm:columns-2 md:columns-3 lg:columns-4 [column-gap:0.625rem] sm:[column-gap:0.75rem] md:[column-gap:1rem]'
              } w-full`}
              data-testid="items-grid"
            >
              {visibleItems.map((item) => (
                <div
                  key={item.id}
                  className={`break-inside-avoid ${viewMode === 'waterfall' ? 'mb-2.5 sm:mb-3 md:mb-4 inline-block w-full align-top' : ''}`}
                >
                  <ItemCard
                    item={item}
                    fields={collection.customFields}
                    onClick={() => {
                      if (isSelectionMode) {
                        toggleSelection(item.id);
                        return;
                      }
                      navigate(`/collection/${collection.id}/item/${item.id}`);
                    }}
                    layout={viewMode === 'grid' ? 'grid' : 'masonry'}
                    isSelectable={isSelectionMode}
                    isSelected={selectedItemIds.includes(item.id)}
                    onSelect={() => toggleSelection(item.id)}
                  />
                </div>
              ))}
            </div>
            {shouldPaginate && (
              <div
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border px-5 py-4 shadow-sm ${theme === 'vault' ? 'bg-white/5 border-white/10 text-white/70' : 'bg-white/70 border-stone-100 text-stone-500'}`}
              >
                <span className="text-sm font-semibold">
                  {t('showingItems', { shown: visibleItems.length, total: sortedItems.length })}
                </span>
                <Button
                  variant="outline"
                  className={`${theme === 'vault' ? 'bg-stone-900 text-white border-white/10' : 'bg-white'} w-full sm:w-auto`}
                  onClick={handleLoadMore}
                  disabled={!canLoadMore}
                >
                  {canLoadMore ? t('loadMore') : t('allItemsLoaded')}
                </Button>
              </div>
            )}
          </>
        )}

        <FilterModal
          isOpen={isFilterModalOpen}
          onClose={() => setIsFilterModalOpen(false)}
          fields={collection.customFields}
          items={collection.items}
          activeFilters={activeFilters}
          onApply={setActiveFilters}
        />
        <ExhibitionView
          isOpen={isExhibitionOpen}
          collection={collection}
          onClose={() => setIsExhibitionOpen(false)}
        />
        <DeleteCollectionModal
          isOpen={isDeleteCollectionModalOpen}
          collection={collection}
          onClose={() => setIsDeleteCollectionModalOpen(false)}
          onConfirm={handleDeleteCollection}
        />
        <DeleteItemsModal
          isOpen={isBulkDeleteOpen}
          count={selectedCount}
          onClose={() => setIsBulkDeleteOpen(false)}
          onConfirm={handleConfirmBulkDelete}
        />
      </div>
    );
  };

  const ItemDetailScreen = () => {
    const { id, itemId } = useParams<{ id: string; itemId: string }>();
    const navigate = useNavigate();
    const [isExportOpen, setIsExportOpen] = useState(false);
    const [isEnhanceOpen, setIsEnhanceOpen] = useState(false);
    const [isDeleteItemModalOpen, setIsDeleteItemModalOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [aiImageEditEnabled, setAiImageEditEnabled] = useState(false);
    const [imageKey, setImageKey] = useState(0); // Used to force re-render of ItemImage after enhancement
    const [imageEditSource, setImageEditSource] = useState<string | null>(null);
    const [isImageEditorOpen, setIsImageEditorOpen] = useState(false);
    // Story (CUR-13): when the user dismisses the empty-state card by tapping
    // "Write your story", switch to the textarea even though notes is still empty.
    const [storyEditingOverride, setStoryEditingOverride] = useState(false);
    const [detailPromptsOpen, setDetailPromptsOpen] = useState(false);
    const [detailPromptsLoading, setDetailPromptsLoading] = useState(false);
    const [detailStoryPrompts, setDetailStoryPrompts] = useState<string[]>([]);
    const [detailPromptsFetchedFor, setDetailPromptsFetchedFor] = useState<string | null>(null);
    const detailStoryRef = useRef<HTMLTextAreaElement | null>(null);
    const [history, setHistory] = useState<
      Pick<CollectionItem, 'title' | 'notes' | 'rating' | 'data'>[]
    >([]);
    const [future, setFuture] = useState<
      Pick<CollectionItem, 'title' | 'notes' | 'rating' | 'data'>[]
    >([]);
    const historyTimeoutRef = useRef<number | null>(null);
    const pendingSnapshotRef = useRef<Pick<
      CollectionItem,
      'title' | 'notes' | 'rating' | 'data'
    > | null>(null);
    const isApplyingHistoryRef = useRef(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const titleTextareaRef = useRef<HTMLTextAreaElement | null>(null);

    const collection = collections.find((c) => c.id === id);
    const item = collection?.items.find((i) => i.id === itemId);

    // Check if AI image editing is enabled
    useEffect(() => {
      refreshAiImageEditEnabled().then(setAiImageEditEnabled);
    }, []);

    useEffect(() => {
      const ta = titleTextareaRef.current;
      if (!ta) return;
      ta.style.height = 'auto';
      ta.style.height = `${ta.scrollHeight}px`;
    }, [item?.title]);

    // CUR-135: install the keyboard shortcut listener before any early return
    // so the hook order stays stable while the item is still loading. The ref
    // is populated further down once handleUndo/handleRedo are defined.
    const shortcutRef = useRef({
      isReadOnly: false,
      historyLength: 0,
      futureLength: 0,
      handleUndo: () => {},
      handleRedo: () => {},
    });

    useEffect(() => {
      const handler = (e: KeyboardEvent) => {
        const current = shortcutRef.current;
        if (current.isReadOnly) return;
        const mod = e.metaKey || e.ctrlKey;
        if (!mod) return;
        const key = e.key.toLowerCase();
        const isUndo = key === 'z' && !e.shiftKey;
        // Windows-style redo (Ctrl+Y) — skip when Meta is also held so it
        // doesn't collide with browser History shortcuts on macOS.
        const isRedo = (key === 'z' && e.shiftKey) || (key === 'y' && e.ctrlKey && !e.metaKey);
        if (!isUndo && !isRedo) return;
        if (isEditableTarget(e.target)) return;
        if (isInsideModalDialog(e.target)) return;
        if (isUndo && current.historyLength > 0) {
          e.preventDefault();
          current.handleUndo();
        } else if (isRedo && current.futureLength > 0) {
          e.preventDefault();
          current.handleRedo();
        }
      };
      window.addEventListener('keydown', handler);
      return () => window.removeEventListener('keydown', handler);
    }, []);

    if (!collection || !item) {
      // CUR-118: deep-link reload of /collection/:id/item/:itemId must wait
      // for the cloud fetch instead of bouncing to Home / parent collection.
      // The `!item` half matters too: `refreshCollections()` flips `isLoading`
      // without clearing existing collection state, so a follow-up refresh
      // can leave the parent collection cached while the item is still in
      // the pending cloud response — without this guard, the shared link
      // would lose the item to the parent route before the fetch resolves.
      if (isLoading) return <ItemDetailSkeleton label={t('restoringArchives')} />;
      if (!collection) return <Navigate to="/" replace />;
      return <Navigate to={`/collection/${id}`} replace />;
    }
    const isReadOnly = Boolean(collection.isPublic) && !isAdmin;
    const itemSaveState = itemSaveStates[item.id];

    const snapshotItem = (target: CollectionItem) => ({
      title: target.title,
      notes: target.notes,
      rating: target.rating,
      data: { ...target.data },
    });

    const isSameSnapshot = (
      a: Pick<CollectionItem, 'title' | 'notes' | 'rating' | 'data'>,
      b: Pick<CollectionItem, 'title' | 'notes' | 'rating' | 'data'>,
    ) => JSON.stringify(a) === JSON.stringify(b);

    const pushHistory = (snapshot: Pick<CollectionItem, 'title' | 'notes' | 'rating' | 'data'>) => {
      if (isApplyingHistoryRef.current) return;
      pendingSnapshotRef.current = snapshot;
      if (historyTimeoutRef.current) return;
      historyTimeoutRef.current = window.setTimeout(() => {
        historyTimeoutRef.current = null;
        const pending = pendingSnapshotRef.current;
        pendingSnapshotRef.current = null;
        if (!pending) return;
        setHistory((prev) => {
          const last = prev[prev.length - 1];
          if (last && isSameSnapshot(last, pending)) return prev;
          const next = [...prev, pending];
          return next.slice(-20);
        });
        setFuture([]);
      }, 600);
    };

    const applyItemUpdate = (updates: Partial<CollectionItem>) => {
      pushHistory(snapshotItem(item));
      updateItem(collection.id, item.id, updates);
    };

    const focusStoryTextarea = () => {
      setStoryEditingOverride(true);
      requestAnimationFrame(() => detailStoryRef.current?.focus());
    };

    const detailPromptsCacheKey = `${item.title || ''} ${(item.data?._aiDescription as string | undefined) || ''}`;

    const openDetailPromptsPanel = async () => {
      setDetailPromptsOpen(true);
      // Make sure the textarea is mounted so insertions land in a real element.
      if (!storyEditingOverride) setStoryEditingOverride(true);
      if (detailPromptsLoading) return;
      if (detailPromptsFetchedFor === detailPromptsCacheKey && detailStoryPrompts.length > 0) {
        return;
      }
      trackEvent('story_prompt_panel_opened', { surface: 'item_detail' });
      setDetailPromptsLoading(true);
      try {
        const knownFields: Record<string, string | number> = {};
        for (const [k, v] of Object.entries(item.data || {})) {
          if (k.startsWith('_')) continue;
          if (typeof v === 'string' || typeof v === 'number') knownFields[k] = v;
        }
        const result = await fetchStoryPrompts({
          title: item.title || '',
          collectionContext: {
            name: collection.name,
            description: collection.collectionDescription,
          },
          aiDescription: (item.data?._aiDescription as string | undefined) || undefined,
          knownFields,
          locale: language,
        });
        setDetailStoryPrompts(result.prompts);
        if (result.prompts.length > 0) {
          setDetailPromptsFetchedFor(detailPromptsCacheKey);
        } else {
          // Leave the panel open with an informative message; the user can
          // dismiss with "Hide prompts" and retry once they've edited the
          // title or other context.
          setDetailPromptsFetchedFor(null);
        }
      } finally {
        setDetailPromptsLoading(false);
      }
    };

    const insertDetailStoryPrompt = (prompt: string) => {
      const el = detailStoryRef.current;
      const current = item.notes || '';
      const snippet = `> ${prompt}\n\n`;
      const insertAt = el?.selectionStart ?? current.length;
      const next = current.slice(0, insertAt) + snippet + current.slice(insertAt);
      applyItemUpdate({ notes: next });
      trackEvent('story_prompt_inserted', { surface: 'item_detail', prompt_length: prompt.length });
      requestAnimationFrame(() => {
        const t = detailStoryRef.current;
        if (!t) return;
        t.focus();
        const caret = insertAt + snippet.length;
        try {
          t.setSelectionRange(caret, caret);
        } catch {
          /* selection not supported in some test envs */
        }
      });
    };

    const handleUndo = () => {
      if (history.length === 0 || isReadOnly) return;
      const previous = history[history.length - 1];
      isApplyingHistoryRef.current = true;
      setHistory((prev) => prev.slice(0, -1));
      setFuture((prev) => [snapshotItem(item), ...prev].slice(0, 20));
      updateItem(collection.id, item.id, previous);
      requestAnimationFrame(() => {
        isApplyingHistoryRef.current = false;
      });
    };

    const handleRedo = () => {
      if (future.length === 0 || isReadOnly) return;
      const next = future[0];
      isApplyingHistoryRef.current = true;
      setFuture((prev) => prev.slice(1));
      setHistory((prev) => [...prev, snapshotItem(item)].slice(-20));
      updateItem(collection.id, item.id, next);
      requestAnimationFrame(() => {
        isApplyingHistoryRef.current = false;
      });
    };

    useEffect(() => {
      setHistory([]);
      setFuture([]);
      pendingSnapshotRef.current = null;
      if (historyTimeoutRef.current) {
        clearTimeout(historyTimeoutRef.current);
        historyTimeoutRef.current = null;
      }
      // Reset Story UI state when navigating between items so the empty card
      // and stale prompt cache don't leak across items.
      setStoryEditingOverride(false);
      setDetailPromptsOpen(false);
      setDetailStoryPrompts([]);
      setDetailPromptsFetchedFor(null);
    }, [item.id]);

    // CUR-135: Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z, Ctrl+Y drive the app-level
    // undo/redo stacks that the on-screen buttons already use. Text-field
    // focus defers to the browser's native per-field undo so typing history
    // stays reachable; the shortcut only steps the app-level stack once the
    // user has clicked out of the field. Read-only items ignore both keys.
    shortcutRef.current.isReadOnly = isReadOnly;
    shortcutRef.current.historyLength = history.length;
    shortcutRef.current.futureLength = future.length;
    shortcutRef.current.handleUndo = handleUndo;
    shortcutRef.current.handleRedo = handleRedo;

    const handleDelete = () => {
      if (isReadOnly) return;
      setIsDeleteItemModalOpen(true);
    };

    const handleConfirmDelete = () => {
      if (deleteItem(collection.id, item.id)) {
        setIsDeleteItemModalOpen(false);
        navigate(`/collection/${collection.id}`);
      }
    };

    const handleRetryItemSave = () => {
      const revision = itemSaveRevisionRef.current[item.id] ?? 0;
      setItemSaveState([item.id], 'saving');
      pendingDetailSavesRef.current.set(item.id, revision);
      const settleRetry = (status: 'saved' | 'error', error?: string) => {
        if (pendingDetailSavesRef.current.get(item.id) === revision) {
          pendingDetailSavesRef.current.delete(item.id);
        }
        if (revision === (itemSaveRevisionRef.current[item.id] ?? 0)) {
          setItemSaveState([item.id], status, error);
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
    };

    const applyEditedPhoto = async (dataUrl: string) => {
      setIsProcessing(true);
      try {
        await clearEnhancedReference(item.id);
        if (collection.isPublic) {
          updateItem(collection.id, item.id, {
            photoUrl: dataUrl,
            photoEnhancedPath: undefined,
          });
        } else {
          const { original, display } = await processImage(dataUrl);
          await saveAsset(collection.id, item.id, original, display);
          await checkStorageQuota();
          updateItem(collection.id, item.id, {
            photoUrl: 'asset',
            photoEnhancedPath: undefined,
          });
        }
      } catch (err) {
        console.error('Photo update failed', err);
        showStatus(t('photoUpdateFailed'), 'error');
      } finally {
        setIsProcessing(false);
      }
    };

    const handlePhotoUpdate = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (isReadOnly) return;
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = reader.result as string;
          setImageEditSource(base64);
          setIsImageEditorOpen(true);
        };
        reader.readAsDataURL(file);
        e.target.value = '';
      }
    };

    const getLabel = (fieldId: string) =>
      getFieldTranslation(t, fieldId, collection.customFields.find((f) => f.id === fieldId)?.label);

    const titleIsEmpty = !item.title.trim();
    const hasPhoto = item.photoUrl && item.photoUrl !== '';
    // Check if photo is an asset: either 'asset' sentinel, Supabase URL, or storage path
    const isAssetPhoto = (() => {
      if (!item.photoUrl || item.photoUrl === '') return false;
      if (item.photoUrl === 'asset') return true;
      // Check if it's a Supabase URL
      if (extractCurioAssetPath(item.photoUrl)) return true;
      // Check if it's a storage path (not a full URL, ends with image extension)
      if (
        !item.photoUrl.startsWith('http') &&
        !item.photoUrl.startsWith('data:') &&
        !item.photoUrl.startsWith('blob:') &&
        !item.photoUrl.startsWith('/')
      ) {
        return (
          item.photoUrl.endsWith('.jpg') ||
          item.photoUrl.endsWith('.jpeg') ||
          item.photoUrl.endsWith('.png') ||
          item.photoUrl.endsWith('.webp')
        );
      }
      return false;
    })();

    const detailBaseClasses = {
      gallery: 'bg-white text-stone-900 border-stone-100 shadow-2xl',
      vault: 'bg-stone-950 text-white border-white/5 shadow-black/50 shadow-2xl',
      atelier: 'bg-[#faf9f6] text-stone-800 border-[#e8e6e1] shadow-xl',
    };

    return (
      <>
        <div
          className={`max-w-4xl mx-auto rounded-[2rem] sm:rounded-[4rem] border overflow-hidden animate-in zoom-in-95 duration-500 mb-[calc(var(--bottom-nav-height,5.5rem)+env(safe-area-inset-bottom,0px))] sm:mb-20 ${detailBaseClasses[theme]}`}
          onAnimationEnd={(e) => {
            // Remove animation classes after animation ends to fix fixed positioning in children
            e.currentTarget.classList.remove('animate-in', 'zoom-in-95', 'duration-500');
            e.currentTarget.style.animation = 'none';
          }}
        >
          <div
            className={`relative ${hasPhoto ? 'aspect-[4/5] max-h-[55vh] sm:aspect-[16/9] sm:max-h-none md:aspect-[21/9]' : 'h-32 sm:h-48'} bg-stone-950 group transition-all duration-700 ease-in-out`}
          >
            <ItemImage
              key={imageKey}
              itemId={item.id}
              collectionId={collection.id}
              photoUrl={item.photoUrl}
              enhancedPath={item.photoEnhancedPath}
              alt={item.title}
              type="enhanced"
              className="w-full h-full object-cover transition-transform duration-[10s] group-hover:scale-110 opacity-80"
            />

            <div className="absolute inset-0 bg-gradient-to-t from-stone-950/60 to-transparent"></div>

            {!isReadOnly && (
              <>
                <div
                  className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${hasPhoto ? 'hidden sm:flex sm:opacity-0 sm:group-hover:opacity-100' : 'opacity-100'}`}
                >
                  <button
                    disabled={isProcessing}
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-white/90 hover:bg-white text-stone-900 px-6 sm:px-8 py-2 sm:py-3 rounded-full font-bold shadow-2xl backdrop-blur-md transition-all hover:scale-105 flex items-center gap-2 sm:gap-3 disabled:opacity-50 text-xs sm:text-sm"
                  >
                    {isProcessing ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Camera size={16} />
                    )}
                    {t('updatePhoto')}
                  </button>
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handlePhotoUpdate}
                />
              </>
            )}

            <button
              onClick={() => navigate(-1)}
              aria-label={t('back')}
              className={`absolute top-4 left-4 sm:top-8 sm:left-8 w-11 h-11 sm:w-14 sm:h-14 backdrop-blur-md rounded-xl sm:rounded-2xl flex items-center justify-center shadow-xl transition-all hover:scale-105 z-10 ${theme === 'vault' ? 'bg-white/10 text-white' : 'bg-white/80 text-stone-800'}`}
            >
              <ArrowLeft size={20} className="sm:w-6 sm:h-6" />
            </button>

            <div className="absolute top-4 right-4 sm:top-8 sm:right-8 flex gap-2 sm:gap-4 z-10">
              {/* Mobile-only quick action to update the photo (desktop reveals the centered pill on hover) */}
              {!isReadOnly && hasPhoto && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                  className={`sm:hidden w-11 h-11 backdrop-blur-md rounded-xl flex items-center justify-center shadow-xl transition-all hover:scale-105 disabled:opacity-50 ${theme === 'vault' ? 'bg-white/10 text-white' : 'bg-white/80 text-stone-800'}`}
                  title={t('updatePhoto')}
                  aria-label={t('updatePhoto')}
                >
                  {isProcessing ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Camera size={18} />
                  )}
                </button>
              )}
              {/* Enhance Image Button - only show when AI is enabled, not read-only, and has photo */}
              {aiImageEditEnabled && !isReadOnly && isAssetPhoto && (
                <button
                  onClick={() => setIsEnhanceOpen(true)}
                  className={`w-11 h-11 sm:w-14 sm:h-14 backdrop-blur-md rounded-xl sm:rounded-2xl flex items-center justify-center shadow-xl transition-all hover:scale-105 ${theme === 'vault' ? 'bg-white/10 text-white' : 'bg-white/80 text-stone-800'}`}
                  title={t('enhanceImage')}
                  aria-label={t('enhanceImage')}
                >
                  <Sparkles size={20} className="sm:w-6 sm:h-6" />
                </button>
              )}
              <button
                onClick={() => setIsExportOpen(true)}
                className={`w-11 h-11 sm:w-14 sm:h-14 backdrop-blur-md rounded-xl sm:rounded-2xl flex items-center justify-center shadow-xl transition-all hover:scale-105 ${theme === 'vault' ? 'bg-white/10 text-white' : 'bg-white/80 text-stone-800'}`}
                title={t('exportCard')}
                aria-label={t('exportCard')}
                data-testid="item-export"
              >
                <Printer size={20} className="sm:w-6 sm:h-6" />
              </button>
            </div>
          </div>

          <div className="p-8 sm:p-12 md:p-20 space-y-10 sm:space-y-12">
            {isReadOnly && (
              <div
                className={`flex items-center gap-3 p-4 rounded-2xl border ${theme === 'vault' ? 'bg-white/5 border-white/10' : 'bg-stone-50 border-stone-100'}`}
              >
                <div className="p-2 rounded-xl bg-amber-50 text-amber-700 shadow-inner">
                  <Lock size={16} />
                </div>
                <div>
                  <p
                    className={`text-sm font-semibold ${theme === 'vault' ? 'text-white' : 'text-stone-900'}`}
                  >
                    {t('readOnlyMode')}
                  </p>
                  <p className="text-xs text-stone-500">{t('readOnlyItemDesc')}</p>
                </div>
              </div>
            )}
            <div className="flex flex-col md:flex-row justify-between items-start gap-8 sm:gap-12">
              <div className="flex-1 w-full">
                <textarea
                  ref={titleTextareaRef}
                  rows={1}
                  aria-label={t('title')}
                  aria-required="true"
                  aria-invalid={titleIsEmpty && !isReadOnly ? true : undefined}
                  aria-describedby={
                    titleIsEmpty && !isReadOnly ? 'item-detail-title-error' : undefined
                  }
                  className={`${typographyClasses.titleDisplay} mb-2 sm:mb-3 w-full bg-transparent border-b-2 resize-none overflow-hidden break-words leading-tight ${
                    titleIsEmpty && !isReadOnly
                      ? 'border-red-400 focus:border-red-500'
                      : 'border-transparent'
                  } focus:border-amber-500 outline-none transition-all placeholder:italic ${theme === 'vault' ? 'text-white' : 'text-stone-900'} ${isReadOnly ? 'cursor-not-allowed opacity-70' : ''}`}
                  value={item.title}
                  onChange={(e) => applyItemUpdate({ title: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.currentTarget.blur();
                    }
                  }}
                  placeholder={t('itemTitlePlaceholder')}
                  disabled={isReadOnly}
                />
                {titleIsEmpty && !isReadOnly && (
                  <p
                    id="item-detail-title-error"
                    role="alert"
                    className="text-xs font-semibold text-red-500 mb-3"
                  >
                    {t('titleRequired')}
                  </p>
                )}
                {!isReadOnly && itemSaveState && (
                  <div
                    role="status"
                    aria-live="polite"
                    data-testid="item-save-status"
                    className={`mb-3 inline-flex max-w-full flex-wrap items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                      itemSaveState.status === 'error'
                        ? theme === 'vault'
                          ? 'border-red-400/40 bg-red-500/10 text-red-200'
                          : 'border-red-200 bg-red-50 text-red-700'
                        : itemSaveState.status === 'saved'
                          ? theme === 'vault'
                            ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
                            : theme === 'atelier'
                              ? 'border-[#d7d0c5] bg-white/70 text-[#5f6f4f]'
                              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : theme === 'vault'
                            ? 'border-white/10 bg-white/5 text-stone-300'
                            : 'border-stone-200 bg-stone-50 text-stone-600'
                    }`}
                  >
                    {itemSaveState.status === 'saving' && (
                      <Loader2 size={14} className="shrink-0 animate-spin" aria-hidden />
                    )}
                    {itemSaveState.status === 'saved' && (
                      <CheckSquare size={14} className="shrink-0" aria-hidden />
                    )}
                    {itemSaveState.status === 'error' && (
                      <AlertCircle size={14} className="shrink-0" aria-hidden />
                    )}
                    <span>
                      {itemSaveState.status === 'saving'
                        ? t('itemSaveStatusSaving')
                        : itemSaveState.status === 'saved'
                          ? t('itemSaveStatusSaved')
                          : t('itemSaveStatusError')}
                    </span>
                    {itemSaveState.status === 'error' && (
                      <button
                        type="button"
                        onClick={handleRetryItemSave}
                        className={`rounded-full px-2 py-0.5 text-[11px] underline-offset-2 hover:underline ${
                          theme === 'vault' ? 'bg-white/10 text-white' : 'bg-white/80 text-red-800'
                        }`}
                      >
                        {t('actionRetry')}
                      </button>
                    )}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => applyItemUpdate({ rating: star })}
                      aria-label={t('rateStars', { count: star })}
                      aria-pressed={item.rating === star}
                      title={t('rateStars', { count: star })}
                      className={`p-2 min-w-[48px] min-h-[48px] flex items-center justify-center transition-transform ${isReadOnly ? 'cursor-not-allowed opacity-70' : 'hover:scale-125'}`}
                      disabled={isReadOnly}
                    >
                      <Star
                        className={`w-6 h-6 sm:w-9 sm:h-9 ${
                          star <= item.rating
                            ? `${ratingColorClasses[theme]} fill-current`
                            : ratingEmptyClasses[theme]
                        }`}
                        strokeWidth={1.5}
                      />
                    </button>
                  ))}
                  <span
                    className={`shrink-0 whitespace-nowrap sm:ml-2 ${typographyClasses.label} ${mutedTextClasses[theme]}`}
                  >
                    {t('registryQuality')}
                  </span>
                  {isReadOnly && (
                    <span className="shrink-0 whitespace-nowrap text-[12px] text-amber-500 font-semibold">
                      {t('readOnlyControls')}
                    </span>
                  )}
                </div>
              </div>
              {!isReadOnly && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleUndo}
                    disabled={history.length === 0}
                    aria-label={t('undo')}
                    title={`${t('undo')} (${UNDO_SHORTCUT_LABEL})`}
                    className={`p-3 sm:p-4 rounded-full transition-colors ${mutedTextClasses[theme]} ${
                      history.length === 0
                        ? 'opacity-50 cursor-not-allowed'
                        : theme === 'vault'
                          ? 'hover:text-white hover:bg-white/10'
                          : 'hover:text-stone-900 hover:bg-stone-100'
                    }`}
                  >
                    <Undo2 size={18} className="sm:w-5 sm:h-5" />
                  </button>
                  <button
                    onClick={handleRedo}
                    disabled={future.length === 0}
                    aria-label={t('redo')}
                    title={`${t('redo')} (${REDO_SHORTCUT_LABEL})`}
                    className={`p-3 sm:p-4 rounded-full transition-colors ${mutedTextClasses[theme]} ${
                      future.length === 0
                        ? 'opacity-50 cursor-not-allowed'
                        : theme === 'vault'
                          ? 'hover:text-white hover:bg-white/10'
                          : 'hover:text-stone-900 hover:bg-stone-100'
                    }`}
                  >
                    <Redo2 size={18} className="sm:w-5 sm:h-5" />
                  </button>
                  <button
                    onClick={handleDelete}
                    aria-label={t('deleteItem')}
                    title={t('deleteItem')}
                    className={`w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-xl border transition-colors shrink-0 ${
                      theme === 'vault'
                        ? 'bg-stone-900 border-white/10 text-stone-400 hover:text-red-400 hover:border-red-400/30'
                        : 'bg-white border-stone-200 text-stone-400 hover:text-red-500 hover:border-red-200'
                    }`}
                  >
                    <Trash2 size={18} className="sm:w-5 sm:h-5" />
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 sm:gap-16">
              <div className="lg:col-span-2 space-y-6">
                <div className={`flex flex-wrap items-center gap-3 ${accentColorClasses[theme]}`}>
                  <Quote size={18} fill="currentColor" className="opacity-20 sm:w-5 sm:h-5" />
                  <dt
                    className={`min-w-0 ${typographyClasses.label} ${labelColorClasses[theme]} break-words`}
                  >
                    {t('story')}
                  </dt>
                </div>
                {(() => {
                  const isLegacy = isLegacyAiNoteItem(item);
                  const isEmpty = !(item.notes || '').trim();
                  const showEmptyCard = isEmpty && !isReadOnly && !storyEditingOverride;

                  const dismissMigration = () => {
                    applyItemUpdate({
                      data: { ...item.data, _storyMigrationDismissed: true },
                    });
                    trackEvent('story_legacy_banner_action', { action: 'keep' });
                  };
                  const editLegacy = () => {
                    applyItemUpdate({
                      data: { ...item.data, _storyMigrationDismissed: true },
                    });
                    trackEvent('story_legacy_banner_action', { action: 'edit' });
                  };
                  const startFresh = () => {
                    applyItemUpdate({
                      notes: '',
                      data: {
                        ...item.data,
                        _aiDescription: item.notes,
                        _storyMigrationDismissed: true,
                      },
                    });
                    setStoryEditingOverride(true);
                    trackEvent('story_legacy_banner_action', { action: 'start_fresh' });
                    requestAnimationFrame(() => detailStoryRef.current?.focus());
                  };

                  return (
                    <>
                      {isLegacy && !isReadOnly && (
                        <div
                          className={`p-4 sm:p-5 rounded-2xl border ${theme === 'vault' ? 'bg-amber-500/10 border-amber-500/30 text-amber-100' : 'bg-amber-50 border-amber-200 text-amber-900'}`}
                        >
                          <p className="text-sm leading-relaxed mb-3">
                            {t('storyMigrationBanner')}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" onClick={startFresh}>
                              {t('storyMigrationStart')}
                            </Button>
                            <Button size="sm" variant="outline" onClick={editLegacy}>
                              {t('storyMigrationEdit')}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={dismissMigration}>
                              {t('storyMigrationKeep')}
                            </Button>
                          </div>
                        </div>
                      )}
                      {showEmptyCard ? (
                        <div
                          className={`w-full p-6 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border-2 border-dashed flex flex-col items-center justify-center text-center gap-3 min-h-[200px] sm:min-h-[240px] ${theme === 'vault' ? 'border-white/10 bg-white/5 text-stone-300' : 'border-stone-200 bg-stone-50/40 text-stone-500'}`}
                        >
                          <p className={`${typographyClasses.quote} text-base sm:text-lg max-w-md`}>
                            {t('storyEmptyDetailHint')}
                          </p>
                          <div className="flex flex-wrap items-center justify-center gap-2">
                            <Button size="sm" onClick={focusStoryTextarea}>
                              {t('storyEmptyDetailCta')}
                            </Button>
                            <Button size="sm" variant="outline" onClick={openDetailPromptsPanel}>
                              {t('storyPromptCta')}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <textarea
                          ref={detailStoryRef}
                          className={`w-full p-6 sm:p-8 rounded-2xl sm:rounded-[2.5rem] italic border font-serif text-xl sm:text-2xl leading-relaxed min-h-[200px] sm:min-h-[240px] focus:ring-8 focus:ring-amber-500/30 focus:border-amber-500 outline-none transition-all shadow-inner placeholder:text-stone-400 ${theme === 'vault' ? 'bg-white/5 border-white/5 text-white' : 'bg-stone-50/50 border-stone-100 text-stone-800'} ${isReadOnly ? 'cursor-not-allowed opacity-70' : ''}`}
                          value={item.notes}
                          onChange={(e) => applyItemUpdate({ notes: e.target.value })}
                          placeholder={t('storyPlaceholder')}
                          disabled={isReadOnly}
                        />
                      )}
                      {detailPromptsOpen && !isReadOnly && (
                        <div
                          className={`rounded-xl border p-3 sm:p-4 ${theme === 'vault' ? 'bg-white/5 border-white/10' : 'bg-amber-50/40 border-stone-200'}`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <p
                              className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${theme === 'vault' ? 'text-stone-400' : 'text-stone-500'}`}
                            >
                              {t('storyPromptHelp')}
                            </p>
                            <button
                              type="button"
                              onClick={() => setDetailPromptsOpen(false)}
                              className={`text-[11px] ${theme === 'vault' ? 'text-stone-400' : 'text-stone-500'} hover:text-stone-700`}
                            >
                              {t('storyPromptHide')}
                            </button>
                          </div>
                          {detailPromptsLoading && (
                            <p
                              className={`text-[12px] italic ${theme === 'vault' ? 'text-stone-400' : 'text-stone-500'}`}
                            >
                              {t('storyPromptLoading')}
                            </p>
                          )}
                          {!detailPromptsLoading && detailStoryPrompts.length === 0 && (
                            <p
                              className={`text-[12px] ${theme === 'vault' ? 'text-stone-300' : 'text-stone-600'}`}
                            >
                              {t('storyPromptEmpty')}
                            </p>
                          )}
                          <ul className="space-y-1.5 mt-1">
                            {detailStoryPrompts.map((prompt, idx) => (
                              <li key={`${idx}-${prompt}`}>
                                <button
                                  type="button"
                                  onClick={() => insertDetailStoryPrompt(prompt)}
                                  className={`w-full text-left text-[12px] sm:text-[13px] px-2 py-1.5 rounded-lg flex items-start gap-2 transition-colors ${theme === 'vault' ? 'hover:bg-white/10 text-stone-200' : 'hover:bg-white text-stone-700'}`}
                                >
                                  <span className="mt-0.5 shrink-0" aria-hidden>
                                    +
                                  </span>
                                  <span>{prompt}</span>
                                  <span className="sr-only">{t('storyPromptInsert')}</span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              <div className="space-y-8 sm:space-y-10">
                <dt
                  className={`${typographyClasses.label} pb-3 sm:pb-4 border-b break-words leading-tight ${theme === 'vault' ? 'text-stone-500 border-white/5' : `${labelColorClasses[theme]} ${dividerClasses[theme]}`}`}
                >
                  {t('technicalSpec')}
                </dt>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-6 sm:gap-8">
                  {collection.customFields.map((field) => {
                    const val = item.data[field.id];
                    const label = getLabel(field.id);
                    return (
                      <div key={field.id} className="group">
                        <dt
                          className={`${typographyClasses.label} ${mutedTextClasses[theme]} mb-1 sm:mb-2 group-hover:text-amber-500 transition-colors break-words leading-tight`}
                        >
                          {label}
                        </dt>
                        <input
                          className={`${typographyClasses.title} w-full bg-transparent border-none p-0 outline-none focus:text-amber-900 focus:ring-0 transition-colors ${theme === 'vault' ? 'text-white placeholder:text-stone-400' : theme === 'atelier' ? 'text-stone-900 placeholder:text-[#8C7B6B]' : 'text-stone-900 placeholder:text-stone-500'} ${isReadOnly ? 'cursor-not-allowed opacity-70' : ''}`}
                          value={val || ''}
                          placeholder="—"
                          onChange={(e) => {
                            const newData = {
                              ...item.data,
                              [field.id]: e.target.value,
                            };
                            applyItemUpdate({ data: newData });
                          }}
                          disabled={isReadOnly}
                        />
                      </div>
                    );
                  })}
                </div>
                {typeof item.data?._aiDescription === 'string' &&
                  item.data._aiDescription.trim().length > 0 && (
                    <details
                      className={`mt-6 sm:mt-8 pt-4 sm:pt-6 border-t ${theme === 'vault' ? 'border-white/5' : `${dividerClasses[theme]}`}`}
                    >
                      <summary
                        className={`${typographyClasses.label} cursor-pointer text-stone-400 hover:text-amber-500 transition-colors`}
                      >
                        {t('storyAiObservationLabel')}
                      </summary>
                      <p
                        className={`mt-3 text-xs sm:text-sm leading-relaxed ${theme === 'vault' ? 'text-stone-300' : 'text-stone-500'} font-mono whitespace-pre-wrap`}
                      >
                        {item.data._aiDescription}
                      </p>
                    </details>
                  )}
              </div>
            </div>
            {(() => {
              const created = new Date(item.createdAt);
              if (Number.isNaN(created.getTime())) return null;
              const locale = language === 'zh' ? 'zh-CN' : 'en-US';
              const formatted = new Intl.DateTimeFormat(locale, {
                dateStyle: 'long',
              }).format(created);
              return (
                <p className={typographyClasses.accession} data-testid="item-added-on">
                  {t('addedOn', { date: formatted })}
                </p>
              );
            })()}
          </div>
        </div>
        <ExportModal
          isOpen={isExportOpen}
          onClose={() => setIsExportOpen(false)}
          item={item}
          fields={collection.customFields}
          onStatus={showStatus}
        />
        <EnhanceImageModal
          isOpen={isEnhanceOpen}
          onClose={() => setIsEnhanceOpen(false)}
          itemId={item.id}
          photoUrl={item.photoUrl}
          collectionId={collection.id}
          onEnhancementComplete={({ enhancedPath }) => {
            if (enhancedPath) {
              updateItem(collection.id, item.id, { photoEnhancedPath: enhancedPath });
            }
            // Force ItemImage to re-render with updated enhanced image
            setImageKey((prev) => prev + 1);
          }}
        />
        <ImageEditModal
          isOpen={isImageEditorOpen}
          source={imageEditSource}
          onClose={() => {
            setIsImageEditorOpen(false);
            setImageEditSource(null);
          }}
          onApply={(edited) => {
            setIsImageEditorOpen(false);
            setImageEditSource(null);
            applyEditedPhoto(edited);
          }}
        />
        <DeleteItemModal
          isOpen={isDeleteItemModalOpen}
          item={item}
          onClose={() => setIsDeleteItemModalOpen(false)}
          onConfirm={handleConfirmDelete}
        />
      </>
    );
  };

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
  const shouldShowAccessGate = showAccessGate && !isExploreRoute && !isLegalRoute;
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
    if (pendingAssetUploads > 0) {
      return (
        <StatusBanner
          title={t('pendingUploadsTitle', { count: pendingAssetUploads })}
          message={t('pendingUploadsDesc', { count: pendingAssetUploads })}
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
      setIsAuthModalOpen(true);
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
  }, [editableCollections, isAuthenticated, location.pathname]);

  const handleCreateCollectionAction = useCallback(() => {
    if (!isAuthenticated) {
      setPendingAuthAction('create-collection');
      setIsAuthModalOpen(true);
      return;
    }
    setIsCreateCollectionOpen(true);
  }, [isAuthenticated]);

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
          className={`text-[12px] mt-5 leading-relaxed ${theme === 'vault' ? 'text-stone-500' : theme === 'atelier' ? 'text-[#8C7B6B]' : 'text-stone-400'}`}
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
        onOpenAuth={() => setIsAuthModalOpen(true)}
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
            {!isAuthenticated && isSupabaseReady && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsAuthModalOpen(true)}
                className="hidden sm:inline-flex motion-fade"
              >
                {t('login')}
              </Button>
            )}
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
                    <CollectionScreen />
                  </ErrorBoundary>
                }
              />
              <Route
                path="/collection/:id/item/:itemId"
                element={
                  <ErrorBoundary>
                    <ItemDetailScreen />
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
              onAddFirstItem={() => {
                setAddModalDefaultCollectionId(undefined);
                setIsAddModalOpen(true);
              }}
            />
          </>
        )}
      </Layout>
      <div
        role="status"
        aria-live="polite"
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
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
        initialMode={isPasswordRecovery ? 'set-password' : undefined}
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

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <LocalizedErrorBoundary>
          <HashRouter>
            <AppContent />
          </HashRouter>
          <SpeedInsights />
          <Analytics />
        </LocalizedErrorBoundary>
      </LanguageProvider>
    </ThemeProvider>
  );
};
