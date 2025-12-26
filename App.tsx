
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { HashRouter, Routes, Route, useNavigate, useParams, Link } from 'react-router-dom';
import { Layout } from './components/Layout';
import { CollectionCard } from './components/CollectionCard';
import { ItemCard } from './components/ItemCard';
import { AddItemModal } from './components/AddItemModal';
import { CreateCollectionModal } from './components/CreateCollectionModal';
import { UserCollection, CollectionItem } from './types';
import { TEMPLATES } from './constants';
import { Plus, SlidersHorizontal, ArrowLeft, Trash2, LayoutGrid, LayoutTemplate, Printer, Camera, Search, Download, Upload, Loader2, Sparkles, BookOpen, Mic, Play, Quote, Sparkle } from 'lucide-react';
import { Button } from './components/ui/Button';
import { loadCollections, saveCollection, saveAllCollections, saveAsset, deleteAsset, requestPersistence } from './services/db';
import { processImage } from './services/imageProcessor';
import { ItemImage } from './components/ItemImage';
import { MuseumGuide } from './components/MuseumGuide';
import { ExhibitionView } from './components/ExhibitionView';
import { ExportModal } from './components/ExportModal';
import { FilterModal } from './components/FilterModal';

// This manifest maps item IDs to local asset files stored in the repository
const SAMPLE_ASSET_MANIFEST: Record<string, string> = {
  'seed-vinyl-1': 'assets/sample-vinyl.jpg'
};

const INITIAL_COLLECTIONS: UserCollection[] = [
  {
    id: 'sample-vinyl',
    templateId: 'vinyl',
    name: 'The Vinyl Vault',
    icon: '🎷',
    customFields: TEMPLATES.find(t => t.id === 'vinyl')!.fields,
    items: [
      {
        id: 'seed-vinyl-1',
        collectionId: 'sample-vinyl',
        photoUrl: 'asset',
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
        const stored = await loadCollections();
        
        if (stored && stored.length > 0) {
          setCollections(stored);
        } else {
          // Hydrate Sample Assets from local /assets/ folder
          for (const [itemId, path] of Object.entries(SAMPLE_ASSET_MANIFEST)) {
             try {
               const response = await fetch(path);
               if (response.ok) {
                 const blob = await response.blob();
                 const objectURL = URL.createObjectURL(blob);
                 const { master, thumb } = await processImage(objectURL);
                 await saveAsset(itemId, master, thumb);
                 URL.revokeObjectURL(objectURL);
               }
             } catch (e) {
               console.warn(`Could not hydrate sample asset: ${path}. Ensure the file exists in your assets/ folder.`);
             }
          }

          setCollections(INITIAL_COLLECTIONS);
          await saveAllCollections(INITIAL_COLLECTIONS);
        }
      } catch (e) {
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
      saveCollection(collection).catch(console.error);
    }, 1000);
  }, []);

  const handleAddItem = async (collectionId: string, itemData: Omit<CollectionItem, 'id' | 'createdAt'>) => {
    const itemId = Math.random().toString(36).substr(2, 9);
    let hasPhoto = false;

    if (itemData.photoUrl.startsWith('data:')) {
      try {
        const { master, thumb } = await processImage(itemData.photoUrl);
        await saveAsset(itemId, master, thumb);
        hasPhoto = true;
      } catch (e) {}
    }

    const newItem: CollectionItem = {
      ...itemData,
      id: itemId,
      photoUrl: hasPhoto ? 'asset' : '', 
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
      if (confirm('Permanently remove this item?')) {
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
    
    // Get a "featured" item for the hero
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
        <div className="relative">
           <div className="absolute inset-0 bg-amber-200 rounded-full blur-2xl animate-pulse opacity-30"></div>
           <Loader2 className="text-amber-600 animate-spin mb-6 relative z-10" size={40} />
        </div>
        <p className="text-stone-400 font-serif text-xl italic tracking-tight">Restoring the archives...</p>
      </div>
    );

    return (
      <div className="space-y-16 animate-in fade-in duration-1000">
        
        {/* REFINED HERO SECTION */}
        <section className="relative overflow-hidden rounded-[3.5rem] bg-stone-950 text-white min-h-[480px] flex items-center group shadow-2xl border border-white/5">
            {stats.featured && (
                <div className="absolute inset-0 opacity-30 group-hover:opacity-40 transition-opacity duration-[2s]">
                    <ItemImage itemId={stats.featured.id} type="master" className="w-full h-full object-cover scale-[1.05] group-hover:scale-100 transition-transform duration-[15s] ease-out" />
                </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-stone-950 via-stone-950/70 to-transparent"></div>
            
            <div className="relative z-10 p-12 md:p-20 max-w-2xl">
                <div className="flex items-center gap-3 mb-6">
                   <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.8)]"></div>
                   <span className="text-[10px] font-mono tracking-[0.4em] uppercase text-amber-500 font-bold">Featured Artifact</span>
                </div>
                <h1 className="text-6xl md:text-8xl font-serif font-bold mb-8 tracking-tighter leading-[0.9]">
                    Curio <span className="text-white/40 font-light italic block md:inline">Museum</span>
                </h1>
                <p className="text-stone-300 text-xl md:text-2xl font-light leading-relaxed mb-12 max-w-md font-serif italic">
                    Where physical memories become eternal archives.
                </p>
                
                <div className="flex flex-wrap gap-16 pt-10 border-t border-white/10">
                   <div className="space-y-1">
                      <p className="text-3xl font-serif font-bold text-white tracking-tighter">{stats.totalItems}</p>
                      <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-stone-500 font-bold">Artifacts</p>
                   </div>
                   <div className="space-y-1">
                      <p className="text-3xl font-serif font-bold text-white tracking-tighter">{stats.totalCollections}</p>
                      <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-stone-500 font-bold">Archives</p>
                   </div>
                   <div className="space-y-1">
                      <p className="text-3xl font-serif font-bold text-white tracking-tighter">{stats.avgRating}<span className="text-amber-500 text-lg ml-0.5">★</span></p>
                      <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-stone-500 font-bold">Avg Quality</p>
                   </div>
                </div>
            </div>
            
            <div className="absolute bottom-10 right-10 hidden lg:block opacity-20">
               <Sparkle className="text-white animate-spin-slow" size={120} />
            </div>
        </section>

        {/* GLASSMORPHIC SEARCH */}
        <div className="relative max-w-2xl mx-auto -mt-24 z-20 px-4">
            <div className="absolute inset-0 bg-white/40 backdrop-blur-xl rounded-[2.5rem] shadow-2xl border border-white/40 -m-1"></div>
            <div className="relative">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-stone-400" size={24} />
                <input 
                  type="text" 
                  placeholder="Search your vast archives..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-16 pr-8 py-7 rounded-[2rem] bg-white border border-stone-100 focus:ring-8 focus:ring-amber-500/5 focus:border-amber-200 outline-none transition-all shadow-xl text-xl font-serif italic placeholder:text-stone-300"
                />
            </div>
        </div>

        {/* COLLECTIONS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          {filteredCollections.map(col => (
            <CollectionCard 
              key={col.id} 
              collection={col} 
              onClick={() => navigate(`/collection/${col.id}`)} 
            />
          ))}
          
          <button 
            onClick={() => setIsCreateCollectionOpen(true)}
            className="group relative p-10 rounded-[3rem] border-2 border-dashed border-stone-200 hover:border-amber-400 bg-white/50 hover:bg-white transition-all duration-700 flex flex-col items-center justify-center h-72 gap-6 text-stone-400 hover:text-amber-800 shadow-sm hover:shadow-2xl overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-amber-50/0 to-amber-50/100 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
            <div className="relative z-10 w-20 h-20 rounded-full bg-stone-50 border border-stone-100 flex items-center justify-center shadow-inner group-hover:scale-110 group-hover:shadow-xl transition-all duration-700 group-hover:bg-white group-hover:border-amber-200">
                <Plus size={40} strokeWidth={1.5} />
            </div>
            <div className="relative z-10 text-center">
               <span className="font-serif text-3xl font-bold italic tracking-tight block mb-1">New Archive</span>
               <span className="text-[10px] font-mono uppercase tracking-[0.3em] opacity-60 font-bold">Expand the curated space</span>
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

    if (!collection) return <div>Collection not found</div>;

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
      <div className="space-y-10 animate-in slide-in-from-bottom-6 duration-700">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
            <div className="flex items-center gap-8">
                <Link to="/" className="p-4 bg-white border border-stone-100 rounded-[1.5rem] text-stone-400 hover:text-stone-900 shadow-lg transition-all hover:scale-110 active:scale-95 group">
                    <ArrowLeft size={28} className="group-hover:-translate-x-1 transition-transform" />
                </Link>
                <div>
                    <h1 className="text-6xl font-serif font-bold text-stone-900 tracking-tighter mb-2 leading-none">{collection.name}</h1>
                    <div className="flex items-center gap-4">
                        <span className="text-stone-400 font-serif text-lg italic">{collection.items.length} artifacts cataloged</span>
                        {collection.id.startsWith('sample') && (
                            <span className="text-[10px] font-mono tracking-[0.3em] bg-amber-100 text-amber-900 px-3 py-1 rounded-full border border-amber-200 uppercase font-bold">Sample Record</span>
                        )}
                    </div>
                </div>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                 <Button 
                   variant="primary" 
                   onClick={() => setIsExhibitionOpen(true)} 
                   disabled={collection.items.length === 0}
                   icon={<Play size={18} />}
                   className="shadow-2xl hover:shadow-amber-500/20 transition-all h-14 px-10 rounded-2xl bg-stone-900 text-white font-serif italic text-lg"
                 >
                   Enter Exhibition
                 </Button>
                 <Button 
                   variant="outline" 
                   className="bg-white h-14 px-8 rounded-2xl border-stone-200 text-stone-600 hover:text-stone-900 shadow-sm"
                   onClick={() => { setActiveCollectionForGuide(collection); setIsGuideOpen(true); }}
                   disabled={collection.items.length === 0}
                   icon={<Mic size={18} />}
                 >
                   Vocal Guide
                 </Button>
                 <div className="flex bg-stone-100/50 rounded-2xl p-1.5 border border-stone-200/40 backdrop-blur-sm">
                    <button onClick={() => setViewMode('grid')} className={`p-3 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-white text-stone-900 shadow-md' : 'text-stone-400 hover:text-stone-600'}`}><LayoutGrid size={22} /></button>
                    <button onClick={() => setViewMode('waterfall')} className={`p-3 rounded-xl transition-all ${viewMode === 'waterfall' ? 'bg-white text-stone-900 shadow-md' : 'text-stone-400 hover:text-stone-600'}`}><LayoutTemplate size={22} className="rotate-180" /></button>
                 </div>
                 <div className="relative flex-grow flex gap-2">
                    <div className="relative flex-grow">
                        <input type="text" placeholder="Search..." value={filter} onChange={e => setFilter(e.target.value)} className="pl-5 pr-5 h-14 rounded-2xl bg-white border border-stone-100 focus:ring-8 focus:ring-amber-500/5 outline-none text-base w-full lg:w-56 transition-all shadow-sm font-serif italic" />
                    </div>
                    <Button variant={activeFilterCount > 0 ? 'primary' : 'outline'} className={`h-14 w-14 flex items-center justify-center p-0 rounded-2xl border-stone-100 ${activeFilterCount > 0 ? '' : 'bg-white'} shadow-sm`} onClick={() => setIsFilterModalOpen(true)}>
                        <SlidersHorizontal size={22} />
                    </Button>
                </div>
            </div>
        </div>

        {filteredItems.length === 0 ? (
             <div className="text-center py-48 bg-white/50 rounded-[4rem] border border-stone-100 shadow-sm backdrop-blur-sm">
                 <div className="text-9xl mb-10 grayscale opacity-10 filter drop-shadow-2xl">🏛️</div>
                 <h3 className="text-4xl font-serif font-bold text-stone-800 mb-4 italic tracking-tight">The gallery awaits.</h3>
                 <p className="text-stone-400 mb-12 max-w-sm mx-auto leading-relaxed font-serif text-lg">A museum is defined by what it protects. Begin your archival journey today.</p>
                 {!filter && activeFilterCount === 0 && <Button size="lg" className="px-16 h-16 text-xl rounded-3xl shadow-xl" onClick={() => setIsAddModalOpen(true)}>Catalog First Item</Button>}
             </div>
        ) : (
            <div className={`${viewMode === 'grid' ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-10" : "columns-2 md:columns-3 lg:columns-4 gap-10"} w-full pb-24`}>
                {filteredItems.map(item => (
                    <div key={item.id} className={`break-inside-avoid ${viewMode === 'waterfall' ? 'mb-10 inline-block w-full align-top' : 'h-full'}`}>
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

      if (!collection || !item) return <div>Item not found</div>;

      const handleDelete = () => {
          if (deleteItem(collection.id, item.id)) {
              navigate(`/collection/${collection.id}`);
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

      return (
          <div className="max-w-5xl mx-auto bg-white rounded-[4rem] shadow-2xl border border-stone-100 overflow-hidden animate-in zoom-in-[0.98] duration-700">
              <div className="relative aspect-[21/9] bg-stone-950 group overflow-hidden">
                  <ItemImage itemId={item.id} alt={item.title} type="master" className="w-full h-full object-cover transition-transform duration-[8s] group-hover:scale-110 opacity-70" />
                  
                  <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/20 to-transparent opacity-80"></div>

                  <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-500 opacity-0 group-hover:opacity-100`}>
                      <button disabled={isProcessing} onClick={() => fileInputRef.current?.click()} className="bg-white/95 hover:bg-white text-stone-900 px-10 py-4 rounded-full font-bold shadow-2xl backdrop-blur-xl transition-all hover:scale-110 flex items-center gap-4 pointer-events-auto disabled:opacity-50">
                        {isProcessing ? <Loader2 size={24} className="animate-spin" /> : <Camera size={24} />}
                        Update Artifact Photo
                      </button>
                  </div>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpdate} />
                  
                  <button onClick={() => navigate(-1)} className="absolute top-10 left-10 w-16 h-16 bg-white/90 backdrop-blur-xl rounded-[1.5rem] flex items-center justify-center text-stone-800 shadow-2xl hover:bg-white transition-all hover:scale-110 z-10"><ArrowLeft size={32} /></button>
                  
                  <div className="absolute top-10 right-10 flex gap-5 z-10">
                     <button onClick={() => setIsExportOpen(true)} className="w-16 h-16 bg-white/90 backdrop-blur-xl rounded-[1.5rem] flex items-center justify-center text-stone-800 shadow-2xl hover:bg-white transition-all hover:scale-110" title="Export card"><Printer size={30} /></button>
                  </div>
              </div>

              <div className="p-16 md:p-24 space-y-20">
                  <div className="flex flex-col md:flex-row justify-between items-start gap-12">
                      <div className="flex-1 w-full">
                          <input 
                            type="text" 
                            className="text-7xl font-serif font-bold text-stone-900 mb-8 w-full bg-transparent border-b-2 border-transparent focus:border-amber-100 outline-none transition-all placeholder:italic tracking-tighter leading-tight"
                            value={item.title}
                            onChange={(e) => updateItem(collection.id, item.id, { title: e.target.value })}
                            placeholder="Untitled Artifact"
                          />
                          <div className="flex items-center gap-4">
                              {[1,2,3,4,5].map((star) => (
                                <button key={star} onClick={() => updateItem(collection.id, item.id, { rating: star })} className="transition-all hover:scale-[1.35] active:scale-90">
                                    <span className="text-5xl">{star <= item.rating ? <span className="text-amber-400 drop-shadow-md">★</span> : <span className="text-stone-100">★</span>}</span>
                                </button>
                              ))}
                              <span className="ml-6 text-[11px] font-mono tracking-[0.4em] text-stone-300 uppercase font-bold">Registry Quality Score</span>
                          </div>
                      </div>
                      <button onClick={handleDelete} className="text-stone-200 hover:text-red-500 transition-all p-5 rounded-[2rem] hover:bg-red-50 shrink-0 border border-transparent hover:border-red-100"><Trash2 size={32} /></button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-24">
                      <div className="lg:col-span-2 space-y-8">
                        <div className="flex items-center gap-4 text-amber-600">
                             <Quote size={32} fill="currentColor" className="opacity-10" />
                             <dt className="text-xs font-bold text-stone-400 uppercase tracking-[0.4em] font-mono">Archive Narrative</dt>
                        </div>
                        <textarea 
                            className="w-full bg-stone-50/30 p-10 rounded-[3.5rem] italic text-stone-800 border border-stone-100 font-serif text-3xl leading-relaxed min-h-[320px] focus:ring-[12px] focus:ring-amber-500/5 focus:border-amber-100 outline-none transition-all shadow-inner placeholder:text-stone-200"
                            value={item.notes}
                            onChange={(e) => updateItem(collection.id, item.id, { notes: e.target.value })}
                            placeholder="Begin the provenance of this artifact..."
                        />
                      </div>

                      <div className="space-y-12">
                          <dt className="text-xs font-bold text-stone-400 uppercase tracking-[0.4em] pb-6 border-b border-stone-100 font-mono">Technical Spec</dt>
                          <div className="space-y-10">
                              {collection.customFields.map(field => {
                                  const val = item.data[field.id];
                                  return (
                                      <div key={field.id} className="group">
                                          <dt className="text-[11px] font-bold text-stone-300 uppercase tracking-[0.3em] mb-3 group-hover:text-amber-500 transition-colors font-mono">{field.label}</dt>
                                          <input 
                                            className="text-stone-900 font-serif text-2xl w-full bg-transparent border-none p-0 outline-none focus:text-amber-900 focus:ring-0 transition-colors placeholder:text-stone-100 font-medium"
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
    <Layout onAddItem={() => setIsAddModalOpen(true)}>
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/collection/:id" element={<CollectionScreen />} />
        <Route path="/collection/:id/item/:itemId" element={<ItemDetailScreen />} />
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
    <HashRouter>
      <AppContent />
    </HashRouter>
  );
};
