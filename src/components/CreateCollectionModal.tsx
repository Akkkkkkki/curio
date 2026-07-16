import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, GripVertical, Loader2, Pin, X } from 'lucide-react';
import { TEMPLATES } from '../constants';
import { Button } from './ui/Button';
import { useTranslation } from '../i18n';
import { useTheme, panelSurfaceClasses, overlaySurfaceClasses, mutedTextClasses } from '../theme';
import { suggestCollectionFields } from '../services/geminiService';
import { useModalA11y } from '../hooks/useModalA11y';
import {
  FIELD_LABEL_MAX_LENGTH,
  FIELD_MAX_COUNT,
  FIELD_MIN_COUNT,
  PINNED_MAX_COUNT,
  PINNED_MIN_COUNT,
  normalizeFieldLabel,
  validateFieldLabel,
  validateFieldSelection,
} from '../utils/fieldValidation';

interface CreateCollectionPayload {
  name: string;
  icon?: string;
  templateId?: string;
  description?: string;
  fields: string[];
  pinnedFields: string[];
}

interface CreateCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (payload: CreateCollectionPayload) => string | null;
  onAddFirstItem: (collectionId: string) => void;
}

type CreateStep = 'entry' | 'loading' | 'fields' | 'preview';

const DESCRIPTION_MAX_LENGTH = 100;
const SUGGESTION_TIMEOUT_MS = 15000;
const SUGGESTION_RETRY_DELAY_MS = 2000;
const DEFAULT_ICON = '✨';

const BASE_ICON_OPTIONS = [
  '✨',
  '🎴',
  '📚',
  '📀',
  '🎨',
  '📷',
  '🧸',
  '🪙',
  '🧪',
  '🧵',
  '👟',
  '🥃',
  '🍫',
  '🪄',
  '🎧',
  '🎟️',
  '🕰️',
  '🏺',
];

export const CreateCollectionModal: React.FC<CreateCollectionModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  onAddFirstItem,
}) => {
  const { t, language } = useTranslation();
  const { theme } = useTheme();
  const [step, setStep] = useState<CreateStep>('entry');
  const [description, setDescription] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [suggestedFields, setSuggestedFields] = useState<string[]>([]);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [pinnedFields, setPinnedFields] = useState<string[]>([]);
  const [customFieldInput, setCustomFieldInput] = useState('');
  const [collectionName, setCollectionName] = useState('');
  const [hasEditedName, setHasEditedName] = useState(false);
  const [icon, setIcon] = useState(DEFAULT_ICON);
  const [hasCustomIcon, setHasCustomIcon] = useState(false);
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [suggestionsError, setSuggestionsError] = useState(false);
  const suggestRunRef = useRef(0);
  const iconPickerRef = useRef<HTMLDivElement | null>(null);
  const iconButtonRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const descriptionInputRef = useRef<HTMLInputElement | null>(null);

  const selectedTemplate = useMemo(
    () => (selectedTemplateId ? TEMPLATES.find((temp) => temp.id === selectedTemplateId) : null),
    [selectedTemplateId],
  );

  const iconOptions = useMemo(() => {
    const optionSet = new Set([...BASE_ICON_OPTIONS, ...TEMPLATES.map((temp) => temp.icon)]);
    return Array.from(optionSet);
  }, []);

  const maxFieldsAllowed = selectedTemplate
    ? Math.max(FIELD_MAX_COUNT, selectedTemplate.fields.length)
    : FIELD_MAX_COUNT;

  const surfaceClass = panelSurfaceClasses[theme];
  const overlayClass = `${overlaySurfaceClasses[theme]} motion-overlay`;
  const dividerBorder = theme === 'vault' ? 'border-white/10' : 'border-stone-100';
  const mutedText = mutedTextClasses[theme];
  const inputSurface =
    theme === 'vault'
      ? 'bg-white/5 border border-white/10 text-white placeholder:text-stone-400'
      : 'bg-stone-50 border border-stone-200 text-stone-800';

  // CUR-22: theme-aware tone tokens for the status banner and loading spinner
  // backdrop. Mirrors the AddItemModal warnBannerClass (CUR-92) so amber
  // pastels stop punching through Vault's stone-950 surface.
  const statusBannerClass = {
    gallery: 'bg-amber-50 text-amber-700 border-amber-100',
    vault: 'bg-amber-500/10 text-amber-200 border-amber-400/20',
    atelier: 'bg-amber-100/70 text-amber-900 border-amber-300/60',
  }[theme];
  const loadingSpinnerClass = {
    gallery: 'bg-amber-50 text-amber-500',
    vault: 'bg-amber-500/15 text-amber-300',
    atelier: 'bg-amber-100/70 text-[#A86F3C]',
  }[theme];

  const resetState = () => {
    suggestRunRef.current += 1;
    setStep('entry');
    setDescription('');
    setSelectedTemplateId('');
    setSuggestedFields([]);
    setSelectedFields([]);
    setPinnedFields([]);
    setCustomFieldInput('');
    setCollectionName('');
    setHasEditedName(false);
    setIcon(DEFAULT_ICON);
    setHasCustomIcon(false);
    setIsIconPickerOpen(false);
    setStatusMessage(null);
    setSuggestionsError(false);
  };

  useEffect(() => {
    if (!isOpen) resetState();
  }, [isOpen]);

  const nameFallback = selectedTemplate?.name || t('newArchive');
  const displayName = collectionName.trim() || description.trim() || nameFallback;

  const handleClose = () => {
    resetState();
    onClose();
  };

  // The icon picker owns Escape while open, so the first Escape collapses it
  // and only the next one dismisses the modal.
  const handleDismissRequest = () => {
    if (isIconPickerOpen) {
      setIsIconPickerOpen(false);
      return;
    }
    handleClose();
  };

  useModalA11y(dialogRef, isOpen, handleDismissRequest, {
    initialFocusRef: descriptionInputRef,
  });

  const handleTemplateSelect = (templateId: string) => {
    // Tapping the already-selected preset clears it, returning the user to
    // the free-text suggestion flow without closing the modal.
    const nextTemplateId = selectedTemplateId === templateId ? '' : templateId;
    setSelectedTemplateId(nextTemplateId);
    setSuggestedFields([]);
    setSelectedFields([]);
    setPinnedFields([]);
    setStatusMessage(null);
    if (!hasCustomIcon) {
      const template = TEMPLATES.find((temp) => temp.id === nextTemplateId);
      setIcon(template ? template.icon : DEFAULT_ICON);
    }
  };

  const getDefaultPinnedFields = (fields: string[], preferredFields?: string[]) => {
    const candidates = preferredFields && preferredFields.length > 0 ? preferredFields : fields;
    return candidates.slice(0, PINNED_MAX_COUNT);
  };

  const initializeSelectedFields = (fields: string[], preferredFields?: string[]) => {
    const defaultPinned = getDefaultPinnedFields(fields, preferredFields);
    setSelectedFields(defaultPinned);
    setPinnedFields(defaultPinned);
  };

  const sanitizeSuggestions = (fields: string[]) => {
    const cleaned: string[] = [];
    const seen = new Set<string>();
    for (const field of fields) {
      const validation = validateFieldLabel(field, cleaned);
      if (!validation.ok) continue;
      const trimmed = validation.label.slice(0, FIELD_LABEL_MAX_LENGTH);
      const key = trimmed.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      cleaned.push(trimmed);
      if (cleaned.length >= FIELD_MAX_COUNT) break;
    }
    return cleaned;
  };

  const loadSuggestedFields = async (runId: number) => {
    const trimmed = description.trim();
    if (!trimmed) {
      setStep('entry');
      return;
    }
    setSuggestionsError(false);
    const deadline = Date.now() + SUGGESTION_TIMEOUT_MS;
    const withTimeout = async (timeoutMs: number) =>
      new Promise<string[] | null>((resolve) => {
        const timer = setTimeout(() => resolve(null), timeoutMs);
        suggestCollectionFields(trimmed, language)
          .then((result) => resolve(result))
          .catch(() => resolve(null))
          .finally(() => clearTimeout(timer));
      });

    const firstResult = await withTimeout(SUGGESTION_TIMEOUT_MS);
    if (runId !== suggestRunRef.current) return;

    let fields = firstResult;
    if (!fields || fields.length === 0) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        setSuggestedFields([]);
        setStatusMessage(t('suggestionsUnavailable'));
        setSuggestionsError(true);
        setStep('fields');
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, SUGGESTION_RETRY_DELAY_MS));
      if (runId !== suggestRunRef.current) return;
      const retryRemaining = deadline - Date.now();
      if (retryRemaining <= 0) {
        setSuggestedFields([]);
        setStatusMessage(t('suggestionsUnavailable'));
        setSuggestionsError(true);
        setStep('fields');
        return;
      }
      fields = await withTimeout(retryRemaining);
    }

    if (runId !== suggestRunRef.current) return;
    const cleaned = fields ? sanitizeSuggestions(fields) : [];
    setSuggestedFields(cleaned);
    if (cleaned.length === 0) {
      setStatusMessage(t('suggestionsUnavailable'));
      setSuggestionsError(true);
    }
    initializeSelectedFields(cleaned);
    setStep('fields');
  };

  const handleToggleSuggestedField = (field: string) => {
    setStatusMessage(null);
    const exists = selectedFields.some(
      (item) =>
        normalizeFieldLabel(item).toLowerCase() === normalizeFieldLabel(field).toLowerCase(),
    );
    if (exists) {
      setSelectedFields((prev) => prev.filter((item) => item !== field));
      setPinnedFields((prev) => prev.filter((item) => item !== field));
      return;
    }
    if (selectedFields.length >= maxFieldsAllowed) {
      setStatusMessage(t('fieldMaximum', { max: maxFieldsAllowed }));
      return;
    }
    setSelectedFields((prev) => [...prev, field]);
  };

  const handleAddCustomField = () => {
    const validation = validateFieldLabel(customFieldInput, selectedFields);
    if (!validation.ok) {
      if (validation.reason === 'too-long') {
        setStatusMessage(t('fieldTooLong', { max: FIELD_LABEL_MAX_LENGTH }));
      } else if (validation.reason === 'reserved') {
        setStatusMessage(t('fieldReserved', { name: validation.label }));
      } else if (validation.reason === 'duplicate') {
        setStatusMessage(t('fieldDuplicate'));
      }
      return;
    }
    if (selectedFields.length >= maxFieldsAllowed) {
      setStatusMessage(t('fieldMaximum', { max: maxFieldsAllowed }));
      return;
    }
    setSelectedFields((prev) => [...prev, validation.label]);
    setCustomFieldInput('');
  };

  const handleCreate = () => {
    if (!displayName.trim()) return;
    const templateId = selectedTemplate?.id;
    const createdCollectionId = onCreate({
      name: displayName.trim(),
      icon: icon || selectedTemplate?.icon || TEMPLATES[0].icon,
      templateId,
      description: description.trim() || undefined,
      fields: selectedFields,
      pinnedFields,
    });
    if (!createdCollectionId) return;
    handleClose();
    onAddFirstItem(createdCollectionId);
  };

  const handleContinueFromEntry = () => {
    setStatusMessage(null);
    if (selectedTemplate) {
      const templateFields = selectedTemplate.fields.map((field) => field.label);
      const pinnedFromTemplate = selectedTemplate.fields
        .filter((field) => field.displayMode === 'primary')
        .map((field) => field.label);
      const pinnedSelection =
        pinnedFromTemplate.length > 0
          ? pinnedFromTemplate.slice(0, PINNED_MAX_COUNT)
          : templateFields.slice(0, PINNED_MAX_COUNT);
      setSuggestedFields(templateFields);
      initializeSelectedFields(templateFields, pinnedSelection);
      setStep('fields');
      return;
    }
    if (description.trim()) {
      setSelectedTemplateId('');
      setSuggestedFields([]);
      setSelectedFields([]);
      setPinnedFields([]);
      setStep('loading');
      return;
    }
  };

  const handleLoadingCancel = () => {
    suggestRunRef.current += 1;
    setStep('entry');
  };

  const previewFields = selectedFields.slice(0, FIELD_MAX_COUNT);

  useEffect(() => {
    if (!isOpen) return;
    if (hasEditedName) return;
    const trimmed = description.trim();
    if (trimmed) {
      setCollectionName(trimmed);
      return;
    }
    if (selectedTemplate) {
      setCollectionName(selectedTemplate.name);
      return;
    }
    setCollectionName('');
  }, [description, selectedTemplate, hasEditedName, isOpen]);

  useEffect(() => {
    if (step !== 'loading') return;
    const runId = suggestRunRef.current + 1;
    suggestRunRef.current = runId;
    setStatusMessage(null);
    loadSuggestedFields(runId);
  }, [step]);

  useEffect(() => {
    if (!isIconPickerOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (iconPickerRef.current?.contains(target) || iconButtonRef.current?.contains(target)) {
        return;
      }
      setIsIconPickerOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [isIconPickerOpen]);

  useEffect(() => {
    if (!isIconPickerOpen) return;
    if (step !== 'entry') {
      setIsIconPickerOpen(false);
    }
  }, [step, isIconPickerOpen]);

  if (!isOpen) return null;

  const renderEntry = () => (
    <div className="space-y-6">
      <div>
        <label
          className={`block text-[12px] font-semibold uppercase tracking-[0.12em] ${mutedText} mb-2`}
        >
          {t('collectionPrompt')}
        </label>
        <input
          ref={descriptionInputRef}
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('collectionPromptPlaceholder')}
          maxLength={DESCRIPTION_MAX_LENGTH}
          data-testid="collection-description-input"
          className={`w-full p-3.5 rounded-xl focus:ring-2 focus:ring-amber-200 outline-none font-medium ${inputSurface}`}
        />
      </div>

      <div>
        <p className={`text-[12px] font-semibold uppercase tracking-[0.12em] ${mutedText} mb-2`}>
          {t('icon')}
        </p>
        <div className="relative">
          <button
            type="button"
            data-testid="collection-icon-picker"
            onClick={() => setIsIconPickerOpen((prev) => !prev)}
            ref={iconButtonRef}
            aria-expanded={isIconPickerOpen}
            aria-controls="collection-icon-options"
            className={`w-full flex items-center justify-between p-3 rounded-xl outline-none focus:ring-2 focus:ring-amber-200 font-medium ${inputSurface}`}
          >
            <span className="text-xl">{icon}</span>
            <ChevronDown size={18} className="text-stone-400" />
          </button>
          {isIconPickerOpen && (
            <div
              id="collection-icon-options"
              ref={iconPickerRef}
              className={`absolute z-10 mt-2 w-full rounded-2xl border p-3 shadow-lg ${
                theme === 'vault' ? 'bg-stone-900 border-white/10' : 'bg-white border-stone-200'
              }`}
            >
              <div className="grid grid-cols-7 gap-2">
                {iconOptions.map((option) => (
                  <button
                    type="button"
                    key={option}
                    onClick={() => {
                      setIcon(option);
                      setHasCustomIcon(true);
                      setIsIconPickerOpen(false);
                    }}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                      icon === option
                        ? theme === 'vault'
                          ? 'bg-white/10 text-white'
                          : 'bg-amber-50 text-amber-700'
                        : theme === 'vault'
                          ? 'bg-white/5 text-white/80 hover:bg-white/10'
                          : 'bg-stone-50 text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    <span className="text-lg">{option}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div>
        <p className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${mutedText} mb-2`}>
          {t('orChoosePreset')}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {TEMPLATES.map((temp) => {
            const isSelected = selectedTemplateId === temp.id;
            return (
              <button
                key={temp.id}
                type="button"
                onClick={() => handleTemplateSelect(temp.id)}
                data-testid={`collection-preset-${temp.id}`}
                aria-pressed={isSelected}
                className={`min-h-20 rounded-2xl border p-3 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-amber-200 ${
                  isSelected
                    ? theme === 'vault'
                      ? 'border-amber-400 bg-amber-400/10 text-amber-100'
                      : 'border-amber-300 bg-amber-50 text-amber-950'
                    : theme === 'vault'
                      ? 'border-white/10 bg-white/5 text-white hover:bg-white/10'
                      : 'border-stone-200 bg-white text-stone-800 hover:bg-stone-50'
                }`}
              >
                <span className="mb-2 block text-xl" aria-hidden="true">
                  {temp.icon}
                </span>
                <span className="block text-sm font-semibold leading-tight">{temp.name}</span>
              </button>
            );
          })}
        </div>
        {selectedTemplate && (
          <div
            className={`mt-4 p-4 rounded-2xl border ${theme === 'vault' ? 'border-white/10 bg-white/5' : 'border-stone-100 bg-stone-50/60'}`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-inner ${theme === 'vault' ? 'bg-white/10' : 'bg-white'}`}
              >
                {selectedTemplate.icon}
              </div>
              <div className="flex-1">
                <p
                  className={`text-sm font-semibold ${theme === 'vault' ? 'text-white' : 'text-stone-800'}`}
                >
                  {selectedTemplate.name}
                </p>
                <p className={`text-[12px] ${mutedText} leading-snug`}>
                  {selectedTemplate.description}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div
        className={`flex justify-end gap-3 pt-4 border-t ${theme === 'vault' ? 'border-white/10' : 'border-stone-50'}`}
      >
        <Button variant="ghost" onClick={handleClose}>
          {t('cancel')}
        </Button>
        <Button
          onClick={handleContinueFromEntry}
          data-testid="collection-continue-btn"
          disabled={!selectedTemplate && !description.trim()}
        >
          {t('continue')}
        </Button>
      </div>
    </div>
  );

  const renderLoading = () => (
    <div className="text-center py-12 sm:py-16 space-y-4">
      <div className="flex justify-center">
        <div
          data-testid="collection-loading-spinner"
          className={`w-14 h-14 rounded-full flex items-center justify-center ${loadingSpinnerClass}`}
        >
          <Loader2 size={24} className="animate-spin" />
        </div>
      </div>
      <div>
        <h3
          className={`text-lg font-serif font-bold ${theme === 'vault' ? 'text-white' : 'text-stone-800'}`}
        >
          {t('creatingSuggestions')}
        </h3>
        <p className={`text-sm ${mutedText}`}>
          {t('creatingSuggestionsFor', { item: description.trim() })}
        </p>
      </div>
      <Button variant="ghost" size="sm" onClick={handleLoadingCancel}>
        {t('cancel')}
      </Button>
    </div>
  );

  const renderFields = () => {
    const selectionValidation = selectedTemplate
      ? (() => {
          if (selectedFields.length < FIELD_MIN_COUNT) return { ok: false, reason: 'min' };
          if (selectedFields.length > maxFieldsAllowed) return { ok: false, reason: 'max' };
          if (pinnedFields.length < PINNED_MIN_COUNT) return { ok: false, reason: 'pin-min' };
          if (pinnedFields.length > PINNED_MAX_COUNT) return { ok: false, reason: 'pin-max' };
          return { ok: true, reason: null };
        })()
      : validateFieldSelection(selectedFields, pinnedFields);
    return (
      <div className="space-y-6">
        <div>
          <h3
            className={`text-lg font-serif font-bold ${theme === 'vault' ? 'text-white' : 'text-stone-800'}`}
          >
            {t('pickFieldsTitle')}
          </h3>
          <p className={`text-sm ${mutedText}`}>{t('pickFieldsDesc')}</p>
        </div>

        {statusMessage && (
          <div
            data-testid="collection-status-message"
            className={`p-3 rounded-xl border text-xs font-medium ${statusBannerClass}`}
          >
            {statusMessage}
          </div>
        )}
        {suggestionsError && description.trim() && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setStatusMessage(null);
              setSuggestedFields([]);
              setSelectedFields([]);
              setPinnedFields([]);
              setStep('loading');
            }}
          >
            {t('retrySuggestions')}
          </Button>
        )}

        <div>
          <p className={`text-[12px] font-semibold uppercase tracking-[0.12em] ${mutedText} mb-2`}>
            {t('suggestedFields')}
          </p>
          {suggestedFields.length === 0 ? (
            <p className={`text-sm ${mutedText}`}>{t('suggestionsEmpty')}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {suggestedFields.map((field, index) => {
                const isSelected = selectedFields.includes(field);
                return (
                  <button
                    key={`${field}-${index}`}
                    data-testid={`suggested-field-${index}`}
                    onClick={() => handleToggleSuggestedField(field)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                      isSelected
                        ? theme === 'vault'
                          ? 'bg-amber-400/20 border-amber-400 text-amber-200'
                          : 'bg-amber-100 border-amber-200 text-amber-800'
                        : theme === 'vault'
                          ? 'bg-white/5 border-white/10 text-white/80'
                          : 'bg-white border-stone-200 text-stone-500'
                    }`}
                  >
                    {isSelected && <Check size={12} className="inline-block mr-1" />}
                    {field}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <p className={`text-[12px] font-semibold uppercase tracking-[0.12em] ${mutedText} mb-2`}>
            {t('addYourOwn')}
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={customFieldInput}
              onChange={(e) => setCustomFieldInput(e.target.value)}
              placeholder={t('addFieldPlaceholder')}
              maxLength={FIELD_LABEL_MAX_LENGTH}
              data-testid="custom-field-input"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddCustomField();
                }
              }}
              className={`flex-1 p-3 rounded-xl focus:ring-2 focus:ring-amber-200 outline-none font-medium ${inputSurface}`}
            />
            <Button variant="secondary" onClick={handleAddCustomField}>
              {t('addField')}
            </Button>
          </div>
        </div>

        <div>
          <p className={`text-[12px] font-semibold uppercase tracking-[0.12em] ${mutedText} mb-2`}>
            {t('yourFields')}
          </p>
          {selectedFields.length === 0 ? (
            <p className={`text-sm ${mutedText}`}>{t('fieldMinimum')}</p>
          ) : (
            <div className="space-y-2">
              {selectedFields.map((field, index) => {
                const isPinned = pinnedFields.includes(field);
                return (
                  <div
                    key={`${field}-${index}`}
                    data-testid="selected-field-row"
                    className={`flex items-center gap-2 p-3 rounded-xl border ${
                      theme === 'vault' ? 'border-white/10 bg-white/5' : 'border-stone-200 bg-white'
                    }`}
                  >
                    <GripVertical size={16} className="text-stone-400" />
                    <span
                      className={`flex-1 text-sm font-medium ${theme === 'vault' ? 'text-white' : 'text-stone-800'}`}
                    >
                      {field}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (isPinned) {
                          setPinnedFields((prev) => prev.filter((item) => item !== field));
                          return;
                        }
                        if (pinnedFields.length >= PINNED_MAX_COUNT) {
                          setStatusMessage(t('pinLimitReached'));
                          return;
                        }
                        setPinnedFields((prev) => [...prev, field]);
                      }}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                        isPinned
                          ? theme === 'vault'
                            ? 'bg-amber-400/20 border-amber-400 text-amber-200'
                            : 'bg-amber-100 border-amber-200 text-amber-800'
                          : theme === 'vault'
                            ? 'bg-white/5 border-white/10 text-white/70'
                            : 'bg-stone-100 border-stone-200 text-stone-600'
                      }`}
                    >
                      <Pin size={12} className="inline-block mr-1" />
                      {isPinned ? t('pinnedToCard') : t('pinToCard')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFields((prev) => prev.filter((item) => item !== field));
                        setPinnedFields((prev) => prev.filter((item) => item !== field));
                      }}
                      className={`p-1 rounded-full ${
                        theme === 'vault'
                          ? 'text-stone-400 hover:text-white hover:bg-white/10'
                          : 'text-stone-400 hover:text-stone-700 hover:bg-stone-100'
                      }`}
                      aria-label={t('remove')}
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          <div className={`mt-3 text-[12px] ${mutedText}`}>{t('pinnedFieldsHelp')}</div>
          <div className={`mt-2 text-[12px] ${mutedText}`}>{t('builtInNotesHint')}</div>
        </div>

        <div className={`text-[12px] ${mutedText}`}>{t('fieldLimitHelp')}</div>

        <div
          className={`flex justify-between gap-3 pt-4 border-t ${theme === 'vault' ? 'border-white/10' : 'border-stone-50'}`}
        >
          <Button variant="ghost" onClick={() => setStep('entry')}>
            {t('back')}
          </Button>
          <Button
            onClick={() => {
              if (!selectionValidation.ok) {
                if (selectionValidation.reason === 'min') {
                  setStatusMessage(t('fieldMinimum'));
                } else if (selectionValidation.reason === 'max') {
                  setStatusMessage(t('fieldMaximum', { max: maxFieldsAllowed }));
                } else if (selectionValidation.reason === 'pin-min') {
                  setStatusMessage(t('pinRequired'));
                } else if (selectionValidation.reason === 'pin-max') {
                  setStatusMessage(t('pinLimitReached'));
                }
                return;
              }
              setStep('preview');
            }}
            disabled={!selectionValidation.ok}
          >
            {t('next')}
          </Button>
        </div>
      </div>
    );
  };

  const renderPreview = () => (
    <div className="space-y-6">
      <div>
        <h3
          className={`text-lg font-serif font-bold ${theme === 'vault' ? 'text-white' : 'text-stone-800'}`}
        >
          {t('previewTitle')}
        </h3>
        <p className={`text-sm ${mutedText}`}>{t('previewDesc')}</p>
      </div>

      <div
        className={`p-5 rounded-2xl border ${theme === 'vault' ? 'border-white/10 bg-white/5' : 'border-stone-100 bg-white'}`}
      >
        <p className={`text-sm ${mutedText} mb-3`}>{t('collectionCardPreview')}</p>
        <div
          className={`rounded-2xl border p-4 ${theme === 'vault' ? 'border-white/10 bg-stone-900/40' : 'border-stone-100 bg-stone-50'}`}
        >
          <div className="flex items-center justify-between">
            <h4
              className={`text-base font-semibold ${theme === 'vault' ? 'text-white' : 'text-stone-800'}`}
            >
              {displayName}
            </h4>
            <span className="text-xl">{icon || selectedTemplate?.icon || TEMPLATES[0].icon}</span>
          </div>
          {previewFields.length > 0 && (
            <p className={`mt-2 text-[12px] ${mutedText}`}>
              {t('fieldsLabel')}: {previewFields.join(' • ')}
            </p>
          )}
        </div>
      </div>

      <div>
        <label
          className={`block text-[12px] font-semibold uppercase tracking-[0.12em] ${mutedText} mb-2`}
        >
          {t('collectionName')}
        </label>
        <input
          type="text"
          value={collectionName}
          onChange={(e) => {
            setCollectionName(e.target.value);
            setHasEditedName(true);
          }}
          placeholder={displayName}
          className={`w-full p-3.5 rounded-xl focus:ring-2 focus:ring-amber-200 outline-none font-medium ${inputSurface}`}
        />
      </div>

      <div
        className={`flex justify-between gap-3 pt-4 border-t ${theme === 'vault' ? 'border-white/10' : 'border-stone-50'}`}
      >
        <Button variant="ghost" onClick={() => setStep('fields')}>
          {t('back')}
        </Button>
        <Button onClick={handleCreate} icon={<Check size={16} />}>
          {t('createAndAddFirst')}
        </Button>
      </div>
    </div>
  );

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 ${overlayClass} backdrop-blur-sm`}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-collection-title"
        data-testid="create-collection-modal"
        className={`${surfaceClass} rounded-t-3xl rounded-b-none sm:rounded-2xl shadow-xl w-full max-w-md h-[100dvh] sm:h-auto max-h-[100dvh] overflow-hidden flex flex-col motion-panel border pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] sm:pt-0 sm:pb-0`}
      >
        <div className="sm:hidden h-3" />
        <div className={`flex items-center justify-between p-4 border-b ${dividerBorder}`}>
          <h2
            id="create-collection-title"
            className={`font-serif font-bold text-lg ${theme === 'vault' ? 'text-white' : 'text-stone-800'}`}
          >
            {t('newArchive')}
          </h2>
          <button
            onClick={handleClose}
            aria-label={t('close')}
            className={`p-1 rounded-full transition-colors ${theme === 'vault' ? 'hover:bg-white/5 text-stone-300 hover:text-white' : 'hover:bg-stone-100 text-stone-400 hover:text-stone-800'}`}
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-6 pb-24 sm:pb-6 space-y-6">
          {step === 'entry' && renderEntry()}
          {step === 'loading' && renderLoading()}
          {step === 'fields' && renderFields()}
          {step === 'preview' && renderPreview()}
        </div>
      </div>
    </div>
  );
};
