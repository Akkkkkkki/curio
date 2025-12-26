
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { HashRouter, Routes, Route, useNavigate, useParams, Link } from 'react-router-dom';
import { Layout } from './components/Layout';
import { CollectionCard } from './components/CollectionCard';
import { ItemCard } from './components/ItemCard';
import { AddItemModal } from './components/AddItemModal';
import { CreateCollectionModal } from './components/CreateCollectionModal';
import { ExportModal } from './components/ExportModal';
import { FilterModal } from './components/FilterModal';
import { UserCollection, CollectionItem } from './types';
import { TEMPLATES } from './constants';
import { Plus, SlidersHorizontal, ArrowLeft, Trash2, LayoutGrid, LayoutTemplate, Printer, Camera, Link as LinkIcon, Download, Upload, ShieldCheck, Database, Loader2 } from 'lucide-react';
import { Button } from './components/ui/Button';
import { loadCollections, saveCollection, saveAllCollections, saveAsset, getAsset, deleteAsset, requestPersistence } from './services/db';
import { processImage } from './services/imageProcessor';
import { ItemImage } from './components/ItemImage';

const INITIAL_COLLECTIONS: UserCollection[] = [
  {
    id: 'c1',
    templateId: 'chocolate',
    name: 'Chocolate Stash',
    icon: '🍫',
    customFields: TEMPLATES.find(t => t.id === 'chocolate')!.fields,
    items: [],
    settings: {
      displayFields: TEMPLATES.find(t => t.id === 'chocolate')!.displayFields,
      badgeFields: TEMPLATES.find(t => t.id === 'chocolate')!.badgeFields,
    }
  }
];

const AppContent: React.FC = () => {
  const [collections, setCollections] = useState<UserCollection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCreateCollectionOpen, setIsCreateCollectionOpen] = useState(false);
  const saveTimeoutRef = useRef<Record<string, any>>({});

  useEffect(() => {
    const init = async () => {
      try {
        await requestPersistence();
        const stored = await loadCollections();
        if (stored && stored.length > 0) {
          setCollections(stored);
        } else {
          setCollections(INITIAL_COLLECTIONS);
        }
      } catch (e) {
        console.error("Failed to load collections", e);
        setCollections(INITIAL_COLLECTIONS);
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
      saveCollection(collection).catch(err => console.error("Auto-save failed", err));
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
      } catch (e) {
        console.warn("Image processing failed", e);
      }
    }

    const newItem: CollectionItem = {
      ...itemData,
      id: itemId,
      photoUrl: hasPhoto ? 'asset' : '', 
      createdAt: new Date().toISOString(),
    };

    setCollections(prev => {
      const updated = prev.map(c => {
        if (c.id === collectionId) {
          const newC = { ...c, items: [newItem, ...c.items] };
          saveCollection(newC);
          return newC;
        }
        return c;
      });
      return updated;
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
      setCollections(prev => prev.map(c => {
          if (c.id === collectionId) {
              const newC = { ...c, items: c.items.filter(i => i.id !== itemId) };
              saveCollection(newC);
              deleteAsset(itemId);
              return newC;
          }
          return c;
      }));
  };

  const handleExportData = () => {
    const dataStr = JSON.stringify(collections, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `curio-museum-backup-${new Date().toISOString().split('T')[0]}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (Array.isArray(json) && confirm("This will replace your current collection with the backup. Continue?")) {
          setCollections(json);
          saveAllCollections(json);
        }
      } catch (err) {
        alert("Invalid backup file.");
      }
    };
    reader.readAsText(file);
  };

  const HomeScreen = () => {
    const navigate = useNavigate();
    const importRef = useRef<HTMLInputElement>(null);

    if (isLoading) return (
      <div className="flex flex-col items-center justify-center py-20 animate-pulse">
        <Loader2 className="text-amber-500 animate-spin mb-4" size={48} />
        <p className="text-stone-400 font-serif">Opening your museum...</p>
      </div>
    );

    return (
      <div className="space-y-12 animate-in fade-in duration-500">
        <section className="text-center py-8">
            <h1 className="text-4xl md:text-5xl font-serif font-bold text-stone-900 mb-4 tracking-tight">
                Your Personal Museum
            </h1>
            <p className="text-stone-500 max-w-lg mx-auto text-lg">
                Capture, organize, and enjoy everything from movie tickets and chocolates to vinlys and sneakers.
            </p>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {collections.map(col => (
            <CollectionCard 
              key={col.id} 
              collection={col} 
              onClick={() => navigate(`/collection/${col.id}`)} 
            />
          ))}
          
          <button 
            onClick={() => setIsCreateCollectionOpen(true)}
            className="group relative p-6 rounded-2xl border border-dashed border-stone-300 hover:border-stone-400 bg-stone-50/50 hover:bg-stone-100 transition-all flex flex-col items-center justify-center h-40 gap-3 text-stone-400 hover:text-stone-600"
          >
            <div className="w-10 h-10 rounded-full bg-stone-200 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Plus size={20} />
            </div>
            <span className="font-medium">New Collection</span>
          </button>
        </div>

        <section className="pt-12 border-t border-stone-200">
            <div className="bg-white rounded-3xl p-8 border border-stone-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-green-50 text-green-600 rounded-2xl">
                        <ShieldCheck size={32} />
                    </div>
                    <div>
                        <h3 className="text-xl font-serif font-bold text-stone-900">Privacy & Speed</h3>
                        <p className="text-sm text-stone-500 max-w-sm mt-1">
                            Optimized for performance. Your data and high-res photos stay private and compressed on your device.
                        </p>
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    <Button variant="outline" onClick={handleExportData} icon={<Download size={16} />}>
                        Backup
                    </Button>
                    <Button variant="outline" onClick={() => importRef.current?.click()} icon={<Upload size={16} />}>
                        Restore
                    </Button>
                    <input type="file" ref={importRef} className="hidden" accept=".json" onChange={handleImportData} />
                </div>
            </div>
        </section>
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
      <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="flex items-center gap-3">
                <Link to="/" className="p-2 -ml-2 text-stone-400 hover:text-stone-800 transition-colors">
                    <ArrowLeft size={24} />
                </Link>
                <div>
                    <h1 className="text-3xl font-serif font-bold text-stone-900">{collection.name}</h1>
                    <p className="text-stone-500 text-sm">{collection.items.length} items collected</p>
                </div>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                 <div className="flex bg-white rounded-lg border border-stone-200 p-0.5">
                    <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-stone-100 text-stone-900 shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}><LayoutGrid size={18} /></button>
                    <button onClick={() => setViewMode('waterfall')} className={`p-1.5 rounded-md transition-all ${viewMode === 'waterfall' ? 'bg-stone-100 text-stone-900 shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}><LayoutTemplate size={18} className="rotate-180" /></button>
                 </div>
                <div className="relative flex-grow flex gap-2">
                    <div className="relative flex-grow">
                        <input type="text" placeholder="Search..." value={filter} onChange={e => setFilter(e.target.value)} className="pl-4 pr-4 py-2 rounded-lg bg-white border border-stone-200 focus:ring-2 focus:ring-stone-200 outline-none text-sm w-full md:w-48" />
                    </div>
                    <Button variant={activeFilterCount > 0 ? 'primary' : 'outline'} className={activeFilterCount > 0 ? '' : 'bg-white'} onClick={() => setIsFilterModalOpen(true)} icon={<SlidersHorizontal size={14} />}>
                        {activeFilterCount > 0 ? `${activeFilterCount}` : ''}
                    </Button>
                </div>
            </div>
        </div>

        {filteredItems.length === 0 ? (
             <div className="text-center py-20 bg-white rounded-3xl border border-stone-100 border-dashed">
                 <div className="text-6xl mb-4 grayscale opacity-20">🖼️</div>
                 <h3 className="text-xl font-serif font-bold text-stone-800 mb-2">It's quiet here.</h3>
                 <p className="text-stone-500 mb-6">{filter || activeFilterCount > 0 ? "No items match your filters." : "Start building your collection."}</p>
                 {!filter && activeFilterCount === 0 && <Button onClick={() => setIsAddModalOpen(true)}>Add First Item</Button>}
             </div>
        ) : (
            <div className={`${viewMode === 'grid' ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6" : "columns-2 md:columns-3 lg:columns-4 gap-4 md:gap-6"} w-full`}>
                {filteredItems.map(item => (
                    <div key={item.id} className={`break-inside-avoid ${viewMode === 'waterfall' ? 'mb-4 md:mb-6 inline-block w-full align-top' : 'h-full'}`}>
                         <ItemCard item={item} fields={collection.customFields} displayFields={collection.settings.displayFields} badgeFields={collection.settings.badgeFields} onClick={() => navigate(`/collection/${collection.id}/item/${item.id}`)} layout={viewMode === 'grid' ? 'grid' : 'masonry'} />
                    </div>
                ))}
            </div>
        )}
        
        <FilterModal isOpen={isFilterModalOpen} onClose={() => setIsFilterModalOpen(false)} fields={collection.customFields} activeFilters={activeFilters} onApply={setActiveFilters} />
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
          if (confirm('Are you sure you want to remove this item?')) {
              deleteItem(collection.id, item.id);
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
          <div className="max-w-2xl mx-auto bg-white rounded-3xl shadow-sm border border-stone-100 overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="relative aspect-video bg-stone-100 group">
                  <ItemImage itemId={item.id} alt={item.title} type="master" className="w-full h-full" />
                  
                  <div className={`absolute inset-0 bg-black/5 flex items-center justify-center transition-opacity duration-200 opacity-0 group-hover:opacity-100`}>
                      <button disabled={isProcessing} onClick={() => fileInputRef.current?.click()} className="bg-white/90 hover:bg-white text-stone-800 px-4 py-2 rounded-full font-medium shadow-sm backdrop-blur-sm transition-transform hover:scale-105 flex items-center gap-2 text-sm pointer-events-auto disabled:opacity-50">
                        {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                        Change Photo
                      </button>
                  </div>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpdate} />
                  <button onClick={() => navigate(-1)} className="absolute top-4 left-4 w-10 h-10 bg-white/80 backdrop-blur-md rounded-full flex items-center justify-center text-stone-800 shadow-sm hover:bg-white z-10"><ArrowLeft size={20} /></button>
                  <div className="absolute top-4 right-4 flex gap-2 z-10">
                     <button onClick={() => setIsExportOpen(true)} className="w-10 h-10 bg-white/80 backdrop-blur-md rounded-full flex items-center justify-center text-stone-800 shadow-sm hover:bg-white transition-colors" title="Print / Share"><Printer size={18} /></button>
                  </div>
              </div>
              <div className="p-6 md:p-8 space-y-8">
                  <div className="flex justify-between items-start">
                      <div className="flex-1 mr-4">
                          <input 
                            type="text" 
                            className="text-3xl font-serif font-bold text-stone-900 mb-2 w-full bg-transparent border-b border-transparent focus:border-stone-200 outline-none"
                            value={item.title}
                            onChange={(e) => updateItem(collection.id, item.id, { title: e.target.value })}
                          />
                          <div className="flex items-center gap-1 text-amber-400">
                              {[1,2,3,4,5].map((star) => (
                                <button key={star} onClick={() => updateItem(collection.id, item.id, { rating: star })}>
                                    <span className="text-xl">{star <= item.rating ? '★' : <span className="text-stone-200">★</span>}</span>
                                </button>
                              ))}
                          </div>
                      </div>
                      <button onClick={handleDelete} className="text-stone-300 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-stone-50"><Trash2 size={20} /></button>
                  </div>
                  <div>
                    <dt className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">My Notes</dt>
                    <textarea 
                        className="w-full bg-stone-50 p-4 rounded-xl italic text-stone-600 border border-stone-100 font-serif min-h-[100px] focus:ring-2 focus:ring-amber-200 outline-none"
                        value={item.notes}
                        onChange={(e) => updateItem(collection.id, item.id, { notes: e.target.value })}
                        placeholder="Personal thoughts..."
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {collection.customFields.map(field => {
                          const val = item.data[field.id];
                          return (
                              <div key={field.id} className="pb-3 border-b border-stone-50 last:border-0">
                                  <dt className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">{field.label}</dt>
                                  <input 
                                    className="text-stone-800 font-medium w-full bg-transparent border-none p-0 outline-none focus:text-amber-700"
                                    value={val || ''}
                                    onChange={(e) => {
                                        const newData = { ...item.data, [field.id]: e.target.value };
                                        updateItem(collection.id, item.id, { data: newData });
                                    }}
                                  />
                              </div>
                          );
                      })}
                  </div>
                  <div className="text-center pt-8"><p className="text-xs text-stone-300">Added on {new Date(item.createdAt).toLocaleDateString()}</p></div>
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
