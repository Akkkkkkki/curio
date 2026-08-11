import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link, Navigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckSquare,
  Landmark,
  LayoutGrid,
  LayoutTemplate,
  ListOrdered,
  Lock,
  Play,
  Plus,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { useTranslation, getFieldTranslation } from '../i18n';
import { useTheme, typographyClasses, labelColorClasses } from '../theme';
import { UserCollection, AppTheme } from '../types';
import { Button } from './ui/Button';
import { CollectionScreenSkeleton } from './ui/Skeleton';
import { ItemCard } from './ItemCard';
import { FilterModal } from './FilterModal';
import { ExhibitionView } from './ExhibitionView';
import { DeleteCollectionModal } from './DeleteCollectionModal';
import { DeleteItemsModal } from './DeleteItemsModal';
import type { StatusTone } from './StatusToast';
import { sortCollectionItems, type ItemSort } from '../utils/collectionSorting';
import { matchesItemFilters } from '../utils/itemFilter';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

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

interface CollectionScreenProps {
  collections: UserCollection[];
  isAdmin: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  isSupabaseReady: boolean;
  sampleCollectionId?: string;
  openAuthModal: (mode: 'signin' | 'signup') => void;
  openAddItemModal: (collectionId: string) => void;
  deleteItem: (collectionId: string, itemId: string) => boolean;
  removeCollection: (collection: UserCollection) => Promise<void>;
  showStatus: (message: string, tone?: StatusTone) => void;
}

// CUR-149: this screen must be a top-level component (not declared inside
// AppContent) so its identity is stable across app re-renders. An inline
// declaration remounts the whole subtree on every app state change, wiping
// in-progress search input and screen-local UI state.
export const CollectionScreen: React.FC<CollectionScreenProps> = ({
  collections,
  isAdmin,
  isLoading,
  isAuthenticated,
  isSupabaseReady,
  sampleCollectionId,
  openAuthModal,
  openAddItemModal,
  deleteItem,
  removeCollection,
  showStatus,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const collection = collections.find((c) => c.id === id);
  const isReadOnly = Boolean(collection?.isPublic) && !isAdmin;
  const isSample = Boolean(collection?.isPublic) || Boolean(collection?.id?.startsWith('sample'));
  const canAddItems = Boolean(collection) && !isReadOnly;
  const hasItems = (collection?.items.length ?? 0) > 0;
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

  // CUR-149: the screen keeps its identity across /collection/:id param
  // changes now (it used to remount), so collection-specific search and
  // filter state must be cleared explicitly when the route id changes —
  // a stale filter keyed to a field id the next collection lacks would
  // otherwise hide every item. Background re-renders leave both intact.
  useEffect(() => {
    setFilterInput('');
    setActiveFilters({});
  }, [id]);

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
    getFieldTranslation(t, fieldId, collection?.customFields.find((f) => f.id === fieldId)?.label);

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
      await removeCollection(collection);
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
    // CUR-144: a signed-out visitor following a dead or private link gets
    // an explanation and a path onward (sign in / explore the sample)
    // instead of silently landing back on the welcome card.
    if (!isAuthenticated && isSupabaseReady) {
      return (
        <div
          className="flex flex-col items-center justify-center px-4 py-16 sm:py-24"
          data-testid="collection-unavailable"
        >
          <div
            className={`max-w-md w-full text-center border rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-10 shadow-xl ${theme === 'vault' ? 'bg-white/5 border-white/10' : theme === 'atelier' ? 'bg-[#EDE4D3]/70 border-[#D4C9B8]' : 'bg-white/70 border-stone-200'}`}
          >
            <div
              className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 sm:mb-6 ${theme === 'vault' ? 'bg-white/10 text-stone-400' : theme === 'atelier' ? 'bg-[#D4C9B8]/50 text-[#8C7B6B]' : 'bg-stone-100 text-stone-500'}`}
            >
              <Landmark size={24} />
            </div>
            <h1
              className={`font-serif text-2xl font-bold mb-2 ${theme === 'vault' ? 'text-white' : theme === 'atelier' ? 'text-[#3D3530]' : 'text-stone-900'}`}
            >
              {t('collectionUnavailableTitle')}
            </h1>
            <p
              className={`text-sm mb-6 ${theme === 'vault' ? 'text-stone-400' : theme === 'atelier' ? 'text-[#8C7B6B]' : 'text-stone-500'}`}
            >
              {t('collectionUnavailableDesc')}
            </p>
            <div className="space-y-2">
              <Button
                onClick={() => openAuthModal('signin')}
                size="lg"
                className="w-full"
                data-testid="collection-unavailable-sign-in"
              >
                {t('login')}
              </Button>
              {sampleCollectionId && (
                <Button
                  onClick={() => navigate(`/collection/${sampleCollectionId}`)}
                  size="lg"
                  variant="secondary"
                  className="w-full"
                  data-testid="collection-unavailable-explore"
                >
                  {t('exploreSample')}
                </Button>
              )}
            </div>
          </div>
        </div>
      );
    }
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-6 sm:space-y-10 animate-in slide-in-from-bottom-4 duration-500">
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

      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 sm:gap-8">
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
                {t(collection.items.length === 1 ? 'artifactCataloged' : 'artifactsCataloged', {
                  n: collection.items.length,
                })}
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
          {/* CUR-160: keep the primary actions on one row on mobile so item
              cards surface sooner. Add Item stays the emphasized primary;
              Enter Exhibition collapses to a compact icon beside it, and only
              takes the full labelled treatment when it is the sole action
              (e.g. a read-only sample collection with no Add Item button). */}
          <div className="flex flex-row items-center gap-3 sm:gap-4 w-full">
            {canAddItems && (
              <Button
                variant="primary"
                onClick={() => openAddItemModal(collection.id)}
                icon={<Plus size={16} />}
                className="shadow-md flex-1 sm:flex-none sm:w-auto"
              >
                {t('addItem')}
              </Button>
            )}
            {hasItems && (
              <Button
                variant="primary"
                onClick={() => setIsExhibitionOpen(true)}
                icon={<Play size={16} />}
                aria-label={t('enterExhibition')}
                title={t('enterExhibition')}
                className={`shadow-md ${canAddItems ? 'w-11 !px-0 sm:w-auto sm:!px-6' : 'flex-1 sm:flex-none sm:w-auto'}`}
              >
                <span className={canAddItems ? 'hidden sm:inline' : undefined}>
                  {t('enterExhibition')}
                </span>
              </Button>
            )}
          </div>
          {/* CUR-160: item-oriented controls only make sense once a collection
              has items — hide Exhibition/Select/Sort/Search/Filter on an empty
              collection so it shows just its empty-state CTA. Delete Collection
              stays available so an empty collection can still be removed. */}
          {(!isReadOnly || hasItems) && (
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
              {!isReadOnly && hasItems && (
                <Button
                  variant={isSelectionMode ? 'primary' : 'outline'}
                  onClick={handleToggleSelectionMode}
                  className={`${theme === 'vault' ? 'bg-stone-900 text-white border-white/10' : 'bg-white'} h-11`}
                  icon={<CheckSquare size={16} />}
                >
                  {isSelectionMode ? t('done') : t('selectItems')}
                </Button>
              )}
              {hasItems && (
                <>
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
                      className={`w-11 h-11 sm:w-10 sm:h-10 flex items-center justify-center !p-0 rounded-xl ${theme === 'vault' ? 'bg-stone-900 border-white/10' : activeFilterCount > 0 ? '' : 'bg-white'}`}
                      onClick={() => setIsFilterModalOpen(true)}
                      aria-label={t('filterCollection')}
                      title={t('filterCollection')}
                    >
                      <SlidersHorizontal size={18} />
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
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
                onClick={() => openAddItemModal(collection.id)}
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
