import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, Loader2, X } from 'lucide-react';
import { TEMPLATES } from '../constants';
import { Button } from './ui/Button';
import { useTranslation } from '../i18n';
import { useTheme, panelSurfaceClasses, overlaySurfaceClasses, mutedTextClasses } from '../theme';
import { suggestCollectionTags } from '../services/geminiService';

interface CreateCollectionPayload {
  name: string;
  icon?: string;
  templateId?: string;
  tags?: string[];
}

interface CreateCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (payload: CreateCollectionPayload) => boolean;
  onAddFirstItem: () => void;
}

type CreateStep = 'entry' | 'loading' | 'tags' | 'preview' | 'success';

const TAG_MIN = 3;
const TAG_MAX = 6;
const TAG_MAX_LENGTH = 32;

const normalizeTag = (value: string) => value.trim().replace(/\s+/g, ' ');

export const CreateCollectionModal: React.FC<CreateCollectionModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  onAddFirstItem,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [step, setStep] = useState<CreateStep>('entry');
  const [description, setDescription] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const selectedTemplate = useMemo(
    () => (selectedTemplateId ? TEMPLATES.find((temp) => temp.id === selectedTemplateId) : null),
    [selectedTemplateId],
  );

  const surfaceClass = panelSurfaceClasses[theme];
  const overlayClass = `${overlaySurfaceClasses[theme]} motion-overlay`;
  const dividerBorder = theme === 'vault' ? 'border-white/10' : 'border-stone-100';
  const mutedText = mutedTextClasses[theme];
  const inputSurface =
    theme === 'vault'
      ? 'bg-white/5 border border-white/10 text-white placeholder:text-stone-400'
      : 'bg-stone-50 border border-stone-200 text-stone-800';

  const resetState = () => {
    setStep('entry');
    setDescription('');
    setSelectedTemplateId('');
    setSuggestedTags([]);
    setSelectedTags([]);
    setCustomTagInput('');
    setStatusMessage(null);
  };

  useEffect(() => {
    if (!isOpen) resetState();
  }, [isOpen]);

  if (!isOpen) return null;

  const nameFallback = selectedTemplate?.name || t('newArchive');
  const collectionName = description.trim() || nameFallback;

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    setSuggestedTags([]);
    setSelectedTags([]);
    setStatusMessage(null);
  };

  const handleSuggestTags = async () => {
    const trimmed = description.trim();
    if (!trimmed) return;
    setStatusMessage(null);
    setStep('loading');
    setSelectedTemplateId('');
    const result = await suggestCollectionTags(trimmed);
    if (!result || result.length === 0) {
      setSuggestedTags([]);
      setSelectedTags([]);
      setStatusMessage(t('suggestionsUnavailable'));
      setStep('tags');
      return;
    }
    setSuggestedTags(result);
    setSelectedTags(result.slice(0, TAG_MAX));
    setStep('tags');
  };

  const handleToggleTag = (tag: string) => {
    setStatusMessage(null);
    if (selectedTags.includes(tag)) {
      setSelectedTags((prev) => prev.filter((item) => item !== tag));
      return;
    }
    if (selectedTags.length >= TAG_MAX) {
      setStatusMessage(t('tagLimitReached'));
      return;
    }
    setSelectedTags((prev) => [...prev, tag]);
  };

  const handleAddCustomTag = () => {
    const trimmed = normalizeTag(customTagInput);
    if (!trimmed) return;
    if (trimmed.length > TAG_MAX_LENGTH) {
      setStatusMessage(t('tagTooLong', { max: TAG_MAX_LENGTH }));
      return;
    }
    const exists = selectedTags.some((tag) => tag.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      setCustomTagInput('');
      return;
    }
    if (selectedTags.length >= TAG_MAX) {
      setStatusMessage(t('tagLimitReached'));
      return;
    }
    setSelectedTags((prev) => [...prev, trimmed]);
    setCustomTagInput('');
  };

  const handleCreate = () => {
    if (!collectionName.trim()) return;
    const templateId = selectedTemplate?.id || TEMPLATES[0].id;
    const icon = selectedTemplate?.icon || TEMPLATES[0].icon;
    const tags = selectedTemplate ? undefined : selectedTags;
    const created = onCreate({ name: collectionName.trim(), icon, templateId, tags });
    if (!created) return;
    setStep('success');
  };

  const handleContinueFromEntry = () => {
    if (selectedTemplate) {
      setStep('preview');
      return;
    }
    if (suggestedTags.length > 0) {
      setStep('tags');
    }
  };

  const previewTags = selectedTemplate
    ? selectedTemplate.fields.map((field) => field.label)
    : selectedTags;

  const renderEntry = () => (
    <div className="space-y-6">
      <div>
        <label
          className={`block text-[12px] font-semibold uppercase tracking-[0.12em] ${mutedText} mb-2`}
        >
          {t('collectionPrompt')}
        </label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('collectionPromptPlaceholder')}
          className={`w-full p-3.5 rounded-xl focus:ring-2 focus:ring-amber-200 outline-none font-medium ${inputSurface}`}
          autoFocus
        />
        <div className="flex items-center justify-between mt-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSuggestTags}
            disabled={!description.trim()}
          >
            {t('suggestTags')}
          </Button>
          <p className={`text-[11px] ${mutedText}`}>{t('suggestTagsHint')}</p>
        </div>
      </div>

      <div>
        <p className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${mutedText} mb-2`}>
          {t('presetSeparator')}
        </p>
        <div className="relative">
          <select
            value={selectedTemplateId}
            onChange={(e) => handleTemplateSelect(e.target.value)}
            className={`w-full p-3 rounded-xl appearance-none outline-none focus:ring-2 focus:ring-amber-200 font-medium pr-10 ${inputSurface}`}
          >
            <option value="">{t('choosePreset')}</option>
            {TEMPLATES.map((temp) => (
              <option key={temp.id} value={temp.id}>
                {temp.name}
              </option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none">
            <ChevronDown size={18} />
          </div>
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
          disabled={!selectedTemplate && !suggestedTags.length}
        >
          {t('continue')}
        </Button>
      </div>
    </div>
  );

  const renderLoading = () => (
    <div className="text-center py-12 sm:py-16 space-y-4">
      <div className="flex justify-center">
        <div className="w-14 h-14 rounded-full flex items-center justify-center bg-amber-50 text-amber-500">
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
      <Button variant="ghost" size="sm" onClick={handleClose}>
        {t('cancel')}
      </Button>
    </div>
  );

  const renderTags = () => (
    <div className="space-y-6">
      <div>
        <h3
          className={`text-lg font-serif font-bold ${theme === 'vault' ? 'text-white' : 'text-stone-800'}`}
        >
          {t('pickTagsTitle')}
        </h3>
        <p className={`text-sm ${mutedText}`}>{t('pickTagsDesc')}</p>
      </div>

      {statusMessage && (
        <div className="p-3 rounded-xl border text-xs font-medium bg-amber-50 text-amber-700 border-amber-100">
          {statusMessage}
        </div>
      )}

      <div>
        <p className={`text-[12px] font-semibold uppercase tracking-[0.12em] ${mutedText} mb-2`}>
          {t('suggestedTagsTitle')}
        </p>
        {suggestedTags.length === 0 ? (
          <p className={`text-sm ${mutedText}`}>{t('suggestionsEmpty')}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {suggestedTags.map((tag) => {
              const isSelected = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  onClick={() => handleToggleTag(tag)}
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
                  {tag}
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
            value={customTagInput}
            onChange={(e) => setCustomTagInput(e.target.value)}
            placeholder={t('addTagPlaceholder')}
            maxLength={TAG_MAX_LENGTH}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddCustomTag();
              }
            }}
            className={`flex-1 p-3 rounded-xl focus:ring-2 focus:ring-amber-200 outline-none font-medium ${inputSurface}`}
          />
          <Button variant="secondary" onClick={handleAddCustomTag}>
            {t('addTag')}
          </Button>
        </div>
        {selectedTags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {selectedTags.map((tag) => (
              <button
                key={tag}
                onClick={() => handleToggleTag(tag)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                  theme === 'vault'
                    ? 'bg-white/5 border-white/10 text-white/80'
                    : 'bg-white border-stone-200 text-stone-600'
                }`}
              >
                {tag}
                <span className="ml-2 text-[10px] opacity-60">×</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={`text-[12px] ${mutedText}`}>{t('tagLimitHelp')}</div>

      <div
        className={`flex justify-between gap-3 pt-4 border-t ${theme === 'vault' ? 'border-white/10' : 'border-stone-50'}`}
      >
        <Button variant="ghost" onClick={() => setStep('entry')}>
          {t('back')}
        </Button>
        <Button onClick={() => setStep('preview')} disabled={selectedTags.length < TAG_MIN}>
          {t('next')}
        </Button>
      </div>
    </div>
  );

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
              {collectionName}
            </h4>
            <span className="text-xl">{selectedTemplate?.icon || TEMPLATES[0].icon}</span>
          </div>
          {previewTags.length > 0 && (
            <p className={`mt-2 text-[12px] ${mutedText}`}>
              {t('tagsLabel')}: {previewTags.slice(0, TAG_MAX).join(' • ')}
            </p>
          )}
        </div>
      </div>

      <div
        className={`flex justify-between gap-3 pt-4 border-t ${theme === 'vault' ? 'border-white/10' : 'border-stone-50'}`}
      >
        <Button variant="ghost" onClick={() => setStep(selectedTemplate ? 'entry' : 'tags')}>
          {t('back')}
        </Button>
        <Button onClick={handleCreate} icon={<Check size={16} />}>
          {t('createCollection')}
        </Button>
      </div>
    </div>
  );

  const renderSuccess = () => (
    <div className="space-y-6 text-center py-6">
      <div>
        <h3
          className={`text-xl font-serif font-bold ${theme === 'vault' ? 'text-white' : 'text-stone-800'}`}
        >
          {t('collectionCreated')}
        </h3>
        <p className={`text-sm ${mutedText}`}>{collectionName}</p>
      </div>
      <Button
        className="w-full"
        size="lg"
        onClick={() => {
          handleClose();
          onAddFirstItem();
        }}
      >
        {t('ctaAddFirst')}
      </Button>
      <Button variant="ghost" size="sm" onClick={handleClose}>
        {t('close')}
      </Button>
    </div>
  );

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 ${overlayClass} backdrop-blur-sm`}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-collection-title"
        data-testid="create-collection-modal"
        className={`${surfaceClass} rounded-t-3xl rounded-b-none sm:rounded-2xl shadow-xl w-full max-w-md h-[100dvh] sm:h-auto max-h-[100dvh] overflow-hidden flex flex-col motion-panel border pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] sm:pt-0 sm:pb-0`}
      >
        <div className="sm:hidden flex items-center justify-center pt-2">
          <span
            className={`${theme === 'vault' ? 'bg-white/20' : 'bg-stone-200'} h-1.5 w-12 rounded-full`}
          />
        </div>
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
          {step === 'tags' && renderTags()}
          {step === 'preview' && renderPreview()}
          {step === 'success' && renderSuccess()}
        </div>
      </div>
    </div>
  );
};
