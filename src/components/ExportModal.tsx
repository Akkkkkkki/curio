import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { X, Printer, Share2, Download, Maximize2, Minimize2, Loader2, Camera } from 'lucide-react';
import { toBlob } from 'html-to-image';
import { CollectionItem, FieldDefinition } from '../types';
import { Button } from './ui/Button';
import { extractCurioAssetPath, getAsset, getEnhancedAsset } from '../services/db';
import { useTranslation } from '../i18n';
import { trackEvent } from '../services/analytics';
import type { StatusTone } from './StatusToast';

const sanitizeFilename = (value: string) =>
  value
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 80) || 'curio-card';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: CollectionItem;
  fields: FieldDefinition[];
  // CUR-106: lets the modal surface positive / informational outcomes through
  // the shared toast pattern (Saved / Synced / Will sync style). Real errors
  // still render inline next to the action buttons.
  onStatus?: (message: string, tone: StatusTone) => void;
}

type TemplateStyle = 'minimal' | 'full' | 'retro';
type AspectRatio = '1:1' | '3:4' | '9:16';
type ImageFit = 'cover' | 'contain';

// CUR-99: rasterize the card at a fixed minimum short-edge resolution
// (1080px) instead of inheriting the viewport-dependent preview size, so
// a phone export reads as sharp as a desktop export when re-shared.
const EXPORT_TARGET_SHORT_EDGE_PX = 1080;

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  item,
  fields,
  onStatus,
}) => {
  const { t } = useTranslation();
  const [style, setStyle] = useState<TemplateStyle>('minimal');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('3:4');
  const [imageFit, setImageFit] = useState<ImageFit>('cover');
  // CUR-105: open the mobile bottom sheet so Save / Share / Print are visible on
  // first open. The open height is a moderate fraction of the screen (see
  // OPEN_SHEET_HEIGHT) so the card stays prominent above it; users can drag the
  // handle / tap it to collapse to a peek and admire the card, then drag or tap
  // again to re-open. Desktop is unaffected (sheet is forced full-height at md:).
  const [isExpanded, setIsExpanded] = useState(true);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoadingImage, setIsLoadingImage] = useState(true);
  // CUR-137: distinguish "no photo on this item" from "photo failed to load".
  // The card preview used to render whatever the browser put in the broken
  // `<img>` slot (a default broken-image glyph), which then also poisoned
  // html-to-image's canvas. Surface the same `noPhoto` placeholder either way
  // so the exported PNG is intentional, not an accident.
  const [imageLoadError, setImageLoadError] = useState(false);
  const [exportAction, setExportAction] = useState<null | 'save' | 'share'>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{
    startY: number;
    startHeight: number;
    pointerId: number;
    moved: boolean;
  } | null>(null);
  const remoteAssetPath = useMemo(() => {
    if (!item.photoUrl || item.photoUrl === 'asset') return null;
    const extracted = extractCurioAssetPath(item.photoUrl);
    if (extracted) return extracted;
    if (
      item.photoUrl.startsWith('http') ||
      item.photoUrl.startsWith('data:') ||
      item.photoUrl.startsWith('blob:') ||
      item.photoUrl.startsWith('/')
    ) {
      return null;
    }
    if (
      item.photoUrl.endsWith('.jpg') ||
      item.photoUrl.endsWith('.jpeg') ||
      item.photoUrl.endsWith('.png') ||
      item.photoUrl.endsWith('.webp')
    ) {
      return item.photoUrl;
    }
    return null;
  }, [item.photoUrl]);

  const directPhotoUrl = useMemo(() => {
    const url = item.photoUrl;
    if (!url || url === 'asset') return null;
    if (remoteAssetPath) return null;
    if (
      url.startsWith('http') ||
      url.startsWith('data:') ||
      url.startsWith('blob:') ||
      url.startsWith('/')
    ) {
      return url;
    }
    return `${import.meta.env.BASE_URL}${url}`;
  }, [item.photoUrl, remoteAssetPath]);

  useEffect(() => {
    if (!isOpen) {
      setImageUrl(null);
      setImageLoadError(false);
      return;
    }
    setImageLoadError(false);
    if (directPhotoUrl) {
      setImageUrl(directPhotoUrl);
      setIsLoadingImage(false);
      return;
    }
    let objectUrl: string | null = null;
    const loadImage = async () => {
      setIsLoadingImage(true);
      setImageUrl(null);
      try {
        let blob = await getEnhancedAsset(item.id, {
          enhancedPath: item.photoEnhancedPath,
          collectionId: item.collectionId,
        });
        if (!blob || blob.size === 0) {
          blob = await getAsset(
            item.id,
            'original',
            remoteAssetPath || undefined,
            item.collectionId,
          );
        }
        if (!blob || blob.size === 0) {
          blob = await getAsset(
            item.id,
            'display',
            remoteAssetPath || undefined,
            item.collectionId,
          );
        }
        if (blob && blob.size > 0) {
          objectUrl = URL.createObjectURL(blob);
          setImageUrl(objectUrl);
        } else {
          setImageLoadError(true);
        }
      } catch (e) {
        console.error(e);
        setImageLoadError(true);
      } finally {
        setIsLoadingImage(false);
      }
    };
    loadImage();
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [isOpen, item.id, item.collectionId, item.photoEnhancedPath, remoteAssetPath, directPhotoUrl]);

  const renderCardToBlob = useCallback(async (): Promise<Blob | null> => {
    const node = cardRef.current;
    if (!node) return null;
    const imgs = Array.from(node.querySelectorAll('img'));
    await Promise.all(
      imgs.map(
        (img) =>
          new Promise<void>((resolve) => {
            // `complete` is terminal for both success and error — a broken image
            // has `complete: true` + `naturalWidth: 0` and will never fire load/error again.
            if (img.complete) {
              resolve();
              return;
            }
            const done = () => resolve();
            img.addEventListener('load', done, { once: true });
            img.addEventListener('error', done, { once: true });
            // Safety net: never block export on a stuck network request.
            setTimeout(done, 3000);
          }),
      ),
    );
    // Width is the short edge for every supported aspect ratio (1:1, 3:4, 9:16),
    // so scaling pixelRatio off offsetWidth is enough. Floor at 2 so retina
    // desktop exports keep their current quality.
    const previewWidth = node.offsetWidth;
    const pixelRatio =
      previewWidth > 0 ? Math.max(2, EXPORT_TARGET_SHORT_EDGE_PX / previewWidth) : 2;
    try {
      return await toBlob(node, {
        pixelRatio,
        backgroundColor: '#ffffff',
      });
    } catch (err) {
      // html-to-image inlines the brand web fonts by fetching them. If that
      // fetch fails (offline, CSP, flaky network) the whole export rejects.
      // Retry without font embedding so the user still gets a card — it falls
      // back to system serif/mono, which is far better than a hard failure.
      console.warn('Card export failed with embedded fonts, retrying without them:', err);
      return await toBlob(node, {
        pixelRatio,
        backgroundColor: '#ffffff',
        skipFonts: true,
      });
    }
  }, []);

  const handleSaveImage = useCallback(async () => {
    if (exportAction) return;
    setExportAction('save');
    setExportError(null);
    try {
      const blob = await renderCardToBlob();
      if (!blob) throw new Error('render-failed');
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${sanitizeFilename(item.title || 'curio-card')}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      // CUR-106: browser download chrome is easy to miss inside the dark
      // export overlay (and on mobile is sometimes invisible). Mirror the
      // trust pattern used for Saved / Synced so the outcome is explicit.
      onStatus?.(t('imageSaved'), 'success');
    } catch (err) {
      console.error('Save image failed:', err);
      setExportError(t('saveImageFailed'));
    } finally {
      setExportAction(null);
    }
  }, [exportAction, item.title, onStatus, renderCardToBlob, t]);

  const handleShare = useCallback(async () => {
    if (exportAction) return;
    trackEvent('share_initiated', { surface: 'item_card' });
    setExportAction('share');
    setExportError(null);
    try {
      const blob = await renderCardToBlob();
      if (!blob) throw new Error('render-failed');
      const filename = `${sanitizeFilename(item.title || 'curio-card')}.png`;
      const file = new File([blob], filename, { type: 'image/png' });
      const nav = navigator as Navigator & {
        canShare?: (data: { files: File[] }) => boolean;
      };
      if (typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: item.title || t('exportCard') });
        trackEvent('share_completed', { method: 'native', surface: 'item_card' });
        return;
      }
      // No share target — fall back to download so the user still gets the image.
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      trackEvent('share_completed', { method: 'download_fallback', surface: 'item_card' });
      // CUR-106: fallback download is the standard path on most desktop
      // browsers — it is not a failure. Surface it as a neutral info toast
      // ("Sharing isn't available — image saved instead") so the user
      // understands what happened, instead of a red `role="alert"` in the
      // footer that read as broken every time.
      onStatus?.(t('shareUnavailableSavedInstead'), 'info');
    } catch (err) {
      const error = err as DOMException;
      if (error?.name === 'AbortError') return;
      console.error('Share failed:', err);
      trackEvent('share_failed', {
        reason: error?.name || 'unknown',
        surface: 'item_card',
      });
      setExportError(t('saveImageFailed'));
    } finally {
      setExportAction(null);
    }
  }, [exportAction, item.title, onStatus, renderCardToBlob, t]);

  const PEEK_HEIGHT_PX = 56;
  // Moderate open height: tall enough to reveal the action footer (Save / Share /
  // Print) while leaving the card prominent above the sheet. Clamped so the
  // footer still fits on short screens and the sheet never dominates tall ones.
  const OPEN_SHEET_HEIGHT = 'clamp(20rem, 52dvh, 32rem)';
  // Past this drag delta we commit to the new state; smaller drags snap back to
  // the current state so a tap-sized wobble never flips the sheet.
  const SNAP_DELTA_PX = 48;

  const handleSheetPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (window.matchMedia('(min-width: 768px)').matches) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const startHeight = sheetRef.current?.offsetHeight ?? PEEK_HEIGHT_PX;
    dragStateRef.current = {
      startY: e.clientY,
      startHeight,
      pointerId: e.pointerId,
      moved: false,
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  };

  const handleSheetPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dy = e.clientY - drag.startY;
    if (Math.abs(dy) > 4) drag.moved = true;
    const minH = PEEK_HEIGHT_PX;
    const maxH = window.innerHeight * 0.92;
    const next = Math.max(minH, Math.min(maxH, drag.startHeight - dy));
    setDragHeight(next);
  };

  const handleSheetPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
    const finalHeight = dragHeight ?? drag.startHeight;
    if (drag.moved) {
      // Snap by drag *direction* relative to where the drag started, not an
      // absolute screen fraction. The old absolute threshold meant a short swipe
      // up from the peek could never clear it, so a collapsed sheet got stuck.
      const delta = finalHeight - drag.startHeight; // > 0 means dragged up (grew)
      if (delta > SNAP_DELTA_PX) {
        setIsExpanded(true);
      } else if (delta < -SNAP_DELTA_PX) {
        setIsExpanded(false);
      }
      // Otherwise keep the current state — the sheet snaps back to its prior snap.
    } else {
      setIsExpanded((prev) => !prev);
    }
    setDragHeight(null);
    dragStateRef.current = null;
  };

  if (!isOpen) return null;

  const getValue = (fieldId: string) => {
    const val = item.data[fieldId];
    return val !== undefined && val !== null ? val.toString() : null;
  };

  // CUR-137: only set crossOrigin for HTTP(S) sources. Setting it on `blob:` /
  // `data:` URLs is a no-op in spec terms but some browsers cache differently;
  // for same-origin assets (relative paths) the attribute is unnecessary.
  const imgCrossOrigin = imageUrl && /^https?:\/\//i.test(imageUrl) ? 'anonymous' : undefined;
  const handleImageError = () => setImageLoadError(true);
  const hasPhoto = Boolean(imageUrl) && !imageLoadError;

  const renderCardPreview = () => {
    const containerStyles = {
      minimal:
        'bg-white p-6 flex flex-col items-center text-center justify-between border-[12px] border-white',
      full: 'bg-stone-900 text-white p-6 flex flex-col justify-end relative',
      retro: 'bg-[#f4ebd9] p-4 flex flex-col border-4 border-stone-800',
    };
    const titleSize = aspectRatio === '1:1' ? 'text-xl' : 'text-3xl';
    const metaSize = aspectRatio === '1:1' ? 'text-[8px]' : 'text-[10px]';
    const [ratioW, ratioH] = aspectRatio.split(':').map(Number);
    const previewMaxWidth = 'min(85vw, 560px)';

    return (
      // CUR-136 follow-up: fill the available height first and derive the
      // width from `aspect-ratio`, capped at `previewMaxWidth`. Fixing the
      // width and only clamping `max-height` (the old shape) squashes the
      // ratio whenever the container is shorter than the natural card height
      // — most visibly when the bottom sheet is expanded on a phone, where
      // it also baked the squash into `renderCardToBlob()`'s export.
      <div
        id="card-preview"
        ref={cardRef}
        className={`isolate shadow-2xl transition-all duration-300 overflow-hidden relative group select-none mx-auto print:h-auto print:!w-[100mm]`}
        style={{
          aspectRatio: `${ratioW} / ${ratioH}`,
          height: '100%',
          width: 'auto',
          maxWidth: previewMaxWidth,
          maxHeight: '100%',
        }}
      >
        <div className={`w-full h-full ${containerStyles[style]} transition-all duration-300`}>
          {style === 'minimal' && (
            <>
              <div
                className={`w-full overflow-hidden mb-4 ring-4 ring-stone-100 bg-stone-50 relative flex-1 rounded-xl min-h-0`}
              >
                {isLoadingImage ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="animate-spin text-stone-200" />
                  </div>
                ) : hasPhoto ? (
                  <img
                    src={imageUrl!}
                    crossOrigin={imgCrossOrigin}
                    onError={handleImageError}
                    className={`w-full h-full ${imageFit === 'contain' ? 'object-contain' : 'object-cover'}`}
                    alt={item.title || t('photoPreview')}
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-stone-200">
                    <Camera size={40} />
                    <span className="text-xs">{t('noPhoto')}</span>
                  </div>
                )}
              </div>
              <div className="flex-shrink-0 w-full">
                <h3
                  className={`font-serif ${titleSize} font-bold text-stone-900 leading-tight mb-2 break-words`}
                >
                  {item.title}
                </h3>
                <div className="flex gap-1 justify-center text-amber-400 mb-3">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className={i < item.rating ? 'text-amber-400' : 'text-stone-200'}>
                      ★
                    </span>
                  ))}
                </div>
              </div>
              <div className="mt-5 pt-3 border-t border-stone-100 w-full flex-shrink-0 flex justify-between items-center">
                <p className={`${metaSize} text-stone-400 font-mono uppercase tracking-widest`}>
                  {t('appTitle')} {t('appSubtitle')}
                </p>
                <p className={`${metaSize} text-stone-300 font-mono`}>{new Date().getFullYear()}</p>
              </div>
            </>
          )}
          {style === 'full' && (
            <>
              {hasPhoto && (
                <div className="absolute inset-0">
                  <img
                    src={imageUrl!}
                    crossOrigin={imgCrossOrigin}
                    onError={handleImageError}
                    className={`w-full h-full ${imageFit === 'contain' ? 'object-contain' : 'object-cover'} opacity-80`}
                    alt=""
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-stone-900 via-stone-900/40 to-transparent z-20" />
                </div>
              )}
              <div className={`relative z-30 flex flex-col h-full justify-end text-left`}>
                <h3
                  className={`font-serif ${aspectRatio === '1:1' ? 'text-2xl' : 'text-4xl'} font-bold text-white mb-2 leading-none`}
                >
                  {item.title}
                </h3>
                <p
                  className={`text-stone-300 text-sm line-clamp-2 mb-6 ${aspectRatio === '1:1' ? 'hidden' : 'block'}`}
                >
                  {item.notes}
                </p>
              </div>
            </>
          )}
          {style === 'retro' && (
            <>
              <div className="w-full flex-1 border-2 border-stone-800 mb-4 bg-stone-200 grayscale contrast-125 overflow-hidden relative min-h-0">
                {hasPhoto && (
                  <img
                    src={imageUrl!}
                    crossOrigin={imgCrossOrigin}
                    onError={handleImageError}
                    className={`w-full h-full mix-blend-multiply ${imageFit === 'contain' ? 'object-contain' : 'object-cover'}`}
                    alt=""
                  />
                )}
              </div>
              <div className="flex-shrink-0 text-left">
                <div className="flex justify-between items-end gap-3 border-b-2 border-stone-800 pb-2 mb-3">
                  <h3
                    className={`font-serif ${aspectRatio === '1:1' ? 'text-lg' : 'text-2xl'} font-bold text-stone-900 uppercase tracking-tighter break-words min-w-0 flex-1`}
                  >
                    {item.title}
                  </h3>
                  {item.rating > 0 && (
                    <span
                      className="font-mono text-xs font-bold bg-stone-900 text-[#f4ebd9] px-1 flex-shrink-0"
                      aria-label={t('ratedOutOfFive', { rating: item.rating })}
                    >
                      {'★'.repeat(item.rating)}
                    </span>
                  )}
                </div>
                <div
                  className={`text-center ${metaSize} font-mono text-stone-400 mt-4 uppercase tracking-widest`}
                >
                  {t('archivalRecord')} • {new Date().toLocaleDateString()}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  const isDragging = dragHeight !== null;
  const mobileSheetHeight = isDragging
    ? `${dragHeight}px`
    : isExpanded
      ? OPEN_SHEET_HEIGHT
      : 'var(--peek-height)';

  return (
    <div
      data-export-modal
      className={`fixed inset-0 z-50 bg-stone-950/90 backdrop-blur-md animate-in fade-in duration-200 print:bg-white print:static print:block print:inset-auto print:h-auto print:overflow-visible overflow-hidden pt-[env(safe-area-inset-top,0px)] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)]`}
      style={
        {
          '--peek-height': `calc(${PEEK_HEIGHT_PX}px + env(safe-area-inset-bottom, 0px))`,
        } as React.CSSProperties
      }
    >
      {/* CUR-136: on mobile the preview's bottom tracks the sheet height so the
          card stays fully visible above whatever portion of the sheet is up.
          The desktop override (`md:!bottom-0`) keeps the sidebar layout, where
          the preview spans the full height beside a fixed-width sheet. */}
      <div
        className={`absolute top-0 left-0 right-0 flex flex-col items-center justify-center px-6 py-6 md:!bottom-0 md:pr-[calc(24rem+1.5rem)] overflow-hidden print:static print:inset-auto print:p-0 print:block pointer-events-none ${
          isDragging ? '' : 'transition-[bottom] duration-300 ease-out'
        }`}
        style={{ bottom: mobileSheetHeight }}
      >
        <div className="h-full w-full flex items-center justify-center print:block print:h-auto print:w-auto">
          {renderCardPreview()}
        </div>
      </div>
      {isExpanded && (
        // Transparent tap-outside-to-collapse overlay. Touch-only convenience
        // duplicating the drag handle; the action collapses the sheet, it does
        // not close the modal — so it stays out of the a11y tree (the X button
        // in the sheet header remains the single accessible Close action).
        <button
          type="button"
          aria-hidden="true"
          tabIndex={-1}
          onClick={() => setIsExpanded(false)}
          data-testid="export-sheet-tap-to-collapse"
          className="md:hidden absolute inset-0 z-[5] bg-transparent print:hidden"
          style={{ bottom: mobileSheetHeight }}
        />
      )}
      <div
        ref={sheetRef}
        className={`absolute inset-x-0 bottom-0 md:absolute md:top-0 md:left-auto md:inset-x-auto md:right-0 md:w-96 md:!h-full min-h-0 overflow-hidden bg-white rounded-t-3xl md:rounded-none shadow-2xl flex flex-col z-10 print:hidden [--export-footer-height:11.5rem] md:[--export-footer-height:12.5rem] ${isDragging ? '' : 'transition-[height] duration-300 ease-out'}`}
        style={{ height: mobileSheetHeight }}
      >
        <div
          className="md:hidden w-full h-14 shrink-0 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none"
          onPointerDown={handleSheetPointerDown}
          onPointerMove={handleSheetPointerMove}
          onPointerUp={handleSheetPointerUp}
          onPointerCancel={handleSheetPointerUp}
        >
          <div className="w-12 h-1.5 bg-stone-300 rounded-full" />
        </div>
        <div className="px-6 pb-4 md:pt-6 border-b border-stone-100 flex justify-between items-center shrink-0">
          <div>
            <h2 className="font-serif font-bold text-xl text-stone-900">{t('exportCard')}</h2>
          </div>
          <button
            onClick={onClose}
            aria-label={t('close')}
            className="p-2 -mr-2 text-stone-400 hover:text-stone-800 rounded-full hover:bg-stone-50"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 pb-[calc(var(--export-footer-height)+env(safe-area-inset-bottom,0px))] space-y-10">
          <div>
            <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-3">
              {t('cardStyle')}
            </label>
            <div className="grid grid-cols-1 gap-2">
              {['minimal', 'full', 'retro'].map((s) => (
                <button
                  key={s}
                  onClick={() => setStyle(s as TemplateStyle)}
                  className={`flex items-center p-3 rounded-xl border transition-all text-left group ${style === s ? 'border-amber-500 bg-amber-50/50 ring-1 ring-amber-500' : 'border-stone-200 hover:border-amber-200 hover:bg-stone-50'}`}
                >
                  <div
                    className={`w-10 h-10 rounded-lg mr-3 shadow-sm border ${s === 'minimal' ? 'bg-white border-stone-100' : s === 'full' ? 'bg-stone-800 border-stone-800' : 'bg-[#f4ebd9] border-stone-300'}`}
                  ></div>
                  <div>
                    <span className="font-bold text-stone-900 capitalize block">{t(s)}</span>
                    <span className="text-[10px] text-stone-500 uppercase tracking-wide">
                      {t(`${s}Tag`)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">
                {t('aspectRatio')}
              </label>
              <div className="flex gap-2">
                {['1:1', '3:4', '9:16'].map((r) => (
                  <button
                    key={r}
                    onClick={() => setAspectRatio(r as AspectRatio)}
                    className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-all ${aspectRatio === r ? 'bg-stone-800 text-white border-stone-800' : 'border-stone-200 text-stone-600 hover:bg-stone-50'}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">
                {t('imageFit')}
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setImageFit('contain')}
                  className={`flex-1 py-2 text-xs font-medium rounded-lg border flex items-center justify-center gap-1 ${imageFit === 'contain' ? 'bg-stone-800 text-white border-stone-800' : 'border-stone-200 text-stone-600 hover:bg-stone-50'}`}
                >
                  <Minimize2 size={12} /> {t('fit')}
                </button>
                <button
                  onClick={() => setImageFit('cover')}
                  className={`flex-1 py-2 text-xs font-medium rounded-lg border flex items-center justify-center gap-1 ${imageFit === 'cover' ? 'bg-stone-800 text-white border-stone-800' : 'border-stone-200 text-stone-600 hover:bg-stone-50'}`}
                >
                  <Maximize2 size={12} /> {t('fill')}
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="sticky bottom-0 border-t border-stone-100 bg-stone-50 space-y-3 shrink-0 px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] md:px-6 md:pt-6 md:pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] min-h-[var(--export-footer-height)]">
          {exportError && (
            <p className="text-xs text-rose-600" role="alert">
              {exportError}
            </p>
          )}
          <Button
            theme="gallery"
            className="w-full"
            size="lg"
            onClick={handleSaveImage}
            disabled={exportAction !== null || isLoadingImage}
            icon={
              exportAction === 'save' ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Download size={18} />
              )
            }
          >
            {exportAction === 'save' ? t('saving') : t('saveImage')}
          </Button>
          <Button
            theme="gallery"
            variant="outline"
            className="w-full"
            onClick={handleShare}
            disabled={exportAction !== null || isLoadingImage}
            icon={
              exportAction === 'share' ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Share2 size={16} />
              )
            }
          >
            {exportAction === 'share' ? t('sharing') : t('share')}
          </Button>
          <div className="flex justify-center">
            <Button
              theme="gallery"
              variant="ghost"
              size="sm"
              onClick={() => window.print()}
              disabled={exportAction !== null || isLoadingImage}
              icon={<Printer size={14} />}
            >
              {t('print')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
