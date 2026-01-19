import React, { useState, useEffect, useRef } from 'react';
import { X, Loader2, Sparkles, AlertCircle, Check, RotateCcw } from 'lucide-react';
import { useTheme } from '../theme';
import { useTranslation } from '../i18n';
import { EnhancementStrength } from '../types';
import {
  enhanceImage,
  type EnhanceImageResult,
  isAiImageEditEnabled,
  refreshAiImageEditEnabled,
} from '../services/geminiService';
import { getAsset, saveEnhancedAsset } from '../services/db';

interface EnhanceImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemId: string;
  collectionId: string;
  onEnhancementComplete?: (result: { enhancedPath: string | null }) => void;
}

type EnhanceStep = 'select' | 'generating' | 'compare' | 'error';

const hashBase64 = async (base64: string): Promise<string> => {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  let hash = 0;
  for (let i = 0; i < base64.length; i++) {
    hash = (hash * 31 + base64.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
};

export const EnhanceImageModal: React.FC<EnhanceImageModalProps> = ({
  isOpen,
  onClose,
  itemId,
  collectionId,
  onEnhancementComplete,
}) => {
  const { theme } = useTheme();
  const { t } = useTranslation();

  const [step, setStep] = useState<EnhanceStep>('select');
  const [strength, setStrength] = useState<EnhancementStrength>('subtle');
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [enhancedUrl, setEnhancedUrl] = useState<string | null>(null);
  const [enhancedBlob, setEnhancedBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [aiEnabled, setAiEnabled] = useState<boolean | null>(null);
  const [enhancementMeta, setEnhancementMeta] = useState<EnhanceImageResult['metadata'] | null>(
    null,
  );
  const [inputHash, setInputHash] = useState<string | null>(null);

  const originalUrlRef = useRef<string | null>(null);
  const enhancedUrlRef = useRef<string | null>(null);

  // Check if AI image editing is enabled
  useEffect(() => {
    if (isOpen) {
      refreshAiImageEditEnabled().then(setAiEnabled);
    }
  }, [isOpen]);

  // Load original image when modal opens
  useEffect(() => {
    if (isOpen && itemId) {
      const loadOriginal = async () => {
        const blob = await getAsset(itemId, 'original', undefined, collectionId);
        if (blob) {
          const url = URL.createObjectURL(blob);
          originalUrlRef.current = url;
          setOriginalUrl(url);
        }
      };
      loadOriginal();
    }

    return () => {
      // Cleanup URLs on close
      if (originalUrlRef.current) {
        URL.revokeObjectURL(originalUrlRef.current);
        originalUrlRef.current = null;
      }
      if (enhancedUrlRef.current) {
        URL.revokeObjectURL(enhancedUrlRef.current);
        enhancedUrlRef.current = null;
      }
    };
  }, [isOpen, itemId, collectionId]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setStep('select');
      setStrength('subtle');
      setOriginalUrl(null);
      setEnhancedUrl(null);
      setEnhancedBlob(null);
      setError(null);
      setShowOriginal(false);
      setEnhancementMeta(null);
      setInputHash(null);
    }
  }, [isOpen]);

  const handleEnhance = async () => {
    if (!originalUrl) return;

    setStep('generating');
    setError(null);

    try {
      // Get the original image as base64
      const blob = await getAsset(itemId, 'original', undefined, collectionId);
      if (!blob) {
        throw new Error('Could not load original image');
      }

      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          // Extract base64 from data URL
          const base64 = dataUrl.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const base64 = await base64Promise;
      const computedHash = await hashBase64(base64);
      setInputHash(computedHash);
      const result = await enhanceImage(base64, strength);

      if (!result || !result.enhancedImageBase64) {
        throw new Error('Enhancement returned no image');
      }
      setEnhancementMeta(result.metadata);

      // Convert base64 back to blob
      const byteCharacters = atob(result.enhancedImageBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const newBlob = new Blob([byteArray], { type: 'image/jpeg' });

      const url = URL.createObjectURL(newBlob);
      if (enhancedUrlRef.current) {
        URL.revokeObjectURL(enhancedUrlRef.current);
      }
      enhancedUrlRef.current = url;
      setEnhancedUrl(url);
      setEnhancedBlob(newBlob);
      setStep('compare');
    } catch (err) {
      console.error('Enhancement failed:', err);
      setError(err instanceof Error ? err.message : 'Enhancement failed');
      setStep('error');
    }
  };

  const handleAccept = async () => {
    if (!enhancedBlob) return;

    try {
      const { enhancedPath } = await saveEnhancedAsset(collectionId, itemId, enhancedBlob, {
        metadata: enhancementMeta || undefined,
        inputHash: inputHash || undefined,
      });
      onEnhancementComplete?.({ enhancedPath });
      onClose();
    } catch (err) {
      console.error('Failed to save enhanced image:', err);
      setError('Failed to save enhanced image');
    }
  };

  const handleTryAgain = () => {
    if (enhancedUrlRef.current) {
      URL.revokeObjectURL(enhancedUrlRef.current);
      enhancedUrlRef.current = null;
    }
    setEnhancedUrl(null);
    setEnhancedBlob(null);
    setError(null);
    setStep('select');
    setEnhancementMeta(null);
    setInputHash(null);
  };

  if (!isOpen) return null;

  const modalBg = {
    gallery: 'bg-white',
    vault: 'bg-stone-900',
    atelier: 'bg-[#faf9f6]',
  };

  const textColor = {
    gallery: 'text-stone-900',
    vault: 'text-white',
    atelier: 'text-stone-800',
  };

  const mutedText = {
    gallery: 'text-stone-500',
    vault: 'text-stone-400',
    atelier: 'text-stone-500',
  };

  const borderColor = {
    gallery: 'border-stone-200',
    vault: 'border-white/10',
    atelier: 'border-stone-200',
  };

  const cardBg = {
    gallery: 'bg-stone-50',
    vault: 'bg-white/5',
    atelier: 'bg-stone-100/50',
  };

  const selectedBg = {
    gallery: 'bg-amber-50 border-amber-300',
    vault: 'bg-amber-900/20 border-amber-500/50',
    atelier: 'bg-amber-50 border-amber-300',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl ${modalBg[theme]} ${textColor[theme]}`}
      >
        {/* Header */}
        <div
          className={`sticky top-0 z-10 flex items-center justify-between p-6 border-b ${borderColor[theme]} ${modalBg[theme]}`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-600">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="font-serif text-xl font-bold">{t('enhanceImage')}</h2>
              <p className={`text-sm ${mutedText[theme]}`}>{t('enhanceImageDesc')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-xl hover:bg-stone-100 transition-colors ${theme === 'vault' ? 'hover:bg-white/10' : ''}`}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* AI not enabled warning */}
          {aiEnabled === false && (
            <div className={`p-4 rounded-2xl mb-6 ${cardBg[theme]} border ${borderColor[theme]}`}>
              <div className="flex items-center gap-3">
                <AlertCircle size={20} className="text-amber-500" />
                <p className={`text-sm ${mutedText[theme]}`}>
                  AI image enhancement is not available. Check your configuration.
                </p>
              </div>
            </div>
          )}

          {/* Step: Select Strength */}
          {step === 'select' && (
            <div className="space-y-6">
              {/* Preview */}
              {originalUrl && (
                <div className="aspect-video rounded-2xl overflow-hidden bg-stone-900">
                  <img src={originalUrl} alt="Original" className="w-full h-full object-contain" />
                </div>
              )}

              {/* Strength Selection */}
              <div>
                <h3 className={`text-sm font-semibold mb-3 ${mutedText[theme]}`}>
                  {t('enhanceStrength')}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setStrength('subtle')}
                    className={`p-4 rounded-2xl border-2 text-left transition-all ${
                      strength === 'subtle'
                        ? selectedBg[theme]
                        : `${cardBg[theme]} ${borderColor[theme]}`
                    }`}
                  >
                    <div className="font-semibold mb-1">{t('enhanceSubtle')}</div>
                    <div className={`text-sm ${mutedText[theme]}`}>{t('enhanceSubtleDesc')}</div>
                  </button>
                  <button
                    onClick={() => setStrength('beautified')}
                    className={`p-4 rounded-2xl border-2 text-left transition-all ${
                      strength === 'beautified'
                        ? selectedBg[theme]
                        : `${cardBg[theme]} ${borderColor[theme]}`
                    }`}
                  >
                    <div className="font-semibold mb-1">{t('enhanceBeautified')}</div>
                    <div className={`text-sm ${mutedText[theme]}`}>
                      {t('enhanceBeautifiedDesc')}
                    </div>
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className={`flex-1 py-3 px-6 rounded-xl border ${borderColor[theme]} font-semibold transition-all hover:opacity-80`}
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={handleEnhance}
                  disabled={!originalUrl || aiEnabled === false}
                  className="flex-1 py-3 px-6 rounded-xl bg-amber-500 text-white font-semibold transition-all hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Sparkles size={18} />
                  {t('enhanceImage')}
                </button>
              </div>
            </div>
          )}

          {/* Step: Generating */}
          {step === 'generating' && (
            <div className="py-16 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 text-amber-600 mb-6">
                <Loader2 size={32} className="animate-spin" />
              </div>
              <h3 className="text-xl font-serif font-bold mb-2">{t('enhanceGenerating')}</h3>
              <p className={mutedText[theme]}>{t('enhanceGeneratingDesc')}</p>
            </div>
          )}

          {/* Step: Compare */}
          {step === 'compare' && (
            <div className="space-y-6">
              {/* Before/After Toggle */}
              <div className="relative aspect-video rounded-2xl overflow-hidden bg-stone-900">
                <img
                  src={showOriginal ? originalUrl || '' : enhancedUrl || ''}
                  alt={showOriginal ? 'Original' : 'Enhanced'}
                  className="w-full h-full object-contain transition-opacity duration-300"
                />
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                  <button
                    onClick={() => setShowOriginal(true)}
                    className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                      showOriginal
                        ? 'bg-white text-stone-900'
                        : 'bg-black/50 text-white hover:bg-black/70'
                    }`}
                  >
                    {t('enhanceOriginal')}
                  </button>
                  <button
                    onClick={() => setShowOriginal(false)}
                    className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                      !showOriginal
                        ? 'bg-amber-500 text-white'
                        : 'bg-black/50 text-white hover:bg-black/70'
                    }`}
                  >
                    {t('enhanceEnhanced')}
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={handleTryAgain}
                  className={`py-3 px-6 rounded-xl border ${borderColor[theme]} font-semibold transition-all hover:opacity-80 flex items-center gap-2`}
                >
                  <RotateCcw size={18} />
                  {t('enhanceTryAgain')}
                </button>
                <button
                  onClick={onClose}
                  className={`flex-1 py-3 px-6 rounded-xl border ${borderColor[theme]} font-semibold transition-all hover:opacity-80`}
                >
                  {t('enhanceKeepOriginal')}
                </button>
                <button
                  onClick={handleAccept}
                  className="flex-1 py-3 px-6 rounded-xl bg-amber-500 text-white font-semibold transition-all hover:bg-amber-600 flex items-center justify-center gap-2"
                >
                  <Check size={18} />
                  {t('enhanceAccept')}
                </button>
              </div>
            </div>
          )}

          {/* Step: Error */}
          {step === 'error' && (
            <div className="space-y-6">
              {/* Preview with error overlay */}
              {originalUrl && (
                <div className="aspect-video rounded-2xl overflow-hidden bg-stone-900 relative">
                  <img
                    src={originalUrl}
                    alt="Original"
                    className="w-full h-full object-contain opacity-50"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 text-red-600 mb-3">
                        <AlertCircle size={24} />
                      </div>
                      <h4 className="text-white font-semibold">{t('enhanceFailed')}</h4>
                      <p className="text-white/70 text-sm">{error || t('enhanceFailedDesc')}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className={`flex-1 py-3 px-6 rounded-xl border ${borderColor[theme]} font-semibold transition-all hover:opacity-80`}
                >
                  {t('enhanceKeepOriginal')}
                </button>
                <button
                  onClick={handleTryAgain}
                  className="flex-1 py-3 px-6 rounded-xl bg-amber-500 text-white font-semibold transition-all hover:bg-amber-600 flex items-center justify-center gap-2"
                >
                  <RotateCcw size={18} />
                  {t('enhanceTryAgain')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
