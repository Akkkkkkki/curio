import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AlertCircle, Sparkles, Calendar, Search, Plus, Loader2 } from 'lucide-react';
import { useTranslation } from '../i18n';
import {
  useTheme,
  typographyClasses,
  accentColorClasses,
  dividerClasses,
  labelColorClasses,
} from '../theme';
import { UserCollection } from '../types';
import { Button } from './ui/Button';
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
  const [showOnboarding, setShowOnboarding] = useState(false);
  const debouncedSearch = useDebouncedValue(searchInput, 250);
  const normalizedSearch = debouncedSearch.trim().toLowerCase();
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
  const hasPrivateCollections = collections.some((c) => !c.isPublic);
  const shouldShowOnboarding = showOnboarding && !hasPrivateCollections;

  useEffect(() => {
    const dismissed = localStorage.getItem('curio_onboarding_dismissed') === 'true';
    setShowOnboarding(!dismissed);
  }, []);

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
          <h2 className="font-serif text-2xl font-bold text-stone-900 mb-2">
            {t('syncPausedTitle')}
          </h2>
          <p className="text-sm text-stone-500 mb-6">{loadError}</p>
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

  // Filter editable collections for the "Add First" CTA check
  const editableCollections = collections.filter((c) => !c.isPublic);

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
      {shouldShowOnboarding && (
        <div
          className={`rounded-[2rem] border p-5 sm:p-6 shadow-sm ${theme === 'vault' ? 'bg-white/5 border-white/10 text-white/80' : 'bg-white/80 border-stone-100 text-stone-700'}`}
        >
          <h3 className="text-sm font-semibold mb-2">{t('onboardingTitle')}</h3>
          <ul className="text-xs space-y-1">
            <li>{t('onboardingStepOne')}</li>
            <li>{t('onboardingStepTwo')}</li>
            <li>{t('onboardingStepThree')}</li>
          </ul>
          <div className="mt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                localStorage.setItem('curio_onboarding_dismissed', 'true');
                setShowOnboarding(false);
              }}
            >
              {t('gotIt')}
            </Button>
          </div>
        </div>
      )}
      {/* Bento Grid Hero */}
      <section className={`grid grid-cols-1 gap-6 ${historyItems.length ? 'md:grid-cols-3' : ''}`}>
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
                alt={stats.featured.title || t('featuredArtifact')}
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
                  alt={primaryHistoryItem.title || t('historyTitle')}
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
                        onClick={() => navigate(`/collection/${item.collectionId}/item/${item.id}`)}
                        className="w-full text-left rounded-xl border border-stone-200/60 bg-white/70 px-3 py-2 text-xs sm:text-sm shadow-sm transition hover:border-amber-200 hover:bg-amber-50/60"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-medium text-stone-700">{item.title}</span>
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
                  {t('viewHistory')}
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
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
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
              {t('searchNoResultsBody', { query: searchInput.trim() })}
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
