import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Camera,
  CheckSquare,
  Loader2,
  Lock,
  Printer,
  Quote,
  Redo2,
  Sparkles,
  Star,
  Trash2,
  Undo2,
} from 'lucide-react';
import { useTranslation, getFieldTranslation, getFieldHint } from '../i18n';
import {
  useTheme,
  typographyClasses,
  labelColorClasses,
  mutedTextClasses,
  accentColorClasses,
  dividerClasses,
  ratingColorClasses,
  ratingEmptyClasses,
} from '../theme';
import { UserCollection, CollectionItem } from '../types';
import { isBuiltInTemplateField } from '../constants';
import { Button } from './ui/Button';
import { ItemDetailSkeleton } from './ui/Skeleton';
import { ItemImage } from './ItemImage';
import { ExportModal } from './ExportModal';
import { EnhanceImageModal } from './EnhanceImageModal';
import { ImageEditModal } from './ImageEditModal';
import { DeleteItemModal } from './DeleteItemModal';
import type { StatusTone } from './StatusToast';
import { clearEnhancedReference, extractCurioAssetPath, saveAsset } from '../services/db';
import { processImage } from '../services/imageProcessor';
import { fetchStoryPrompts, refreshAiImageEditEnabled } from '../services/geminiService';
import { trackEvent } from '../services/analytics';

/**
 * CUR-13: items created before this timestamp may have AI-authored notes
 * ("Archive Narrative"). The legacy migration banner is offered for those
 * items only, exactly once each. New items default to user-authored Story.
 *
 * Setting this to the merge moment of the CUR-13 rollout PR — the cutoff
 * is conservative on purpose; the user can still dismiss the banner if
 * the heuristic mis-fires.
 */
const STORY_FEATURE_LAUNCHED_AT = '2026-05-16T00:00:00.000Z';

// CUR-135: Item Detail undo/redo can be reached from the keyboard.
// `navigator.platform` is deprecated but still populated in every browser
// Curio targets; jsdom exposes it too, so tests see a stable value.
const IS_MAC =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.platform || '');
const UNDO_SHORTCUT_LABEL = IS_MAC ? '⌘Z' : 'Ctrl+Z';
const REDO_SHORTCUT_LABEL = IS_MAC ? '⌘⇧Z' : 'Ctrl+Shift+Z';

export type ItemSaveState = {
  status: 'saving' | 'saved' | 'error';
  error?: string;
};

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return target.isContentEditable;
};

// CUR-135: item modals (Export, Delete, Enhance, ImageEdit, …) mount above
// the item detail while it stays in the DOM. Focus inside a dialog must not
// silently mutate the item behind it — the app-level undo should only fire
// while the item detail itself is the active surface.
const isInsideModalDialog = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  return target.closest('[aria-modal="true"], [data-export-modal]') !== null;
};

const isLegacyAiNoteItem = (item: CollectionItem): boolean => {
  const story = item.notes;
  if (!story || !story.trim()) return false;
  const data = item.data || {};
  if (data._isLegacyAiNotes === false) return false; // explicit exemption (e.g. seed items)
  if (data._storyMigrationDismissed === true) return false;
  if (data._aiDescription) return false; // already on the new schema
  const createdAt = Date.parse(item.createdAt);
  if (Number.isNaN(createdAt)) return false;
  return createdAt < Date.parse(STORY_FEATURE_LAUNCHED_AT);
};

interface ItemDetailScreenProps {
  collections: UserCollection[];
  isAdmin: boolean;
  isLoading: boolean;
  itemSaveStates: Record<string, ItemSaveState>;
  updateItem: (collectionId: string, itemId: string, updates: Partial<CollectionItem>) => void;
  deleteItem: (collectionId: string, itemId: string) => boolean;
  retryItemSave: (collection: UserCollection, itemId: string) => void;
  checkStorageQuota: () => Promise<void>;
  showStatus: (message: string, tone?: StatusTone) => void;
}

// CUR-149: this screen must be a top-level component (not declared inside
// AppContent) so its identity is stable across app re-renders. An inline
// declaration remounted the screen on every keystroke (each edit updates
// app state), which dropped focus after one character and corrupted titles.
export const ItemDetailScreen: React.FC<ItemDetailScreenProps> = ({
  collections,
  isAdmin,
  isLoading,
  itemSaveStates,
  updateItem,
  deleteItem,
  retryItemSave,
  checkStorageQuota,
  showStatus,
}) => {
  const { t, language } = useTranslation();
  const { theme } = useTheme();
  const { id, itemId } = useParams<{ id: string; itemId: string }>();
  const navigate = useNavigate();
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isEnhanceOpen, setIsEnhanceOpen] = useState(false);
  const [isDeleteItemModalOpen, setIsDeleteItemModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiImageEditEnabled, setAiImageEditEnabled] = useState(false);
  const [imageKey, setImageKey] = useState(0); // Used to force re-render of ItemImage after enhancement
  const [imageEditSource, setImageEditSource] = useState<string | null>(null);
  const [isImageEditorOpen, setIsImageEditorOpen] = useState(false);
  // Story (CUR-13): when the user dismisses the empty-state card by tapping
  // "Write your story", switch to the textarea even though notes is still empty.
  const [storyEditingOverride, setStoryEditingOverride] = useState(false);
  const [detailPromptsOpen, setDetailPromptsOpen] = useState(false);
  const [detailPromptsLoading, setDetailPromptsLoading] = useState(false);
  const [detailStoryPrompts, setDetailStoryPrompts] = useState<string[]>([]);
  const [detailPromptsFetchedFor, setDetailPromptsFetchedFor] = useState<string | null>(null);
  const detailStoryRef = useRef<HTMLTextAreaElement | null>(null);
  const [history, setHistory] = useState<
    Pick<CollectionItem, 'title' | 'notes' | 'rating' | 'data'>[]
  >([]);
  const [future, setFuture] = useState<
    Pick<CollectionItem, 'title' | 'notes' | 'rating' | 'data'>[]
  >([]);
  const historyTimeoutRef = useRef<number | null>(null);
  const pendingSnapshotRef = useRef<Pick<
    CollectionItem,
    'title' | 'notes' | 'rating' | 'data'
  > | null>(null);
  const isApplyingHistoryRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const detailFieldTextareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  const collection = collections.find((c) => c.id === id);
  const item = collection?.items.find((i) => i.id === itemId);

  // Check if AI image editing is enabled
  useEffect(() => {
    refreshAiImageEditEnabled().then(setAiImageEditEnabled);
  }, []);

  useEffect(() => {
    const ta = titleTextareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${ta.scrollHeight}px`;
  }, [item?.title]);

  // CUR-135: install the keyboard shortcut listener before any early return
  // so the hook order stays stable while the item is still loading. The ref
  // is populated further down once handleUndo/handleRedo are defined.
  const shortcutRef = useRef({
    isReadOnly: false,
    historyLength: 0,
    futureLength: 0,
    handleUndo: () => {},
    handleRedo: () => {},
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const current = shortcutRef.current;
      if (current.isReadOnly) return;
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      const isUndo = key === 'z' && !e.shiftKey;
      // Windows-style redo (Ctrl+Y) — skip when Meta is also held so it
      // doesn't collide with browser History shortcuts on macOS.
      const isRedo = (key === 'z' && e.shiftKey) || (key === 'y' && e.ctrlKey && !e.metaKey);
      if (!isUndo && !isRedo) return;
      if (isEditableTarget(e.target)) return;
      if (isInsideModalDialog(e.target)) return;
      if (isUndo && current.historyLength > 0) {
        e.preventDefault();
        current.handleUndo();
      } else if (isRedo && current.futureLength > 0) {
        e.preventDefault();
        current.handleRedo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // CUR-149: now that this component keeps its identity across renders (it
  // used to remount every time, making each render a first mount), every
  // hook must run before the early return below or the hook order breaks
  // once the item resolves.
  useEffect(() => {
    setHistory([]);
    setFuture([]);
    pendingSnapshotRef.current = null;
    if (historyTimeoutRef.current) {
      clearTimeout(historyTimeoutRef.current);
      historyTimeoutRef.current = null;
    }
    // Reset Story UI state when navigating between items so the empty card
    // and stale prompt cache don't leak across items.
    setStoryEditingOverride(false);
    setDetailPromptsOpen(false);
    setDetailStoryPrompts([]);
    setDetailPromptsFetchedFor(null);
  }, [item?.id]);

  useEffect(() => {
    collection?.customFields.forEach((field) => {
      const textarea = detailFieldTextareaRefs.current[field.id];
      if (!textarea) return;
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    });
  }, [collection?.customFields, item?.data]);

  if (!collection || !item) {
    // CUR-118: deep-link reload of /collection/:id/item/:itemId must wait
    // for the cloud fetch instead of bouncing to Home / parent collection.
    // The `!item` half matters too: `refreshCollections()` flips `isLoading`
    // without clearing existing collection state, so a follow-up refresh
    // can leave the parent collection cached while the item is still in
    // the pending cloud response — without this guard, the shared link
    // would lose the item to the parent route before the fetch resolves.
    if (isLoading) return <ItemDetailSkeleton label={t('restoringArchives')} />;
    // CUR-144: when the whole collection is unknown, fall through to the
    // collection route instead of straight to Home — for a signed-out
    // visitor CollectionScreen renders the "isn't on view" explanation
    // there (authed users continue to Home via its existing redirect).
    return <Navigate to={`/collection/${id}`} replace />;
  }
  const isReadOnly = Boolean(collection.isPublic) && !isAdmin;
  const itemSaveState = itemSaveStates[item.id];

  const snapshotItem = (target: CollectionItem) => ({
    title: target.title,
    notes: target.notes,
    rating: target.rating,
    data: { ...target.data },
  });

  const isSameSnapshot = (
    a: Pick<CollectionItem, 'title' | 'notes' | 'rating' | 'data'>,
    b: Pick<CollectionItem, 'title' | 'notes' | 'rating' | 'data'>,
  ) => JSON.stringify(a) === JSON.stringify(b);

  const pushHistory = (snapshot: Pick<CollectionItem, 'title' | 'notes' | 'rating' | 'data'>) => {
    if (isApplyingHistoryRef.current) return;
    pendingSnapshotRef.current = snapshot;
    if (historyTimeoutRef.current) return;
    historyTimeoutRef.current = window.setTimeout(() => {
      historyTimeoutRef.current = null;
      const pending = pendingSnapshotRef.current;
      pendingSnapshotRef.current = null;
      if (!pending) return;
      setHistory((prev) => {
        const last = prev[prev.length - 1];
        if (last && isSameSnapshot(last, pending)) return prev;
        const next = [...prev, pending];
        return next.slice(-20);
      });
      setFuture([]);
    }, 600);
  };

  const applyItemUpdate = (updates: Partial<CollectionItem>) => {
    pushHistory(snapshotItem(item));
    updateItem(collection.id, item.id, updates);
  };

  const focusStoryTextarea = () => {
    setStoryEditingOverride(true);
    requestAnimationFrame(() => detailStoryRef.current?.focus());
  };

  const detailPromptsCacheKey = `${item.title || ''} ${(item.data?._aiDescription as string | undefined) || ''}`;

  const openDetailPromptsPanel = async () => {
    setDetailPromptsOpen(true);
    // Make sure the textarea is mounted so insertions land in a real element.
    if (!storyEditingOverride) setStoryEditingOverride(true);
    if (detailPromptsLoading) return;
    if (detailPromptsFetchedFor === detailPromptsCacheKey && detailStoryPrompts.length > 0) {
      return;
    }
    trackEvent('story_prompt_panel_opened', { surface: 'item_detail' });
    setDetailPromptsLoading(true);
    try {
      const knownFields: Record<string, string | number> = {};
      for (const [k, v] of Object.entries(item.data || {})) {
        if (k.startsWith('_')) continue;
        if (typeof v === 'string' || typeof v === 'number') knownFields[k] = v;
      }
      const result = await fetchStoryPrompts({
        title: item.title || '',
        collectionContext: {
          name: collection.name,
          description: collection.collectionDescription,
        },
        aiDescription: (item.data?._aiDescription as string | undefined) || undefined,
        knownFields,
        locale: language,
      });
      setDetailStoryPrompts(result.prompts);
      if (result.prompts.length > 0) {
        setDetailPromptsFetchedFor(detailPromptsCacheKey);
      } else {
        // Leave the panel open with an informative message; the user can
        // dismiss with "Hide prompts" and retry once they've edited the
        // title or other context.
        setDetailPromptsFetchedFor(null);
      }
    } finally {
      setDetailPromptsLoading(false);
    }
  };

  const insertDetailStoryPrompt = (prompt: string) => {
    const el = detailStoryRef.current;
    const current = item.notes || '';
    const snippet = `> ${prompt}\n\n`;
    const insertAt = el?.selectionStart ?? current.length;
    const next = current.slice(0, insertAt) + snippet + current.slice(insertAt);
    applyItemUpdate({ notes: next });
    trackEvent('story_prompt_inserted', { surface: 'item_detail', prompt_length: prompt.length });
    requestAnimationFrame(() => {
      const t = detailStoryRef.current;
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

  const handleUndo = () => {
    if (history.length === 0 || isReadOnly) return;
    const previous = history[history.length - 1];
    isApplyingHistoryRef.current = true;
    setHistory((prev) => prev.slice(0, -1));
    setFuture((prev) => [snapshotItem(item), ...prev].slice(0, 20));
    updateItem(collection.id, item.id, previous);
    requestAnimationFrame(() => {
      isApplyingHistoryRef.current = false;
    });
  };

  const handleRedo = () => {
    if (future.length === 0 || isReadOnly) return;
    const next = future[0];
    isApplyingHistoryRef.current = true;
    setFuture((prev) => prev.slice(1));
    setHistory((prev) => [...prev, snapshotItem(item)].slice(-20));
    updateItem(collection.id, item.id, next);
    requestAnimationFrame(() => {
      isApplyingHistoryRef.current = false;
    });
  };

  // CUR-135: Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z, Ctrl+Y drive the app-level
  // undo/redo stacks that the on-screen buttons already use. Text-field
  // focus defers to the browser's native per-field undo so typing history
  // stays reachable; the shortcut only steps the app-level stack once the
  // user has clicked out of the field. Read-only items ignore both keys.
  shortcutRef.current.isReadOnly = isReadOnly;
  shortcutRef.current.historyLength = history.length;
  shortcutRef.current.futureLength = future.length;
  shortcutRef.current.handleUndo = handleUndo;
  shortcutRef.current.handleRedo = handleRedo;

  const handleDelete = () => {
    if (isReadOnly) return;
    setIsDeleteItemModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (deleteItem(collection.id, item.id)) {
      setIsDeleteItemModalOpen(false);
      navigate(`/collection/${collection.id}`);
    }
  };

  const handleRetryItemSave = () => {
    retryItemSave(collection, item.id);
  };

  const applyEditedPhoto = async (dataUrl: string) => {
    setIsProcessing(true);
    try {
      await clearEnhancedReference(item.id);
      if (collection.isPublic) {
        updateItem(collection.id, item.id, {
          photoUrl: dataUrl,
          photoEnhancedPath: undefined,
        });
      } else {
        const { original, display } = await processImage(dataUrl);
        await saveAsset(collection.id, item.id, original, display);
        await checkStorageQuota();
        updateItem(collection.id, item.id, {
          photoUrl: 'asset',
          photoEnhancedPath: undefined,
        });
      }
    } catch (err) {
      console.error('Photo update failed', err);
      showStatus(t('photoUpdateFailed'), 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePhotoUpdate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isReadOnly) return;
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        setImageEditSource(base64);
        setIsImageEditorOpen(true);
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    }
  };

  const getLabel = (fieldId: string) =>
    getFieldTranslation(t, fieldId, collection.customFields.find((f) => f.id === fieldId)?.label);

  const titleIsEmpty = !item.title.trim();
  const hasPhoto = item.photoUrl && item.photoUrl !== '';
  // Check if photo is an asset: either 'asset' sentinel, Supabase URL, or storage path
  const isAssetPhoto = (() => {
    if (!item.photoUrl || item.photoUrl === '') return false;
    if (item.photoUrl === 'asset') return true;
    // Check if it's a Supabase URL
    if (extractCurioAssetPath(item.photoUrl)) return true;
    // Check if it's a storage path (not a full URL, ends with image extension)
    if (
      !item.photoUrl.startsWith('http') &&
      !item.photoUrl.startsWith('data:') &&
      !item.photoUrl.startsWith('blob:') &&
      !item.photoUrl.startsWith('/')
    ) {
      return (
        item.photoUrl.endsWith('.jpg') ||
        item.photoUrl.endsWith('.jpeg') ||
        item.photoUrl.endsWith('.png') ||
        item.photoUrl.endsWith('.webp')
      );
    }
    return false;
  })();

  const detailBaseClasses = {
    gallery: 'bg-white text-stone-900 border-stone-100 shadow-2xl',
    vault: 'bg-stone-950 text-white border-white/5 shadow-black/50 shadow-2xl',
    atelier: 'bg-[#faf9f6] text-stone-800 border-[#e8e6e1] shadow-xl',
  };

  return (
    <>
      <div
        className={`max-w-4xl mx-auto rounded-[2rem] sm:rounded-[4rem] border overflow-hidden animate-in zoom-in-95 duration-500 mb-[calc(var(--bottom-nav-height,5.5rem)+env(safe-area-inset-bottom,0px))] sm:mb-20 ${detailBaseClasses[theme]}`}
        onAnimationEnd={(e) => {
          // Remove animation classes after animation ends to fix fixed positioning in children
          e.currentTarget.classList.remove('animate-in', 'zoom-in-95', 'duration-500');
          e.currentTarget.style.animation = 'none';
        }}
      >
        <div
          className={`relative ${hasPhoto ? 'aspect-[4/5] max-h-[55vh] sm:aspect-[16/9] sm:max-h-none md:aspect-[21/9]' : 'h-32 sm:h-48'} bg-stone-950 group transition-all duration-700 ease-in-out`}
        >
          <ItemImage
            key={imageKey}
            itemId={item.id}
            collectionId={collection.id}
            photoUrl={item.photoUrl}
            enhancedPath={item.photoEnhancedPath}
            alt={item.title}
            type="enhanced"
            className="w-full h-full object-cover transition-transform duration-[10s] group-hover:scale-110 opacity-80"
          />

          <div className="absolute inset-0 bg-gradient-to-t from-stone-950/60 to-transparent"></div>

          {!isReadOnly && (
            <>
              <div
                className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${hasPhoto ? 'hidden sm:flex sm:opacity-0 sm:group-hover:opacity-100' : 'opacity-100'}`}
              >
                <button
                  disabled={isProcessing}
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-white/90 hover:bg-white text-stone-900 px-6 sm:px-8 py-2 sm:py-3 rounded-full font-bold shadow-2xl backdrop-blur-md transition-all hover:scale-105 flex items-center gap-2 sm:gap-3 disabled:opacity-50 text-xs sm:text-sm"
                >
                  {isProcessing ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Camera size={16} />
                  )}
                  {t('updatePhoto')}
                </button>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handlePhotoUpdate}
              />
            </>
          )}

          <button
            onClick={() => navigate(-1)}
            aria-label={t('back')}
            className={`absolute top-4 left-4 sm:top-8 sm:left-8 w-11 h-11 sm:w-14 sm:h-14 backdrop-blur-md rounded-xl sm:rounded-2xl flex items-center justify-center shadow-xl transition-all hover:scale-105 z-10 ${theme === 'vault' ? 'bg-white/10 text-white' : 'bg-white/80 text-stone-800'}`}
          >
            <ArrowLeft size={20} className="sm:w-6 sm:h-6" />
          </button>

          <div className="absolute top-4 right-4 sm:top-8 sm:right-8 flex gap-2 sm:gap-4 z-10">
            {/* Mobile-only quick action to update the photo (desktop reveals the centered pill on hover) */}
            {!isReadOnly && hasPhoto && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className={`sm:hidden w-11 h-11 backdrop-blur-md rounded-xl flex items-center justify-center shadow-xl transition-all hover:scale-105 disabled:opacity-50 ${theme === 'vault' ? 'bg-white/10 text-white' : 'bg-white/80 text-stone-800'}`}
                title={t('updatePhoto')}
                aria-label={t('updatePhoto')}
              >
                {isProcessing ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Camera size={18} />
                )}
              </button>
            )}
            {/* Enhance Image Button - only show when AI is enabled, not read-only, and has photo */}
            {aiImageEditEnabled && !isReadOnly && isAssetPhoto && (
              <button
                onClick={() => setIsEnhanceOpen(true)}
                className={`w-11 h-11 sm:w-14 sm:h-14 backdrop-blur-md rounded-xl sm:rounded-2xl flex items-center justify-center shadow-xl transition-all hover:scale-105 ${theme === 'vault' ? 'bg-white/10 text-white' : 'bg-white/80 text-stone-800'}`}
                title={t('enhanceImage')}
                aria-label={t('enhanceImage')}
              >
                <Sparkles size={20} className="sm:w-6 sm:h-6" />
              </button>
            )}
            <button
              onClick={() => setIsExportOpen(true)}
              className={`w-11 h-11 sm:w-14 sm:h-14 backdrop-blur-md rounded-xl sm:rounded-2xl flex items-center justify-center shadow-xl transition-all hover:scale-105 ${theme === 'vault' ? 'bg-white/10 text-white' : 'bg-white/80 text-stone-800'}`}
              title={t('exportCard')}
              aria-label={t('exportCard')}
              data-testid="item-export"
            >
              <Printer size={20} className="sm:w-6 sm:h-6" />
            </button>
          </div>
        </div>

        <div className="p-8 sm:p-12 md:p-20 space-y-10 sm:space-y-12">
          {isReadOnly && (
            <div
              className={`flex items-center gap-3 p-4 rounded-2xl border ${theme === 'vault' ? 'bg-white/5 border-white/10' : 'bg-stone-50 border-stone-100'}`}
            >
              <div className="p-2 rounded-xl bg-amber-50 text-amber-700 shadow-inner">
                <Lock size={16} />
              </div>
              <div>
                <p
                  className={`text-sm font-semibold ${theme === 'vault' ? 'text-white' : 'text-stone-900'}`}
                >
                  {t('readOnlyMode')}
                </p>
                <p className="text-xs text-stone-500">{t('readOnlyItemDesc')}</p>
              </div>
            </div>
          )}
          <div className="flex flex-col md:flex-row justify-between items-start gap-8 sm:gap-12">
            <div className="flex-1 w-full">
              <textarea
                ref={titleTextareaRef}
                rows={1}
                aria-label={t('title')}
                aria-required="true"
                aria-invalid={titleIsEmpty && !isReadOnly ? true : undefined}
                aria-describedby={
                  titleIsEmpty && !isReadOnly ? 'item-detail-title-error' : undefined
                }
                className={`${typographyClasses.titleDisplay} mb-2 sm:mb-3 w-full bg-transparent border-b-2 resize-none overflow-hidden break-words leading-tight ${
                  titleIsEmpty && !isReadOnly
                    ? 'border-red-400 focus:border-red-500'
                    : 'border-transparent'
                } focus:border-amber-500 outline-none transition-all placeholder:italic ${theme === 'vault' ? 'text-white' : 'text-stone-900'} ${isReadOnly ? 'cursor-not-allowed opacity-70' : ''}`}
                value={item.title}
                onChange={(e) => applyItemUpdate({ title: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.currentTarget.blur();
                  }
                }}
                placeholder={t('itemTitlePlaceholder')}
                disabled={isReadOnly}
              />
              {titleIsEmpty && !isReadOnly && (
                <p
                  id="item-detail-title-error"
                  role="alert"
                  className="text-xs font-semibold text-red-500 mb-3"
                >
                  {t('titleRequired')}
                </p>
              )}
              {!isReadOnly && itemSaveState && (
                <div
                  role="status"
                  aria-live="polite"
                  data-testid="item-save-status"
                  className={`mb-3 inline-flex max-w-full flex-wrap items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                    itemSaveState.status === 'error'
                      ? theme === 'vault'
                        ? 'border-red-400/40 bg-red-500/10 text-red-200'
                        : 'border-red-200 bg-red-50 text-red-700'
                      : itemSaveState.status === 'saved'
                        ? theme === 'vault'
                          ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
                          : theme === 'atelier'
                            ? 'border-[#d7d0c5] bg-white/70 text-[#5f6f4f]'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : theme === 'vault'
                          ? 'border-white/10 bg-white/5 text-stone-300'
                          : 'border-stone-200 bg-stone-50 text-stone-600'
                  }`}
                >
                  {itemSaveState.status === 'saving' && (
                    <Loader2 size={14} className="shrink-0 animate-spin" aria-hidden />
                  )}
                  {itemSaveState.status === 'saved' && (
                    <CheckSquare size={14} className="shrink-0" aria-hidden />
                  )}
                  {itemSaveState.status === 'error' && (
                    <AlertCircle size={14} className="shrink-0" aria-hidden />
                  )}
                  <span>
                    {itemSaveState.status === 'saving'
                      ? t('itemSaveStatusSaving')
                      : itemSaveState.status === 'saved'
                        ? t('itemSaveStatusSaved')
                        : t('itemSaveStatusError')}
                  </span>
                  {itemSaveState.status === 'error' && (
                    <button
                      type="button"
                      onClick={handleRetryItemSave}
                      className={`rounded-full px-2 py-0.5 text-[11px] underline-offset-2 hover:underline ${
                        theme === 'vault' ? 'bg-white/10 text-white' : 'bg-white/80 text-red-800'
                      }`}
                    >
                      {t('actionRetry')}
                    </button>
                  )}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => applyItemUpdate({ rating: star })}
                    aria-label={t('rateStars', { count: star })}
                    aria-pressed={item.rating === star}
                    title={t('rateStars', { count: star })}
                    className={`p-2 min-w-[48px] min-h-[48px] flex items-center justify-center transition-transform ${isReadOnly ? 'cursor-not-allowed opacity-70' : 'hover:scale-125'}`}
                    disabled={isReadOnly}
                  >
                    <Star
                      className={`w-6 h-6 sm:w-9 sm:h-9 ${
                        star <= item.rating
                          ? `${ratingColorClasses[theme]} fill-current`
                          : ratingEmptyClasses[theme]
                      }`}
                      strokeWidth={1.5}
                    />
                  </button>
                ))}
                {item.rating > 0 && (
                  <span
                    className={`shrink-0 whitespace-nowrap font-mono text-sm font-medium tabular-nums ${ratingColorClasses[theme]}`}
                  >
                    {t('ratingValue', { value: item.rating, max: 5 })}
                  </span>
                )}
                <span
                  className={`shrink-0 whitespace-nowrap sm:ml-2 ${typographyClasses.label} ${mutedTextClasses[theme]}`}
                >
                  {t('yourRating')}
                </span>
                {isReadOnly && (
                  <span className="shrink-0 whitespace-nowrap text-[12px] text-amber-500 font-semibold">
                    {t('readOnlyControls')}
                  </span>
                )}
              </div>
            </div>
            {!isReadOnly && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleUndo}
                  disabled={history.length === 0}
                  aria-label={t('undo')}
                  title={`${t('undo')} (${UNDO_SHORTCUT_LABEL})`}
                  className={`p-3 sm:p-4 rounded-full transition-colors ${mutedTextClasses[theme]} ${
                    history.length === 0
                      ? 'opacity-50 cursor-not-allowed'
                      : theme === 'vault'
                        ? 'hover:text-white hover:bg-white/10'
                        : 'hover:text-stone-900 hover:bg-stone-100'
                  }`}
                >
                  <Undo2 size={18} className="sm:w-5 sm:h-5" />
                </button>
                <button
                  onClick={handleRedo}
                  disabled={future.length === 0}
                  aria-label={t('redo')}
                  title={`${t('redo')} (${REDO_SHORTCUT_LABEL})`}
                  className={`p-3 sm:p-4 rounded-full transition-colors ${mutedTextClasses[theme]} ${
                    future.length === 0
                      ? 'opacity-50 cursor-not-allowed'
                      : theme === 'vault'
                        ? 'hover:text-white hover:bg-white/10'
                        : 'hover:text-stone-900 hover:bg-stone-100'
                  }`}
                >
                  <Redo2 size={18} className="sm:w-5 sm:h-5" />
                </button>
                <button
                  onClick={handleDelete}
                  aria-label={t('deleteItem')}
                  title={t('deleteItem')}
                  className={`w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-xl border transition-colors shrink-0 ${
                    theme === 'vault'
                      ? 'bg-stone-900 border-white/10 text-stone-400 hover:text-red-400 hover:border-red-400/30'
                      : 'bg-white border-stone-200 text-stone-400 hover:text-red-500 hover:border-red-200'
                  }`}
                >
                  <Trash2 size={18} className="sm:w-5 sm:h-5" />
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 sm:gap-16">
            <div className="lg:col-span-2 space-y-6">
              <div className={`flex flex-wrap items-center gap-3 ${accentColorClasses[theme]}`}>
                <Quote size={18} fill="currentColor" className="opacity-20 sm:w-5 sm:h-5" />
                <dt
                  id="item-story-label"
                  className={`min-w-0 ${typographyClasses.label} ${labelColorClasses[theme]} break-words`}
                >
                  {t('story')}
                </dt>
              </div>
              {(() => {
                const isLegacy = isLegacyAiNoteItem(item);
                const isEmpty = !(item.notes || '').trim();
                const showEmptyCard = isEmpty && !isReadOnly && !storyEditingOverride;

                const dismissMigration = () => {
                  applyItemUpdate({
                    data: { ...item.data, _storyMigrationDismissed: true },
                  });
                  trackEvent('story_legacy_banner_action', { action: 'keep' });
                };
                const editLegacy = () => {
                  applyItemUpdate({
                    data: { ...item.data, _storyMigrationDismissed: true },
                  });
                  trackEvent('story_legacy_banner_action', { action: 'edit' });
                };
                const startFresh = () => {
                  applyItemUpdate({
                    notes: '',
                    data: {
                      ...item.data,
                      _aiDescription: item.notes,
                      _storyMigrationDismissed: true,
                    },
                  });
                  setStoryEditingOverride(true);
                  trackEvent('story_legacy_banner_action', { action: 'start_fresh' });
                  requestAnimationFrame(() => detailStoryRef.current?.focus());
                };

                return (
                  <>
                    {isLegacy && !isReadOnly && (
                      <div
                        className={`p-4 sm:p-5 rounded-2xl border ${theme === 'vault' ? 'bg-amber-500/10 border-amber-500/30 text-amber-100' : 'bg-amber-50 border-amber-200 text-amber-900'}`}
                      >
                        <p className="text-sm leading-relaxed mb-3">{t('storyMigrationBanner')}</p>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" onClick={startFresh}>
                            {t('storyMigrationStart')}
                          </Button>
                          <Button size="sm" variant="outline" onClick={editLegacy}>
                            {t('storyMigrationEdit')}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={dismissMigration}>
                            {t('storyMigrationKeep')}
                          </Button>
                        </div>
                      </div>
                    )}
                    {showEmptyCard ? (
                      <div
                        className={`w-full p-6 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border-2 border-dashed flex flex-col items-center justify-center text-center gap-3 min-h-[200px] sm:min-h-[240px] ${theme === 'vault' ? 'border-white/10 bg-white/5 text-stone-300' : 'border-stone-200 bg-stone-50/40 text-stone-500'}`}
                      >
                        <p className={`${typographyClasses.quote} text-base sm:text-lg max-w-md`}>
                          {t('storyEmptyDetailHint')}
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          <Button size="sm" onClick={focusStoryTextarea}>
                            {t('storyEmptyDetailCta')}
                          </Button>
                          <Button size="sm" variant="outline" onClick={openDetailPromptsPanel}>
                            {t('storyPromptCta')}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <textarea
                        ref={detailStoryRef}
                        aria-labelledby="item-story-label"
                        className={`w-full p-6 sm:p-8 rounded-2xl sm:rounded-[2.5rem] italic border font-serif text-xl sm:text-2xl leading-relaxed min-h-[200px] sm:min-h-[240px] focus:ring-8 focus:ring-amber-500/30 focus:border-amber-500 outline-none transition-all shadow-inner placeholder:text-stone-400 ${theme === 'vault' ? 'bg-white/5 border-white/5 text-white' : 'bg-stone-50/50 border-stone-100 text-stone-800'} ${isReadOnly ? 'cursor-not-allowed opacity-70' : ''}`}
                        value={item.notes}
                        onChange={(e) => applyItemUpdate({ notes: e.target.value })}
                        placeholder={t('storyPlaceholder')}
                        disabled={isReadOnly}
                      />
                    )}
                    {detailPromptsOpen && !isReadOnly && (
                      <div
                        className={`rounded-xl border p-3 sm:p-4 ${theme === 'vault' ? 'bg-white/5 border-white/10' : 'bg-amber-50/40 border-stone-200'}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <p
                            className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${theme === 'vault' ? 'text-stone-400' : 'text-stone-500'}`}
                          >
                            {t('storyPromptHelp')}
                          </p>
                          <button
                            type="button"
                            onClick={() => setDetailPromptsOpen(false)}
                            className={`text-[11px] ${theme === 'vault' ? 'text-stone-400' : 'text-stone-500'} hover:text-stone-700`}
                          >
                            {t('storyPromptHide')}
                          </button>
                        </div>
                        {detailPromptsLoading && (
                          <p
                            className={`text-[12px] italic ${theme === 'vault' ? 'text-stone-400' : 'text-stone-500'}`}
                          >
                            {t('storyPromptLoading')}
                          </p>
                        )}
                        {!detailPromptsLoading && detailStoryPrompts.length === 0 && (
                          <p
                            className={`text-[12px] ${theme === 'vault' ? 'text-stone-300' : 'text-stone-600'}`}
                          >
                            {t('storyPromptEmpty')}
                          </p>
                        )}
                        <ul className="space-y-1.5 mt-1">
                          {detailStoryPrompts.map((prompt, idx) => (
                            <li key={`${idx}-${prompt}`}>
                              <button
                                type="button"
                                onClick={() => insertDetailStoryPrompt(prompt)}
                                className={`w-full text-left text-[12px] sm:text-[13px] px-2 py-1.5 rounded-lg flex items-start gap-2 transition-colors ${theme === 'vault' ? 'hover:bg-white/10 text-stone-200' : 'hover:bg-white text-stone-700'}`}
                              >
                                <span className="mt-0.5 shrink-0" aria-hidden>
                                  +
                                </span>
                                <span>{prompt}</span>
                                <span className="sr-only">{t('storyPromptInsert')}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            <div className="space-y-8 sm:space-y-10">
              <dt
                className={`${typographyClasses.label} pb-3 sm:pb-4 border-b break-words leading-tight ${theme === 'vault' ? 'text-stone-500 border-white/5' : `${labelColorClasses[theme]} ${dividerClasses[theme]}`}`}
              >
                {t('technicalSpec')}
              </dt>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-6 sm:gap-8">
                {collection.customFields.map((field) => {
                  const val = item.data[field.id];
                  const label = getLabel(field.id);
                  const isMultilineText = field.type === 'text' || field.type === 'long_text';
                  const fieldValue = val || '';
                  // Guide an empty, editable field; hide once filled or read-only so
                  // the museum placard stays uncluttered (beauty before bureaucracy).
                  // Built-in hints are scoped to real template fields so a custom
                  // field whose id happens to match (e.g. "Origin") never inherits
                  // domain copy. Empty is checked explicitly so a stored `false`/`0`
                  // still counts as filled.
                  const isEmpty = val === undefined || val === null || val === '';
                  const hint =
                    (isBuiltInTemplateField(collection.templateId, field.id)
                      ? getFieldHint(t, field.id)
                      : '') ||
                    field.hint ||
                    '';
                  const showHint = Boolean(hint) && !isReadOnly && isEmpty;
                  const fieldBaseClass = `${typographyClasses.title} w-full bg-transparent border-none p-0 outline-none focus:text-amber-900 focus:ring-0 transition-colors ${theme === 'vault' ? 'text-white placeholder:text-stone-400' : theme === 'atelier' ? 'text-stone-900 placeholder:text-[#8C7B6B]' : 'text-stone-900 placeholder:text-stone-500'} ${isReadOnly ? 'cursor-not-allowed opacity-70' : ''}`;
                  const handleFieldChange = (
                    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
                  ) => {
                    const newData = {
                      ...item.data,
                      [field.id]: e.target.value,
                    };
                    applyItemUpdate({ data: newData });
                  };

                  return (
                    <div key={field.id} className="group">
                      <dt
                        id={`item-field-label-${field.id}`}
                        className={`${typographyClasses.label} ${mutedTextClasses[theme]} mb-1 sm:mb-2 group-hover:text-amber-500 transition-colors break-words leading-tight`}
                      >
                        {label}
                      </dt>
                      {isMultilineText ? (
                        <textarea
                          ref={(node) => {
                            detailFieldTextareaRefs.current[field.id] = node;
                          }}
                          className={`${fieldBaseClass} min-h-[1.75rem] resize-none overflow-hidden leading-snug break-words whitespace-pre-wrap`}
                          value={fieldValue}
                          placeholder="—"
                          rows={1}
                          aria-labelledby={`item-field-label-${field.id}`}
                          aria-describedby={showHint ? `item-field-hint-${field.id}` : undefined}
                          onChange={(e) => {
                            e.currentTarget.style.height = 'auto';
                            e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
                            handleFieldChange(e);
                          }}
                          disabled={isReadOnly}
                        />
                      ) : (
                        <input
                          className={fieldBaseClass}
                          value={fieldValue}
                          placeholder="—"
                          aria-labelledby={`item-field-label-${field.id}`}
                          aria-describedby={showHint ? `item-field-hint-${field.id}` : undefined}
                          onChange={handleFieldChange}
                          disabled={isReadOnly}
                        />
                      )}
                      {showHint && (
                        <p
                          id={`item-field-hint-${field.id}`}
                          className={`mt-1 text-[11px] leading-snug ${mutedTextClasses[theme]}`}
                        >
                          {hint}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
              {typeof item.data?._aiDescription === 'string' &&
                item.data._aiDescription.trim().length > 0 && (
                  <details
                    className={`mt-6 sm:mt-8 pt-4 sm:pt-6 border-t ${theme === 'vault' ? 'border-white/5' : `${dividerClasses[theme]}`}`}
                  >
                    <summary
                      className={`${typographyClasses.label} cursor-pointer text-stone-400 hover:text-amber-500 transition-colors`}
                    >
                      {t('storyAiObservationLabel')}
                    </summary>
                    <p
                      className={`mt-3 text-xs sm:text-sm leading-relaxed ${theme === 'vault' ? 'text-stone-300' : 'text-stone-500'} font-mono whitespace-pre-wrap`}
                    >
                      {item.data._aiDescription}
                    </p>
                  </details>
                )}
            </div>
          </div>
          {(() => {
            const created = new Date(item.createdAt);
            if (Number.isNaN(created.getTime())) return null;
            const locale = language === 'zh' ? 'zh-CN' : 'en-US';
            const formatted = new Intl.DateTimeFormat(locale, {
              dateStyle: 'long',
            }).format(created);
            return (
              <p className={typographyClasses.accession} data-testid="item-added-on">
                {t('addedOn', { date: formatted })}
              </p>
            );
          })()}
        </div>
      </div>
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        item={item}
        fields={collection.customFields}
        onStatus={showStatus}
      />
      <EnhanceImageModal
        isOpen={isEnhanceOpen}
        onClose={() => setIsEnhanceOpen(false)}
        itemId={item.id}
        photoUrl={item.photoUrl}
        collectionId={collection.id}
        onEnhancementComplete={({ enhancedPath }) => {
          if (enhancedPath) {
            updateItem(collection.id, item.id, { photoEnhancedPath: enhancedPath });
          }
          // Force ItemImage to re-render with updated enhanced image
          setImageKey((prev) => prev + 1);
        }}
      />
      <ImageEditModal
        isOpen={isImageEditorOpen}
        source={imageEditSource}
        onClose={() => {
          setIsImageEditorOpen(false);
          setImageEditSource(null);
        }}
        onApply={(edited) => {
          setIsImageEditorOpen(false);
          setImageEditSource(null);
          applyEditedPhoto(edited);
        }}
      />
      <DeleteItemModal
        isOpen={isDeleteItemModalOpen}
        item={item}
        onClose={() => setIsDeleteItemModalOpen(false)}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
};
