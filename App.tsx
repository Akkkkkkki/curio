
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { HashRouter, Routes, Route, useNavigate, useParams, Link, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { CollectionCard } from './components/CollectionCard';
import { ItemCard } from './components/ItemCard';
import { AddItemModal } from './components/AddItemModal';
import { CreateCollectionModal } from './components/CreateCollectionModal';
import { UserCollection, CollectionItem } from './types';
import { TEMPLATES } from './constants';
import { Plus, SlidersHorizontal, ArrowLeft, Trash2, LayoutGrid, LayoutTemplate, Printer, Camera, Search, Loader2, Sparkles, Mic, Play, Quote, Sparkle, Globe } from 'lucide-react';
import { Button } from './components/ui/Button';
import { loadCollections, saveCollection, saveAllCollections, saveAsset, deleteAsset, requestPersistence, getSeedVersion, setSeedVersion } from './services/db';
import { processImage } from './services/imageProcessor';
import { ItemImage } from './components/ItemImage';
import { MuseumGuide } from './components/MuseumGuide';
import { ExhibitionView } from './components/ExhibitionView';
import { ExportModal } from './components/ExportModal';
import { FilterModal } from './components/FilterModal';
import { LanguageProvider, useTranslation } from './i18n';
import { ensureAuth } from './services/supabase';

const CURRENT_SEED_VERSION = 2;
const SEED_IMAGE_PATH = '/assets/sample-vinyl.jpg';

const INITIAL_COLLECTIONS: UserCollection[] = [
  {
    id: 'sample-vinyl',
    seedKey: 'master_vinyl_seed',
    templateId: 'vinyl',
    name: 'The Vinyl Vault',
    icon: '🎷',
    customFields: TEMPLATES.find(t => t.id === 'vinyl')!.fields,
    items: [
      {
        id: 'seed-vinyl-1',
        seedKey: 'kind_of_blue_seed',
        collectionId: 'sample-vinyl',
        photoUrl: SEED_IMAGE_PATH,
        title: 'Kind of Blue',
        rating: 5,
        data: {
          artist: 'Miles Davis',
          label: 'Columbia',
          year: 1959,
          genre: 'Modal Jazz',
          condition: 'Mint (M)'
        },
        createdAt: new Date().toISOString(),
        notes: "The definitive masterpiece of modal jazz. This specific 180g pressing captures every breath of Miles' trumpet and the delicate touch of Bill Evans on piano. A cornerstone of any serious archive."
      }
    ],
    settings: {
      displayFields: TEMPLATES.find(t => t.id === 'vinyl')!.displayFields,
      badgeFields: TEMPLATES.find(t => t.id === 'vinyl')!.badgeFields,
    }
  }
];

const AppContent: React.FC = () => {
  const { t, language, setLanguage } = useTranslation();
  const [collections, setCollections] = useState<UserCollection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCreateCollectionOpen, setIsCreateCollectionOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [activeCollectionForGuide, setActiveCollectionForGuide] = useState<UserCollection | null>(null);
  const saveTimeoutRef = useRef<Record<string, any>>({});

  useEffect(() => {
    const init = async () => {
      try {
        await requestPersistence();
        await ensureAuth(); 
        
        const localSeedVersion = await getSeedVersion();
        const existingCollections = await loadCollections();
        
        let workingCollections = [...existingCollections];

        if (localSeedVersion < CURRENT_SEED_VERSION) {
          for (const seedCollection of INITIAL_COLLECTIONS) {
            const existingIndex = workingCollections.findIndex(c => c.seedKey === seedCollection.seedKey || c.id === seedCollection.id);
            
            if (existingIndex > -1) {
              const currentCollection = workingCollections[existingIndex];
              const newItems = seedCollection.items.filter(si => 
                !currentCollection.items.some(ci => ci.seedKey === si.seedKey)
              );
              workingCollections[existingIndex] = {
                ...currentCollection,
                items: [...newItems, ...currentCollection.items]
              };
            } else {
              workingCollections.push(seedCollection);
            }
          }
          await saveAllCollections(workingCollections);
          await setSeedVersion(CURRENT_SEED_VERSION);
        }

        setCollections(workingCollections);
      } catch (e) {
        console.error("Initialization failed:", e);
        setCollections([]);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  const debouncedSaveCollection = useCallback((collection: UserCollection) => {
    if (saveTimeoutRef.current[collection.id]) {
      clearTimeout(saveTimeoutRef.current[collection.id]);
    }
    saveTimeoutRef.current[collection.id] = setTimeout(() => {
      saveCollection(collection).catch(err => console.warn('Sync failed', err));
    }, 1500);
  }, []);

  const handleAddItem = async (collectionId: string, itemData: Omit<CollectionItem, 'id' | 'createdAt'>) => {
    const itemId = Math.random().toString(36).substr(2, 9);
    let hasPhoto = false;

    if (itemData.photoUrl.startsWith('data:')) {
      try {
        const { master, thumb } = await processImage(itemData.photoUrl);
        await saveAsset(itemId, master, thumb);
        hasPhoto = true;
      } catch (e) {
        console.error('Image processing failed', e);
      }
    }

    const newItem: CollectionItem = {
      ...itemData,
      id: itemId,
      photoUrl: hasPhoto ? 'asset' : itemData.photoUrl, 
      createdAt: new Date().toISOString(),
    };

    setCollections(prev => {
      return prev.map(c => {
        if (c.id === collectionId) {
          const newC = { ...c, items: [newItem, ...c.items] };
          saveCollection(newC); 
          return newC;
        }
        return c;
      });
    });
  };

  const updateItem = (collectionId: string, itemId: string, updates: Partial<CollectionItem>) => {
    setCollections(prev => prev.map(c => {
      if (c.id === collectionId) {
        const newC = {
          ...c,
          items: c.items.map(item => item.id === itemId ? { ...item, ...updates } : item)
        };
        debouncedSaveCollection(newC);
        return newC;
      }
      return c;
    }));
  };

  const handleCreateCollection = (templateId: string, name: string, icon: string) => {
      const template = TEMPLATES.find(t => t.id === templateId) || TEMPLATES[0];
      const newCol: UserCollection = {
          id: Math.random().toString(36).substr(2, 9),
          templateId: template.id,
          name: name,
          icon: icon || template.icon,
          customFields: template.fields,
          items: [],
          settings: { displayFields: template.displayFields, badgeFields: template.badgeFields }
      };
      setCollections(prev => {
        const updated = [...prev, newCol];
        saveCollection(newCol);
        return updated;
      });
  };

  const deleteItem = (collectionId: string, itemId: string) => {
      if (confirm(t('deleteConfirm'))) {
          setCollections(prev => prev.map(c => {
              if (c.id === collectionId) {
                  const newC = { ...c, items: c.items.filter(i => i.id !== itemId) };
                  saveCollection(newC);
                  deleteAsset(itemId);
                  return newC;
              }
              return c;
          }));
          return true;
      }
      return false;
  };

  const stats = useMemo(() => {
    const totalItems = collections.reduce((acc, c) => acc + c.items.length, 0);
    const avgRating = totalItems > 0 
      ? (collections.reduce((acc, c) => acc + c.items.reduce((iacc, i) => iacc + i.rating, 0), 0) / totalItems).toFixed(1)
      : 0;
    const allItems = collections.flatMap(c => c.items);
    const featured = allItems.length > 0 ? allItems[Math.floor(Math.random() * allItems.length)] : null;
    return { totalItems, avgRating, totalCollections: collections.length, featured };
  }, [collections]);

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

    return (
      <div className="space-y-12 animate-in fade-in duration-700">
        <section className="relative overflow-hidden rounded-[3rem] bg-stone-900 text-white min-h-[480px] flex items-center shadow-2xl border border-white/5 group">
            {stats.featured && (
                <div className="absolute inset-0 opacity-40 group-hover:opacity-30 transition-opacity duration-1000">
                    <ItemImage 
                        itemId={stats.featured.id} 
                        photoUrl={stats.featured.photoUrl} 
                        type="master" 
                        className="w-full h-full object-cover scale-105 group-hover:scale-100 transition-transform duration-[20s] ease-out" 
                    />
                </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-stone-950 via-stone-900/60 to-transparent"></div>
            
            <div className="relative z-10 p-12 md:p-20 max-w-2xl">
                <div className="flex items-center gap-3 mb-6">
                   <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                   <span className="text-[10px] font-mono tracking-[0.4em] uppercase text-amber-500 font-bold">{t('featuredArtifact')}</span>
                </div>
                <h1 className="text-5xl md:text-7xl font-serif font-bold mb-6 tracking-tight leading-tight">
                    {t('appTitle')} <span className="text-white/30 italic font-light">{t('appSubtitle')}</span>
                </h1>
                <p className="text-xl md:text-2xl font-light leading-relaxed mb-10 max-w-sm font-serif italic text-stone-300">
                    {t('heroSubtitle')}
                </p>
                
                <div className="flex gap-12 pt-10 border-t border-white/10">
                   <div className="space-y-1">
                      <p className="text-3xl font-serif font-bold text-white">{stats.totalItems}</p>
                      <p className="text-[10px] font-mono uppercase tracking-widest text-stone-500">{t('artifacts')}</p>
                   </div>
                   <div className="space-y-1">
                      <p className="text-3xl font-serif font-bold text-white">{stats.totalCollections}</p>
                      <p className="text-[10px] font-mono uppercase tracking-widest text-stone-500">{t('archives')}</p>
                   </div>
                   <div className="space-y-1">
                      <p className="text-3xl font-serif font-bold text-white">{stats.avgRating}<span className="text-amber-500 text-lg ml-1">★</span></p>
                      <p className="text-[10px] font-mono uppercase tracking-widest text-stone-500">{t('avgQuality')}</p>
                   </div>
                </div>
            </div>
            
            <div className="absolute bottom-12 right-12 hidden lg:block">
               <Sparkle className="text-white/10 animate-spin-slow" size={120} />
            </div>
        </section>

        <div className="relative max-w-xl mx-auto -mt-20 z-20 px-4">
            <div className="relative">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
                <input 
                  type="text" 
                  placeholder={t('searchPlaceholder')}
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-16 pr-8 py-6 rounded-[2rem] bg-white border border-stone-200 focus:ring-4 focus:ring-amber-500/5 focus:border-amber-200 outline-none transition-all shadow-xl text-lg font-serif italic placeholder:text-stone-300"
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
            onClick={() => setIsCreateCollectionOpen(true)}
            className="group relative p-10 rounded-[2.5rem] border-2 border-dashed border-stone-200 hover:border-amber-400 bg-white/50 hover:bg-white transition-all flex flex-col items-center justify-center min-h-[240px] gap-4 text-stone-400 hover:text-amber-800 shadow-sm hover:shadow-xl overflow-hidden"
          >
            <div className="w-16 h-16 rounded-full bg-stone-50 flex items-center justify-center shadow-inner group-hover:scale-110 group-hover:shadow-lg transition-transform">
                <Plus size={32} strokeWidth={1.5} />
            </div>
            <div className="text-center">
               <span className="font-serif text-2xl font-bold italic tracking-tight block mb-1">{t('newArchive')}</span>
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

    return (
      <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
            <div className="flex items-center gap-6">
                <Link to="/" className="p-4 bg-white border border-stone-100 rounded-2xl text-stone-400 hover:text-stone-900 shadow-lg transition-all hover:scale-105 active:scale-95">
                    <ArrowLeft size={24} />
                </Link>
                <div>
                    <h1 className="text-4xl md:text-5xl font-serif font-bold text-stone-900 tracking-tight mb-2">{collection.name}</h1>
                    <div className="flex items-center gap-4">
                        <span className="text-stone-400 font-serif text-lg italic">
                          {t('artifactsCataloged', { n: collection.items.length })}
                        </span>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
                 <Button 
                   variant="primary" 
                   onClick={() => setIsExhibitionOpen(true)} 
                   disabled={collection.items.length === 0}
                   icon={<Play size={16} />}
                   className="shadow-xl"
                 >
                   {t('enterExhibition')}
                 </Button>
                 <Button 
                   variant="outline" 
                   className="bg-white"
                   onClick={() => { setActiveCollectionForGuide(collection); setIsGuideOpen(true); }}
                   disabled={collection.items.length === 0}
                   icon={<Mic size={16} />}
                 >
                   {t('vocalGuide')}
                 </Button>
                 <div className="flex bg-stone-200/50 rounded-xl p-1">
                    <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}><LayoutGrid size={18} /></button>
                    <button onClick={() => setViewMode('waterfall')} className={`p-2 rounded-lg transition-all ${viewMode === 'waterfall' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}><LayoutTemplate size={18} className="rotate-180" /></button>
                 </div>
                 <div className="relative flex gap-2">
                    <input type="text" placeholder="..." value={filter} onChange={e => setFilter(e.target.value)} className="pl-4 pr-4 py-2 rounded-xl bg-white border border-stone-200 focus:ring-4 focus:ring-amber-500/5 outline-none text-sm w-48 transition-all shadow-sm font-serif italic" />
                    <Button variant={activeFilterCount > 0 ? 'primary' : 'outline'} className={`w-10 h-10 flex items-center justify-center p-0 rounded-xl ${activeFilterCount > 0 ? '' : 'bg-white'}`} onClick={() => setIsFilterModalOpen(true)}>
                        <SlidersHorizontal size={18} />
                    </Button>
                </div>
            </div>
        </div>

        {filteredItems.length === 0 ? (
             <div className="text-center py-32 bg-white/50 rounded-[3rem] border border-stone-100 shadow-sm">
                 <div className="text-8xl mb-8 grayscale opacity-10">🏛️</div>
                 <h3 className="text-3xl font-serif font-bold text-stone-800 mb-2 italic tracking-tight">{t('galleryAwaits')}</h3>
                 <p className="text-stone-400 mb-10 max-w-sm mx-auto leading-relaxed font-serif text-lg">{t('museumDefinition')}</p>
                 {!filter && activeFilterCount === 0 && <Button size="lg" className="px-12 py-4 text-lg rounded-2xl shadow-xl" onClick={() => setIsAddModalOpen(true)}>{t('catalogFirst')}</Button>}
             </div>
        ) : (
            <div className={`${viewMode === 'grid' ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8" : "columns-2 md:columns-3 lg:columns-4 gap-8"} w-full`}>
                {filteredItems.map(item => (
                    <div key={item.id} className={`break-inside-avoid ${viewMode === 'waterfall' ? 'mb-8' : ''}`}>
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

      const handleDelete = () => {
          if (confirm(t('deleteConfirm'))) {
              if (deleteItem(collection.id, item.id)) {
                  navigate(`/collection/${collection.id}`);
              }
          }
      };

      const handlePhotoUpdate = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setIsProcessing(true);
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64 = reader.result as string;
                try {
                    const { master, thumb } = await processImage(base64);
                    await saveAsset(item.id, master, thumb);
                    updateItem(collection.id, item.id, { photoUrl: 'asset' });
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

      return (
          <div className="max-w-4xl mx-auto bg-white rounded-[2rem] sm:rounded-[4rem] shadow-2xl border border-stone-100 overflow-hidden animate-in zoom-in-95 duration-500 mb-20">
              <div className={`relative ${hasPhoto ? 'aspect-[4/5] sm:aspect-[16/9] md:aspect-[21/9]' : 'h-32 sm:h-48'} bg-stone-950 group transition-all duration-700 ease-in-out`}>
                  <ItemImage 
                    itemId={item.id} 
                    photoUrl={item.photoUrl} 
                    alt={item.title} 
                    type="master" 
                    className="w-full h-full object-cover transition-transform duration-[10s] group-hover:scale-110 opacity-80" 
                  />
                  
                  <div className="absolute inset-0 bg-gradient-to-t from-stone-950/60 to-transparent"></div>

                  <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${hasPhoto ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}>
                      <button disabled={isProcessing} onClick={() => fileInputRef.current?.click()} className="bg-white/90 hover:bg-white text-stone-900 px-6 sm:px-8 py-2 sm:py-3 rounded-full font-bold shadow-2xl backdrop-blur-md transition-all hover:scale-105 flex items-center gap-2 sm:gap-3 disabled:opacity-50 text-xs sm:text-sm">
                        {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                        {t('updatePhoto')}
                      </button>
                  </div>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpdate} />
                  
                  <button onClick={() => navigate(-1)} className="absolute top-4 left-4 sm:top-8 sm:left-8 w-10 h-10 sm:w-14 sm:h-14 bg-white/80 backdrop-blur-md rounded-xl sm:rounded-2xl flex items-center justify-center text-stone-800 shadow-xl hover:bg-white transition-all hover:scale-105 z-10"><ArrowLeft size={20} className="sm:w-6 sm:h-6" /></button>
                  
                  <div className="absolute top-4 right-4 sm:top-8 sm:right-8 flex gap-2 sm:gap-4 z-10">
                     <button onClick={() => setIsExportOpen(true)} className="w-10 h-10 sm:w-14 sm:h-14 bg-white/80 backdrop-blur-md rounded-xl sm:rounded-2xl flex items-center justify-center text-stone-800 shadow-xl hover:bg-white transition-all hover:scale-105" title={t('exportCard')}><Printer size={20} className="sm:w-6 sm:h-6" /></button>
                  </div>
              </div>

              <div className="p-8 sm:p-12 md:p-20 space-y-10 sm:space-y-12">
                  <div className="flex flex-col md:flex-row justify-between items-start gap-8 sm:gap-12">
                      <div className="flex-1 w-full">
                          <input 
                            type="text" 
                            className="text-3xl sm:text-5xl md:text-6xl font-serif font-bold text-stone-900 mb-4 sm:mb-6 w-full bg-transparent border-b-2 border-transparent focus:border-amber-100 outline-none transition-all placeholder:italic tracking-tight"
                            value={item.title}
                            onChange={(e) => updateItem(collection.id, item.id, { title: e.target.value })}
                            placeholder="..."
                          />
                          <div className="flex items-center gap-2">
                              {[1,2,3,4,5].map((star) => (
                                <button key={star} onClick={() => updateItem(collection.id, item.id, { rating: star })} className="transition-transform hover:scale-125">
                                    <span className="text-2xl sm:text-4xl">{star <= item.rating ? <span className="text-amber-400">★</span> : <span className="text-stone-100">★</span>}</span>
                                </button>
                              ))}
                              <span className="ml-3 sm:ml-4 text-[8px] sm:text-[10px] font-mono tracking-[0.2em] sm:tracking-[0.3em] text-stone-300 uppercase font-bold">{t('registryQuality')}</span>
                          </div>
                      </div>
                      <button onClick={handleDelete} className="text-stone-200 hover:text-red-400 transition-colors p-3 sm:p-4 rounded-full hover:bg-red-50 shrink-0"><Trash2 size={20} className="sm:w-6 sm:h-6" /></button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 sm:gap-16">
                      <div className="lg:col-span-2 space-y-6">
                        <div className="flex items-center gap-3 text-amber-600">
                             <Quote size={18} fill="currentColor" className="opacity-20 sm:w-5 sm:h-5" />
                             <dt className="text-[9px] sm:text-[10px] font-bold text-stone-400 uppercase tracking-[0.2em] sm:tracking-[0.3em] font-mono">{t('archiveNarrative')}</dt>
                        </div>
                        <textarea 
                            className="w-full bg-stone-50/50 p-6 sm:p-8 rounded-2xl sm:rounded-[2.5rem] italic text-stone-800 border border-stone-100 font-serif text-xl sm:text-2xl leading-relaxed min-h-[200px] sm:min-h-[240px] focus:ring-8 focus:ring-amber-500/5 focus:border-amber-100 outline-none transition-all shadow-inner placeholder:text-stone-200"
                            value={item.notes}
                            onChange={(e) => updateItem(collection.id, item.id, { notes: e.target.value })}
                            placeholder={t('provenancePlaceholder')}
                        />
                      </div>

                      <div className="space-y-8 sm:space-y-10">
                          <dt className="text-[9px] sm:text-[10px] font-bold text-stone-400 uppercase tracking-[0.2em] sm:tracking-[0.3em] pb-3 sm:pb-4 border-b border-stone-100 font-mono">{t('technicalSpec')}</dt>
                          <div className="grid grid-cols-2 lg:grid-cols-1 gap-6 sm:gap-8">
                              {collection.customFields.map(field => {
                                  const val = item.data[field.id];
                                  const label = getLabel(field.id);
                                  return (
                                      <div key={field.id} className="group">
                                          <dt className="text-[8px] sm:text-[10px] font-bold text-stone-300 uppercase tracking-2.0 mb-1 sm:mb-2 group-hover:text-amber-500 transition-colors font-mono">{label}</dt>
                                          <input 
                                            className="text-stone-900 font-serif text-lg sm:text-xl w-full bg-transparent border-none p-0 outline-none focus:text-amber-900 focus:ring-0 transition-colors placeholder:text-stone-100"
                                            value={val || ''}
                                            placeholder="—"
                                            onChange={(e) => {
                                                const newData = { ...item.data, [field.id]: e.target.value };
                                                updateItem(collection.id, item.id, { data: newData });
                                            }}
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

  return (
    <Layout 
      onAddItem={() => setIsAddModalOpen(true)}
      headerExtras={
        <button 
          onClick={() => setLanguage(language === 'en' ? 'zh' : 'en')}
          className="p-2 hover:bg-stone-100 rounded-full text-stone-500 hover:text-stone-900 transition-colors flex items-center gap-1.5"
          title="Switch Language"
        >
          <Globe size={18} />
          <span className="text-[10px] font-bold uppercase tracking-widest">{language === 'en' ? 'ZH' : 'EN'}</span>
        </button>
      }
    >
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/collection/:id" element={<CollectionScreen />} />
        <Route path="/collection/:id/item/:itemId" element={<ItemDetailScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <AddItemModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} collections={collections} onSave={handleAddItem} />
      <CreateCollectionModal isOpen={isCreateCollectionOpen} onClose={() => setIsCreateCollectionOpen(false)} onCreate={handleCreateCollection} />
      {activeCollectionForGuide && (
        <MuseumGuide 
          collection={activeCollectionForGuide} 
          isOpen={isGuideOpen} 
          onClose={() => setIsGuideOpen(false)} 
        />
      )}
    </Layout>
  );
};

export const App: React.FC = () => {
  return (
    <LanguageProvider>
      <HashRouter>
        <AppContent />
      </HashRouter>
    </LanguageProvider>
  );
};
