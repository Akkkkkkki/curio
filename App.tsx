
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { HashRouter, Routes, Route, useNavigate, useParams, Link, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { CollectionCard } from './components/CollectionCard';
import { ItemCard } from './components/ItemCard';
import { AddItemModal } from './components/AddItemModal';
import { CreateCollectionModal } from './components/CreateCollectionModal';
import { AuthModal } from './components/AuthModal';
import { UserCollection, CollectionItem, AppTheme } from './types';
import { TEMPLATES } from './constants';
import { Plus, SlidersHorizontal, ArrowLeft, Trash2, LayoutGrid, LayoutTemplate, Printer, Camera, Search, Loader2, Sparkles, Mic, Play, Quote, Sparkle, Globe, Calendar, Lock, AlertCircle, X } from 'lucide-react';
import { Button } from './components/ui/Button';
import { fetchCloudCollections, getLocalCollections, hasLocalOnlyData, importLocalCollectionsToCloud, saveCollection, saveAllCollections, saveAsset, deleteAsset, deleteCloudItem, requestPersistence, getSeedVersion, setSeedVersion, initDB } from './services/db';
import { processImage } from './services/imageProcessor';
import { ItemImage } from './components/ItemImage';
import { MuseumGuide } from './components/MuseumGuide';
import { ExhibitionView } from './components/ExhibitionView';
import { ExportModal } from './components/ExportModal';
import { FilterModal } from './components/FilterModal';
import { LanguageProvider, useTranslation } from './i18n';
import { supabase, isSupabaseConfigured, signOutUser } from './services/supabase';
import { ThemeProvider, useTheme } from './theme';
import { StatusToast, StatusTone } from './components/StatusToast';
import { CURRENT_SEED_VERSION, INITIAL_COLLECTIONS } from './services/seedCollections';

const AppContent: React.FC = () => {
  const { t, language, setLanguage } = useTranslation();
  const { theme, setTheme } = useTheme();
  const isVoiceGuideEnabled = import.meta.env.VITE_VOICE_GUIDE_ENABLED === 'true';
  const [collections, setCollections] = useState<UserCollection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
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
  const [activeCollectionForGuide, setActiveCollectionForGuide] = useState<UserCollection | null>(null);
  const [status, setStatus] = useState<{ message: string; tone: StatusTone } | null>(null);
  const [pendingAuthAction, setPendingAuthAction] = useState<'add-item' | 'create-collection' | null>(null);
  const [authActionQueue, setAuthActionQueue] = useState<'add-item' | 'create-collection' | null>(null);
  const saveTimeoutRef = useRef<Record<string, any>>({});
  const statusTimeoutRef = useRef<number | null>(null);
  const isSupabaseReady = isSupabaseConfigured();
  const fallbackSampleCollections = useMemo(() => (
    INITIAL_COLLECTIONS.map(collection => ({
      ...collection,
      isPublic: true,
      ownerId: collection.ownerId || null,
    }))
  ), []);

  const showStatus = useCallback((message: string, tone: StatusTone = 'info') => {
    if (statusTimeoutRef.current) {
      clearTimeout(statusTimeoutRef.current);
    }
    setStatus({ message, tone });
    statusTimeoutRef.current = window.setTimeout(() => setStatus(null), 2400);
  }, []);

  useEffect(() => {
    return () => {
      if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseReady || !supabase) {
      setUser(null);
      setAuthReady(true);
      return;
    }

    let unsubscribe: (() => void) | undefined;
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user || null);
      } catch (e) {
        console.warn('Auth init failed:', e);
        setUser(null);
      } finally {
        setAuthReady(true);
      }

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
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
      return () => { isMounted = false; };
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
    return () => { isMounted = false; };
  }, [isSupabaseReady, user]);

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
      console.error("Initialization failed:", e);
      setLoadError('Failed to load collections. Please try again.');
      showStatus(t('statusSyncPaused'), 'error');
      setCollections([]);
    } finally {
      setIsLoading(false);
    }
  }, [user, isAdmin, isSupabaseReady, withTimeout, fallbackSampleCollections, t, showStatus]);

  useEffect(() => {
    if (!isSupabaseReady) {
      setCollections([]);
      setIsLoading(false);
      setHasLocalImport(false);
      setImportState('idle');
      setImportMessage(null);
      return;
    }
    refreshCollections();
  }, [isSupabaseReady, user, refreshCollections]);

  useEffect(() => {
    if (!user && collections.some(c => c.isPublic)) {
      setAllowPublicBrowse(true);
    }
  }, [collections, user]);

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
      saveCollection(collection).catch(err => console.warn('Sync failed', err));
    }, 1500);
  }, []);

  const canEditCollection = useCallback((collectionId: string) => {
    const target = collections.find(c => c.id === collectionId);
    if (!target) return false;
    return !target.isPublic || isAdmin;
  }, [collections, isAdmin]);

  const handleAddItem = async (collectionId: string, itemData: Omit<CollectionItem, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!canEditCollection(collectionId)) return;
    const itemId = Math.random().toString(36).substr(2, 9);
    const now = new Date().toISOString();
    let hasPhoto = false;
    const targetCollection = collections.find(c => c.id === collectionId);
    const isPublicCollection = Boolean(targetCollection?.isPublic);

    if (!isPublicCollection && itemData.photoUrl.startsWith('data:')) {
      try {
        const { original, display } = await processImage(itemData.photoUrl);
        await saveAsset(collectionId, itemId, original, display);
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

    setCollections(prev => {
      return prev.map(c => {
        if (c.id === collectionId) {
          const newC = { ...c, items: [newItem, ...c.items], updatedAt: now };
          saveCollection(newC); 
          return newC;
        }
        return c;
      });
    });
    showStatus(t('statusSaved'), 'success');
  };

  const updateItem = (collectionId: string, itemId: string, updates: Partial<CollectionItem>) => {
    if (!canEditCollection(collectionId)) return;
    const now = new Date().toISOString();
    setCollections(prev => prev.map(c => {
      if (c.id === collectionId) {
        const newC = {
          ...c,
          updatedAt: now,
          items: c.items.map(item => item.id === itemId ? { ...item, ...updates, updatedAt: now } : item)
        };
        debouncedSaveCollection(newC);
        return newC;
      }
      return c;
    }));
  };

  const handleCreateCollection = (templateId: string, name: string, icon: string) => {
      if (!isAuthenticated) {
        setPendingAuthAction('create-collection');
        setIsAuthModalOpen(true);
        setIsCreateCollectionOpen(false);
        return;
      }
      const template = TEMPLATES.find(t => t.id === templateId) || TEMPLATES[0];
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
          settings: { displayFields: template.displayFields, badgeFields: template.badgeFields }
      };
      setCollections(prev => {
        const updated = [...prev, newCol];
        saveCollection(newCol);
        return updated;
      });
      showStatus(t('statusSaved'), 'success');
  };

  const deleteItem = (collectionId: string, itemId: string) => {
      if (!canEditCollection(collectionId)) return false;
      if (confirm(t('deleteConfirm'))) {
          setCollections(prev => prev.map(c => {
              if (c.id === collectionId) {
                  const newC = { ...c, items: c.items.filter(i => i.id !== itemId) };
                  saveCollection(newC);
                  deleteAsset(collectionId, itemId);
                  void deleteCloudItem(collectionId, itemId);
                  return newC;
              }
              return c;
          }));
          return true;
      }
      return false;
  };

  const stats = useMemo(() => {
    const statCollections = collections.filter(c => !c.isPublic);
    const totalItems = statCollections.reduce((acc, c) => acc + c.items.length, 0);
    const avgRating = totalItems > 0 
      ? (statCollections.reduce((acc, c) => acc + c.items.reduce((iacc, i) => iacc + i.rating, 0), 0) / totalItems).toFixed(1)
      : 0;
    const allItems = statCollections.flatMap(c => c.items);
    const featured = allItems.length > 0 ? allItems[Math.floor(Math.random() * allItems.length)] : null;
    
    // Archeology: Find item added on this day in past
    const now = new Date();
    const historyItem = allItems.find(i => {
       const d = new Date(i.createdAt);
       return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() < now.getFullYear();
    }) || allItems[0];

    return { totalItems, avgRating, totalCollections: statCollections.length, featured, historyItem };
  }, [collections]);

  const editableCollections = useMemo(() => {
    return collections.filter(c => !c.isPublic || isAdmin);
  }, [collections, isAdmin]);

  const HomeScreen = () => {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');

    const filteredCollections = collections.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.items.some(i => i.title.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (isLoading) return (
      <div className="flex flex-col items-center justify-center py-32">
        <Loader2 className="text-stone-300 animate-spin mb-4" size={32} />
        <p className="text-stone-400 font-serif italic">{t('restoringArchives')}</p>
      </div>
    );

    if (loadError) return (
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
        gallery: "bg-white text-stone-900 border-stone-100",
        vault: "bg-stone-950 text-white border-white/5",
        atelier: "bg-[#faf9f6] text-stone-800 border-[#e8e6e1] shadow-inner",
    };

    return (
      <div className={`space-y-10 sm:space-y-12 animate-in fade-in duration-700`}>
        {editableCollections.length === 0 && (
          <div className={`rounded-[2rem] border p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm motion-pop ${theme === 'vault' ? 'bg-white/5 border-white/10' : 'bg-white/80 border-stone-100'}`}>
            <div>
              <p className={`text-sm font-semibold ${theme === 'vault' ? 'text-white' : 'text-stone-900'}`}>{t('ctaAddFirst')}</p>
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
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className={`md:col-span-2 relative overflow-hidden rounded-[2rem] sm:rounded-[2.25rem] min-h-[280px] sm:min-h-[360px] flex items-center shadow-xl border transition-all duration-700 ${themeBaseClasses[theme]} group`}>
                {stats.featured && (
                    <div className="absolute inset-0 opacity-30 group-hover:opacity-25 transition-opacity duration-700">
                        <ItemImage 
                            itemId={stats.featured.id} 
                            collectionId={stats.featured.collectionId}
                            photoUrl={stats.featured.photoUrl} 
                            type="display" 
                            className="w-full h-full object-cover scale-105 group-hover:scale-100 transition-transform duration-[20s] ease-out" 
                        />
                    </div>
                )}
                <div className={`absolute inset-0 bg-gradient-to-r ${theme === 'vault' ? 'from-stone-950 via-stone-900/50' : theme === 'atelier' ? 'from-[#faf9f6] via-[#faf9f6]/60' : 'from-white via-white/60'} to-transparent`}></div>
                
                <div className="relative z-10 p-6 sm:p-10 lg:p-12 max-w-xl">
                    <div className="flex items-center gap-2 mb-3 sm:mb-4">
                       <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                       <span className="text-[11px] font-mono tracking-[0.28em] uppercase text-amber-600 font-bold">{t('featuredArtifact')}</span>
                    </div>
                    <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold mb-3 sm:mb-4 tracking-tight leading-tight">
                        {t('appTitle')} <span className="opacity-40 italic font-light">{t('appSubtitle')}</span>
                    </h1>
                    <p className="text-sm sm:text-base md:text-lg font-light leading-relaxed mb-6 sm:mb-8 max-w-sm font-serif italic opacity-80">
                        {t('heroSubtitle')}
                    </p>

                    <div className="flex gap-6 sm:gap-8 pt-6 sm:pt-8 border-t border-black/5 dark:border-white/5">
                        <div className="space-y-1">
                            <p className="text-xl font-serif font-bold">{stats.totalItems}</p>
                            <p className="text-[11px] font-mono uppercase tracking-[0.18em] opacity-40">{t('artifacts')}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-xl font-serif font-bold">{stats.totalCollections}</p>
                            <p className="text-[11px] font-mono uppercase tracking-[0.18em] opacity-40">{t('archives')}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Archeology Bento Card */}
            <div className={`relative overflow-hidden rounded-[2rem] p-6 sm:p-7 border flex flex-col justify-between transition-all duration-500 ${themeBaseClasses[theme]} shadow-md`}>
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <div className="p-2 bg-amber-50 rounded-xl text-amber-600"><Calendar size={18}/></div>
                    <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-stone-400">{t('onThisDay')}</span>
                </div>
                {stats.historyItem ? (
                    <div className="space-y-4">
                        <div className="aspect-square rounded-2xl overflow-hidden bg-stone-100 shadow-inner">
                            <ItemImage itemId={stats.historyItem.id} collectionId={stats.historyItem.collectionId} photoUrl={stats.historyItem.photoUrl} className="w-full h-full object-cover" />
                        </div>
                        <div>
                            <p className="text-[11px] font-mono opacity-40 uppercase tracking-[0.18em] mb-1">{t('historyTitle')}</p>
                            <h4 className="font-serif font-bold text-lg leading-tight truncate">{stats.historyItem.title}</h4>
                        </div>
                        <Button variant="ghost" size="sm" className="w-full" onClick={() => navigate(`/collection/${stats.historyItem?.collectionId}/item/${stats.historyItem?.id}`)}>{t('viewHistory') || "Relive Memory"}</Button>
                    </div>
                ) : (
                    <div className="h-full flex items-center justify-center italic text-stone-300 font-serif">Awaiting history...</div>
                )}
            </div>
        </section>

        <div className="relative max-w-xl mx-auto -mt-6 sm:-mt-10 z-20 px-4">
            <div className="relative">
                <Search className="absolute left-5 sm:left-6 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
                <input 
                  type="text" 
                  placeholder={t('searchPlaceholder')}
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className={`w-full pl-12 sm:pl-14 pr-6 sm:pr-8 py-3.5 sm:py-4 rounded-[1.5rem] sm:rounded-[1.75rem] border focus:ring-4 focus:ring-amber-500/5 outline-none transition-all shadow-lg text-sm sm:text-base font-serif italic placeholder:text-stone-300 ${theme === 'vault' ? 'bg-stone-900 border-white/10 text-white' : 'bg-white border-stone-200 text-stone-900'}`}
                />
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {filteredCollections.map(col => (
            <CollectionCard 
              key={col.id} 
              collection={col} 
              onClick={() => navigate(`/collection/${col.id}`)} 
            />
          ))}
          
          <button 
            onClick={handleCreateCollectionAction}
            className={`group relative p-8 rounded-[2rem] border-2 border-dashed transition-all flex flex-col items-center justify-center min-h-[220px] gap-4 shadow-sm hover:shadow-xl overflow-hidden ${theme === 'vault' ? 'border-white/10 hover:border-amber-400 bg-white/5 text-stone-500' : 'border-stone-200 hover:border-amber-400 bg-white/50 text-stone-400'}`}
          >
            <div className="w-16 h-16 rounded-full bg-stone-50 flex items-center justify-center shadow-inner group-hover:scale-110 group-hover:shadow-lg transition-transform text-stone-300">
                <Plus size={32} strokeWidth={1.5} />
            </div>
            <div className="text-center">
               <span className={`font-serif text-2xl font-bold italic tracking-tight block mb-1 ${theme === 'vault' ? 'text-white/60' : 'text-stone-400'}`}>{t('newArchive')}</span>
               <span className="text-[10px] font-mono uppercase tracking-[0.2em] opacity-60">{t('expandSpace')}</span>
            </div>
          </button>
        </div>
      </div>
    );
  };

  const CollectionScreen = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const collection = collections.find(c => c.id === id);
    const [filter, setFilter] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'waterfall'>('waterfall');
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
    const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
    const [isExhibitionOpen, setIsExhibitionOpen] = useState(false);

    if (!collection) return <Navigate to="/" replace />;
    const isReadOnly = Boolean(collection.isPublic) && !isAdmin;
    const isSample = Boolean(collection.isPublic) || collection.id.startsWith('sample');
    const canAddItems = !isReadOnly;

    const filteredItems = collection.items.filter(item => {
        const term = filter.toLowerCase();
        const matchesSearch = !term || (
            item.title.toLowerCase().includes(term) ||
            item.notes?.toLowerCase().includes(term) ||
            (Object.values(item.data) as any[]).some(val => String(val).toLowerCase().includes(term))
        );
        const matchesFilters = (Object.entries(activeFilters) as [string, string][]).every(([key, value]) => {
            if (!value) return true;
            if (key === 'rating') return item.rating >= parseInt(value);
            const itemVal = item.data[key];
            if (itemVal === undefined || itemVal === null) return false;
            return String(itemVal).toLowerCase().includes(value.toLowerCase());
        });
        return matchesSearch && matchesFilters;
    });

    const activeFilterCount = Object.values(activeFilters).filter(Boolean).length;
    const activeFilterEntries = Object.entries(activeFilters).filter(([, value]) => value);

    const getFieldLabel = (fieldId: string) => {
      const fieldKey = `label_${fieldId}` as any;
      const translated = t(fieldKey);
      if (translated === fieldKey) {
        return collection.customFields.find(f => f.id === fieldId)?.label || fieldId;
      }
      return translated;
    };

    const handleRemoveFilter = (key: string) => {
      setActiveFilters(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    };

    const handleClearFilters = () => setActiveFilters({});

    return (
      <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-500">
        {isReadOnly && (
          <div className={`flex items-center gap-3 p-4 rounded-2xl border shadow-sm ${theme === 'vault' ? 'bg-white/5 border-white/10' : 'bg-white/80 border-stone-100'}`}>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-700 shadow-inner">
              <Lock size={16} />
            </div>
            <div>
              <p className={`text-sm font-semibold ${theme === 'vault' ? 'text-white' : 'text-stone-900'}`}>{t('readOnlyMode')}</p>
              <p className="text-xs text-stone-500">{t('readOnlyCollectionDesc')}</p>
            </div>
          </div>
        )}

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
            <div className="flex items-center gap-4 sm:gap-6">
                <Link to="/" className={`w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center border rounded-2xl shadow-md transition-all hover:scale-105 active:scale-95 ${theme === 'vault' ? 'bg-stone-900 border-white/5 text-stone-400' : 'bg-white border-stone-100 text-stone-400'}`}>
                    <ArrowLeft size={20} className="sm:w-6 sm:h-6" />
                </Link>
                <div>
                    <h1 className={`text-3xl sm:text-4xl md:text-5xl font-serif font-bold tracking-tight mb-2 ${theme === 'vault' ? 'text-white' : 'text-stone-900'}`}>{collection.name}</h1>
                    <div className="flex items-center gap-4">
                        <span className="text-stone-400 font-serif text-lg italic">
                          {t('artifactsCataloged', { n: collection.items.length })}
                        </span>
                        {isSample && (
                          <span className="text-[12px] sm:text-[11px] font-mono tracking-[0.2em] bg-white/40 text-stone-500 px-1.5 py-0.5 rounded border border-black/5 uppercase font-bold">
                            Sample
                          </span>
                        )}
                        {collection.isLocked && <Lock size={16} className="text-amber-500" />}
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
                 {canAddItems && (
                   <Button 
                     variant="primary"
                     onClick={() => setIsAddModalOpen(true)} 
                     icon={<Plus size={16} />}
                     className="shadow-md"
                   >
                     {t('addItem')}
                   </Button>
                 )}
                 <Button 
                   variant="primary" 
                   onClick={() => setIsExhibitionOpen(true)} 
                   disabled={collection.items.length === 0}
                   icon={<Play size={16} />}
                   className="shadow-md"
                 >
                   {t('enterExhibition')}
                 </Button>
                 <Button 
                   variant="outline" 
                   className={theme === 'vault' ? 'bg-stone-900 text-white border-white/10' : 'bg-white'}
                   onClick={() => { if (isVoiceGuideEnabled) { setActiveCollectionForGuide(collection); setIsGuideOpen(true); } }}
                   disabled={!isVoiceGuideEnabled || collection.items.length === 0}
                   icon={<Mic size={16} />}
                   title={isVoiceGuideEnabled ? undefined : 'Coming soon'}
                 >
                   {t('vocalGuide')}
                 </Button>
                 <div className={`flex rounded-xl p-1 ${theme === 'vault' ? 'bg-white/5' : 'bg-stone-200/50'}`}>
                    <button onClick={() => setViewMode('grid')} className={`w-11 h-11 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}><LayoutGrid size={18} /></button>
                    <button onClick={() => setViewMode('waterfall')} className={`w-11 h-11 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg transition-all ${viewMode === 'waterfall' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}><LayoutTemplate size={18} className="rotate-180" /></button>
                 </div>
                 <div className="relative flex gap-2">
                    <input type="text" placeholder="..." value={filter} onChange={e => setFilter(e.target.value)} className={`pl-4 pr-4 py-2 rounded-xl border focus:ring-4 focus:ring-amber-500/5 outline-none text-sm w-48 transition-all shadow-sm font-serif italic ${theme === 'vault' ? 'bg-stone-900 border-white/10 text-white' : 'bg-white border-stone-200 text-stone-900'}`} />
                    <Button variant={activeFilterCount > 0 ? 'primary' : 'outline'} className={`w-11 h-11 sm:w-10 sm:h-10 flex items-center justify-center p-0 rounded-xl ${theme === 'vault' ? 'bg-stone-900 border-white/10' : (activeFilterCount > 0 ? '' : 'bg-white')}`} onClick={() => setIsFilterModalOpen(true)}>
                        <SlidersHorizontal size={18} />
                    </Button>
                </div>
            </div>
        </div>

        {activeFilterEntries.length > 0 && (
          <div className="flex items-center flex-wrap gap-2 mt-2 mb-1">
            <span className={`text-sm font-semibold ${theme === 'vault' ? 'text-white/70' : 'text-stone-500'}`}>{t('activeFilters')}</span>
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
            <button onClick={handleClearFilters} className="text-sm font-semibold text-stone-500 hover:text-stone-800 underline decoration-stone-300">
              {t('clearAll')}
            </button>
          </div>
        )}

        {isReadOnly && (
          <p className="text-sm text-amber-600 font-semibold">{t('readOnlyCollectionNote')}</p>
        )}

        {filteredItems.length === 0 ? (
             <div className={`text-center py-32 rounded-[3rem] border shadow-sm ${theme === 'vault' ? 'bg-white/5 border-white/5' : 'bg-white/50 border-stone-100'}`}>
                 <div className="text-8xl mb-8 grayscale opacity-10">🏛️</div>
                 <h3 className={`text-3xl font-serif font-bold mb-2 italic tracking-tight ${theme === 'vault' ? 'text-white' : 'text-stone-800'}`}>{t('galleryAwaits')}</h3>
                 <p className={`${theme === 'vault' ? 'text-white/60' : 'text-stone-400'} mb-10 max-w-sm mx-auto leading-relaxed font-serif text-lg`}>{t('museumDefinition')}</p>
                 {!isReadOnly && !filter && activeFilterCount === 0 && (
                   <Button size="lg" className="px-12 py-4 text-lg rounded-2xl shadow-xl" onClick={() => setIsAddModalOpen(true)}>
                     {t('catalogFirst')}
                   </Button>
                 )}
             </div>
        ) : (
            <div
              className={`${
                viewMode === 'grid'
                  ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 sm:gap-8'
                  : 'columns-1 sm:columns-2 md:columns-3 lg:columns-4 [column-gap:1.5rem] sm:[column-gap:2rem]'
              } w-full`}
            >
                {filteredItems.map(item => (
                    <div
                      key={item.id}
                      className={`break-inside-avoid ${viewMode === 'waterfall' ? 'mb-8 inline-block w-full align-top' : ''}`}
                    >
                         <ItemCard item={item} fields={collection.customFields} displayFields={collection.settings.displayFields} badgeFields={collection.settings.badgeFields} onClick={() => navigate(`/collection/${collection.id}/item/${item.id}`)} layout={viewMode === 'grid' ? 'grid' : 'masonry'} />
                    </div>
                ))}
            </div>
        )}
        
        <FilterModal isOpen={isFilterModalOpen} onClose={() => setIsFilterModalOpen(false)} fields={collection.customFields} activeFilters={activeFilters} onApply={setActiveFilters} />
        <ExhibitionView isOpen={isExhibitionOpen} collection={collection} onClose={() => setIsExhibitionOpen(false)} />
      </div>
    );
  };

  const ItemDetailScreen = () => {
      const { id, itemId } = useParams<{ id: string; itemId: string }>();
      const navigate = useNavigate();
      const [isExportOpen, setIsExportOpen] = useState(false);
      const [isProcessing, setIsProcessing] = useState(false);
      const fileInputRef = useRef<HTMLInputElement>(null);
      
      const collection = collections.find(c => c.id === id);
      const item = collection?.items.find(i => i.id === itemId);

      if (!collection || !item) return <Navigate to={`/collection/${id}`} replace />;
      const isReadOnly = Boolean(collection.isPublic) && !isAdmin;

      const handleDelete = () => {
          if (isReadOnly) return;
          if (confirm(t('deleteConfirm'))) {
              if (deleteItem(collection.id, item.id)) {
                  navigate(`/collection/${collection.id}`);
              }
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
                    if (collection.isPublic) {
                        updateItem(collection.id, item.id, { photoUrl: base64 });
                    } else {
                        const { original, display } = await processImage(base64);
                        await saveAsset(collection.id, item.id, original, display);
                        updateItem(collection.id, item.id, { photoUrl: 'asset' });
                    }
                } catch (err) {
                    console.error("Photo update failed", err);
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
            return collection.customFields.find(f => f.id === fieldId)?.label || fieldId;
        }
        return translated;
      };

      const hasPhoto = item.photoUrl && item.photoUrl !== '';

      const detailBaseClasses = {
        gallery: "bg-white text-stone-900 border-stone-100 shadow-2xl",
        vault: "bg-stone-950 text-white border-white/5 shadow-black/50 shadow-2xl",
        atelier: "bg-[#faf9f6] text-stone-800 border-[#e8e6e1] shadow-xl",
      };

      return (
          <div className={`max-w-4xl mx-auto rounded-[2rem] sm:rounded-[4rem] border overflow-hidden animate-in zoom-in-95 duration-500 mb-20 ${detailBaseClasses[theme]}`}>
              <div className={`relative ${hasPhoto ? 'aspect-[4/5] sm:aspect-[16/9] md:aspect-[21/9]' : 'h-32 sm:h-48'} bg-stone-950 group transition-all duration-700 ease-in-out`}>
                  <ItemImage 
                    itemId={item.id} 
                    collectionId={collection.id}
                    photoUrl={item.photoUrl} 
                    alt={item.title} 
                    type="original" 
                    className="w-full h-full object-cover transition-transform duration-[10s] group-hover:scale-110 opacity-80" 
                  />
                  
                  <div className="absolute inset-0 bg-gradient-to-t from-stone-950/60 to-transparent"></div>

                  {!isReadOnly && (
                    <>
                      <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${hasPhoto ? 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100' : 'opacity-100'}`}>
                          <button disabled={isProcessing} onClick={() => fileInputRef.current?.click()} className="bg-white/90 hover:bg-white text-stone-900 px-6 sm:px-8 py-2 sm:py-3 rounded-full font-bold shadow-2xl backdrop-blur-md transition-all hover:scale-105 flex items-center gap-2 sm:gap-3 disabled:opacity-50 text-xs sm:text-sm">
                            {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                            {t('updatePhoto')}
                          </button>
                      </div>
                      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpdate} />
                    </>
                  )}
                  
                  <button onClick={() => navigate(-1)} className={`absolute top-4 left-4 sm:top-8 sm:left-8 w-10 h-10 sm:w-14 sm:h-14 backdrop-blur-md rounded-xl sm:rounded-2xl flex items-center justify-center shadow-xl transition-all hover:scale-105 z-10 ${theme === 'vault' ? 'bg-white/10 text-white' : 'bg-white/80 text-stone-800'}`}><ArrowLeft size={20} className="sm:w-6 sm:h-6" /></button>
                  
                  <div className="absolute top-4 right-4 sm:top-8 sm:right-8 flex gap-2 sm:gap-4 z-10">
                     <button onClick={() => setIsExportOpen(true)} className={`w-10 h-10 sm:w-14 sm:h-14 backdrop-blur-md rounded-xl sm:rounded-2xl flex items-center justify-center shadow-xl transition-all hover:scale-105 ${theme === 'vault' ? 'bg-white/10 text-white' : 'bg-white/80 text-stone-800'}`} title={t('exportCard')}><Printer size={20} className="sm:w-6 sm:h-6" /></button>
                  </div>
              </div>

              <div className="p-8 sm:p-12 md:p-20 space-y-10 sm:space-y-12">
                  {isReadOnly && (
                    <div className={`flex items-center gap-3 p-4 rounded-2xl border ${theme === 'vault' ? 'bg-white/5 border-white/10' : 'bg-stone-50 border-stone-100'}`}>
                      <div className="p-2 rounded-xl bg-amber-50 text-amber-700 shadow-inner">
                        <Lock size={16} />
                      </div>
                      <div>
                        <p className={`text-sm font-semibold ${theme === 'vault' ? 'text-white' : 'text-stone-900'}`}>{t('readOnlyMode')}</p>
                        <p className="text-xs text-stone-500">{t('readOnlyItemDesc')}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex flex-col md:flex-row justify-between items-start gap-8 sm:gap-12">
                      <div className="flex-1 w-full">
                          <input 
                            type="text" 
                            className={`text-3xl sm:text-5xl md:text-6xl font-serif font-bold mb-4 sm:mb-6 w-full bg-transparent border-b-2 border-transparent focus:border-amber-100 outline-none transition-all placeholder:italic tracking-tight ${theme === 'vault' ? 'text-white' : 'text-stone-900'} ${isReadOnly ? 'cursor-not-allowed opacity-70' : ''}`}
                            value={item.title}
                            onChange={(e) => updateItem(collection.id, item.id, { title: e.target.value })}
                            placeholder="..."
                            disabled={isReadOnly}
                          />
                          <div className="flex items-center gap-2">
                              {[1,2,3,4,5].map((star) => (
                                <button
                                  key={star}
                                  onClick={() => updateItem(collection.id, item.id, { rating: star })}
                                  className={`transition-transform ${isReadOnly ? 'cursor-not-allowed opacity-70' : 'hover:scale-125'}`}
                                  disabled={isReadOnly}
                                >
                                    <span className="text-2xl sm:text-4xl">{star <= item.rating ? <span className="text-amber-400">★</span> : <span className="text-stone-100/10">★</span>}</span>
                                </button>
                              ))}
                              <span className="ml-3 sm:ml-4 text-[11px] sm:text-[12px] font-mono tracking-[0.18em] sm:tracking-[0.2em] text-stone-300 uppercase font-bold">{t('registryQuality')}</span>
                              {isReadOnly && (
                                <span className="ml-2 text-[12px] text-amber-500 font-semibold">{t('readOnlyControls')}</span>
                              )}
                          </div>
                      </div>
                      {!isReadOnly && (
                        <button onClick={handleDelete} className="text-stone-200 hover:text-red-400 transition-colors p-3 sm:p-4 rounded-full hover:bg-red-50 shrink-0"><Trash2 size={20} className="sm:w-6 sm:h-6" /></button>
                      )}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 sm:gap-16">
                      <div className="lg:col-span-2 space-y-6">
                        <div className="flex flex-wrap items-center gap-3 text-amber-600">
                             <Quote size={18} fill="currentColor" className="opacity-20 sm:w-5 sm:h-5" />
                             <dt className="min-w-0 text-[11px] sm:text-[12px] font-bold text-stone-400 uppercase tracking-[0.2em] sm:tracking-[0.3em] font-mono break-words">{t('archiveNarrative')}</dt>
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
                          <dt className={`text-[11px] sm:text-[12px] font-bold uppercase tracking-[0.2em] sm:tracking-[0.3em] pb-3 sm:pb-4 border-b font-mono break-words leading-tight ${theme === 'vault' ? 'text-stone-500 border-white/5' : 'text-stone-400 border-stone-100'}`}>{t('technicalSpec')}</dt>
                          <div className="grid grid-cols-2 lg:grid-cols-1 gap-6 sm:gap-8">
                              {collection.customFields.map(field => {
                                  const val = item.data[field.id];
                                  const label = getLabel(field.id);
                                  return (
                                      <div key={field.id} className="group">
                                          <dt className="text-[11px] sm:text-[12px] font-bold text-stone-300 uppercase tracking-2.0 mb-1 sm:mb-2 group-hover:text-amber-500 transition-colors font-mono break-words leading-tight">{label}</dt>
                                          <input 
                                            className={`font-serif text-lg sm:text-xl w-full bg-transparent border-none p-0 outline-none focus:text-amber-900 focus:ring-0 transition-colors placeholder:text-stone-100 ${theme === 'vault' ? 'text-white' : 'text-stone-900'} ${isReadOnly ? 'cursor-not-allowed opacity-70' : ''}`}
                                            value={val || ''}
                                            placeholder="—"
                                            onChange={(e) => {
                                                const newData = { ...item.data, [field.id]: e.target.value };
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
              <ExportModal isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} item={item} fields={collection.customFields} />
          </div>
      );
  };

  const themeColors = {
    gallery: "bg-stone-50",
    vault: "bg-stone-950",
    atelier: "bg-[#faf9f6]",
  };

  const isAuthenticated = Boolean(user);
  const sampleCollection = useMemo(() => collections.find(c => c.isPublic), [collections]);
  const hasPublicCollections = useMemo(() => collections.some(c => c.isPublic), [collections]);
  const showAccessGate = !isSupabaseReady || (!isAuthenticated && !allowPublicBrowse && !hasPublicCollections);
  const sampleCollectionId = sampleCollection?.id ?? null;

  const handleExploreSamples = () => {
    setAllowPublicBrowse(true);
    if (isSupabaseReady) {
      refreshCollections();
    }
  };

  const handleAddAction = () => {
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
  };

  const handleCreateCollectionAction = () => {
    if (!isAuthenticated) {
      setPendingAuthAction('create-collection');
      setIsAuthModalOpen(true);
      return;
    }
    setIsCreateCollectionOpen(true);
  };

  const handleSignOut = async () => {
    await signOutUser();
  };

  const handleAuthClose = () => {
    setIsAuthModalOpen(false);
    setPendingAuthAction(null);
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
    <div className="flex flex-col items-center justify-center px-4 py-16 sm:py-24">
      <div className="max-w-md w-full text-center bg-white/70 border border-stone-200 rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-10 shadow-xl">
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-stone-100 text-stone-500 flex items-center justify-center mx-auto mb-5 sm:mb-6">
          {!authReady && isSupabaseReady ? <Loader2 size={24} className="animate-spin" /> : <Lock size={24} />}
        </div>
        <h2 className="font-serif text-2xl font-bold text-stone-900 mb-2">
          {!authReady && isSupabaseReady ? t('authLoading') : (isSupabaseReady ? t('authRequiredTitle') : t('cloudRequiredTitle'))}
        </h2>
        <p className="text-sm text-stone-500 mb-6">
          {!authReady && isSupabaseReady ? t('authLoadingDesc') : (isSupabaseReady ? t('authRequiredDesc') : t('cloudRequiredDesc'))}
        </p>
        <div className="space-y-2">
          <Button onClick={handleAddAction} size="lg" className="w-full">
            {t('ctaAddFirst')}
          </Button>
          {isSupabaseReady && (
            <Button onClick={handleExploreSamples} size="lg" variant="secondary" className="w-full">
              {t('exploreSample')}
            </Button>
          )}
          {isSupabaseReady && authReady ? (
            <button onClick={() => setIsAuthModalOpen(true)} className="w-full text-sm font-semibold text-stone-500 hover:text-stone-800 py-2">
              {t('authRequiredAction')}
            </button>
          ) : !isSupabaseReady ? (
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
    <div className={`min-h-screen transition-colors duration-1000 ${themeColors[theme]}`}>
        <Layout 
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onSignOut={handleSignOut}
        onAddItem={handleAddAction}
        onExploreSamples={handleExploreSamples}
        sampleCollectionId={sampleCollectionId}
        user={user}
        isSupabaseConfigured={isSupabaseReady}
        hasLocalImport={hasLocalImport}
        importState={importState}
        importMessage={importMessage}
        onImportLocal={handleImportLocal}
        headerExtras={
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
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
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.14em]">{language === 'en' ? 'ZH' : 'EN'}</span>
            </button>
          </div>
        }
        >
        {showAccessGate ? (
          renderAccessGate()
        ) : (
          <>
            <Routes>
                <Route path="/" element={<HomeScreen />} />
                <Route path="/collection/:id" element={<CollectionScreen />} />
                <Route path="/collection/:id/item/:itemId" element={<ItemDetailScreen />} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <AddItemModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} collections={editableCollections} onSave={handleAddItem} />
            <CreateCollectionModal isOpen={isCreateCollectionOpen} onClose={() => setIsCreateCollectionOpen(false)} onCreate={handleCreateCollection} />
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
        {status && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
            <StatusToast message={status.message} tone={status.tone} onDismiss={() => setStatus(null)} />
          </div>
        )}
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
        <HashRouter>
          <AppContent />
        </HashRouter>
      </LanguageProvider>
    </ThemeProvider>
  );
};
