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
import { CollectionCard } from './components/CollectionCard';
import { ItemCard } from './components/ItemCard';
import { AddItemModal } from './components/AddItemModal';
import { CreateCollectionModal } from './components/CreateCollectionModal';
import { AuthModal } from './components/AuthModal';
import { UserCollection, CollectionItem, AppTheme } from './types';
import { TEMPLATES } from './constants';
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
  Mic,
  Play,
  Quote,
  Sparkle,
  Globe,
  Calendar,
  Lock,
  AlertCircle,
  X,
} from 'lucide-react';
import { Button } from './components/ui/Button';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import {
  fetchCloudCollections,
  getLocalCollections,
  getPendingSyncIds,
  hasLocalOnlyData,
  importLocalCollectionsToCloud,
  mergeCollections,
  saveCollection,
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
  setSyncStatusCallback,
  syncPendingChanges,
  syncPendingAssetUploads,
  extractCurioAssetPath,
  type SyncStatus,
} from './services/db';
import { processImage } from './services/imageProcessor';
import { ItemImage } from './components/ItemImage';
import { MuseumGuide } from './components/MuseumGuide';
import { ExhibitionView } from './components/ExhibitionView';
import { ExportModal } from './components/ExportModal';
import { FilterModal } from './components/FilterModal';
import { EnhanceImageModal } from './components/EnhanceImageModal';
import { refreshAiImageEditEnabled, isAiImageEditEnabled } from './services/geminiService';
import { DeleteCollectionModal } from './components/DeleteCollectionModal';
import { DeleteItemModal } from './components/DeleteItemModal';
import { LanguageProvider, useTranslation } from './i18n';
import { supabase, isSupabaseConfigured, signOutUser } from './services/supabase';
import {
  ThemeProvider,
  useTheme,
  typographyClasses,
  labelColorClasses,
  inputClasses,
  accentColorClasses,
  dividerClasses,
  cardHoverClasses,
} from './theme';
import { StatusToast, StatusTone } from './components/StatusToast';
import { CURRENT_SEED_VERSION, INITIAL_COLLECTIONS } from './services/seedCollections';
import {
  STORAGE_QUOTA_CHECK_INTERVAL_MS,
  STORAGE_QUOTA_WARNING_THRESHOLD_BYTES,
  STORAGE_QUOTA_WARNING_THRESHOLD_RATIO,
} from './config';

const AppContent: React.FC = () => {
  const { t, language, setLanguage } = useTranslation();
  const { theme, setTheme } = useTheme();
  const isVoiceGuideEnabled = import.meta.env.VITE_VOICE_GUIDE_ENABLED === 'true';
  const [collections, setCollections] = useState<UserCollection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [allowPublicBrowse, setAllowPublicBrowse] = useState(false);
  const [hasLocalImport, setHasLocalImport] = useState(false);
  const [importState, setImportState] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCreateCollectionOpen, setIsCreateCollectionOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [activeCollectionForGuide, setActiveCollectionForGuide] = useState<UserCollection | null>(
    null,
  );
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
  const location = useLocation();
  const [pendingAuthAction, setPendingAuthAction] = useState<
    'add-item' | 'create-collection' | null
  >(null);
  const [authActionQueue, setAuthActionQueue] = useState<'add-item' | 'create-collection' | null>(
    null,
  );
  const saveTimeoutRef = useRef<Record<string, any>>({});
  const statusTimeoutRef = useRef<number | null>(null);
  const pendingSyncToastRef = useRef(false);
  const hasQuotaWarningRef = useRef(false);
  const isSupabaseReady = isSupabaseConfigured();
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
      const durationMs = options?.durationMs ?? (options?.actionLabel ? 6000 : 2400);
      statusTimeoutRef.current = window.setTimeout(() => setStatus(null), durationMs);
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
      const synced = await syncPendingChanges();
      const assetsSynced = await syncPendingAssetUploads();
      if (synced > 0) {
        showStatus(t('statusPendingSynced').replace('{count}', String(synced)), 'success');
      }
      if (synced === 0 && assetsSynced === 0) {
        showStatus(t('statusWillSync'), 'warning');
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : t('statusSyncPaused');
      showStatus(t('statusSyncError').replace('{error}', errorMessage), 'error', {
        actionLabel: t('actionRetry'),
        onAction: () => handleRetrySync(),
      });
    }
  }, [showStatus, t]);

  useEffect(() => {
    checkStorageQuota();
    const intervalId = window.setInterval(() => {
      checkStorageQuota();
    }, STORAGE_QUOTA_CHECK_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [checkStorageQuota]);

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
    };
    setSyncStatusCallback(handleSyncStatus);
    return () => setSyncStatusCallback(null);
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

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user || null);
      });
      unsubscribe = () => subscription.unsubscribe();
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
    if (!isSupabaseReady) {
      setCollections([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setLoadError(null);
    try {
      await withTimeout(requestPersistence(), 4000, 'Persistence request timed out');

      const localCollections = await loadLocalCollectionsWithTimeout();
      let cloudCollections: UserCollection[] = [];
      try {
        cloudCollections = await loadCloudCollectionsWithTimeout(user?.id ?? null);
      } catch (e) {
        console.warn('Supabase cloud fetch failed:', e);
        setHasLocalImport(false);
        setCollections(localCollections);
        setLoadError('Unable to sync with Supabase. Check your connection and Supabase settings.');
        showStatusRef.current(tRef.current('statusSyncPaused'), 'error');
        return;
      }

      cloudCollections = await maybeSeedCollections({
        user,
        isAdmin,
        localCollections,
        cloudCollections,
      });

      const pendingSyncIds = await getPendingSyncIds();
      const mergedCollections = mergeCollections(localCollections, cloudCollections, {
        includeLocalOnly: (collection) =>
          !collection.ownerId || pendingSyncIds.includes(collection.id),
      });

      const {
        collections: resolvedCollections,
        hasLocalImport: resolvedHasLocalImport,
        shouldPersist,
        showSyncedStatus,
      } = resolveCollectionsForUser({
        user,
        localCollections,
        cloudCollections,
        fallbackSampleCollections,
        mergedCollections,
      });

      setHasLocalImport(resolvedHasLocalImport);

      if (shouldPersist) {
        await saveAllCollections(mergedCollections);
      }

      setCollections(resolvedCollections);
      if (showSyncedStatus) {
        showStatusRef.current(tRef.current('statusSynced'), 'success');
      }
    } catch (e) {
      console.error('Initialization failed:', e);
      setLoadError('Failed to load collections. Please try again.');
      showStatusRef.current(tRef.current('statusSyncPaused'), 'error');
      setCollections([]);
    } finally {
      setIsLoading(false);
    }
  }, [
    user,
    isAdmin,
    isSupabaseReady,
    withTimeout,
    fallbackSampleCollections,
    loadLocalCollectionsWithTimeout,
    loadCloudCollectionsWithTimeout,
    maybeSeedCollections,
    resolveCollectionsForUser,
  ]);

  useEffect(() => {
    if (!isSupabaseReady) {
      setCollections([]);
      setIsLoading(false);
      setHasLocalImport(false);
      setImportState('idle');
      setImportMessage(null);
    }
  }, [isSupabaseReady]);

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

  const debouncedSaveCollection = useCallback((collection: UserCollection) => {
    if (saveTimeoutRef.current[collection.id]) {
      clearTimeout(saveTimeoutRef.current[collection.id]);
    }
    saveTimeoutRef.current[collection.id] = setTimeout(() => {
      saveCollection(collection).catch((err) => console.warn('Sync failed', err));
    }, 1500);
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
    if (!canEditCollection(collectionId)) return;
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
      }
    }

    const newItem: CollectionItem = {
      ...itemData,
      id: itemId,
      photoUrl: hasPhoto ? 'asset' : itemData.photoUrl,
      createdAt: now,
      updatedAt: now,
    };

    setCollections((prev) =>
      prev.map((c) => {
        if (c.id === collectionId) {
          const newC = { ...c, items: [newItem, ...c.items], updatedAt: now };
          saveCollection(newC);
          return newC;
        }
        return c;
      }),
    );
    showStatus(t('statusSaved'), 'success');
  };

  const updateItem = (collectionId: string, itemId: string, updates: Partial<CollectionItem>) => {
    if (!canEditCollection(collectionId)) return;
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
          debouncedSaveCollection(newC);
          return newC;
        }
        return c;
      }),
    );
  };

  const handleCreateCollection = (templateId: string, name: string, icon: string) => {
    if (!isAuthenticated) {
      setPendingAuthAction('create-collection');
      setIsAuthModalOpen(true);
      setIsCreateCollectionOpen(false);
      return;
    }
    pendingSyncToastRef.current = true;
    if (!isSupabaseReady) pendingSyncToastRef.current = false;
    const template = TEMPLATES.find((t) => t.id === templateId) || TEMPLATES[0];
    const newCol: UserCollection = {
      id: Math.random().toString(36).substr(2, 9),
      templateId: template.id,
      name: name,
      icon: icon || template.icon,
      customFields: template.fields,
      items: [],
      isPublic: false,
      ownerId: user?.id,
      updatedAt: new Date().toISOString(),
      settings: {
        displayFields: template.displayFields,
        badgeFields: template.badgeFields,
      },
    };
    setCollections((prev) => {
      const updated = [...prev, newCol];
      saveCollection(newCol);
      return updated;
    });
    showStatus(t('statusSaved'), 'success');
  };

  const deleteItem = (collectionId: string, itemId: string) => {
    if (!canEditCollection(collectionId)) return false;
    setCollections((prev) =>
      prev.map((c) => {
        if (c.id === collectionId) {
          const newC = {
            ...c,
            items: c.items.filter((i) => i.id !== itemId),
          };
          saveCollection(newC);
          deleteAsset(collectionId, itemId);
          void deleteCloudItem(collectionId, itemId);
          return newC;
        }
        return c;
      }),
    );
    return true;
  };

  const stats = useMemo(() => {
    const statCollections = collections.filter((c) => !c.isPublic);
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

  const HomeScreen = () => {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const hasSearch = normalizedSearch.length > 0;

    const filteredCollections = collections.filter(
      (c) =>
        !normalizedSearch ||
        c.name.toLowerCase().includes(normalizedSearch) ||
        c.items.some((i) => i.title.toLowerCase().includes(normalizedSearch)),
    );
    const historyItems = stats.historyItems;
    const historyPreview = historyItems.slice(0, 3);
    const historyOverflow = historyItems.length - historyPreview.length;
    const primaryHistoryItem = historyItems[0];

    if (isLoading)
      return (
        <div className="flex flex-col items-center justify-center py-32">
          <Loader2 className="text-stone-300 animate-spin mb-4" size={32} />
          <p className="text-stone-400 font-serif italic">{t('restoringArchives')}</p>
        </div>
      );

    if (loadError)
      return (
        <div className="flex flex-col items-center justify-center px-4 py-16 sm:py-24">
          <div className="max-w-md w-full text-center bg-white/70 border border-stone-200 rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-10 shadow-xl">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-5 sm:mb-6">
              <AlertCircle size={24} />
            </div>
            <h2 className="font-serif text-2xl font-bold text-stone-900 mb-2">Sync paused</h2>
            <p className="text-sm text-stone-500 mb-6">{loadError}</p>
            <Button onClick={() => refreshCollections()} size="lg" className="w-full">
              Retry
            </Button>
          </div>
        </div>
      );

    const themeBaseClasses = {
      gallery: 'bg-white text-stone-900 border-stone-100',
      vault: 'bg-stone-950 text-white border-white/5',
      atelier: 'bg-[#faf9f6] text-stone-800 border-[#e8e6e1] shadow-inner',
    };

    return (
      <div className={`space-y-10 sm:space-y-12 animate-in fade-in duration-700`}>
        {editableCollections.length === 0 && (
          <div
            className={`rounded-[2rem] border p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm motion-pop ${theme === 'vault' ? 'bg-white/5 border-white/10' : 'bg-white/80 border-stone-100'}`}
          >
            <div>
              <p
                className={`text-sm font-semibold ${theme === 'vault' ? 'text-white' : 'text-stone-900'}`}
              >
                {t('ctaAddFirst')}
              </p>
              <p className="text-[12px] text-stone-500 mt-1">{t('ctaPromise')}</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button onClick={handleAddAction} size="md" className="shadow-sm">
                {t('addItem')}
              </Button>
              {sampleCollection && (
                <Link to={`/collection/${sampleCollection.id}`}>
                  <Button variant="secondary" size="md" icon={<Sparkles size={14} />}>
                    {t('exploreSample')}
                  </Button>
                </Link>
              )}
            </div>
          </div>
        )}
        {/* Bento Grid Hero */}
        <section
          className={`grid grid-cols-1 gap-6 ${historyItems.length ? 'md:grid-cols-3' : ''}`}
        >
          <div
            className={`${historyItems.length ? 'md:col-span-2' : ''} relative overflow-hidden rounded-[2rem] sm:rounded-[2.25rem] min-h-[280px] sm:min-h-[360px] flex items-center shadow-xl border transition-all duration-700 ${themeBaseClasses[theme]} group`}
          >
            {stats.featured && (
              <div className="absolute inset-0 opacity-30 group-hover:opacity-25 transition-opacity duration-700">
                <ItemImage
                  itemId={stats.featured.id}
                  collectionId={stats.featured.collectionId}
                  photoUrl={stats.featured.photoUrl}
                  enhancedPath={stats.featured.photoEnhancedPath}
                  type="enhanced"
                  className="w-full h-full object-cover scale-105 group-hover:scale-100 transition-transform duration-[20s] ease-out"
                />
              </div>
            )}
            <div
              className={`absolute inset-0 bg-gradient-to-r ${theme === 'vault' ? 'from-stone-950 via-stone-900/50' : theme === 'atelier' ? 'from-[#faf9f6] via-[#faf9f6]/60' : 'from-white via-white/60'} to-transparent`}
            ></div>

            <div className="relative z-10 p-6 sm:p-10 lg:p-12 max-w-xl">
              <div className="flex items-center gap-2 mb-3 sm:mb-4">
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                <span className={`${typographyClasses.label} ${accentColorClasses[theme]}`}>
                  {t('featuredArtifact')}
                </span>
              </div>
              <h1 className={`${typographyClasses.titleHero} mb-3 sm:mb-4 leading-tight`}>
                {t('appTitle')}{' '}
                <span className="opacity-40 italic font-light">{t('appSubtitle')}</span>
              </h1>
              <p className="text-sm sm:text-base md:text-lg font-light leading-relaxed mb-6 sm:mb-8 max-w-sm font-serif italic opacity-80">
                {t('heroSubtitle')}
              </p>

              <div className={`flex gap-6 sm:gap-8 pt-6 sm:pt-8 border-t ${dividerClasses[theme]}`}>
                <div className="space-y-1">
                  <p className={typographyClasses.title}>{stats.totalItems}</p>
                  <p className={typographyClasses.labelMuted}>{t('artifacts')}</p>
                </div>
                <div className="space-y-1">
                  <p className={typographyClasses.title}>{stats.totalCollections}</p>
                  <p className={typographyClasses.labelMuted}>{t('archives')}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Archeology Bento Card */}
          {primaryHistoryItem && (
            <div
              className={`relative overflow-hidden rounded-[2rem] p-6 sm:p-7 border flex flex-col justify-between transition-all duration-500 ${themeBaseClasses[theme]} shadow-md`}
            >
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className="p-2 bg-amber-50 rounded-xl text-amber-600">
                  <Calendar size={18} />
                </div>
                <span className={`${typographyClasses.labelSmall} ${labelColorClasses[theme]}`}>
                  {t('onThisDay')}
                </span>
              </div>
              <div className="space-y-4">
                <div className="aspect-square rounded-2xl overflow-hidden bg-stone-100 shadow-inner">
                  <ItemImage
                    itemId={primaryHistoryItem.id}
                    collectionId={primaryHistoryItem.collectionId}
                    photoUrl={primaryHistoryItem.photoUrl}
                    enhancedPath={primaryHistoryItem.photoEnhancedPath}
                    type="enhanced"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <p className={`${typographyClasses.labelMuted} mb-1`}>{t('historyTitle')}</p>
                  <h4 className={`${typographyClasses.title} leading-tight truncate`}>
                    {primaryHistoryItem.title}
                  </h4>
                </div>
                <div className="space-y-3">
                  <div className="space-y-2">
                    {historyPreview.map((item) => {
                      const itemYear = new Date(item.createdAt).getFullYear();
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() =>
                            navigate(`/collection/${item.collectionId}/item/${item.id}`)
                          }
                          className="w-full text-left rounded-xl border border-stone-200/60 bg-white/70 px-3 py-2 text-xs sm:text-sm shadow-sm transition hover:border-amber-200 hover:bg-amber-50/60"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate font-medium text-stone-700">
                              {item.title}
                            </span>
                            <span className="text-[11px] uppercase tracking-wide text-stone-400">
                              {itemYear}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {historyOverflow > 0 && (
                    <p className="text-xs text-stone-400">
                      {t('onThisDayMore', { count: historyOverflow })}
                    </p>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() =>
                      navigate(
                        `/collection/${primaryHistoryItem.collectionId}/item/${primaryHistoryItem.id}`,
                      )
                    }
                  >
                    {t('viewHistory') || 'Relive Memory'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </section>

        <div className="relative max-w-xl mx-auto -mt-6 sm:-mt-10 z-20 px-4">
          <div className="relative">
            <Search
              className="absolute left-5 sm:left-6 top-1/2 -translate-y-1/2 text-stone-400"
              size={20}
            />
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-12 sm:pl-14 pr-6 sm:pr-8 py-3.5 sm:py-4 rounded-[1.5rem] sm:rounded-[1.75rem] border focus:ring-4 focus:ring-amber-500/5 outline-none transition-all shadow-lg text-sm sm:text-base font-serif italic placeholder:text-stone-300 ${theme === 'vault' ? 'bg-stone-900 border-white/10 text-white' : 'bg-white border-stone-200 text-stone-900'}`}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8" data-testid="collections-grid">
          {filteredCollections.map((col) => {
            const matchesName = hasSearch && col.name.toLowerCase().includes(normalizedSearch);
            const matchesItems =
              hasSearch &&
              col.items.some((item) => item.title.toLowerCase().includes(normalizedSearch));
            const matchBadge =
              hasSearch && !matchesName && matchesItems ? t('searchItemMatchLabel') : undefined;

            return (
              <CollectionCard
                key={col.id}
                collection={col}
                onClick={() => navigate(`/collection/${col.id}`)}
                matchBadge={matchBadge}
              />
            );
          })}

          {hasSearch && filteredCollections.length === 0 && (
            <div
              className={`col-span-full rounded-[2rem] border p-6 sm:p-8 text-center shadow-sm ${theme === 'vault' ? 'bg-white/5 border-white/10 text-stone-200' : 'bg-white/80 border-stone-100 text-stone-700'}`}
            >
              <p className={`${typographyClasses.titleLarge} italic mb-2`}>
                {t('searchNoResultsTitle')}
              </p>
              <p className={typographyClasses.labelMuted}>
                {t('searchNoResultsBody', { query: searchTerm.trim() })}
              </p>
            </div>
          )}

          {!hasSearch && (
            <button
              onClick={handleCreateCollectionAction}
              className={`group relative p-8 rounded-[2rem] border-2 border-dashed transition-all flex flex-col items-center justify-center min-h-[220px] gap-4 shadow-sm hover:shadow-xl overflow-hidden ${theme === 'vault' ? 'border-white/10 hover:border-amber-400 bg-white/5 text-stone-500' : 'border-stone-200 hover:border-amber-400 bg-white/50 text-stone-400'}`}
            >
              <div className="w-16 h-16 rounded-full bg-stone-50 flex items-center justify-center shadow-inner group-hover:scale-110 group-hover:shadow-lg transition-transform text-stone-300">
                <Plus size={32} strokeWidth={1.5} />
              </div>
              <div className="text-center">
                <span
                  className={`${typographyClasses.titleLarge} italic block mb-1 ${theme === 'vault' ? 'text-white/60' : 'text-stone-400'}`}
                >
                  {t('newArchive')}
                </span>
                <span className={typographyClasses.labelMuted}>{t('expandSpace')}</span>
              </div>
            </button>
          )}
        </div>
      </div>
    );
  };

  const CollectionScreen = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const collection = collections.find((c) => c.id === id);
    const [filter, setFilter] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'waterfall'>('waterfall');
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
    const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
    const [isExhibitionOpen, setIsExhibitionOpen] = useState(false);
    const [isDeleteCollectionModalOpen, setIsDeleteCollectionModalOpen] = useState(false);
    const [visibleCount, setVisibleCount] = useState(60);

    const PAGINATION_THRESHOLD = 120;
    const PAGE_SIZE = 60;

    if (!collection) return <Navigate to="/" replace />;
    const isReadOnly = Boolean(collection.isPublic) && !isAdmin;
    const isSample = Boolean(collection.isPublic) || collection.id.startsWith('sample');
    const canAddItems = !isReadOnly;

    const filteredItems = useMemo(() => {
      return collection.items.filter((item) => {
        const term = filter.toLowerCase();
        const matchesSearch =
          !term ||
          item.title.toLowerCase().includes(term) ||
          item.notes?.toLowerCase().includes(term) ||
          (Object.values(item.data) as any[]).some((val) =>
            String(val).toLowerCase().includes(term),
          );
        const matchesFilters = (Object.entries(activeFilters) as [string, string][]).every(
          ([key, value]) => {
            if (!value) return true;
            if (key === 'rating') return item.rating >= parseInt(value);
            const itemVal = item.data[key];
            if (itemVal === undefined || itemVal === null) return false;
            return String(itemVal).toLowerCase().includes(value.toLowerCase());
          },
        );
        return matchesSearch && matchesFilters;
      });
    }, [collection.items, filter, activeFilters]);

    useEffect(() => {
      setVisibleCount(PAGE_SIZE);
    }, [collection.id, filter, activeFilters]);

    const shouldPaginate = filteredItems.length > PAGINATION_THRESHOLD;
    const visibleItems = shouldPaginate ? filteredItems.slice(0, visibleCount) : filteredItems;
    const canLoadMore = shouldPaginate && visibleCount < filteredItems.length;

    const handleLoadMore = () => {
      setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, filteredItems.length));
    };

    const activeFilterCount = Object.values(activeFilters).filter(Boolean).length;
    const activeFilterEntries = Object.entries(activeFilters).filter(([, value]) => value);

    const getFieldLabel = (fieldId: string) => {
      const fieldKey = `label_${fieldId}` as any;
      const translated = t(fieldKey);
      if (translated === fieldKey) {
        return collection.customFields.find((f) => f.id === fieldId)?.label || fieldId;
      }
      return translated;
    };

    const handleRemoveFilter = (key: string) => {
      setActiveFilters((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    };

    const handleClearFilters = () => setActiveFilters({});

    const handleDeleteCollection = async () => {
      if (!collection || isReadOnly) return;
      try {
        await deleteCollection(collection);
        setCollections((prev) => prev.filter((c) => c.id !== collection.id));
        setIsDeleteCollectionModalOpen(false);
        navigate('/');
        showStatus(t('collectionDeleted'), 'success');
      } catch (e) {
        console.error('Failed to delete collection:', e);
        showStatus('Failed to delete collection', 'error');
      }
    };

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
                    Sample
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
                  onClick={() => setIsAddModalOpen(true)}
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
              <div
                className="w-full sm:w-auto"
                title={!isVoiceGuideEnabled ? t('comingSoon') : undefined}
              >
                <Button
                  variant="outline"
                  className={`${theme === 'vault' ? 'bg-stone-900 text-white border-white/10' : 'bg-white'} w-full sm:w-auto`}
                  onClick={() => {
                    if (isVoiceGuideEnabled) {
                      setActiveCollectionForGuide(collection);
                      setIsGuideOpen(true);
                    }
                  }}
                  disabled={!isVoiceGuideEnabled || collection.items.length === 0}
                  icon={<Mic size={16} />}
                >
                  {t('vocalGuide')}
                  {!isVoiceGuideEnabled && (
                    <span
                      className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        theme === 'vault'
                          ? 'bg-white/10 text-white/70'
                          : 'bg-stone-100 text-stone-500'
                      }`}
                    >
                      {t('comingSoon')}
                    </span>
                  )}
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full">
              {!isReadOnly && (
                <button
                  onClick={() => setIsDeleteCollectionModalOpen(true)}
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
              <div
                className={`flex rounded-xl p-1 ${theme === 'vault' ? 'bg-white/5' : 'bg-stone-200/50'}`}
              >
                <button
                  onClick={() => setViewMode('grid')}
                  className={`w-11 h-11 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}
                >
                  <LayoutGrid size={18} />
                </button>
                <button
                  onClick={() => setViewMode('waterfall')}
                  className={`w-11 h-11 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg transition-all ${viewMode === 'waterfall' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}
                >
                  <LayoutTemplate size={18} className="rotate-180" />
                </button>
              </div>
              <div className="relative flex gap-2 flex-1 min-w-[12rem]">
                <input
                  type="text"
                  placeholder="..."
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className={`pl-4 pr-4 py-2 rounded-xl border focus:ring-4 focus:ring-amber-500/5 outline-none text-sm w-full transition-all shadow-sm font-serif italic ${theme === 'vault' ? 'bg-stone-900 border-white/10 text-white' : 'bg-white border-stone-200 text-stone-900'}`}
                />
                <Button
                  variant={activeFilterCount > 0 ? 'primary' : 'outline'}
                  className={`w-11 h-11 sm:w-10 sm:h-10 flex items-center justify-center p-0 rounded-xl ${theme === 'vault' ? 'bg-stone-900 border-white/10' : activeFilterCount > 0 ? '' : 'bg-white'}`}
                  onClick={() => setIsFilterModalOpen(true)}
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
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm bg-amber-50 text-amber-800 border border-amber-100 motion-chip"
                onClick={() => handleRemoveFilter(key)}
                title={t('clearFilter')}
              >
                <span className="font-semibold">{getFieldLabel(key)}</span>
                <span className="text-amber-700/80">·</span>
                <span className="font-medium">{value}</span>
                <X size={14} className="text-amber-600" />
              </button>
            ))}
            <button
              onClick={handleClearFilters}
              className="text-sm font-semibold text-stone-500 hover:text-stone-800 underline decoration-stone-300"
            >
              {t('clearAll')}
            </button>
          </div>
        )}

        {isReadOnly && (
          <p className="text-sm text-amber-600 font-semibold">{t('readOnlyCollectionNote')}</p>
        )}

        {filteredItems.length === 0 ? (
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
            {!isReadOnly && !filter && activeFilterCount === 0 && (
              <Button
                size="lg"
                className="px-12 py-4 text-lg rounded-2xl shadow-xl"
                onClick={() => setIsAddModalOpen(true)}
              >
                {t('catalogFirst')}
              </Button>
            )}
          </div>
        ) : (
          <>
            <div
              className={`${
                viewMode === 'grid'
                  ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 sm:gap-8'
                  : 'columns-1 sm:columns-2 md:columns-3 lg:columns-4 [column-gap:1.5rem] sm:[column-gap:2rem]'
              } w-full`}
              data-testid="items-grid"
            >
              {visibleItems.map((item) => (
                <div
                  key={item.id}
                  className={`break-inside-avoid ${viewMode === 'waterfall' ? 'mb-8 inline-block w-full align-top' : ''}`}
                >
                  <ItemCard
                    item={item}
                    fields={collection.customFields}
                    displayFields={collection.settings.displayFields}
                    badgeFields={collection.settings.badgeFields}
                    onClick={() => navigate(`/collection/${collection.id}/item/${item.id}`)}
                    layout={viewMode === 'grid' ? 'grid' : 'masonry'}
                  />
                </div>
              ))}
            </div>
            {shouldPaginate && (
              <div
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border px-5 py-4 shadow-sm ${theme === 'vault' ? 'bg-white/5 border-white/10 text-white/70' : 'bg-white/70 border-stone-100 text-stone-500'}`}
              >
                <span className="text-sm font-semibold">
                  Showing {visibleItems.length} of {filteredItems.length} items
                </span>
                <Button
                  variant="outline"
                  className={`${theme === 'vault' ? 'bg-stone-900 text-white border-white/10' : 'bg-white'} w-full sm:w-auto`}
                  onClick={handleLoadMore}
                  disabled={!canLoadMore}
                >
                  {canLoadMore ? 'Load more' : 'All items loaded'}
                </Button>
              </div>
            )}
          </>
        )}

        <FilterModal
          isOpen={isFilterModalOpen}
          onClose={() => setIsFilterModalOpen(false)}
          fields={collection.customFields}
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
    const fileInputRef = useRef<HTMLInputElement>(null);

    const collection = collections.find((c) => c.id === id);
    const item = collection?.items.find((i) => i.id === itemId);

    // Check if AI image editing is enabled
    useEffect(() => {
      refreshAiImageEditEnabled().then(setAiImageEditEnabled);
    }, []);

    if (!collection || !item) return <Navigate to={`/collection/${id}`} replace />;
    const isReadOnly = Boolean(collection.isPublic) && !isAdmin;

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

    const handlePhotoUpdate = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (isReadOnly) return;
      const file = e.target.files?.[0];
      if (file) {
        setIsProcessing(true);
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = reader.result as string;
          try {
            await clearEnhancedReference(item.id);
            if (collection.isPublic) {
              updateItem(collection.id, item.id, {
                photoUrl: base64,
                photoEnhancedPath: undefined,
              });
            } else {
              const { original, display } = await processImage(base64);
              await saveAsset(collection.id, item.id, original, display);
              await checkStorageQuota();
              updateItem(collection.id, item.id, {
                photoUrl: 'asset',
                photoEnhancedPath: undefined,
              });
            }
          } catch (err) {
            console.error('Photo update failed', err);
          } finally {
            setIsProcessing(false);
          }
        };
        reader.readAsDataURL(file);
      }
    };

    const getLabel = (fieldId: string) => {
      const fieldKey = `label_${fieldId}` as any;
      const translated = t(fieldKey);
      if (translated === fieldKey) {
        return collection.customFields.find((f) => f.id === fieldId)?.label || fieldId;
      }
      return translated;
    };

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
          className={`max-w-4xl mx-auto rounded-[2rem] sm:rounded-[4rem] border overflow-hidden animate-in zoom-in-95 duration-500 mb-20 ${detailBaseClasses[theme]}`}
          onAnimationEnd={(e) => {
            // Remove animation classes after animation ends to fix fixed positioning in children
            e.currentTarget.classList.remove('animate-in', 'zoom-in-95', 'duration-500');
            e.currentTarget.style.animation = 'none';
          }}
        >
          <div
            className={`relative ${hasPhoto ? 'aspect-[4/5] sm:aspect-[16/9] md:aspect-[21/9]' : 'h-32 sm:h-48'} bg-stone-950 group transition-all duration-700 ease-in-out`}
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
                  className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${hasPhoto ? 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100' : 'opacity-100'}`}
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
              className={`absolute top-4 left-4 sm:top-8 sm:left-8 w-10 h-10 sm:w-14 sm:h-14 backdrop-blur-md rounded-xl sm:rounded-2xl flex items-center justify-center shadow-xl transition-all hover:scale-105 z-10 ${theme === 'vault' ? 'bg-white/10 text-white' : 'bg-white/80 text-stone-800'}`}
            >
              <ArrowLeft size={20} className="sm:w-6 sm:h-6" />
            </button>

            <div className="absolute top-4 right-4 sm:top-8 sm:right-8 flex gap-2 sm:gap-4 z-10">
              {/* Enhance Image Button - only show when AI is enabled, not read-only, and has photo */}
              {aiImageEditEnabled && !isReadOnly && isAssetPhoto && (
                <button
                  onClick={() => setIsEnhanceOpen(true)}
                  className={`w-10 h-10 sm:w-14 sm:h-14 backdrop-blur-md rounded-xl sm:rounded-2xl flex items-center justify-center shadow-xl transition-all hover:scale-105 ${theme === 'vault' ? 'bg-white/10 text-white' : 'bg-white/80 text-stone-800'}`}
                  title={t('enhanceImage')}
                >
                  <Sparkles size={20} className="sm:w-6 sm:h-6" />
                </button>
              )}
              <button
                onClick={() => setIsExportOpen(true)}
                className={`w-10 h-10 sm:w-14 sm:h-14 backdrop-blur-md rounded-xl sm:rounded-2xl flex items-center justify-center shadow-xl transition-all hover:scale-105 ${theme === 'vault' ? 'bg-white/10 text-white' : 'bg-white/80 text-stone-800'}`}
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
                <input
                  type="text"
                  className={`${typographyClasses.titleDisplay} mb-4 sm:mb-6 w-full bg-transparent border-b-2 border-transparent focus:border-amber-100 outline-none transition-all placeholder:italic ${theme === 'vault' ? 'text-white' : 'text-stone-900'} ${isReadOnly ? 'cursor-not-allowed opacity-70' : ''}`}
                  value={item.title}
                  onChange={(e) => updateItem(collection.id, item.id, { title: e.target.value })}
                  placeholder="..."
                  disabled={isReadOnly}
                />
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => updateItem(collection.id, item.id, { rating: star })}
                      className={`transition-transform ${isReadOnly ? 'cursor-not-allowed opacity-70' : 'hover:scale-125'}`}
                      disabled={isReadOnly}
                    >
                      <span className="text-2xl sm:text-4xl">
                        {star <= item.rating ? (
                          <span className="text-amber-500">★</span>
                        ) : (
                          <span className="text-amber-500/20">★</span>
                        )}
                      </span>
                    </button>
                  ))}
                  <span className={`ml-3 sm:ml-4 ${typographyClasses.label} text-stone-300`}>
                    {t('registryQuality')}
                  </span>
                  {isReadOnly && (
                    <span className="ml-2 text-[12px] text-amber-500 font-semibold">
                      {t('readOnlyControls')}
                    </span>
                  )}
                </div>
              </div>
              {!isReadOnly && (
                <button
                  onClick={handleDelete}
                  className="text-stone-200 hover:text-red-400 transition-colors p-3 sm:p-4 rounded-full hover:bg-red-50 shrink-0"
                >
                  <Trash2 size={20} className="sm:w-6 sm:h-6" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 sm:gap-16">
              <div className="lg:col-span-2 space-y-6">
                <div className={`flex flex-wrap items-center gap-3 ${accentColorClasses[theme]}`}>
                  <Quote size={18} fill="currentColor" className="opacity-20 sm:w-5 sm:h-5" />
                  <dt
                    className={`min-w-0 ${typographyClasses.label} ${labelColorClasses[theme]} break-words`}
                  >
                    {t('archiveNarrative')}
                  </dt>
                </div>
                <textarea
                  className={`w-full p-6 sm:p-8 rounded-2xl sm:rounded-[2.5rem] italic border font-serif text-xl sm:text-2xl leading-relaxed min-h-[200px] sm:min-h-[240px] focus:ring-8 focus:ring-amber-500/5 focus:border-amber-100 outline-none transition-all shadow-inner placeholder:text-stone-200 ${theme === 'vault' ? 'bg-white/5 border-white/5 text-white' : 'bg-stone-50/50 border-stone-100 text-stone-800'} ${isReadOnly ? 'cursor-not-allowed opacity-70' : ''}`}
                  value={item.notes}
                  onChange={(e) => updateItem(collection.id, item.id, { notes: e.target.value })}
                  placeholder={t('provenancePlaceholder')}
                  disabled={isReadOnly}
                />
              </div>

              <div className="space-y-8 sm:space-y-10">
                <dt
                  className={`${typographyClasses.label} pb-3 sm:pb-4 border-b break-words leading-tight ${theme === 'vault' ? 'text-stone-500 border-white/5' : `${labelColorClasses[theme]} ${dividerClasses[theme]}`}`}
                >
                  {t('technicalSpec')}
                </dt>
                <div className="grid grid-cols-2 lg:grid-cols-1 gap-6 sm:gap-8">
                  {collection.customFields.map((field) => {
                    const val = item.data[field.id];
                    const label = getLabel(field.id);
                    return (
                      <div key={field.id} className="group">
                        <dt
                          className={`${typographyClasses.label} text-stone-300 mb-1 sm:mb-2 group-hover:text-amber-500 transition-colors break-words leading-tight`}
                        >
                          {label}
                        </dt>
                        <input
                          className={`${typographyClasses.title} w-full bg-transparent border-none p-0 outline-none focus:text-amber-900 focus:ring-0 transition-colors placeholder:text-stone-100 ${theme === 'vault' ? 'text-white' : 'text-stone-900'} ${isReadOnly ? 'cursor-not-allowed opacity-70' : ''}`}
                          value={val || ''}
                          placeholder="—"
                          onChange={(e) => {
                            const newData = {
                              ...item.data,
                              [field.id]: e.target.value,
                            };
                            updateItem(collection.id, item.id, { data: newData });
                          }}
                          disabled={isReadOnly}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
        <ExportModal
          isOpen={isExportOpen}
          onClose={() => setIsExportOpen(false)}
          item={item}
          fields={collection.customFields}
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

  const isAuthenticated = Boolean(user);
  const sampleCollection = useMemo(() => collections.find((c) => c.isPublic), [collections]);
  const showAccessGate = !isSupabaseReady || (!isAuthenticated && !allowPublicBrowse);
  const isExploreRoute = location.pathname === '/explore';
  const shouldShowAccessGate = showAccessGate && !isExploreRoute;
  const fallbackSampleCollectionId = fallbackSampleCollections[0]?.id ?? null;
  const sampleCollectionId = sampleCollection?.id ?? fallbackSampleCollectionId;

  const handleExploreSamples = () => {
    setAllowPublicBrowse(true);
    if (isSupabaseReady) {
      refreshCollections();
    }
  };

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
    setIsAddModalOpen(true);
  }, [editableCollections.length, isAuthenticated]);

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
  };

  const handleAuthSuccess = () => {
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
      <div className="max-w-md w-full text-center bg-white/70 border border-stone-200 rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-10 shadow-xl">
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-stone-100 text-stone-500 flex items-center justify-center mx-auto mb-5 sm:mb-6">
          {!authReady && isSupabaseReady ? (
            <Loader2 size={24} className="animate-spin" />
          ) : (
            <Lock size={24} />
          )}
        </div>
        <h1 className="font-serif text-2xl font-bold text-stone-900 mb-2">
          {!authReady && isSupabaseReady
            ? t('authLoading')
            : isSupabaseReady
              ? t('authRequiredTitle')
              : t('cloudRequiredTitle')}
        </h1>
        <p className="text-sm text-stone-500 mb-6">
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
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">
              {t('cloudRequiredAction')}
            </div>
          ) : null}
        </div>
        <p className="text-[12px] text-stone-400 mt-5 leading-relaxed">{t('ctaPromise')}</p>
      </div>
    </div>
  );

  return (
    <div
      className={`min-h-screen transition-colors duration-1000 ${themeColors[theme]}`}
      data-theme={theme}
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
            <button
              onClick={() => setLanguage(language === 'en' ? 'zh' : 'en')}
              className="p-2 hover:bg-stone-100 dark:hover:bg-white/10 rounded-full text-stone-500 hover:text-stone-900 transition-colors flex items-center gap-1 sm:gap-1.5"
              title="Switch Language"
            >
              <Globe size={18} />
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.14em]">
                {language === 'en' ? 'ZH' : 'EN'}
              </span>
            </button>
          </div>
        }
      >
        {shouldShowAccessGate ? (
          renderAccessGate()
        ) : (
          <>
            <Routes>
              <Route path="/" element={<HomeScreen />} />
              <Route
                path="/explore"
                element={
                  <ExplorePlaceholder
                    sampleCollectionId={sampleCollectionId}
                    onExploreSamples={handleExploreSamples}
                  />
                }
              />
              <Route path="/collection/:id" element={<CollectionScreen />} />
              <Route path="/collection/:id/item/:itemId" element={<ItemDetailScreen />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <AddItemModal
              isOpen={isAddModalOpen}
              onClose={() => setIsAddModalOpen(false)}
              collections={editableCollections}
              onSave={handleAddItem}
            />
            <CreateCollectionModal
              isOpen={isCreateCollectionOpen}
              onClose={() => setIsCreateCollectionOpen(false)}
              onCreate={handleCreateCollection}
            />
            {isVoiceGuideEnabled && activeCollectionForGuide && (
              <MuseumGuide
                collection={activeCollectionForGuide}
                isOpen={isGuideOpen}
                onClose={() => setIsGuideOpen(false)}
              />
            )}
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
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <ErrorBoundary>
          <HashRouter>
            <AppContent />
          </HashRouter>
          <SpeedInsights />
          <Analytics />
        </ErrorBoundary>
      </LanguageProvider>
    </ThemeProvider>
  );
};
