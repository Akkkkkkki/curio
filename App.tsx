import React, { useState, useEffect, useRef } from 'react';
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
import { Plus, SlidersHorizontal, ArrowLeft, Trash2, LayoutGrid, LayoutTemplate, Printer, Camera, Link as LinkIcon } from 'lucide-react';
import { Button } from './components/ui/Button';

// Mock Initial Data
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
  },
  {
    id: 'c2',
    templateId: 'vinyl',
    name: 'My Records',
    icon: '🎵',
    customFields: TEMPLATES.find(t => t.id === 'vinyl')!.fields,
    items: [],
    settings: {
        displayFields: TEMPLATES.find(t => t.id === 'vinyl')!.displayFields,
        badgeFields: TEMPLATES.find(t => t.id === 'vinyl')!.badgeFields,
    }
  }
];

const AppContent: React.FC = () => {
  const [collections, setCollections] = useState<UserCollection[]>(() => {
    const saved = localStorage.getItem('curio_collections');
    return saved ? JSON.parse(saved) : INITIAL_COLLECTIONS;
  });
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCreateCollectionOpen, setIsCreateCollectionOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('curio_collections', JSON.stringify(collections));
  }, [collections]);

  const handleAddItem = (collectionId: string, itemData: Omit<CollectionItem, 'id' | 'createdAt'>) => {
    const newItem: CollectionItem = {
      ...itemData,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
    };

    setCollections(prev => prev.map(c => {
      if (c.id === collectionId) {
        return { ...c, items: [newItem, ...c.items] };
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
      setCollections([...collections, newCol]);
  };

  const deleteItem = (collectionId: string, itemId: string) => {
      setCollections(prev => prev.map(c => {
          if (c.id === collectionId) {
              return { ...c, items: c.items.filter(i => i.id !== itemId) };
          }
          return c;
      }));
  };

  // --- Screens ---

  const HomeScreen = () => {
    const navigate = useNavigate();
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <section className="text-center py-8">
            <h1 className="text-4xl md:text-5xl font-serif font-bold text-stone-900 mb-4 tracking-tight">
                Your Personal Museum
            </h1>
            <p className="text-stone-500 max-w-lg mx-auto text-lg">
                Capture, organize, and enjoy everything from movie tickets and flights to chocolates, wine, and vinyls.
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

    // Advanced Filtering Logic
    const filteredItems = collection.items.filter(item => {
        const term = filter.toLowerCase();
        
        // 1. Text Search (Title, Notes, Data)
        const matchesSearch = !term || (
            item.title.toLowerCase().includes(term) ||
            item.notes?.toLowerCase().includes(term) ||
            Object.values(item.data).some(val => String(val).toLowerCase().includes(term))
        );

        // 2. Metadata Filters
        const matchesFilters = Object.entries(activeFilters).every(([key, value]) => {
            if (!value) return true; // Empty filter ignores
            if (key === 'rating') return item.rating >= parseInt(value); // Special case for rating (>=)
            
            const itemVal = item.data[key];
            if (itemVal === undefined || itemVal === null) return false;
            
            return String(itemVal).toLowerCase().includes(value.toLowerCase());
        });

        return matchesSearch && matchesFilters;
    });

    const activeFilterCount = Object.values(activeFilters).filter(Boolean).length;

    return (
      <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="flex items-center gap-3">
                <Link to="/" className="p-2 -ml-2 text-stone-400 hover:text-stone-800 transition-colors">
                    <ArrowLeft size={24} />
                </Link>
                <div>
                    <h1 className="text-3xl font-serif font-bold text-stone-900">{collection.name}</h1>
                    <p className="text-stone-500 text-sm">
                        {collection.items.length} items collected
                    </p>
                </div>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                 <div className="flex bg-white rounded-lg border border-stone-200 p-0.5">
                    <button 
                        onClick={() => setViewMode('grid')}
                        className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-stone-100 text-stone-900 shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}
                        title="Grid View"
                    >
                        <LayoutGrid size={18} />
                    </button>
                    <button 
                        onClick={() => setViewMode('waterfall')}
                        className={`p-1.5 rounded-md transition-all ${viewMode === 'waterfall' ? 'bg-stone-100 text-stone-900 shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}
                        title="Waterfall View"
                    >
                        <LayoutTemplate size={18} className="rotate-180" />
                    </button>
                 </div>
                <div className="relative flex-grow flex gap-2">
                    <div className="relative flex-grow">
                        <input 
                            type="text" 
                            placeholder="Search..." 
                            value={filter}
                            onChange={e => setFilter(e.target.value)}
                            className="pl-4 pr-4 py-2 rounded-lg bg-white border border-stone-200 focus:ring-2 focus:ring-stone-200 outline-none text-sm w-full md:w-48"
                        />
                    </div>
                    <Button 
                        variant={activeFilterCount > 0 ? 'primary' : 'outline'} 
                        className={activeFilterCount > 0 ? '' : 'bg-white'}
                        onClick={() => setIsFilterModalOpen(true)}
                        icon={<SlidersHorizontal size={14} />}
                    >
                        {activeFilterCount > 0 ? `${activeFilterCount}` : ''}
                    </Button>
                </div>
            </div>
        </div>

        {/* Content */}
        {filteredItems.length === 0 ? (
             <div className="text-center py-20 bg-white rounded-3xl border border-stone-100 border-dashed">
                 <div className="text-6xl mb-4 grayscale opacity-20">🖼️</div>
                 <h3 className="text-xl font-serif font-bold text-stone-800 mb-2">It's quiet here.</h3>
                 <p className="text-stone-500 mb-6">
                     {filter || activeFilterCount > 0 ? "No items match your filters." : "Start building your collection."}
                 </p>
                 {!filter && activeFilterCount === 0 && <Button onClick={() => setIsAddModalOpen(true)}>Add First Item</Button>}
             </div>
        ) : (
            <div className={`${viewMode === 'grid' 
                ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6"
                : "columns-2 md:columns-3 lg:columns-4 gap-4 md:gap-6"
            } w-full`}>
                {filteredItems.map(item => (
                    <div key={item.id} className={`break-inside-avoid ${viewMode === 'waterfall' ? 'mb-4 md:mb-6 inline-block w-full align-top' : 'h-full'}`}>
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
        )}
        
        <FilterModal 
            isOpen={isFilterModalOpen}
            onClose={() => setIsFilterModalOpen(false)}
            fields={collection.customFields}
            activeFilters={activeFilters}
            onApply={setActiveFilters}
        />
      </div>
    );
  };

  const ItemDetailScreen = () => {
      const { id, itemId } = useParams<{ id: string; itemId: string }>();
      const navigate = useNavigate();
      const [isExportOpen, setIsExportOpen] = useState(false);
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

      const handlePhotoUpdate = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result as string;
                setCollections(prev => prev.map(c => {
                    if (c.id === collection.id) {
                        return {
                            ...c,
                            items: c.items.map(i => i.id === item.id ? { ...i, photoUrl: base64 } : i)
                        };
                    }
                    return c;
                }));
            };
            reader.readAsDataURL(file);
        }
      };

      return (
          <div className="max-w-2xl mx-auto bg-white rounded-3xl shadow-sm border border-stone-100 overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="relative aspect-video bg-stone-100 group">
                  {item.photoUrl ? (
                      <img src={item.photoUrl} alt={item.title} className="w-full h-full object-cover" />
                  ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-stone-400">
                          <Camera size={48} className="opacity-20 mb-2" />
                          <span className="text-sm font-medium opacity-50">No Photo</span>
                      </div>
                  )}
                  
                  {/* Photo Edit Overlay */}
                  <div className={`absolute inset-0 bg-black/5 flex items-center justify-center transition-opacity duration-200 ${item.photoUrl ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}>
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-white/90 hover:bg-white text-stone-800 px-4 py-2 rounded-full font-medium shadow-sm backdrop-blur-sm transition-transform hover:scale-105 flex items-center gap-2 text-sm pointer-events-auto"
                      >
                        <Camera size={16} />
                        {item.photoUrl ? 'Change Photo' : 'Add Photo'}
                      </button>
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*"
                    onChange={handlePhotoUpdate}
                  />

                  <button 
                    onClick={() => navigate(-1)}
                    className="absolute top-4 left-4 w-10 h-10 bg-white/80 backdrop-blur-md rounded-full flex items-center justify-center text-stone-800 shadow-sm hover:bg-white z-10"
                  >
                      <ArrowLeft size={20} />
                  </button>
                  
                  {/* Action buttons overlay */}
                  <div className="absolute top-4 right-4 flex gap-2 z-10">
                     <button 
                         onClick={() => setIsExportOpen(true)}
                         className="w-10 h-10 bg-white/80 backdrop-blur-md rounded-full flex items-center justify-center text-stone-800 shadow-sm hover:bg-white transition-colors"
                         title="Print / Share"
                     >
                        <Printer size={18} />
                     </button>
                  </div>
              </div>

              <div className="p-6 md:p-8 space-y-8">
                  {/* Header */}
                  <div className="flex justify-between items-start">
                      <div>
                          <h1 className="text-3xl font-serif font-bold text-stone-900 mb-2">{item.title}</h1>
                          <div className="flex items-center gap-1 text-amber-400">
                              {[...Array(5)].map((_, i) => (
                                  <span key={i} className="text-xl">
                                      {i < item.rating ? '★' : <span className="text-stone-200">★</span>}
                                  </span>
                              ))}
                          </div>
                      </div>
                      <button onClick={handleDelete} className="text-stone-300 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-stone-50">
                          <Trash2 size={20} />
                      </button>
                  </div>

                  {/* Notes */}
                  {item.notes && (
                      <div className="bg-stone-50 p-4 rounded-xl italic text-stone-600 border border-stone-100 font-serif">
                          "{item.notes}"
                      </div>
                  )}

                  {/* Details Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {collection.customFields.map(field => {
                          const val = item.data[field.id];
                          if (val === undefined || val === null || val === '') return null;
                          return (
                              <div key={field.id} className="pb-3 border-b border-stone-50 last:border-0">
                                  <dt className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">
                                      {field.label}
                                  </dt>
                                  <dd className="text-stone-800 font-medium">
                                      {val.toString()}
                                  </dd>
                              </div>
                          );
                      })}
                  </div>

                  {/* External Links Section */}
                  <div className="pt-6 border-t border-stone-50">
                     <h3 className="text-sm font-bold text-stone-900 mb-3">Linked Media & Events</h3>
                     <div className="flex gap-2">
                         <button className="text-xs flex items-center gap-1.5 border border-dashed border-stone-300 px-4 py-2 rounded-full text-stone-500 hover:text-stone-800 hover:border-stone-400 hover:bg-stone-50 transition-all">
                             <LinkIcon size={14} />
                             Add Link
                         </button>
                     </div>
                  </div>
                  
                  <div className="text-center pt-8">
                      <p className="text-xs text-stone-300">Added on {new Date(item.createdAt).toLocaleDateString()}</p>
                  </div>
              </div>

              <ExportModal 
                isOpen={isExportOpen}
                onClose={() => setIsExportOpen(false)}
                item={item}
                fields={collection.customFields}
              />
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
      <AddItemModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        collections={collections}
        onSave={handleAddItem}
      />
      <CreateCollectionModal 
        isOpen={isCreateCollectionOpen}
        onClose={() => setIsCreateCollectionOpen(false)}
        onCreate={handleCreateCollection}
      />
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
