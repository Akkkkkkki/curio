import React, { useEffect, useState } from 'react';
import { X, Crop, RotateCcw, RotateCw } from 'lucide-react';
import { useTranslation } from '../i18n';
import { useTheme, panelSurfaceClasses, overlaySurfaceClasses } from '../theme';
import { cropSquareDataUrl, rotateDataUrl } from '../utils/imageTransforms';
import { Button } from './ui/Button';

interface ImageEditModalProps {
  isOpen: boolean;
  source: string | null;
  onClose: () => void;
  onApply: (dataUrl: string) => void;
}

export const ImageEditModal: React.FC<ImageEditModalProps> = ({
  isOpen,
  source,
  onClose,
  onApply,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [preview, setPreview] = useState<string | null>(source);
  const [isTransforming, setIsTransforming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const surfaceClass = panelSurfaceClasses[theme];
  const overlayClass = `${overlaySurfaceClasses[theme]} motion-overlay`;
  const borderClass = theme === 'vault' ? 'border-white/10' : 'border-stone-100';

  useEffect(() => {
    if (!isOpen) return;
    setPreview(source);
    setError(null);
    setIsTransforming(false);
  }, [isOpen, source]);

  if (!isOpen || !preview) return null;

  const handleRotate = async (direction: 'left' | 'right') => {
    setIsTransforming(true);
    setError(null);
    try {
      const next = await rotateDataUrl(preview, direction);
      setPreview(next);
    } catch (e) {
      console.error('Rotate failed', e);
      setError(t('imageEditFailed'));
    } finally {
      setIsTransforming(false);
    }
  };

  const handleCrop = async () => {
    setIsTransforming(true);
    setError(null);
    try {
      const next = await cropSquareDataUrl(preview);
      setPreview(next);
    } catch (e) {
      console.error('Crop failed', e);
      setError(t('imageEditFailed'));
    } finally {
      setIsTransforming(false);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 ${overlayClass} backdrop-blur-sm`}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="image-edit-title"
        className={`${surfaceClass} rounded-t-3xl rounded-b-none sm:rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col motion-panel border pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] sm:pt-0 sm:pb-0`}
      >
        <div className="sm:hidden flex items-center justify-center pt-2">
          <span
            className={`${theme === 'vault' ? 'bg-white/20' : 'bg-stone-200'} h-1.5 w-12 rounded-full`}
          />
        </div>
        <div className={`flex items-center justify-between p-4 border-b ${borderClass}`}>
          <h2
            id="image-edit-title"
            className={`font-serif font-bold text-lg ${theme === 'vault' ? 'text-white' : 'text-stone-800'}`}
          >
            {t('editPhoto')}
          </h2>
          <button
            onClick={onClose}
            aria-label={t('close')}
            className={`p-2 rounded-full transition-colors ${theme === 'vault' ? 'hover:bg-white/5 text-stone-300 hover:text-white' : 'hover:bg-stone-100 text-stone-400 hover:text-stone-800'}`}
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="rounded-2xl overflow-hidden border border-stone-100 bg-stone-100">
            <img src={preview} alt={t('editPhoto')} className="w-full h-auto object-contain" />
          </div>

          {error && (
            <div className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="outline"
              onClick={() => handleRotate('left')}
              disabled={isTransforming}
              icon={<RotateCcw size={16} />}
            >
              {t('rotateLeft')}
            </Button>
            <Button
              variant="outline"
              onClick={handleCrop}
              disabled={isTransforming}
              icon={<Crop size={16} />}
            >
              {t('cropSquare')}
            </Button>
            <Button
              variant="outline"
              onClick={() => handleRotate('right')}
              disabled={isTransforming}
              icon={<RotateCw size={16} />}
            >
              {t('rotateRight')}
            </Button>
          </div>
        </div>

        <div
          className={`px-5 py-4 border-t flex items-center justify-end gap-2 ${theme === 'vault' ? 'border-white/10 bg-white/5' : 'border-stone-100 bg-white'}`}
        >
          <Button variant="ghost" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button onClick={() => preview && onApply(preview)} disabled={isTransforming}>
            {t('applyChanges')}
          </Button>
        </div>
      </div>
    </div>
  );
};
