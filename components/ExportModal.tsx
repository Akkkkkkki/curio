import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Printer,
  Share2,
  Download,
  Maximize2,
  Minimize2,
  Check,
  Loader2,
  Camera,
} from 'lucide-react';
import { CollectionItem, FieldDefinition } from '../types';
import { Button } from './ui/Button';
import { extractCurioAssetPath, getAsset } from '../services/db';
import { useTranslation } from '../i18n';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: CollectionItem;
  fields: FieldDefinition[];
}

type TemplateStyle = 'minimal' | 'full' | 'retro';
type AspectRatio = '1:1' | '3:4' | '9:16';
type ImageFit = 'cover' | 'contain';

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, item, fields }) => {
  const { t } = useTranslation();
  const [style, setStyle] = useState<TemplateStyle>('minimal');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('3:4');
  const [imageFit, setImageFit] = useState<ImageFit>('cover');
  const [isExpanded, setIsExpanded] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoadingImage, setIsLoadingImage] = useState(true);
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

  useEffect(() => {
    if (!isOpen) return;
    let objectUrl: string | null = null;
    const loadOriginal = async () => {
      setIsLoadingImage(true);
      try {
        const blob = await getAsset(
          item.id,
          'original',
          remoteAssetPath || undefined,
          item.collectionId,
        );
        if (blob) {
          objectUrl = URL.createObjectURL(blob);
          setImageUrl(objectUrl);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoadingImage(false);
      }
    };
    loadOriginal();
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [isOpen, item.id, item.collectionId, remoteAssetPath]);

  if (!isOpen) return null;

  const getValue = (fieldId: string) => {
    const val = item.data[fieldId];
    return val !== undefined && val !== null ? val.toString() : null;
  };

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
    const previewWidth = `min(80vw, 520px, calc((100dvh - var(--sheet-height)) * ${ratioW} / ${ratioH}))`;

    return (
      <div
        id="card-preview"
        className={`shadow-2xl transition-all duration-300 overflow-hidden relative group select-none h-auto mx-auto print:h-auto print:!w-[100mm]`}
        style={{ aspectRatio: `${ratioW} / ${ratioH}`, width: previewWidth }}
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
                ) : imageUrl ? (
                  <img
                    src={imageUrl}
                    className={`w-full h-full ${imageFit === 'contain' ? 'object-contain' : 'object-cover'}`}
                    alt=""
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
                  className={`font-serif ${titleSize} font-bold text-stone-900 leading-tight mb-2 line-clamp-2`}
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
              {imageUrl && (
                <div className="absolute inset-0">
                  <img
                    src={imageUrl}
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
                {imageUrl && (
                  <img
                    src={imageUrl}
                    className={`w-full h-full mix-blend-multiply ${imageFit === 'contain' ? 'object-contain' : 'object-cover'}`}
                    alt=""
                  />
                )}
              </div>
              <div className="flex-shrink-0 text-left">
                <div className="flex justify-between items-end border-b-2 border-stone-800 pb-2 mb-3">
                  <h3
                    className={`font-serif ${aspectRatio === '1:1' ? 'text-lg' : 'text-2xl'} font-bold text-stone-900 uppercase tracking-tighter line-clamp-2`}
                  >
                    {item.title}
                  </h3>
                  <span className="font-mono text-xs font-bold bg-stone-900 text-[#f4ebd9] px-1">
                    NO. {item.rating}
                  </span>
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

  const sheetHeight = isExpanded ? '85dvh' : '55dvh';

  return (
    <div
      className={`fixed inset-0 z-50 bg-stone-950/90 backdrop-blur-md animate-in fade-in duration-200 print:bg-white print:static print:block flex flex-col md:block md:[--sheet-height:0px] pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)] ${isExpanded ? '[--sheet-height:85dvh]' : '[--sheet-height:55dvh]'}`}
    >
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-6 pt-6 pb-6 md:absolute md:inset-0 md:pb-6 md:pr-96 md:pt-6 overflow-hidden print:static">
        <div className="h-full w-full flex items-center justify-center print:block">
          {renderCardPreview()}
        </div>
      </div>
      <div
        className={`relative bottom-0 left-0 right-0 md:absolute md:top-0 md:left-auto md:w-96 md:h-full bg-white rounded-t-3xl md:rounded-none shadow-2xl flex flex-col transition-all duration-300 ease-out z-10 h-[var(--sheet-height)] md:h-full print:hidden`}
      >
        <div
          className="md:hidden w-full flex justify-center py-3 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="w-12 h-1.5 bg-stone-200 rounded-full" />
        </div>
        <div className="px-6 pb-4 md:pt-6 border-b border-stone-100 flex justify-between items-center shrink-0">
          <div>
            <h2 className="font-serif font-bold text-xl text-stone-900">{t('exportCard')}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-2 text-stone-400 hover:text-stone-800 rounded-full hover:bg-stone-50"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
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
                    <span className="font-bold text-stone-900 capitalize block">{t(s as any)}</span>
                    <span className="text-[10px] text-stone-500 uppercase tracking-wide">
                      {t(`${s}Tag` as any)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
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
        <div className="p-4 md:p-6 border-t border-stone-100 bg-stone-50 space-y-3 shrink-0">
          <Button className="w-full" size="lg" icon={<Download size={18} />}>
            {t('saveImage')}
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => window.print()}
              icon={<Printer size={16} />}
            >
              {t('print')}
            </Button>
            <Button variant="outline" className="flex-1" icon={<Share2 size={16} />}>
              {t('share')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
