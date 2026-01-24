import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { UserCollection } from '../types';
import { ItemImage } from './ItemImage';
import { useTranslation } from '../i18n';

interface ExhibitionViewProps {
  collection: UserCollection;
  initialIndex?: number;
  isOpen: boolean;
  onClose: () => void;
}

export const ExhibitionView: React.FC<ExhibitionViewProps> = ({
  collection,
  initialIndex = 0,
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();
  const [index, setIndex] = useState(initialIndex);

  if (!isOpen || collection.items.length === 0) return null;

  const item = collection.items[index];
  const next = () => setIndex((i) => (i + 1) % collection.items.length);
  const prev = () => setIndex((i) => (i - 1 + collection.items.length) % collection.items.length);

  const content = (
    <div className="fixed inset-0 z-[9999] bg-stone-950 text-white animate-in fade-in duration-500 grid grid-rows-[auto_1fr_auto] pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)]">
      {/* Header - fixed height, no expansion */}
      <header className="py-3 px-4 sm:py-6 sm:px-8 flex justify-between items-center bg-gradient-to-b from-stone-950 via-stone-950/80 to-transparent">
        <div>
          <h2 className="text-[10px] font-mono tracking-[0.2em] uppercase opacity-40 mb-0.5">
            {collection.name}
          </h2>
          <p className="text-base sm:text-xl font-serif italic text-amber-500">
            {t('exhibitNo', { n: index + 1, total: collection.items.length })}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-2 sm:p-3 bg-white/10 hover:bg-white/20 rounded-full transition-all"
        >
          <X size={20} className="sm:w-6 sm:h-6" />
        </button>
      </header>

      {/* Content - fills remaining space, scrolls only when necessary */}
      <div className="relative min-h-0 overflow-y-auto overflow-x-hidden">
        <div className="h-full flex flex-col sm:flex-row items-start sm:items-center justify-start sm:justify-center px-4 sm:px-12 py-2 sm:py-4 gap-4 sm:gap-12">
          {/* Navigation arrows */}
          <button
            onClick={prev}
            className="hidden sm:flex absolute left-4 sm:left-8 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-white/5 hover:bg-white/10 items-center justify-center transition-all hover:scale-110 z-10"
          >
            <ChevronLeft size={24} className="sm:w-7 sm:h-7" />
          </button>

          <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-12 items-start sm:items-center animate-in zoom-in-95 duration-700">
            {/* Image container - responsive height based on viewport */}
            <div className="relative w-full max-w-xs sm:max-w-none mx-auto">
              <div className="aspect-[3/4] max-h-[50vh] sm:max-h-[60vh] rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl border border-white/10 group">
                <ItemImage
                  itemId={item.id}
                  photoUrl={item.photoUrl}
                  enhancedPath={item.photoEnhancedPath}
                  collectionId={item.collectionId ?? collection.id}
                  type="enhanced"
                  className="w-full h-full object-cover transition-transform duration-[2s] group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-stone-950/30 to-transparent pointer-events-none" />
              </div>
              {/* Mobile navigation arrows below image */}
              <div className="flex sm:hidden justify-center gap-8 mt-3">
                <button
                  onClick={prev}
                  className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={next}
                  className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>

            {/* Text content */}
            <div className="space-y-3 sm:space-y-6 text-center sm:text-left w-full">
              <div className="space-y-2 sm:space-y-3">
                {item.rating > 0 && (
                  <div className="flex items-center justify-center sm:justify-start gap-1 text-amber-500">
                    {[...Array(item.rating)].map((_, i) => (
                      <Star key={i} size={14} className="sm:w-4 sm:h-4" fill="currentColor" />
                    ))}
                  </div>
                )}
                <h1 className="text-2xl sm:text-4xl lg:text-5xl font-serif font-bold leading-tight">
                  {item.title}
                </h1>
                {item.notes && (
                  <p className="text-stone-400 text-sm sm:text-lg font-light leading-relaxed font-serif italic sm:border-l-2 border-stone-800 sm:pl-4 line-clamp-3 sm:line-clamp-4">
                    {item.notes}
                  </p>
                )}
              </div>

              {/* Custom fields - show fewer on mobile */}
              {collection.customFields.length > 0 && (
                <div className="grid grid-cols-2 gap-x-4 sm:gap-x-8 gap-y-2 sm:gap-y-4 pt-3 sm:pt-6 border-t border-white/10 text-left">
                  {collection.customFields.slice(0, 4).map((f) => {
                    const value = item.data[f.id];
                    if (!value) return null;
                    return (
                      <div key={f.id}>
                        <p className="text-[8px] sm:text-[10px] font-mono tracking-widest uppercase opacity-40 mb-0.5">
                          {f.label}
                        </p>
                        <p className="text-xs sm:text-base font-medium truncate">{value}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Desktop right arrow */}
          <button
            onClick={next}
            className="hidden sm:flex absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-white/5 hover:bg-white/10 items-center justify-center transition-all hover:scale-110 z-10"
          >
            <ChevronRight size={24} className="sm:w-7 sm:h-7" />
          </button>
        </div>
      </div>

      {/* Footer - fixed height, pagination */}
      <footer className="py-3 px-4 sm:py-6 sm:px-8 flex justify-center bg-gradient-to-t from-stone-950 via-stone-950/80 to-transparent">
        <div className="flex gap-1.5 sm:gap-2 items-center">
          {collection.items.slice(0, 10).map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={`h-1 sm:h-1.5 rounded-full transition-all ${
                i === index
                  ? 'w-6 sm:w-10 bg-amber-500'
                  : 'w-1.5 sm:w-3 bg-white/20 hover:bg-white/30'
              }`}
            />
          ))}
          {collection.items.length > 10 && (
            <span className="text-[10px] opacity-40 ml-1">+{collection.items.length - 10}</span>
          )}
        </div>
      </footer>
    </div>
  );

  // Use portal to render outside the Layout's stacking context
  return createPortal(content, document.body);
};
