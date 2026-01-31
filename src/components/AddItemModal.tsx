import React, { useState, useRef, useEffect, useMemo } from 'react';
// Added Plus icon to the lucide-react imports
import {
  Camera as CameraIcon,
  Upload,
  X,
  Loader2,
  Sparkles,
  Check,
  Zap,
  ArrowRight,
  Trash2,
  Plus,
  Edit3,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { UserCollection, CollectionItem } from '../types';
import { analyzeImage, refreshAiEnabled } from '../services/geminiService';
import { Button } from './ui/Button';
import { useTranslation } from '../i18n';
import { useTheme, panelSurfaceClasses, overlaySurfaceClasses, mutedTextClasses } from '../theme';
import { ImageEditModal } from './ImageEditModal';

interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  collections: UserCollection[];
  onSave: (
    collectionId: string,
    item: Omit<CollectionItem, 'id' | 'createdAt' | 'updatedAt'>,
  ) => void | Promise<void>;
}

interface BatchItem {
  id: string;
  image: string;
  title: string;
  notes: string;
  data: Record<string, any>;
  rating: number;
}

type FlowStep = 'select-type' | 'upload' | 'analyzing' | 'verify' | 'batch-verify';
const createEmptyForm = () => ({
  title: '',
  notes: '',
  data: {} as Record<string, any>,
  rating: 0,
});

// Helper to filter out null/undefined values from AI-extracted data
const cleanAiData = (data: Record<string, any>): Record<string, any> => {
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    // Skip if value is null, undefined, or the string "null"
    if (value !== null && value !== undefined && value !== 'null') {
      cleaned[key] = value;
    }
  }
  return cleaned;
};

export const AddItemModal: React.FC<AddItemModalProps> = ({
  isOpen,
  onClose,
  collections,
  onSave,
}) => {
  const { t, language } = useTranslation();
  const { theme } = useTheme();
  const [step, setStep] = useState<FlowStep>('select-type');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [formData, setFormData] = useState(createEmptyForm());
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [analysisError, setAnalysisError] = useState(false);
  const [analysisNeedsReview, setAnalysisNeedsReview] = useState(false);
  const [lowConfidence, setLowConfidence] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(
    null,
  );
  const [titleError, setTitleError] = useState<string | null>(null);
  const [batchTitleErrors, setBatchTitleErrors] = useState<Record<string, boolean>>({});
  const [isImageEditorOpen, setIsImageEditorOpen] = useState(false);

  const batchInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const analysisRunId = useRef(0);

  const surfaceClass = panelSurfaceClasses[theme];
  const overlayClass = `${overlaySurfaceClasses[theme]} motion-overlay`;
  const mutedText = mutedTextClasses[theme];
  const borderClass = theme === 'vault' ? 'border-white/10' : 'border-stone-100';
  const inputSurface =
    theme === 'vault'
      ? 'bg-white/5 border-white/10 text-white placeholder:text-stone-400'
      : 'bg-stone-50 border-stone-200 text-stone-900';
  const dialogDescribedBy = error
    ? 'add-item-error'
    : analysisNeedsReview
      ? 'add-item-review'
      : titleError
        ? 'add-item-title-error'
        : undefined;

  const getFieldLabel = (fieldId: string, fallback: string) => {
    const fieldKey = `label_${fieldId}` as any;
    const translated = t(fieldKey);
    return translated === fieldKey ? fallback : translated;
  };

  const stepItems = useMemo<{ id: FlowStep; label: string; helper: string }[]>(
    () => [
      {
        id: 'select-type',
        label: t('stepChooseCollection'),
        helper: t('stepChooseCollectionDesc'),
      },
      { id: 'upload', label: t('stepCapture'), helper: t('stepCaptureDesc') },
      {
        id: 'analyzing',
        label: t('stepAnalyze'),
        helper: t('stepAnalyzeDesc'),
      },
      { id: 'verify', label: t('stepVerify'), helper: t('stepVerifyDesc') },
    ],
    [t],
  );
  const currentStepId: FlowStep = step === 'batch-verify' ? 'verify' : step;
  const currentStepIndex = stepItems.findIndex((s) => s.id === currentStepId);
  const progressCopy = t('stepProgress', {
    current: currentStepIndex + 1,
    total: stepItems.length,
  });

  useEffect(() => {
    if (isOpen) {
      lastFocusedElementRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setStep(collections.length === 1 ? 'upload' : 'select-type');
      if (collections.length === 1) setSelectedCollectionId(collections[0].id);
      setImagePreview(null);
      setBatchItems([]);
      setFormData(createEmptyForm());
      setError(null);
      setIsSaving(false);
      setAnalysisError(false);
      setAnalysisNeedsReview(false);
      setLowConfidence(false);
      setBatchProgress(null);
      setTitleError(null);
      setBatchTitleErrors({});
      setIsImageEditorOpen(false);
      analysisRunId.current += 1;
    }
  }, [isOpen, collections]);

  useEffect(() => {
    if (!isOpen) {
      lastFocusedElementRef.current?.focus?.();
      return;
    }

    const dialog = dialogRef.current;
    // Focus the first focusable element inside the dialog.
    requestAnimationFrame(() => {
      const firstFocusable = dialog?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      firstFocusable?.focus?.();
    });

    const getFocusable = () => {
      const el = dialogRef.current;
      if (!el) return [];
      return Array.from(
        el.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((n) => n.offsetParent !== null);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key !== 'Tab') return;
      const focusable = getFocusable();
      if (focusable.length === 0) return;

      const active = document.activeElement as HTMLElement | null;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const isInside = active ? focusable.includes(active) : false;

      if (!isInside) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
        return;
      }

      if (e.shiftKey) {
        if (!active || active === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      setBatchVisibleCount(8);
    }
  }, [isOpen]);

  useEffect(() => {
    if (step !== 'batch-verify') return;
    setBatchVisibleCount((prev) => {
      const baseline = 8;
      const next = Math.max(prev, baseline);
      return Math.min(next, batchItems.length);
    });
  }, [batchItems.length, step]);

  if (!isOpen) return null;

  const currentCollection = collections.find((c) => c.id === selectedCollectionId);

  const switchToManual = () => {
    analysisRunId.current += 1;
    setError(null);
    setAnalysisError(false);
    setAnalysisNeedsReview(false);
    setStep('verify');
  };

  const takePicture = async () => {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
      });

      if (image.dataUrl) {
        setError(null);
        setAnalysisError(false);
        setAnalysisNeedsReview(false);
        setFormData(createEmptyForm());
        setImagePreview(image.dataUrl);
        analyze(image.dataUrl);
      }
    } catch (error) {
      console.error('Error taking picture:', error);
      setError(t('cameraError', 'Could not access camera. Please ensure permissions are granted.'));
    }
  };

  const pickFromGallery = async () => {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos,
      });

      if (image.dataUrl) {
        setError(null);
        setAnalysisError(false);
        setAnalysisNeedsReview(false);
        setFormData(createEmptyForm());
        setImagePreview(image.dataUrl);
        analyze(image.dataUrl);
      }
    } catch (error) {
      console.error('Error picking from gallery:', error);
      setError(
        t('galleryError', 'Could not access photo gallery. Please ensure permissions are granted.'),
      );
    }
  };

  const createBatchItem = (image: string, overrides: Partial<BatchItem> = {}): BatchItem => ({
    id: Math.random().toString(36).slice(2, 10),
    image,
    title: '',
    notes: '',
    data: {},
    rating: 0,
    ...overrides,
  });

  const runBatchAnalysis = async (images: string[], existingIds: string[] = []) => {
    if (!currentCollection) return images.map((image) => createBatchItem(image));
    const collection = currentCollection;
    const aiEnabled = await refreshAiEnabled();
    if (!aiEnabled) {
      setError(t('aiUnavailableManual'));
      setAnalysisError(true);
      return images.map((image, index) =>
        createBatchItem(image, existingIds[index] ? { id: existingIds[index] } : {}),
      );
    }
    const analyzed: BatchItem[] = [];
    let hadError = false;
    for (let idx = 0; idx < images.length; idx += 1) {
      const image = images[idx];
      setBatchProgress((prev) =>
        prev
          ? { current: Math.min(prev.current + 1, prev.total), total: prev.total }
          : { current: idx + 1, total: images.length },
      );
      const base64Data = image.split(',')[1];
      if (!base64Data) {
        setError(t('analysisFallback'));
        hadError = true;
        analyzed.push(createBatchItem(image, existingIds[idx] ? { id: existingIds[idx] } : {}));
        continue;
      }
      try {
        const result = await analyzeImage(base64Data, collection.customFields, {
          collectionContext: {
            name: collection.name,
            description: collection.collectionDescription,
          },
          locale: language,
        });
        if (!result) {
          setError(t('analysisFallback'));
          hadError = true;
          analyzed.push(createBatchItem(image, existingIds[idx] ? { id: existingIds[idx] } : {}));
          continue;
        }
        analyzed.push(
          createBatchItem(image, {
            id: existingIds[idx] || Math.random().toString(36).slice(2, 10),
            title: result.title || '',
            notes: result.notes || '',
            data: cleanAiData(result.data || {}),
          }),
        );
      } catch (err) {
        console.error(err);
        setError(t('analysisFallback'));
        hadError = true;
        analyzed.push(createBatchItem(image, existingIds[idx] ? { id: existingIds[idx] } : {}));
      }
    }
    setAnalysisError(hadError);
    return analyzed;
  };

  const handleBatchFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !files.length || !currentCollection) return;
    const collection = currentCollection;

    const readFileAsDataUrl = (file: File) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            resolve(reader.result);
          } else {
            reject(new Error('File read failed'));
          }
        };
        reader.onerror = () => reject(new Error('File read failed'));
        reader.readAsDataURL(file);
      });

    const loadBatch = async () => {
      setError(null);
      setAnalysisError(false);
      setBatchTitleErrors({});
      setStep('analyzing');
      try {
        const results = await Promise.allSettled(Array.from(files).map(readFileAsDataUrl));
        const images = results
          .filter(
            (result): result is PromiseFulfilledResult<string> => result.status === 'fulfilled',
          )
          .map((result) => result.value);
        const failedCount = results.length - images.length;
        if (failedCount > 0) {
          setError(t('batchPartialFailure', { count: failedCount }));
          setAnalysisError(true);
        }
        if (images.length === 0) {
          setError(t('batchAllFailed'));
          setAnalysisError(true);
          setStep('batch-verify');
          return;
        }
        setBatchProgress({ current: 0, total: images.length });
        const newItems = await runBatchAnalysis(images);
        setBatchItems((prev) => [...prev, ...newItems]);
        setStep('batch-verify');
      } catch (err) {
        console.error(err);
        setError(t('analysisFailedManual'));
        setAnalysisError(true);
        setStep('batch-verify');
      } finally {
        setBatchProgress(null);
        e.target.value = '';
      }
    };

    void loadBatch();
  };

  const updateBatchItem = (id: string, updates: Partial<BatchItem>) => {
    setBatchItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));
    if (updates.title !== undefined) {
      setBatchTitleErrors((prev) => {
        if (!prev[id]) return prev;
        const next = { ...prev };
        if (updates.title?.trim()) {
          delete next[id];
        }
        return next;
      });
    }
  };

  const updateBatchItemField = (id: string, fieldId: string, value: string) => {
    setBatchItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              data: { ...item.data, [fieldId]: value },
            }
          : item,
      ),
    );
  };

  const removeBatchItem = (id: string) => {
    setBatchItems((prev) => prev.filter((item) => item.id !== id));
    setBatchTitleErrors((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const analyze = async (base64: string) => {
    if (!currentCollection) return;
    const runId = ++analysisRunId.current;
    setError(null);
    setAnalysisError(false);
    setAnalysisNeedsReview(false);
    setLowConfidence(false);
    setTitleError(null);
    setFormData(createEmptyForm());
    const aiEnabled = await refreshAiEnabled();
    if (analysisRunId.current !== runId) return;
    if (!aiEnabled) {
      setError(t('aiUnavailableManual'));
      setStep('verify');
      return;
    }
    if (analysisRunId.current !== runId) return;
    setStep('analyzing');
    try {
      const base64Data = base64.split(',')[1];
      if (!base64Data) {
        setError(t('analysisFallback'));
        setAnalysisError(true);
        setStep('verify');
        return;
      }
      const result = await analyzeImage(base64Data, currentCollection.customFields, {
        collectionContext: {
          name: currentCollection.name,
          description: currentCollection.collectionDescription,
        },
        locale: language,
      });
      if (!result) {
        setError(t('analysisFallback'));
        setAnalysisError(true);
        setStep('verify');
        return;
      }
      if (analysisRunId.current !== runId) return;

      const cleanedData = cleanAiData(result.data || {});
      const isGeneric =
        (result.title === 'New Item' || !result.title) && Object.keys(cleanedData).length < 2;
      setLowConfidence(isGeneric);

      setFormData({
        title: result.title || '',
        notes: result.notes || '',
        data: cleanedData,
        rating: 0,
      });
      setStep('verify');
    } catch (e) {
      console.error(e);
      if (analysisRunId.current !== runId) return;
      setError(t('analysisFallback'));
      setAnalysisError(true);
      setStep('verify');
    }
  };

  const retryAnalysis = () => {
    if (!imagePreview) return;
    setError(null);
    setAnalysisError(false);
    setAnalysisNeedsReview(false);
    analyze(imagePreview);
  };

  const retryBatchAnalysis = async () => {
    if (!currentCollection || batchItems.length === 0) return;
    setError(null);
    setAnalysisError(false);
    setBatchTitleErrors({});
    setBatchProgress({ current: 0, total: batchItems.length });
    setStep('analyzing');
    try {
      const images = batchItems.map((item) => item.image);
      const ids = batchItems.map((item) => item.id);
      const updatedItems = await runBatchAnalysis(images, ids);
      setBatchItems(updatedItems);
      setStep('batch-verify');
    } catch (err) {
      console.error(err);
      setError(t('analysisFallback'));
      setAnalysisError(true);
      setStep('batch-verify');
    } finally {
      setBatchProgress(null);
    }
  };

  const handleApplyImageEdit = (edited: string) => {
    setImagePreview(edited);
    setIsImageEditorOpen(false);
    if (step === 'upload' || step === 'analyzing') {
      setError(null);
      setAnalysisError(false);
      setAnalysisNeedsReview(false);
      analyze(edited);
      return;
    }
    setAnalysisNeedsReview(true);
  };

  const handleSave = async () => {
    if (!currentCollection || isSaving) return;
    const trimmedTitle = formData.title.trim();
    if (!trimmedTitle) {
      setTitleError(t('titleRequired'));
      titleInputRef.current?.focus();
      return;
    }
    setIsSaving(true);
    try {
      await onSave(currentCollection.id, {
        collectionId: currentCollection.id,
        photoUrl: imagePreview || '',
        title: trimmedTitle,
        rating: formData.rating || 0,
        notes: formData.notes || '',
        data: formData.data || {},
      });
      onClose();
    } catch (e) {
      console.error('Save failed:', e);
      setError(t('statusSyncPaused'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleBatchSave = async () => {
    if (!currentCollection || isSaving) return;
    const missingTitles = batchItems.filter((item) => !item.title.trim());
    if (missingTitles.length > 0) {
      const errors = missingTitles.reduce<Record<string, boolean>>((acc, item) => {
        acc[item.id] = true;
        return acc;
      }, {});
      setBatchTitleErrors(errors);
      setError(t('batchTitleRequired'));
      return;
    }
    setIsSaving(true);
    try {
      for (const item of batchItems) {
        await onSave(currentCollection.id, {
          collectionId: currentCollection.id,
          photoUrl: item.image,
          title: item.title || 'Untitled',
          rating: item.rating || 0,
          notes: item.notes || '',
          data: item.data || {},
        });
      }
      onClose();
    } catch (e) {
      console.error('Batch save failed:', e);
      setError(t('statusSyncPaused'));
    } finally {
      setIsSaving(false);
    }
  };

  const renderStepper = () => (
    <div className="space-y-2 mb-4">
      <div className={`flex items-center justify-between text-[12px] ${mutedText}`}>
        <span className="font-semibold">{progressCopy}</span>
        <span className={`text-[12px] ${mutedText}`}>{stepItems[currentStepIndex]?.helper}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {stepItems.map((s, idx) => {
          const isComplete = idx < currentStepIndex;
          const isActive = idx === currentStepIndex;
          const stepSurface = isActive
            ? theme === 'vault'
              ? 'border-amber-300/60 bg-amber-50/10'
              : 'border-amber-200 bg-amber-50/70'
            : theme === 'vault'
              ? 'border-white/10 bg-white/5'
              : 'border-stone-100 bg-stone-50';
          const badgeClass =
            isComplete || isActive
              ? theme === 'vault'
                ? 'bg-amber-400 text-stone-950'
                : 'bg-stone-900 text-white'
              : theme === 'vault'
                ? 'bg-white/5 text-stone-300 border border-white/10'
                : 'bg-white text-stone-400 border border-stone-200';

          return (
            <div
              key={s.id}
              className={`flex items-center gap-3 p-3 rounded-xl border ${stepSurface} motion-fade`}
            >
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${badgeClass}`}
              >
                {isComplete ? <Check size={14} /> : idx + 1}
              </div>
              <div>
                <p
                  className={`text-base font-semibold ${theme === 'vault' ? 'text-white' : 'text-stone-800'}`}
                >
                  {s.label}
                </p>
                <p className={`text-[12px] leading-tight ${mutedText}`}>{s.helper}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderCollectionSelect = () => (
    <div className="space-y-4 sm:space-y-6">
      <h3 className="text-xl sm:text-2xl font-serif font-bold text-center mb-4 sm:mb-8">
        {t('newArchive')}
      </h3>
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {collections.map((c) => (
          <button
            key={c.id}
            onClick={() => {
              setSelectedCollectionId(c.id);
              setStep('upload');
            }}
            className="p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-stone-100 bg-stone-50/50 hover:border-amber-400 hover:bg-amber-50 transition-all text-left group shadow-sm hover:shadow-md"
          >
            <span className="block text-2xl sm:text-3xl mb-2 sm:mb-3 group-hover:scale-110 transition-transform origin-left">
              {c.icon || '📦'}
            </span>
            <span className="font-bold text-stone-800 block text-base sm:text-lg truncate">
              {c.name}
            </span>
            <span className="text-[10px] text-stone-400 font-medium uppercase tracking-wider">
              {t('artifacts')}: {c.items.length}
            </span>
          </button>
        ))}
      </div>
    </div>
  );

  const renderUpload = () => (
    <div className="text-center space-y-6 sm:space-y-8 py-2 sm:py-4">
      <div className="flex justify-center">
        <div className="relative">
          <div
            className="w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-stone-50 border-2 border-dashed border-stone-200 flex flex-col items-center justify-center text-stone-400 group hover:border-amber-400 hover:bg-amber-50 transition-all cursor-pointer overflow-hidden"
            onClick={pickFromGallery}
          >
            {imagePreview ? (
              <img src={imagePreview} className="w-full h-full object-cover" alt="Preview" />
            ) : (
              <>
                <Upload size={28} className="sm:w-8 sm:h-8 mb-2" />
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">
                  {t('uploadPhoto')}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
      <div>
        <h3 className="text-xl sm:text-2xl font-serif font-bold text-stone-900 mb-1 sm:mb-2">
          {t('uploadPhoto')}
        </h3>
        <p className={`text-sm sm:text-base ${mutedText} max-w-xs mx-auto`}>
          {t('geminiExtracting')}
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:gap-3">
        <Button variant="secondary" onClick={takePicture} size="lg" icon={<CameraIcon size={18} />}>
          {t('takePhoto')}
        </Button>
        <Button onClick={pickFromGallery} size="lg" icon={<Upload size={18} />}>
          {imagePreview ? t('changePhoto') : t('uploadPhoto')}
        </Button>
        {imagePreview && (
          <Button
            variant="outline"
            onClick={() => setIsImageEditorOpen(true)}
            size="lg"
            icon={<Edit3 size={18} />}
          >
            {t('editPhoto')}
          </Button>
        )}
        <Button
          variant="secondary"
          onClick={() => batchInputRef.current?.click()}
          icon={<Zap size={18} />}
        >
          {t('batchMode')}
        </Button>
        <button
          onClick={switchToManual}
          className="text-xs sm:text-sm font-medium text-stone-400 hover:text-stone-600"
        >
          {t('skipManual')}
        </button>
      </div>
      <input
        type="file"
        ref={batchInputRef}
        data-testid="add-item-batch-input"
        className="hidden"
        accept="image/*"
        multiple
        onChange={handleBatchFileChange}
      />
    </div>
  );

  const renderBatchVerify = () => {
    const visibleBatchItems = batchItems.slice(0, batchVisibleCount);
    const hasMoreBatchItems = batchVisibleCount < batchItems.length;
    return (
      <div className="space-y-6">
        <div className="bg-amber-50 p-4 rounded-2xl flex gap-3 border border-amber-100">
          <Zap className="text-amber-600 shrink-0" size={20} />
          <div>
            <h4 className="text-sm font-bold text-amber-900">{t('batchMode')}</h4>
            <p className="text-[11px] text-amber-700">{t('batchModeDesc')}</p>
          </div>
        </div>
        {error && (
          <div
            id="add-item-error"
            className="p-3 bg-amber-50 text-amber-700 text-xs rounded-xl border border-amber-100 font-medium"
          >
            {error}
          </div>
        )}
        {analysisError && (
          <Button
            variant="outline"
            size="sm"
            onClick={retryBatchAnalysis}
            icon={<RefreshCw size={14} />}
          >
            {t('retryAnalysis')}
          </Button>
        )}
        <div className="space-y-4 px-1">
          {visibleBatchItems.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-stone-100 bg-white p-3 shadow-sm"
            >
              <div className="flex gap-3 items-start">
                <div className="group relative w-20 h-20 rounded-xl overflow-hidden border border-stone-200 shrink-0">
                  <img
                    src={item.image}
                    alt={item.title || t('photoPreview')}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => removeBatchItem(item.id)}
                    aria-label={t('remove')}
                    className="absolute top-1 right-1 bg-white/80 p-1 rounded-full text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                <div className="flex-1 space-y-2">
                  <div>
                    <label
                      className={`block text-[11px] font-semibold uppercase tracking-[0.12em] ${mutedText} mb-0.5`}
                    >
                      {t('title')}
                    </label>
                    <input
                      type="text"
                      className={`w-full text-sm font-semibold bg-transparent border-b ${borderClass} focus:border-amber-500 outline-none pb-1 transition-colors ${theme === 'vault' ? 'text-white placeholder:text-stone-400' : 'text-stone-900'}`}
                      value={item.title}
                      onChange={(e) => updateBatchItem(item.id, { title: e.target.value })}
                    />
                    {batchTitleErrors[item.id] && (
                      <p className="mt-1 text-[10px] text-red-500 font-semibold">
                        {t('titleRequired')}
                      </p>
                    )}
                    <p className={`mt-1 text-[10px] ${mutedText}`}>{t('titleGuidance')}</p>
                  </div>
                  {currentCollection?.customFields.map((field) => (
                    <div key={field.id}>
                      <label
                        className={`block text-[11px] font-semibold uppercase tracking-[0.12em] ${mutedText} mb-0.5`}
                      >
                        {getFieldLabel(field.id, field.label)}
                      </label>
                      <input
                        className={`w-full p-2 rounded-lg text-xs ${inputSurface}`}
                        value={item.data?.[field.id] || ''}
                        onChange={(e) => updateBatchItemField(item.id, field.id, e.target.value)}
                      />
                    </div>
                  ))}
                  <div>
                    <label
                      className={`block text-[11px] font-semibold uppercase tracking-[0.12em] ${mutedText} mb-0.5`}
                    >
                      {t('rating')}
                    </label>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <button
                          key={s}
                          onClick={() => updateBatchItem(item.id, { rating: s })}
                          aria-label={t('rateStars', { count: s })}
                          aria-pressed={item.rating === s}
                          title={t('rateStars', { count: s })}
                          className={`w-9 h-9 rounded-lg border flex items-center justify-center transition-all text-xs ${
                            s <= item.rating
                              ? 'bg-amber-400 border-amber-500 text-white shadow-sm'
                              : theme === 'vault'
                                ? 'bg-white/5 border-white/10 text-white/60'
                                : 'bg-white border-stone-200 text-stone-300'
                          }`}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {hasMoreBatchItems && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setBatchVisibleCount((prev) => Math.min(prev + 8, batchItems.length))}
            >
              {t('loadMore')}
            </Button>
          )}
          <button
            onClick={() => batchInputRef.current?.click()}
            className="w-full rounded-xl border-2 border-dashed border-stone-200 flex flex-col items-center justify-center text-stone-300 hover:border-amber-200 hover:bg-stone-50 transition-all py-6"
          >
            <Plus size={20} />
            <span className="text-[9px] font-bold uppercase mt-2">{t('addMore')}</span>
          </button>
        </div>
        <Button
          className="w-full"
          size="lg"
          onClick={handleBatchSave}
          icon={
            isSaving ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />
          }
          disabled={
            batchItems.length === 0 || isSaving || batchItems.some((item) => !item.title.trim())
          }
        >
          {isSaving
            ? t('analyzingPhoto').split('...')[0]
            : t('archiveArtifacts', { count: batchItems.length })}
        </Button>
      </div>
    );
  };

  const renderAnalyzing = () => (
    <div className="text-center py-12 sm:py-20 space-y-4 sm:space-y-6">
      <div className="relative inline-block">
        <div className="absolute inset-0 bg-amber-200 rounded-full animate-ping opacity-20"></div>
        <div className="relative bg-white p-4 sm:p-6 rounded-full shadow-lg border border-stone-100">
          <Sparkles size={32} className="sm:w-10 sm:h-10 text-amber-500 animate-pulse" />
        </div>
      </div>
      <div>
        <h3 className="text-xl sm:text-2xl font-serif font-bold text-stone-900 mb-1 sm:mb-2">
          {t('analyzingPhoto')}
        </h3>
        <p className="text-sm sm:text-base text-stone-500 italic font-serif">
          {t('geminiExtracting')}
        </p>
        {batchProgress && batchProgress.total > 1 && (
          <p className="text-xs text-stone-400 mt-2">
            {t('batchProgress', {
              current: batchProgress.current,
              total: batchProgress.total,
            })}
          </p>
        )}
      </div>
      <div className="flex justify-center">
        <Button variant="ghost" size="sm" onClick={switchToManual}>
          {t('enterManually')}
        </Button>
      </div>
    </div>
  );

  const renderVerify = () => (
    <div className="space-y-4 sm:space-y-6">
      {lowConfidence && !error && !analysisError && (
        <div className="p-4 bg-stone-100 text-stone-700 text-sm rounded-xl border border-stone-200 flex flex-col gap-2">
          <div className="flex items-center gap-2 font-semibold text-stone-900">
            <AlertCircle size={16} className="text-amber-500" />
            <span>{t('aiLowConfidenceTitle')}</span>
          </div>
          <p className="text-xs leading-relaxed opacity-80">{t('aiLowConfidenceDesc')}</p>
        </div>
      )}
      {analysisNeedsReview && (
        <div
          id="add-item-review"
          className="p-3 bg-amber-50 text-amber-700 text-xs rounded-xl border border-amber-100 font-medium flex items-center justify-between gap-2"
        >
          <span>{t('analysisNeedsReview')}</span>
          <button
            onClick={retryAnalysis}
            className="text-amber-800 underline underline-offset-4 font-semibold"
          >
            {t('retryAnalysis')}
          </button>
        </div>
      )}
      {error && (
        <div
          id="add-item-error"
          className="p-3 bg-amber-50 text-amber-700 text-xs rounded-xl border border-amber-100 font-medium flex items-center justify-between gap-2"
        >
          <span>{error}</span>
          {analysisError && (
            <button
              onClick={switchToManual}
              className="text-amber-800 underline underline-offset-4 font-semibold"
            >
              {t('enterManually')}
            </button>
          )}
        </div>
      )}
      {analysisError && (
        <Button variant="outline" size="sm" onClick={retryAnalysis} icon={<RefreshCw size={14} />}>
          {t('retryAnalysis')}
        </Button>
      )}
      <div className="flex gap-4 sm:gap-6 items-start">
        <div className="flex flex-col items-center gap-2 shrink-0">
          <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-xl bg-stone-100 overflow-hidden border border-stone-200">
            {imagePreview ? (
              <img
                src={imagePreview}
                alt={t('photoPreview')}
                className="w-full h-full object-cover"
              />
            ) : (
              <CameraIcon className="w-full h-full p-4 sm:p-6 text-stone-200" />
            )}
          </div>
          {imagePreview && (
            <button
              onClick={() => setIsImageEditorOpen(true)}
              className="text-[11px] font-semibold text-amber-700 hover:text-amber-900"
            >
              {t('editPhoto')}
            </button>
          )}
        </div>
        <div className="flex-1">
          <label
            className={`block text-[11px] font-semibold uppercase tracking-[0.12em] ${mutedText} mb-0.5 sm:mb-1`}
          >
            {t('title')}
          </label>
          <input
            type="text"
            ref={titleInputRef}
            className={`w-full text-lg sm:text-xl font-bold bg-transparent border-b ${titleError ? 'border-red-400 focus:border-red-500' : borderClass} focus:border-amber-500 outline-none pb-1 transition-colors ${theme === 'vault' ? 'text-white placeholder:text-stone-400' : 'text-stone-900'}`}
            value={formData.title}
            onChange={(e) => {
              setFormData({ ...formData, title: e.target.value });
              if (titleError && e.target.value.trim()) {
                setTitleError(null);
              }
            }}
          />
          {titleError && (
            <p id="add-item-title-error" className="mt-1 text-[10px] text-red-500 font-semibold">
              {titleError}
            </p>
          )}
          <p className={`mt-1 text-[11px] sm:text-xs ${mutedText}`}>{t('titleGuidance')}</p>
        </div>
      </div>

      <div className="space-y-3 sm:space-y-4 px-1">
        {currentCollection?.customFields.map((field) => (
          <div key={field.id}>
            <label
              className={`block text-[11px] font-semibold uppercase tracking-[0.12em] ${mutedText} mb-0.5 sm:mb-1`}
            >
              {getFieldLabel(field.id, field.label)}
            </label>
            <input
              className={`w-full p-2 sm:p-2.5 rounded-lg sm:rounded-xl text-sm ${inputSurface}`}
              value={formData.data?.[field.id] || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  data: { ...formData.data, [field.id]: e.target.value },
                })
              }
            />
          </div>
        ))}
        <div>
          <label
            className={`block text-[11px] font-semibold uppercase tracking-[0.12em] ${mutedText} mb-0.5 sm:mb-1`}
          >
            {t('rating')}
          </label>
          <div className="flex gap-1 sm:gap-2">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                onClick={() => setFormData({ ...formData, rating: s })}
                aria-label={t('rateStars', { count: s })}
                aria-pressed={formData.rating === s}
                title={t('rateStars', { count: s })}
                className={`w-12 h-12 rounded-xl border flex items-center justify-center transition-all text-base ${
                  s <= formData.rating
                    ? 'bg-amber-400 border-amber-500 text-white shadow-sm'
                    : theme === 'vault'
                      ? 'bg-white/5 border-white/10 text-white/60'
                      : 'bg-white border-stone-200 text-stone-300'
                }`}
              >
                ★
              </button>
            ))}
          </div>
        </div>
      </div>

      <Button
        className="w-full"
        size="lg"
        onClick={handleSave}
        icon={isSaving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
        disabled={isSaving}
      >
        {isSaving ? t('analyzingPhoto').split('...')[0] : t('addToCollection')}
      </Button>
    </div>
  );

  return (
    <>
      <div
        className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 ${overlayClass} backdrop-blur-sm`}
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-item-modal-title"
          aria-describedby={dialogDescribedBy}
          className={`${surfaceClass} rounded-t-3xl rounded-b-none sm:rounded-3xl shadow-2xl w-full max-w-lg h-[100dvh] sm:h-auto max-h-[100dvh] sm:max-h-[90vh] overflow-hidden flex flex-col motion-panel pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] sm:pt-0 sm:pb-0`}
        >
          <div className="sm:hidden flex items-center justify-center pt-2">
            <span
              className={`${theme === 'vault' ? 'bg-white/20' : 'bg-stone-200'} h-1.5 w-12 rounded-full`}
            />
          </div>
          <div className={`flex items-center justify-between p-4 sm:p-6 border-b ${borderClass}`}>
            <h2
              id="add-item-modal-title"
              className={`font-serif font-bold text-lg sm:text-xl ${theme === 'vault' ? 'text-white' : 'text-stone-800'}`}
            >
              {t('addItem')}
            </h2>
            <button
              onClick={onClose}
              aria-label={t('close')}
              className={`p-2 rounded-full transition-colors ${theme === 'vault' ? 'hover:bg-white/5 text-stone-300 hover:text-white' : 'hover:bg-stone-100 text-stone-400 hover:text-stone-800'}`}
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-5 pb-24 sm:p-8 space-y-6 overscroll-contain">
            {renderStepper()}
            {step === 'select-type' && renderCollectionSelect()}
            {step === 'upload' && renderUpload()}
            {step === 'batch-verify' && renderBatchVerify()}
            {step === 'analyzing' && renderAnalyzing()}
            {step === 'verify' && renderVerify()}
          </div>
        </div>
      </div>
      <ImageEditModal
        isOpen={isImageEditorOpen}
        source={imagePreview}
        onClose={() => setIsImageEditorOpen(false)}
        onApply={handleApplyImageEdit}
      />
    </>
  );
};
