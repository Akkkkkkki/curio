import React, { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, Star, Play, Pause } from 'lucide-react';
import { UserCollection } from '../types';
import { ItemImage } from './ItemImage';
import { useTranslation, getFieldTranslation } from '../i18n';
import { useModalA11y } from '../hooks/useModalA11y';

// CUR-32: optional auto-advance for ambient / passive display. Off by default;
// the exhibition stays a manual, deliberate walk unless the user opts in.
const AUTOPLAY_INTERVALS_MS = [5000, 10000, 30000] as const;
const DEFAULT_AUTOPLAY_INTERVAL_MS = 10000;

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
  const [showInfo, setShowInfo] = useState(true);
  // CUR-32: auto-play state. `interactionNonce` restarts the countdown whenever
  // the user takes over (nav / dot / swipe / toggle) so a manual move never
  // triggers an immediate auto-advance and the progress indicator resets.
  const [isPlaying, setIsPlaying] = useState(false);
  const [intervalMs, setIntervalMs] = useState<number>(DEFAULT_AUTOPLAY_INTERVAL_MS);
  const [interactionNonce, setInteractionNonce] = useState(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const itemCount = collection.items.length;
  const safeIndex = itemCount > 0 ? Math.min(Math.max(index, 0), itemCount - 1) : 0;
  const getFieldLabel = (fieldId: string, fallback: string) =>
    getFieldTranslation(t, fieldId, fallback);

  const registerInteraction = useCallback(() => setInteractionNonce((n) => n + 1), []);

  const next = useCallback(() => {
    if (itemCount === 0) return;
    registerInteraction();
    setIndex((i) => (Math.min(Math.max(i, 0), itemCount - 1) + 1) % itemCount);
  }, [itemCount, registerInteraction]);
  const prev = useCallback(() => {
    if (itemCount === 0) return;
    registerInteraction();
    setIndex((i) => (Math.min(Math.max(i, 0), itemCount - 1) - 1 + itemCount) % itemCount);
  }, [itemCount, registerInteraction]);
  const jumpTo = useCallback(
    (target: number) => {
      if (itemCount === 0) return;
      registerInteraction();
      setIndex(Math.min(Math.max(target, 0), itemCount - 1));
    },
    [itemCount, registerInteraction],
  );

  const canAutoplay = itemCount > 1;

  const toggleAutoplay = useCallback(() => {
    registerInteraction();
    setIsPlaying((p) => !p);
  }, [registerInteraction]);

  const selectInterval = useCallback(
    (ms: number) => {
      registerInteraction();
      setIntervalMs(ms);
      setIsPlaying(true);
    },
    [registerInteraction],
  );

  // Advance on a timer while playing. The timer reschedules from scratch on any
  // interaction (via `interactionNonce`) or interval change, so it never fires
  // right after the user has just moved. Auto-advance itself uses `setIndex`
  // directly (not `next`) so it doesn't reset its own countdown.
  useEffect(() => {
    if (!isOpen || !isPlaying || !canAutoplay) return;
    const id = window.setInterval(() => {
      setIndex((i) => (Math.min(Math.max(i, 0), itemCount - 1) + 1) % itemCount);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [isOpen, isPlaying, canAutoplay, intervalMs, interactionNonce, itemCount]);

  // Collection contents can change while the portal stays mounted (bulk delete
  // or cloud sync). Clamp the retained slide index before it can point past the
  // new end of the collection on later interactions.
  useEffect(() => {
    if (!isOpen || itemCount === 0) return;
    setIndex((i) => Math.min(Math.max(i, 0), itemCount - 1));
  }, [isOpen, itemCount]);

  // Closing the exhibition stops playback so re-opening always starts calm.
  useEffect(() => {
    if (!isOpen) setIsPlaying(false);
  }, [isOpen]);

  // Esc-to-close, focus trap and focus restore live in the shared modal a11y
  // primitive; only arrow-key navigation is bespoke to the exhibition view.
  useModalA11y(dialogRef, isOpen, onClose);
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, next, prev]);

  if (!isOpen || itemCount === 0) return null;

  const item = collection.items[safeIndex];

  // Touch handlers for swipe navigation
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
    // Only swipe if horizontal movement > 50px and dominates vertical
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) next();
      else prev();
    }
    touchStartRef.current = null;
  };

  const dialogLabel = `${collection.name} — ${t('exhibitNo', { n: safeIndex + 1, total: itemCount })}`;

  // CUR-32: the auto-play cluster (play/pause + interval pills) lives in both
  // the mobile and desktop layouts, mirroring how the close button, arrows and
  // dots are duplicated per breakpoint. `variant` only tweaks sizing.
  const renderAutoplayControls = (variant: 'mobile' | 'desktop') => {
    if (!canAutoplay) return null;
    const btnSize = variant === 'desktop' ? 'w-10 h-10' : 'w-9 h-9';
    return (
      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={toggleAutoplay}
          aria-pressed={isPlaying}
          aria-label={isPlaying ? t('exhibitionAutoplayPause') : t('exhibitionAutoplayStart')}
          className={`${btnSize} rounded-full flex items-center justify-center transition-all active:scale-90 ${
            isPlaying ? 'bg-amber-500 text-stone-950' : 'bg-white/10 text-white hover:bg-white/20'
          }`}
        >
          {isPlaying ? (
            <Pause size={16} fill="currentColor" />
          ) : (
            <Play size={16} fill="currentColor" />
          )}
        </button>
        {isPlaying && (
          <div className="flex items-center gap-1">
            {AUTOPLAY_INTERVALS_MS.map((ms) => {
              const seconds = ms / 1000;
              const active = intervalMs === ms;
              return (
                <button
                  key={ms}
                  type="button"
                  onClick={() => selectInterval(ms)}
                  aria-pressed={active}
                  aria-label={t('exhibitionAutoplayInterval', { n: seconds })}
                  className={`px-2 py-1 rounded-full text-[10px] font-mono tracking-wider transition-all ${
                    active
                      ? 'bg-amber-500 text-stone-950'
                      : 'bg-white/10 text-white/70 hover:bg-white/20'
                  }`}
                >
                  {t('exhibitionAutoplaySeconds', { n: seconds })}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const content = (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={dialogLabel}
      className="fixed inset-0 z-[9999] bg-stone-950 text-white animate-in fade-in duration-500 flex flex-col pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)]"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* CUR-32: countdown to the next auto-advance. Decorative (position is
          already announced via the dialog's accessible name), keyed so the
          fill restarts cleanly on every advance, interaction or interval
          change. */}
      {isPlaying && canAutoplay && (
        <div
          className="absolute top-0 inset-x-0 h-0.5 bg-white/10 z-20 print:hidden"
          aria-hidden="true"
        >
          <div
            key={`${safeIndex}-${interactionNonce}-${intervalMs}`}
            className="h-full bg-amber-500 animate-exhibition-progress"
            style={{ animationDuration: `${intervalMs}ms` }}
          />
        </div>
      )}
      {/* ── MOBILE LAYOUT (< sm) ── */}
      <div className="flex flex-col h-full sm:hidden">
        {/* Image: hero, fills most of the screen */}
        <div className="relative flex-1 min-h-0">
          <ItemImage
            itemId={item.id}
            photoUrl={item.photoUrl}
            enhancedPath={item.photoEnhancedPath}
            collectionId={item.collectionId ?? collection.id}
            type="enhanced"
            alt={item.title || t('archivalRecord')}
            className="w-full h-full object-contain"
          />
          {/* Gradient overlay at bottom for text legibility */}
          <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-stone-950 via-stone-950/70 to-transparent pointer-events-none" />
          {/* Top bar: collection name + close */}
          <div className="absolute inset-x-0 top-0 flex justify-between items-start px-4 pt-3 bg-gradient-to-b from-stone-950/60 to-transparent">
            <div>
              <h2 className="text-[10px] font-mono tracking-[0.2em] uppercase opacity-40">
                {collection.name}
              </h2>
              <p className="text-sm font-serif italic text-amber-500">
                {t('exhibitNo', { n: safeIndex + 1, total: itemCount })}
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label={t('close')}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-all"
            >
              <X size={18} />
            </button>
          </div>
          {/* Title overlaid at bottom of image */}
          <div className="absolute inset-x-0 bottom-0 px-4 pb-3">
            <button
              onClick={() => setShowInfo((s) => !s)}
              className="w-full text-left"
              aria-label={t('toggleDetails')}
            >
              {item.rating > 0 && (
                <div className="flex items-center gap-0.5 text-amber-500 mb-1">
                  {[...Array(item.rating)].map((_, i) => (
                    <Star key={i} size={12} fill="currentColor" />
                  ))}
                </div>
              )}
              <h1 className="text-xl font-serif font-bold leading-snug drop-shadow-lg">
                {item.title}
              </h1>
            </button>
          </div>
          {/* Navigation arrows - sides of image */}
          <button
            onClick={prev}
            aria-label={t('previous')}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center transition-all active:scale-90"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={next}
            aria-label={t('next')}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center transition-all active:scale-90"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Expandable info panel */}
        <div
          className={`transition-all duration-300 ease-in-out overflow-hidden ${showInfo ? 'max-h-60' : 'max-h-0'}`}
        >
          <div className="px-4 py-3 space-y-2">
            {item.notes && (
              <p className="text-stone-400 text-sm font-serif italic line-clamp-2">{item.notes}</p>
            )}
            {collection.customFields.length > 0 && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pt-2 border-t border-white/10">
                {collection.customFields.slice(0, 4).map((f) => {
                  const value = item.data[f.id];
                  if (!value) return null;
                  return (
                    <div key={f.id}>
                      <p className="text-[8px] font-mono tracking-widest uppercase opacity-40">
                        {getFieldLabel(f.id, f.label)}
                      </p>
                      <p className="text-xs font-medium truncate">{value}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Auto-play + pagination dots */}
        <div className="flex flex-col items-center gap-2 py-2.5">
          {renderAutoplayControls('mobile')}
          <div className="flex justify-center items-center gap-1.5">
            {collection.items.slice(0, 10).map((_, i) => (
              <button
                key={i}
                onClick={() => jumpTo(i)}
                aria-label={t('exhibitionJumpTo', { n: i + 1 })}
                aria-current={i === safeIndex ? 'true' : undefined}
                className={`h-1 rounded-full transition-all ${
                  i === safeIndex ? 'w-6 bg-amber-500' : 'w-1.5 bg-white/20 hover:bg-white/30'
                }`}
              />
            ))}
            {collection.items.length > 10 && (
              <span className="text-[10px] opacity-40 ml-1">+{collection.items.length - 10}</span>
            )}
          </div>
        </div>
      </div>

      {/* ── DESKTOP LAYOUT (>= sm) ── */}
      <div className="hidden sm:grid sm:grid-rows-[auto_1fr_auto] h-full">
        {/* Header */}
        <header className="py-6 px-8 flex justify-between items-center">
          <div>
            <h2 className="text-[10px] font-mono tracking-[0.2em] uppercase opacity-40 mb-0.5">
              {collection.name}
            </h2>
            <p className="text-xl font-serif italic text-amber-500">
              {t('exhibitNo', { n: safeIndex + 1, total: itemCount })}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label={t('close')}
            className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-all"
          >
            <X size={24} />
          </button>
        </header>

        {/* Content */}
        <div className="relative min-h-0 flex items-center justify-center px-20">
          {/* Navigation arrows */}
          <button
            onClick={prev}
            aria-label={t('previous')}
            className="absolute left-8 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all hover:scale-110 z-10"
          >
            <ChevronLeft size={28} />
          </button>

          <div className="max-w-5xl w-full grid grid-cols-[1.2fr_1fr] gap-12 items-center animate-in zoom-in-95 duration-700">
            {/* Image */}
            <div className="relative w-full h-full flex items-center justify-center">
              <div className="w-full max-h-[70vh] aspect-[3/4] rounded-2xl overflow-hidden shadow-2xl border border-white/10 group">
                <ItemImage
                  itemId={item.id}
                  photoUrl={item.photoUrl}
                  enhancedPath={item.photoEnhancedPath}
                  collectionId={item.collectionId ?? collection.id}
                  type="enhanced"
                  alt={item.title || t('archivalRecord')}
                  className="w-full h-full object-contain transition-transform duration-[2s] group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-stone-950/20 to-transparent pointer-events-none" />
              </div>
            </div>

            {/* Text content */}
            <div className="space-y-6 text-left">
              <div className="space-y-3">
                {item.rating > 0 && (
                  <div className="flex items-center gap-1 text-amber-500">
                    {[...Array(item.rating)].map((_, i) => (
                      <Star key={i} size={16} fill="currentColor" />
                    ))}
                  </div>
                )}
                <h1 className="text-4xl lg:text-5xl font-serif font-bold leading-tight">
                  {item.title}
                </h1>
                {item.notes && (
                  <p className="text-stone-400 text-lg font-light leading-relaxed font-serif italic border-l-2 border-stone-800 pl-4 line-clamp-4">
                    {item.notes}
                  </p>
                )}
              </div>

              {collection.customFields.length > 0 && (
                <div className="grid grid-cols-2 gap-x-8 gap-y-4 pt-6 border-t border-white/10">
                  {collection.customFields.slice(0, 4).map((f) => {
                    const value = item.data[f.id];
                    if (!value) return null;
                    return (
                      <div key={f.id}>
                        <p className="text-[10px] font-mono tracking-widest uppercase opacity-40 mb-0.5">
                          {getFieldLabel(f.id, f.label)}
                        </p>
                        <p className="text-base font-medium truncate">{value}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <button
            onClick={next}
            aria-label={t('next')}
            className="absolute right-8 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all hover:scale-110 z-10"
          >
            <ChevronRight size={28} />
          </button>
        </div>

        {/* Footer: auto-play + pagination */}
        <footer className="py-6 px-8 flex flex-col items-center gap-3">
          {renderAutoplayControls('desktop')}
          <div className="flex gap-2 items-center">
            {collection.items.slice(0, 10).map((_, i) => (
              <button
                key={i}
                onClick={() => jumpTo(i)}
                aria-label={t('exhibitionJumpTo', { n: i + 1 })}
                aria-current={i === safeIndex ? 'true' : undefined}
                className={`h-1.5 rounded-full transition-all ${
                  i === safeIndex ? 'w-10 bg-amber-500' : 'w-3 bg-white/20 hover:bg-white/30'
                }`}
              />
            ))}
            {collection.items.length > 10 && (
              <span className="text-[10px] opacity-40 ml-1">+{collection.items.length - 10}</span>
            )}
          </div>
        </footer>
      </div>
    </div>
  );

  // Use portal to render outside the Layout's stacking context
  return createPortal(content, document.body);
};
