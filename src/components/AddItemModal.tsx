import React, { useState, useRef, useEffect, useCallback } from 'react';
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
import { analyzeImage, fetchStoryPrompts, refreshAiEnabled } from '../services/geminiService';
import { compressImageForAi } from '../services/imageProcessor';
import { trackEvent, storyLengthBucket } from '../services/analytics';
import { Button } from './ui/Button';
import { useTranslation, getFieldTranslation } from '../i18n';
import { useTheme, panelSurfaceClasses, overlaySurfaceClasses, mutedTextClasses } from '../theme';
import { ImageEditModal } from './ImageEditModal';

interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  collections: UserCollection[];
  defaultCollectionId?: string;
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
  defaultCollectionId,
  onSave,
}) => {
  const { t, language } = useTranslation();
  const { theme } = useTheme();
  const [step, setStep] = useState<FlowStep>('select-type');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [batchVisibleCount, setBatchVisibleCount] = useState(8);
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
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [promptsOpen, setPromptsOpen] = useState(false);
  const [promptsLoading, setPromptsLoading] = useState(false);
  const [storyPrompts, setStoryPrompts] = useState<string[]>([]);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [aiFieldSuggestions, setAiFieldSuggestions] = useState<Record<string, string>>({});
  // Cache key for storyPrompts. We refetch when the prompt-relevant context
  // changes (title or AI observation) and never cache empty results, so a
  // 400/empty response doesn't permanently silence the affordance.
  const [promptsFetchedFor, setPromptsFetchedFor] = useState<string | null>(null);
  // True while the scroll area has more content below the fold, so we can fade
  // the bottom edge as an affordance that more fields exist (CUR-45).
  const [canScrollDown, setCanScrollDown] = useState(false);

  const batchInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollContentRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLDivElement>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const storyInputRef = useRef<HTMLTextAreaElement>(null);
  const analysisRunId = useRef(0);

  useEffect(() => {
    if (!isOpen) return;
    trackEvent('item_creation_started', { surface: 'add_item_modal' });
  }, [isOpen]);

  const surfaceClass = panelSurfaceClasses[theme];
  const overlayClass = `${overlaySurfaceClasses[theme]} motion-overlay`;
  const mutedText = mutedTextClasses[theme];
  const borderClass = theme === 'vault' ? 'border-white/10' : 'border-stone-100';
  const inputSurface =
    theme === 'vault'
      ? 'bg-white/5 border-white/10 text-white placeholder:text-stone-400'
      : 'bg-stone-50 border-stone-200 text-stone-900';

  // CUR-92: theme-aware tone tokens for the analyzing + verify + batch-verify
  // surfaces. Mirrors the StatusBanner palette (CUR-81) so banners and cards
  // inside the modal stop flipping back to Gallery white on Vault/Atelier.
  const analyzingPillClass = {
    gallery: 'bg-white border-stone-100',
    vault: 'bg-stone-800 border-white/10',
    atelier: 'bg-[#EDE4D3] border-[#D4C9B8]',
  }[theme];
  const warnBannerClass = {
    gallery: 'bg-amber-50 text-amber-700 border-amber-100',
    vault: 'bg-amber-500/10 text-amber-200 border-amber-400/20',
    atelier: 'bg-amber-100/70 text-amber-900 border-amber-300/60',
  }[theme];
  const warnBannerActionClass = {
    gallery: 'text-amber-800 hover:text-amber-900',
    vault: 'text-amber-100 hover:text-white',
    atelier: 'text-[#A86F3C] hover:text-[#8B5A2B]',
  }[theme];
  // CUR-110: the batch-mode info card shares the warn-banner surface; its
  // title and icon need their own amber steps so the hierarchy survives on
  // Vault/Atelier instead of flipping back to the Gallery pastel card.
  const batchInfoTitleClass = {
    gallery: 'text-amber-900',
    vault: 'text-amber-100',
    atelier: 'text-amber-950',
  }[theme];
  const batchInfoIconClass = {
    gallery: 'text-amber-600',
    vault: 'text-amber-300',
    atelier: 'text-amber-700',
  }[theme];
  const lowConfidenceSurfaceClass = {
    gallery: 'bg-stone-100 text-stone-700 border-stone-200',
    vault: 'bg-white/5 text-stone-300 border-white/10',
    atelier: 'bg-[#EDE4D3] text-[#3D3530] border-[#D4C9B8]',
  }[theme];
  const lowConfidenceTitleClass = {
    gallery: 'text-stone-900',
    vault: 'text-white',
    atelier: 'text-[#3D3530]',
  }[theme];
  const imageTileClass = {
    gallery: 'bg-stone-100 border-stone-200',
    vault: 'bg-white/5 border-white/10',
    atelier: 'bg-[#EDE4D3] border-[#D4C9B8]',
  }[theme];
  const imageTilePlaceholderClass = {
    gallery: 'text-stone-200',
    vault: 'text-white/25',
    atelier: 'text-[#8C7B6B]/50',
  }[theme];
  const batchItemCardClass = {
    gallery: 'border-stone-100 bg-white',
    vault: 'border-white/10 bg-white/5',
    atelier: 'border-[#D4C9B8] bg-[#EDE4D3]',
  }[theme];
  const batchRemoveButtonClass = {
    gallery: 'bg-white/90 text-red-500 hover:bg-white',
    vault: 'bg-stone-900/80 text-red-300 hover:bg-stone-900',
    atelier: 'bg-[#F5EFE4]/90 text-red-600 hover:bg-[#F5EFE4]',
  }[theme];
  const addMoreTileClass = {
    gallery: 'border-stone-200 text-stone-400 hover:border-amber-200 hover:bg-stone-50',
    vault: 'border-white/15 text-stone-300 hover:border-amber-400/40 hover:bg-white/5',
    atelier: 'border-[#D4C9B8] text-[#8C7B6B] hover:border-[#A86F3C]/40 hover:bg-[#EDE4D3]',
  }[theme];
  // CUR-22: theme-aware tone tokens for the upload empty state, collection
  // picker tiles, and subtle "skip / hide" links so Vault stops rendering a
  // bright cream pill / heading inside an otherwise dark modal.
  const uploadEmptyTileClass = {
    gallery: 'bg-stone-50 border-stone-200 text-stone-400 hover:border-amber-400 hover:bg-amber-50',
    vault: 'bg-white/5 border-white/15 text-stone-300 hover:border-amber-400/60 hover:bg-white/10',
    atelier:
      'bg-[#EDE4D3] border-[#D4C9B8] text-[#8C7B6B] hover:border-[#A86F3C]/60 hover:bg-[#E6D9C2]',
  }[theme];
  const uploadHeadingClass = {
    gallery: 'text-stone-900',
    vault: 'text-white',
    atelier: 'text-[#3D3530]',
  }[theme];
  const selectTileClass = {
    gallery: 'border border-stone-100 bg-stone-50/50 hover:border-amber-400 hover:bg-amber-50',
    vault: 'border border-white/10 bg-white/5 hover:border-amber-400/60 hover:bg-white/10',
    atelier: 'border border-[#D4C9B8] bg-[#EDE4D3]/60 hover:border-[#A86F3C]/60 hover:bg-[#EDE4D3]',
  }[theme];
  const selectTileTitleClass = {
    gallery: 'text-stone-800',
    vault: 'text-white',
    atelier: 'text-[#3D3530]',
  }[theme];
  // Subtle "skip / dismiss" link hover tone. The original
  // "hover:text-stone-600 / hover:text-stone-700" disappears against Vault's
  // stone-900 surface — pin a theme-specific destination so the hover affordance
  // stays legible across all three themes.
  const subtleLinkHoverClass = {
    gallery: 'hover:text-stone-700',
    vault: 'hover:text-white',
    atelier: 'hover:text-[#3D3530]',
  }[theme];
  // Matches the dialog surface so the bottom fade blends into the panel bg.
  const scrollFadeFrom =
    theme === 'vault' ? 'from-stone-900' : theme === 'atelier' ? 'from-[#F5EFE4]' : 'from-white';
  const dialogDescribedBy = confirmingDiscard
    ? 'add-item-discard-desc'
    : error
      ? 'add-item-error'
      : analysisNeedsReview
        ? 'add-item-review'
        : titleError
          ? 'add-item-title-error'
          : undefined;

  const getFieldLabel = (fieldId: string, fallback: string) => {
    return getFieldTranslation(t, fieldId, fallback);
  };

  const updateScrollAffordance = useCallback(() => {
    const el = scrollRef.current;
    if (!el) {
      setCanScrollDown(false);
      return;
    }
    // 8px tolerance so the fade clears once the user reaches the last field.
    setCanScrollDown(el.scrollHeight - el.clientHeight - el.scrollTop > 8);
  }, []);

  // Compute a cache key from the inputs that influence prompt quality so a
  // re-analyzed photo, an edited title, or a different AI observation
  // produces fresh prompts.
  const storyPromptsCacheKey = (() => {
    const title = formData.title || '';
    const aiDesc = (formData.data?._aiDescription as string | undefined) || '';
    return `${title} ${aiDesc}`;
  })();

  const openStoryPromptsPanel = async () => {
    setPromptsOpen(true);
    if (promptsLoading || !currentCollection) return;
    // Reuse cached prompts only if they're for the current context AND
    // the previous fetch actually returned something — otherwise let the
    // user retry by re-opening the panel.
    if (promptsFetchedFor === storyPromptsCacheKey && storyPrompts.length > 0) return;
    trackEvent('story_prompt_panel_opened', { surface: 'add_item_modal' });
    setPromptsLoading(true);
    try {
      const knownFields: Record<string, string | number> = {};
      for (const [k, v] of Object.entries(formData.data || {})) {
        if (k.startsWith('_')) continue;
        if (typeof v === 'string' || typeof v === 'number') knownFields[k] = v;
      }
      const result = await fetchStoryPrompts({
        title: formData.title || '',
        collectionContext: {
          name: currentCollection.name,
          description: currentCollection.collectionDescription,
        },
        aiDescription: (formData.data?._aiDescription as string | undefined) || undefined,
        knownFields,
        locale: language,
      });
      setStoryPrompts(result.prompts);
      if (result.prompts.length > 0) {
        setPromptsFetchedFor(storyPromptsCacheKey);
      } else {
        // Empty / failed response: leave the panel open so the user knows
        // we tried, and don't cache the empty result — that way reopening
        // after adding a title retries the fetch.
        setPromptsFetchedFor(null);
      }
    } finally {
      setPromptsLoading(false);
    }
  };

  const insertStoryPrompt = (prompt: string) => {
    const el = storyInputRef.current;
    const current = formData.notes || '';
    const snippet = `> ${prompt}\n\n`;
    const insertAt = el?.selectionStart ?? current.length;
    const next = current.slice(0, insertAt) + snippet + current.slice(insertAt);
    setFormData({ ...formData, notes: next });
    trackEvent('story_prompt_inserted', {
      surface: 'add_item_modal',
      prompt_length: prompt.length,
    });
    // Focus the textarea after the state update; caret moves to end of insert.
    requestAnimationFrame(() => {
      const t = storyInputRef.current;
      if (!t) return;
      t.focus();
      const caret = insertAt + snippet.length;
      try {
        t.setSelectionRange(caret, caret);
      } catch {
        /* selection not supported in some test envs */
      }
    });
  };

  useEffect(() => {
    if (!isOpen) return;
    lastFocusedElementRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const resolvedDefault =
      defaultCollectionId && collections.some((c) => c.id === defaultCollectionId)
        ? defaultCollectionId
        : undefined;
    if (resolvedDefault) {
      setSelectedCollectionId(resolvedDefault);
      setStep('upload');
    } else if (collections.length === 1) {
      setSelectedCollectionId(collections[0].id);
      setStep('upload');
    } else {
      setStep('select-type');
    }
    setImagePreview(null);
    setBatchItems([]);
    setBatchVisibleCount(8);
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
    setConfirmingDiscard(false);
    setPromptsOpen(false);
    setPromptsLoading(false);
    setStoryPrompts([]);
    setPromptsFetchedFor(null);
    setDetailsOpen(false);
    setAiFieldSuggestions({});
    analysisRunId.current += 1;
    // Reacting to `collections` here would wipe the in-flight form whenever the
    // parent re-renders with a new array reference (cloud sync, etc.) — CUR-44.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

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
      // While the discard prompt is up, restrict tab cycling to its buttons so
      // focus can't escape back into the form behind it.
      const el = confirmingDiscardRef.current ? confirmRef.current : dialogRef.current;
      if (!el) return [];
      return Array.from(
        el.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((n) => n.offsetParent !== null);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isImageEditorOpenRef.current) return;
        e.preventDefault();
        if (confirmingDiscardRef.current) {
          setConfirmingDiscard(false);
          return;
        }
        if (hasInProgressWorkRef.current) {
          setConfirmingDiscard(true);
          return;
        }
        onClose();
        return;
      }

      if (e.key !== 'Tab') return;
      if (isImageEditorOpenRef.current) return;
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

  useEffect(() => {
    if (!isOpen) return;
    updateScrollAffordance();
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => updateScrollAffordance());
    observer.observe(el);
    if (scrollContentRef.current) observer.observe(scrollContentRef.current);
    return () => observer.disconnect();
  }, [isOpen, step, updateScrollAffordance]);

  // Verify and batch-verify are the only steps where the user has already
  // invested effort worth confirming before discard: a photo upload, AI-
  // analyzed metadata, typed Story, typed title, set rating, filled custom
  // field, or batch items lined up for save.
  const hasFilledFormField = Object.entries(formData.data || {}).some(([key, value]) => {
    // Skip internal AI metadata (e.g. `_aiDescription`); it's hidden and
    // only present alongside `imagePreview`, which is already counted.
    if (key.startsWith('_')) return false;
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    return true;
  });
  const hasInProgressWork =
    (step === 'verify' || step === 'batch-verify') &&
    (!!imagePreview ||
      formData.title.trim().length > 0 ||
      (formData.notes || '').trim().length > 0 ||
      formData.rating > 0 ||
      hasFilledFormField ||
      batchItems.length > 0);

  // Mirror the latest values into refs so the keydown handler (registered once
  // per modal-open) reads current state without a re-registration churn that
  // would refire on every keystroke.
  const hasInProgressWorkRef = useRef(hasInProgressWork);
  hasInProgressWorkRef.current = hasInProgressWork;
  const confirmingDiscardRef = useRef(confirmingDiscard);
  confirmingDiscardRef.current = confirmingDiscard;
  // When the child ImageEditModal is open it owns Escape (CUR-86). Yield so the
  // editor dismisses alone instead of also triggering this modal's discard flow.
  const isImageEditorOpenRef = useRef(isImageEditorOpen);
  isImageEditorOpenRef.current = isImageEditorOpen;

  const requestClose = () => {
    if (confirmingDiscard) {
      setConfirmingDiscard(false);
      return;
    }
    if (hasInProgressWork) {
      setConfirmingDiscard(true);
      return;
    }
    onClose();
  };

  if (!isOpen) return null;

  const currentCollection = collections.find((c) => c.id === selectedCollectionId);

  const switchToManual = () => {
    analysisRunId.current += 1;
    setError(null);
    setAnalysisError(false);
    setAnalysisNeedsReview(false);
    setDetailsOpen(false);
    setAiFieldSuggestions({});
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
        setDetailsOpen(false);
        setAiFieldSuggestions({});
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
        setDetailsOpen(false);
        setAiFieldSuggestions({});
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
      // Downsize before send. Camera photos can blow past Vercel's ~4.5MB
      // request body cap and surface as a 413 from /api/gemini/analyze.
      // compressImageForAi falls back to the raw base64 if it can't compress
      // (e.g. HEIC photos that browsers can't decode), so we never lose the
      // original payload here.
      const base64Data = await compressImageForAi(image);
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
        if (result.status !== 'success') {
          if (result.status === 'error') {
            console.warn('AI analysis failed:', result.message);
          }
          setError(t('analysisFallback'));
          hadError = true;
          analyzed.push(createBatchItem(image, existingIds[idx] ? { id: existingIds[idx] } : {}));
          continue;
        }
        analyzed.push(
          createBatchItem(image, {
            id: existingIds[idx] || Math.random().toString(36).slice(2, 10),
            title: result.title || '',
            // notes (Story) is now user-authored only — never AI-filled.
            notes: '',
            data: {
              ...cleanAiData(result.data || {}),
              ...(result.aiDescription ? { _aiDescription: result.aiDescription } : {}),
            },
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
    setDetailsOpen(false);
    setAiFieldSuggestions({});
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
      // Downsize before send. Camera photos can blow past Vercel's ~4.5MB
      // request body cap and surface as a 413 from /api/gemini/analyze.
      // compressImageForAi falls back to the raw base64 on any failure so
      // we never silently lose the original payload here.
      const base64Data = await compressImageForAi(base64);
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
      if (result.status !== 'success') {
        if (result.status === 'error') {
          console.warn('AI analysis failed:', result.message);
        }
        setError(t('analysisFallback'));
        setAnalysisError(true);
        setStep('verify');
        return;
      }
      if (analysisRunId.current !== runId) return;

      const cleanedData = cleanAiData(result.data || {});
      const suggestedData = Object.fromEntries(
        Object.entries(cleanedData)
          .filter(([key]) => currentCollection.customFields.some((field) => field.id === key))
          .map(([key, value]) => [key, String(value)]),
      );
      const isGeneric =
        (result.title === 'New Item' || !result.title) && Object.keys(cleanedData).length < 2;
      setLowConfidence(isGeneric);
      setAiFieldSuggestions(suggestedData);

      setFormData({
        title: result.title || '',
        // notes (Story) is now user-authored only — never AI-filled.
        notes: '',
        data: {
          ...(result.aiDescription ? { _aiDescription: result.aiDescription } : {}),
        },
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
    setAiFieldSuggestions({});
    if (step === 'upload' || step === 'analyzing') {
      setError(null);
      setAnalysisError(false);
      setAnalysisNeedsReview(false);
      analyze(edited);
      return;
    }
    setAnalysisNeedsReview(true);
  };

  const visibleAiSuggestions = Object.entries(aiFieldSuggestions).filter(([fieldId]) =>
    currentCollection?.customFields.some((field) => field.id === fieldId),
  );

  const acceptFieldSuggestion = (fieldId: string, value: string) => {
    setFormData({
      ...formData,
      data: { ...formData.data, [fieldId]: value },
    });
    setAiFieldSuggestions((prev) => {
      const next = { ...prev };
      delete next[fieldId];
      return next;
    });
  };

  const recoverMissingCollection = () => {
    const fallbackCollectionId =
      defaultCollectionId && collections.some((c) => c.id === defaultCollectionId)
        ? defaultCollectionId
        : collections.length === 1
          ? collections[0].id
          : null;
    if (fallbackCollectionId) {
      setSelectedCollectionId(fallbackCollectionId);
    }
    setStep(fallbackCollectionId ? 'upload' : 'select-type');
  };

  const getSaveErrorMessage = (error: unknown) =>
    error instanceof Error && error.message ? error.message : t('statusSyncPaused');

  const handleSave = async () => {
    if (isSaving) return;
    if (!currentCollection) {
      setError(t('selectCollectionFirst'));
      recoverMissingCollection();
      return;
    }
    const trimmedTitle = formData.title.trim();
    if (!trimmedTitle) {
      setTitleError(t('titleRequired'));
      titleInputRef.current?.focus();
      return;
    }
    setIsSaving(true);
    try {
      const story = formData.notes || '';
      await onSave(currentCollection.id, {
        collectionId: currentCollection.id,
        photoUrl: imagePreview || '',
        title: trimmedTitle,
        rating: formData.rating || 0,
        notes: story,
        data: formData.data || {},
      });
      trackEvent('item_saved', {
        mode: 'single',
        has_story: story.trim().length > 0,
        has_photo: Boolean(imagePreview),
        story_length_bucket: storyLengthBucket(story.trim().length),
      });
      onClose();
    } catch (e) {
      console.error('Save failed:', e);
      setError(getSaveErrorMessage(e));
    } finally {
      setIsSaving(false);
    }
  };

  const handleBatchSave = async () => {
    if (isSaving) return;
    if (!currentCollection) {
      setError(t('selectCollectionFirst'));
      recoverMissingCollection();
      return;
    }
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
      // Iterate over a snapshot and drop each entry as it succeeds, so a
      // mid-batch failure leaves only the unsaved items behind. Retrying then
      // reprocesses just those, instead of re-saving already-persisted items
      // (which would create duplicates with fresh IDs).
      for (const item of [...batchItems]) {
        const story = item.notes || '';
        await onSave(currentCollection.id, {
          collectionId: currentCollection.id,
          photoUrl: item.image,
          title: item.title || 'Untitled',
          rating: item.rating || 0,
          notes: story,
          data: item.data || {},
        });
        setBatchItems((prev) => prev.filter((b) => b.id !== item.id));
        trackEvent('item_saved', {
          mode: 'batch',
          has_story: story.trim().length > 0,
          has_photo: Boolean(item.image),
          story_length_bucket: storyLengthBucket(story.trim().length),
        });
      }
      onClose();
    } catch (e) {
      console.error('Batch save failed:', e);
      setError(getSaveErrorMessage(e));
    } finally {
      setIsSaving(false);
    }
  };

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
            data-testid="add-item-collection-tile"
            className={`p-4 sm:p-6 rounded-xl sm:rounded-2xl ${selectTileClass} transition-all text-left group shadow-sm hover:shadow-md`}
          >
            <span className="block text-2xl sm:text-3xl mb-2 sm:mb-3 group-hover:scale-110 transition-transform origin-left">
              {c.icon || '📦'}
            </span>
            <span
              className={`font-bold ${selectTileTitleClass} block text-base sm:text-lg truncate`}
            >
              {c.name}
            </span>
            <span className={`text-[10px] font-medium uppercase tracking-wider ${mutedText}`}>
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
          <button
            type="button"
            onClick={pickFromGallery}
            aria-label={imagePreview ? t('changePhoto') : undefined}
            data-testid="add-item-upload-empty"
            className={`w-32 h-32 sm:w-40 sm:h-40 rounded-full border-2 border-dashed flex flex-col items-center justify-center group focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 focus-visible:ring-offset-2 transition-all cursor-pointer overflow-hidden ${uploadEmptyTileClass}`}
          >
            {imagePreview ? (
              <img src={imagePreview} className="w-full h-full object-cover" alt="" />
            ) : (
              <>
                <Upload size={28} className="sm:w-8 sm:h-8 mb-2" aria-hidden="true" />
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">
                  {t('uploadPhoto')}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
      <div>
        <h3
          className={`text-xl sm:text-2xl font-serif font-bold mb-1 sm:mb-2 ${uploadHeadingClass}`}
        >
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
          data-testid="add-item-skip-manual"
          className={`text-xs sm:text-sm font-medium transition-colors ${mutedText} ${subtleLinkHoverClass}`}
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
        <div
          data-testid="add-item-batch-info"
          className={`p-4 rounded-2xl flex gap-3 border ${warnBannerClass}`}
        >
          <Zap className={`shrink-0 ${batchInfoIconClass}`} size={20} />
          <div>
            <h4 className={`text-sm font-bold ${batchInfoTitleClass}`}>{t('batchMode')}</h4>
            <p className="text-[11px]">{t('batchModeDesc')}</p>
          </div>
        </div>
        {error && (
          <div
            id="add-item-error"
            className={`p-3 text-xs rounded-xl border font-medium ${warnBannerClass}`}
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
            <div key={item.id} className={`rounded-2xl border ${batchItemCardClass} p-3 shadow-sm`}>
              <div className="flex gap-3 items-start">
                <div
                  className={`group relative w-20 h-20 rounded-xl overflow-hidden border ${imageTileClass} shrink-0`}
                >
                  <img
                    src={item.image}
                    alt={item.title || t('photoPreview')}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => removeBatchItem(item.id)}
                    aria-label={t('remove')}
                    className={`absolute top-1 right-1 p-1.5 rounded-full shadow-sm transition-colors ${batchRemoveButtonClass}`}
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
                    <div className="flex items-center gap-1">
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
                      {item.rating > 0 && (
                        <span
                          className={`ml-1 font-mono text-xs font-medium tabular-nums ${mutedText}`}
                        >
                          {t('ratingValue', { value: item.rating, max: 5 })}
                        </span>
                      )}
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
            className={`w-full rounded-xl border-2 border-dashed flex flex-col items-center justify-center transition-all py-6 ${addMoreTileClass}`}
          >
            <Plus size={20} />
            <span className="text-[9px] font-bold uppercase mt-2">{t('addMore')}</span>
          </button>
        </div>
      </div>
    );
  };

  const renderAnalyzing = () => (
    <div className="text-center py-12 sm:py-20 space-y-4 sm:space-y-6">
      <div className="relative inline-block">
        <div className="absolute inset-0 bg-amber-200 rounded-full animate-ping opacity-20"></div>
        <div className={`relative p-4 sm:p-6 rounded-full shadow-lg border ${analyzingPillClass}`}>
          <Sparkles size={32} className="sm:w-10 sm:h-10 text-amber-500 animate-pulse" />
        </div>
      </div>
      <div>
        <h3
          className={`text-xl sm:text-2xl font-serif font-bold mb-1 sm:mb-2 ${
            theme === 'vault'
              ? 'text-white'
              : theme === 'atelier'
                ? 'text-[#3D3530]'
                : 'text-stone-900'
          }`}
        >
          {t('analyzingPhoto')}
        </h3>
        <p className={`text-sm sm:text-base italic font-serif ${mutedText}`}>
          {t('geminiExtracting')}
        </p>
        {batchProgress && batchProgress.total > 1 && (
          <p className={`text-xs mt-2 ${mutedText}`}>
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
        <div
          className={`p-4 text-sm rounded-xl border flex flex-col gap-2 ${lowConfidenceSurfaceClass}`}
        >
          <div className={`flex items-center gap-2 font-semibold ${lowConfidenceTitleClass}`}>
            <AlertCircle size={16} className="text-amber-500" />
            <span>{t('aiLowConfidenceTitle')}</span>
          </div>
          <p className="text-xs leading-relaxed opacity-80">{t('aiLowConfidenceDesc')}</p>
        </div>
      )}
      {analysisNeedsReview && (
        <div
          id="add-item-review"
          className={`p-3 text-xs rounded-xl border font-medium flex items-center justify-between gap-2 ${warnBannerClass}`}
        >
          <span>{t('analysisNeedsReview')}</span>
          <button
            onClick={retryAnalysis}
            className={`underline underline-offset-4 font-semibold ${warnBannerActionClass}`}
          >
            {t('retryAnalysis')}
          </button>
        </div>
      )}
      {error && (
        <div
          id="add-item-error"
          className={`p-3 text-xs rounded-xl border font-medium flex items-center justify-between gap-2 ${warnBannerClass}`}
        >
          <span>{error}</span>
          {analysisError && (
            <button
              onClick={switchToManual}
              className={`underline underline-offset-4 font-semibold ${warnBannerActionClass}`}
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
      <div className="space-y-3">
        <div
          data-testid="add-item-photo-hero"
          className={`relative w-full aspect-[4/3] min-h-[220px] overflow-hidden rounded-2xl border ${imageTileClass}`}
        >
          {imagePreview ? (
            <img
              src={imagePreview}
              alt={t('photoPreview')}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <CameraIcon className={`h-24 w-24 ${imageTilePlaceholderClass}`} />
            </div>
          )}
          {imagePreview && (
            <button
              onClick={() => setIsImageEditorOpen(true)}
              className={`absolute bottom-3 right-3 rounded-full px-3 py-1.5 text-[11px] font-semibold shadow-sm transition-colors ${
                theme === 'vault'
                  ? 'bg-stone-950/90 text-white hover:bg-stone-900'
                  : 'bg-white/95 text-amber-800 hover:bg-white'
              }`}
            >
              {t('editPhoto')}
            </button>
          )}
        </div>
        <p className={`text-xs ${mutedText}`}>{t('photoFirstHint')}</p>
      </div>

      <div>
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

      {visibleAiSuggestions.length > 0 && (
        <div
          data-testid="add-item-ai-suggestions"
          className={`rounded-2xl border ${borderClass} p-3 sm:p-4 ${theme === 'vault' ? 'bg-white/5' : 'bg-amber-50/40'}`}
        >
          <p className={`mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] ${mutedText}`}>
            {t('suggestedDetails')}
          </p>
          <div className="flex flex-wrap gap-2">
            {visibleAiSuggestions.map(([fieldId, value]) => {
              const field = currentCollection?.customFields.find((f) => f.id === fieldId);
              const label = getFieldLabel(fieldId, field?.label || fieldId);
              return (
                <button
                  key={fieldId}
                  type="button"
                  onClick={() => acceptFieldSuggestion(fieldId, value)}
                  className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1.5 text-left text-xs font-semibold transition-colors ${
                    theme === 'vault'
                      ? 'border-amber-300/30 bg-amber-300/10 text-amber-100 hover:bg-amber-300/20'
                      : 'border-amber-200 bg-white text-amber-900 hover:bg-amber-100'
                  }`}
                  aria-label={t('acceptSuggestion', { field: label, value })}
                >
                  <Sparkles size={12} aria-hidden />
                  <span className="truncate">
                    {label}: {value}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-3 sm:space-y-4 px-1">
        <div>
          <label
            htmlFor="add-item-story"
            className={`block text-[11px] font-semibold uppercase tracking-[0.12em] ${mutedText} mb-1 sm:mb-2`}
          >
            {t('story')}
          </label>
          <textarea
            id="add-item-story"
            ref={storyInputRef}
            className={`w-full p-3 sm:p-4 rounded-xl font-serif italic text-base leading-relaxed min-h-[128px] sm:min-h-[160px] ${inputSurface} placeholder:not-italic placeholder:font-sans placeholder:text-sm`}
            value={formData.notes || ''}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder={t('storyPlaceholder')}
          />
          {!promptsOpen && (
            <button
              type="button"
              onClick={openStoryPromptsPanel}
              className={`mt-2 text-[11px] sm:text-xs font-medium ${mutedText} hover:text-amber-600 transition-colors inline-flex items-center gap-1`}
            >
              <Sparkles size={12} aria-hidden /> {t('storyPromptCta')}
            </button>
          )}
          {promptsOpen && (
            <div
              className={`mt-3 rounded-xl border ${borderClass} p-3 sm:p-4 ${theme === 'vault' ? 'bg-white/5' : 'bg-amber-50/40'}`}
            >
              <div className="flex items-center justify-between mb-2">
                <p className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${mutedText}`}>
                  {t('storyPromptHelp')}
                </p>
                <button
                  type="button"
                  onClick={() => setPromptsOpen(false)}
                  data-testid="add-item-story-prompt-hide"
                  className={`text-[11px] transition-colors ${mutedText} ${subtleLinkHoverClass}`}
                >
                  {t('storyPromptHide')}
                </button>
              </div>
              {promptsLoading && (
                <p className={`text-[12px] ${mutedText} italic`}>{t('storyPromptLoading')}</p>
              )}
              {!promptsLoading && storyPrompts.length === 0 && (
                <p className={`text-[12px] ${mutedText}`}>{t('storyPromptEmpty')}</p>
              )}
              <ul className="space-y-1.5 mt-1">
                {storyPrompts.map((prompt, idx) => (
                  <li key={`${idx}-${prompt}`}>
                    <button
                      type="button"
                      onClick={() => insertStoryPrompt(prompt)}
                      className={`w-full text-left text-[12px] sm:text-[13px] px-2 py-1.5 rounded-lg flex items-start gap-2 transition-colors ${theme === 'vault' ? 'hover:bg-white/10 text-stone-200' : 'hover:bg-white text-stone-700'}`}
                    >
                      <Plus size={12} className="mt-0.5 shrink-0" aria-hidden />
                      <span>{prompt}</span>
                      <span className="sr-only">{t('storyPromptInsert')}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <button
          type="button"
          data-testid="add-item-more-details-toggle"
          onClick={() => setDetailsOpen((open) => !open)}
          aria-expanded={detailsOpen}
          className={`flex w-full items-center justify-between rounded-xl border ${borderClass} px-3 py-3 text-sm font-semibold transition-colors ${
            theme === 'vault'
              ? 'bg-white/5 text-stone-100 hover:bg-white/10'
              : 'bg-stone-50 text-stone-800 hover:bg-stone-100'
          }`}
        >
          <span>{detailsOpen ? t('collapseDetails') : t('moreDetails')}</span>
          <ArrowRight
            size={16}
            className={`transition-transform ${detailsOpen ? 'rotate-90' : ''}`}
            aria-hidden
          />
        </button>

        {detailsOpen && (
          <div data-testid="add-item-more-details" className="space-y-3 sm:space-y-4">
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
                  onChange={(e) => {
                    setFormData({
                      ...formData,
                      data: { ...formData.data, [field.id]: e.target.value },
                    });
                    setAiFieldSuggestions((prev) => {
                      if (!(field.id in prev)) return prev;
                      const next = { ...prev };
                      delete next[field.id];
                      return next;
                    });
                  }}
                />
              </div>
            ))}
            <div>
              <label
                className={`block text-[11px] font-semibold uppercase tracking-[0.12em] ${mutedText} mb-0.5 sm:mb-1`}
              >
                {t('rating')}
              </label>
              <div className="flex items-center gap-1 sm:gap-2">
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
                {formData.rating > 0 && (
                  <span className={`ml-1 font-mono text-sm font-medium tabular-nums ${mutedText}`}>
                    {t('ratingValue', { value: formData.rating, max: 5 })}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
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
          <div className="sm:hidden h-3" />
          <div className={`flex items-center justify-between p-4 sm:p-6 border-b ${borderClass}`}>
            <h2
              id="add-item-modal-title"
              className={`font-serif font-bold text-lg sm:text-xl ${theme === 'vault' ? 'text-white' : 'text-stone-800'}`}
            >
              {t('addItem')}
            </h2>
            <button
              onClick={requestClose}
              aria-label={t('close')}
              className={`p-2 rounded-full transition-colors ${theme === 'vault' ? 'hover:bg-white/5 text-stone-300 hover:text-white' : 'hover:bg-stone-100 text-stone-400 hover:text-stone-800'}`}
            >
              <X size={20} />
            </button>
          </div>

          {/* The desktop dialog is sm:h-auto (indefinite height), so percentage
              heights inside this panel never resolve — h-full falls back to
              content height and paints over the footer, making Save
              unclickable (CUR-142). Size children with flex instead. */}
          <div className="relative flex-1 min-h-0 flex flex-col">
            {confirmingDiscard ? (
              <div
                ref={confirmRef}
                data-testid="add-item-discard-confirm"
                className="flex-1 flex flex-col items-center justify-center text-center p-6 sm:p-8"
              >
                <div
                  className={`p-2.5 rounded-full mb-4 ${
                    theme === 'vault'
                      ? 'bg-amber-500/15 text-amber-300'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                  aria-hidden
                >
                  <AlertCircle size={22} />
                </div>
                <h3
                  id="add-item-discard-title"
                  className={`font-serif font-bold text-xl sm:text-2xl mb-2 ${theme === 'vault' ? 'text-white' : 'text-stone-900'}`}
                >
                  {t('discardItemTitle')}
                </h3>
                <p
                  id="add-item-discard-desc"
                  className={`text-sm leading-relaxed max-w-xs ${mutedText} mb-6`}
                >
                  {t('discardItemDesc')}
                </p>
                <div className="w-full max-w-xs flex flex-col gap-2">
                  <Button
                    autoFocus
                    onClick={() => setConfirmingDiscard(false)}
                    size="lg"
                    className="w-full"
                  >
                    {t('keepEditing')}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setConfirmingDiscard(false);
                      onClose();
                    }}
                    className="w-full"
                  >
                    {t('discardItemAction')}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div
                  ref={scrollRef}
                  data-testid="add-item-scroll"
                  onScroll={updateScrollAffordance}
                  className="flex-1 min-h-0 overflow-y-auto p-5 pb-6 sm:p-8 overscroll-contain"
                >
                  <div ref={scrollContentRef} className="space-y-6">
                    {step === 'select-type' && renderCollectionSelect()}
                    {step === 'upload' && renderUpload()}
                    {step === 'batch-verify' && renderBatchVerify()}
                    {step === 'analyzing' && renderAnalyzing()}
                    {step === 'verify' && renderVerify()}
                  </div>
                </div>
                <div
                  aria-hidden="true"
                  data-testid="add-item-scroll-fade"
                  className={`pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t ${scrollFadeFrom} to-transparent transition-opacity duration-200 ${canScrollDown ? 'opacity-100' : 'opacity-0'}`}
                />
              </>
            )}
          </div>
          {!confirmingDiscard &&
            step === 'verify' &&
            (() => {
              const storyEmpty = !(formData.notes || '').trim();
              const label = isSaving
                ? t('analyzingPhoto').split('...')[0]
                : storyEmpty
                  ? t('storySaveWithout')
                  : t('saveToMuseum');
              return (
                <div
                  data-testid="add-item-save-footer"
                  className={`sticky bottom-0 z-10 border-t ${borderClass} p-4 sm:p-5 ${theme === 'vault' ? 'bg-stone-950' : 'bg-white'}`}
                >
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handleSave}
                    icon={
                      isSaving ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <Check size={18} />
                      )
                    }
                    disabled={isSaving}
                  >
                    {label}
                  </Button>
                  {storyEmpty && !isSaving && (
                    <p className={`mt-2 text-center text-[11px] ${mutedText}`}>
                      {t('storySaveWithoutHint')}
                    </p>
                  )}
                </div>
              );
            })()}
          {!confirmingDiscard && step === 'batch-verify' && (
            <div
              className={`border-t ${borderClass} p-4 sm:p-5 ${theme === 'vault' ? 'bg-stone-950' : 'bg-white'}`}
            >
              <Button
                className="w-full"
                size="lg"
                onClick={handleBatchSave}
                icon={
                  isSaving ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <ArrowRight size={18} />
                  )
                }
                disabled={
                  batchItems.length === 0 ||
                  isSaving ||
                  batchItems.some((item) => !item.title.trim())
                }
              >
                {isSaving
                  ? t('analyzingPhoto').split('...')[0]
                  : t(batchItems.length === 1 ? 'archiveArtifact' : 'archiveArtifacts', {
                      count: batchItems.length,
                    })}
              </Button>
            </div>
          )}
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
