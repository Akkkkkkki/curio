import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AlertCircle, Sparkles, Calendar, Search, Plus, Loader2, X } from 'lucide-react';
import { useTranslation } from '../i18n';
import { useTheme, typographyClasses, accentColorClasses, labelColorClasses } from '../theme';
import { UserCollection } from '../types';
import { Button } from './ui/Button';
import { CollectionCardSkeleton } from './ui/Skeleton';
import { CollectionCard } from './CollectionCard';
import { ItemImage } from './ItemImage';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

interface HomeScreenProps {
  collections: UserCollection[];
  stats: {
    totalItems: number;
    totalCollections: number;
    featured: any;
    historyItems: any[];
  };
  isLoading: boolean;
  loadError: string | null;
  sampleCollection: UserCollection | undefined;
  refreshCollections: () => void;
  handleAddAction: () => void;
  handleCreateCollectionAction: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  collections,
  stats,
  isLoading,
  loadError,
  sampleCollection,
  refreshCollections,
  handleAddAction,
  handleCreateCollectionAction,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput, 250);
  const normalizedSearch = debouncedSearch.trim().toLowerCase();
  const hasSearch = normalizedSearch.length > 0;
  const hasOwnedContent = collections.length > 0;

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
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const visibleHistoryItems = historyExpanded ? historyItems : historyPreview;

  if (isLoading)
    return (
      <div className="px-4 pt-8 max-w-3xl mx-auto space-y-6">
        <div className="text-center mb-8">
          <Loader2 className="text-stone-300 animate-spin mx-auto mb-4" size={24} />
          <p className="text-stone-400 font-serif italic text-sm">{t('restoringArchives')}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <CollectionCardSkeleton />
          <CollectionCardSkeleton />
        </div>
      </div>
    );

  if (loadError)
    return (
      <div className="flex flex-col items-center justify-center px-4 py-16 sm:py-24">
        <div
          className={`max-w-md w-full text-center border rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-10 shadow-xl ${theme === 'vault' ? 'bg-white/5 border-white/10' : theme === 'atelier' ? 'bg-[#EDE4D3]/70 border-[#D4C9B8]' : 'bg-white/70 border-stone-200'}`}
        >
          <div
            className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 sm:mb-6 ${theme === 'vault' ? 'bg-amber-500/10 text-amber-400' : theme === 'atelier' ? 'bg-[#A86F3C]/10 text-[#A86F3C]' : 'bg-amber-50 text-amber-600'}`}
          >
            <AlertCircle size={24} />
          </div>
          <h2
            className={`font-serif text-2xl font-bold mb-2 ${theme === 'vault' ? 'text-white' : theme === 'atelier' ? 'text-[#3D3530]' : 'text-stone-900'}`}
          >
            {t('syncPausedTitle')}
          </h2>
          <p
            className={`text-sm mb-6 ${theme === 'vault' ? 'text-stone-400' : theme === 'atelier' ? 'text-[#8C7B6B]' : 'text-stone-500'}`}
          >
            {loadError}
          </p>
          <Button onClick={() => refreshCollections()} size="lg" className="w-full">
            {t('actionRetry')}
          </Button>
        </div>
      </div>
    );

  const themeBaseClasses = {
    gallery: 'bg-white text-stone-900 border-stone-100',
    vault: 'bg-stone-950 text-white border-white/5',
    atelier: 'bg-[#faf9f6] text-stone-800 border-[#e8e6e1] shadow-inner',
  };

  if (!hasOwnedContent) {
    return (
      <div className="min-h-[calc(100vh-9rem)] flex items-center justify-center px-4 py-10 sm:py-16 animate-in fade-in duration-700">
        <section
          className={`w-full max-w-3xl text-center rounded-[2rem] sm:rounded-[2.5rem] border px-5 py-10 sm:px-10 sm:py-14 shadow-xl ${theme === 'vault' ? 'bg-white/5 border-white/10' : theme === 'atelier' ? 'bg-[#EDE4D3]/70 border-[#D4C9B8]' : 'bg-white/85 border-stone-100'}`}
          aria-labelledby="first-run-heading"
        >
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500 text-white shadow-lg shadow-amber-500/20">
            <Sparkles size={24} />
          </div>
          <p className={`${typographyClasses.label} ${accentColorClasses[theme]} mb-3`}>
            {t('firstRunEyebrow')}
          </p>
          <h1
            id="first-run-heading"
            className={`${typographyClasses.titleHero} mx-auto max-w-2xl leading-tight`}
          >
            {t('firstRunTitle')}
          </h1>
          <p
            className={`mx-auto mt-4 max-w-xl font-serif text-base italic leading-relaxed sm:text-lg ${theme === 'vault' ? 'text-stone-300' : theme === 'atelier' ? 'text-[#6F6257]' : 'text-stone-600'}`}
          >
            {t('firstRunSubtitle')}
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button onClick={handleAddAction} size="lg" className="w-full sm:w-auto shadow-sm">
              {t('firstRunPrimary')}
            </Button>
            {sampleCollection && (
              <Link to={`/collection/${sampleCollection.id}`} className="w-full sm:w-auto">
                <Button
                  variant="secondary"
                  size="lg"
                  icon={<Sparkles size={16} />}
                  className="w-full sm:w-auto"
                >
                  {t('firstRunSecondary')}
                </Button>
              </Link>
            )}
          </div>
          <p className={`${typographyClasses.labelMuted} mt-6`}>{t('firstRunFooter')}</p>
        </section>
      </div>
    );
  }

  return (
    <div className={`space-y-10 sm:space-y-12 animate-in fade-in duration-700`}>
      <header className="space-y-2">
        <p className={`${typographyClasses.label} ${accentColorClasses[theme]}`}>
          {t('homeWelcome')}
        </p>
        <h1 className={`${typographyClasses.titleHero} leading-tight`}>{t('homeMuseumTitle')}</h1>
        <p
          className={`max-w-2xl font-serif text-sm italic sm:text-base ${theme === 'vault' ? 'text-stone-300' : theme === 'atelier' ? 'text-[#6F6257]' : 'text-stone-600'}`}
        >
          {t('homeMuseumSubtitle', {
            collections: stats.totalCollections,
            items: stats.totalItems,
          })}
        </p>
      </header>

      <div className="relative max-w-xl mx-auto px-4">
        <div className="relative">
          <Search
            className="absolute left-5 sm:left-6 top-1/2 -translate-y-1/2 text-stone-400"
            size={20}
          />
          <input
            type="text"
            placeholder={t('searchPlaceholder')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className={`w-full pl-12 sm:pl-14 pr-12 sm:pr-14 py-3.5 sm:py-4 rounded-[1.5rem] sm:rounded-[1.75rem] border focus:ring-4 focus:ring-amber-500/5 outline-none transition-all shadow-lg text-sm sm:text-base font-serif italic placeholder:text-stone-300 ${theme === 'vault' ? 'bg-stone-900 border-white/10 text-white' : 'bg-white border-stone-200 text-stone-900'}`}
          />
          {searchInput.length > 0 && (
            <button
              type="button"
              onClick={() => setSearchInput('')}
              aria-label={t('clearSearch')}
              title={t('clearSearch')}
              className={`absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center transition-colors ${theme === 'vault' ? 'text-stone-300 hover:bg-white/10' : 'text-stone-400 hover:bg-stone-100 hover:text-stone-600'}`}
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {primaryHistoryItem && (
        <section
          className={`relative overflow-hidden rounded-[2rem] border p-5 shadow-md transition-all duration-500 sm:p-6 ${themeBaseClasses[theme]}`}
        >
          <div className="grid gap-5 md:grid-cols-[180px_1fr] md:items-center">
            <div className="aspect-square overflow-hidden rounded-2xl bg-stone-100 shadow-inner">
              <ItemImage
                itemId={primaryHistoryItem.id}
                collectionId={primaryHistoryItem.collectionId}
                photoUrl={primaryHistoryItem.photoUrl}
                enhancedPath={primaryHistoryItem.photoEnhancedPath}
                type="enhanced"
                alt={primaryHistoryItem.title || t('historyTitle')}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${theme === 'vault' ? 'bg-amber-500/10 text-amber-400' : theme === 'atelier' ? 'bg-[#A86F3C]/10 text-[#A86F3C]' : 'bg-amber-50 text-amber-600'}`}
                >
                  <Calendar size={18} />
                </div>
                <span className={`${typographyClasses.labelSmall} ${labelColorClasses[theme]}`}>
                  {t('onThisDay')}
                </span>
              </div>
              <div>
                <p className={`${typographyClasses.labelMuted} mb-1`}>{t('historyTitle')}</p>
                <h2 className={`${typographyClasses.titleLarge} leading-tight`}>
                  {primaryHistoryItem.title}
                </h2>
              </div>
              <div className="space-y-3">
                <ul id="on-this-day-list" className="space-y-2">
                  {visibleHistoryItems.map((item) => {
                    const itemYear = new Date(item.createdAt).getFullYear();
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() =>
                            navigate(`/collection/${item.collectionId}/item/${item.id}`)
                          }
                          className={`w-full text-left rounded-xl border px-3 py-2 text-xs sm:text-sm shadow-sm transition ${theme === 'vault' ? 'border-white/10 bg-white/5 hover:border-[#D4A574]/30 hover:bg-white/10' : theme === 'atelier' ? 'border-[#D4C9B8]/60 bg-[#EDE4D3]/70 hover:border-[#A86F3C]/30 hover:bg-[#EDE4D3]' : 'border-stone-200/60 bg-white/70 hover:border-amber-200 hover:bg-amber-50/60'}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`truncate font-medium ${theme === 'vault' ? 'text-white' : theme === 'atelier' ? 'text-[#3D3530]' : 'text-stone-700'}`}
                            >
                              {item.title}
                            </span>
                            <span
                              className={`text-[11px] uppercase tracking-wide ${theme === 'vault' ? 'text-stone-500' : theme === 'atelier' ? 'text-[#8C7B6B]' : 'text-stone-400'}`}
                            >
                              {itemYear}
                            </span>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {historyOverflow > 0 && !historyExpanded && (
                  <>
                    <p
                      className={`text-xs ${theme === 'vault' ? 'text-stone-500' : theme === 'atelier' ? 'text-[#8C7B6B]' : 'text-stone-400'}`}
                    >
                      {t('onThisDayMore', { count: historyOverflow })}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={() => setHistoryExpanded(true)}
                      aria-expanded={false}
                      aria-controls="on-this-day-list"
                    >
                      {t('onThisDaySeeAll', { count: historyItems.length })}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

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

        {hasSearch && filteredCollections.length === 0 && (
          <div
            className={`col-span-full rounded-[2rem] border p-6 sm:p-8 text-center shadow-sm ${theme === 'vault' ? 'bg-white/5 border-white/10 text-stone-200' : 'bg-white/80 border-stone-100 text-stone-700'}`}
          >
            <p className={`${typographyClasses.titleLarge} italic mb-2`}>
              {t('searchNoResultsTitle')}
            </p>
            <p className={typographyClasses.labelMuted}>
              {t('searchNoResultsBody', { query: searchInput.trim() })}
            </p>
            <div className="mt-6 flex justify-center">
              <Button variant="outline" size="sm" onClick={() => setSearchInput('')}>
                {t('clearSearch')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
