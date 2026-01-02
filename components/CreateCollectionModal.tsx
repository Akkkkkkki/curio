
import React, { useState } from 'react';
import { X, Check, ChevronDown } from 'lucide-react';
import { TEMPLATES } from '../constants';
import { Button } from './ui/Button';
import { useTranslation } from '../i18n';
import { useTheme, panelSurfaceClasses, overlaySurfaceClasses, mutedTextClasses } from '../theme';

interface CreateCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (templateId: string, name: string, icon: string) => void;
}

export const CreateCollectionModal: React.FC<CreateCollectionModalProps> = ({ isOpen, onClose, onCreate }) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(TEMPLATES[0].id);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('✨');
  const selectedTemplate = TEMPLATES.find(temp => temp.id === selectedTemplateId) || TEMPLATES[0];

  const surfaceClass = panelSurfaceClasses[theme];
  const overlayClass = `${overlaySurfaceClasses[theme]} motion-overlay`;
  const dividerBorder = theme === 'vault' ? 'border-white/10' : 'border-stone-100';
  const mutedText = mutedTextClasses[theme];
  const inputSurface = theme === 'vault' ? 'bg-white/5 border border-white/10 text-white placeholder:text-stone-400' : 'bg-stone-50 border border-stone-200 text-stone-800';

  if (!isOpen) return null;

  const handleCreate = () => {
    if (!name.trim()) return;
    onCreate(selectedTemplateId, name, icon);
    setName('');
    setIcon('✨');
    setSelectedTemplateId(TEMPLATES[0].id);
    onClose();
  };

  const handleTemplateSelect = (tId: string) => {
    setSelectedTemplateId(tId);
    const temp = TEMPLATES.find(temp => temp.id === tId);
    if (temp) setIcon(temp.icon);
  };

  const getFieldLabel = (fieldId: string, fallback: string) => {
    const key = `label_${fieldId}` as any;
    const translated = t(key);
    return translated === key ? fallback : translated;
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 ${overlayClass} backdrop-blur-sm`}>
      <div
        className={`${surfaceClass} rounded-t-3xl rounded-b-none sm:rounded-2xl shadow-xl w-full max-w-md h-[100dvh] sm:h-auto max-h-[100dvh] overflow-hidden flex flex-col motion-panel border pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] sm:pt-0 sm:pb-0`}
      >
        <div className="sm:hidden flex items-center justify-center pt-2">
          <span className={`${theme === 'vault' ? 'bg-white/20' : 'bg-stone-200'} h-1.5 w-12 rounded-full`} />
        </div>
        <div className={`flex items-center justify-between p-4 border-b ${dividerBorder}`}>
          <h2 className={`font-serif font-bold text-lg ${theme === 'vault' ? 'text-white' : 'text-stone-800'}`}>{t('newArchive')}</h2>
          <button onClick={onClose} className={`p-1 rounded-full transition-colors ${theme === 'vault' ? 'hover:bg-white/5 text-stone-300 hover:text-white' : 'hover:bg-stone-100 text-stone-400 hover:text-stone-800'}`}>
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-6 pb-24 sm:pb-6 space-y-6">
          <div className="flex gap-4">
              <div className="flex-shrink-0">
                  <label className={`block text-[12px] font-semibold uppercase tracking-[0.12em] ${mutedText} mb-2`}>{t('icon')}</label>
                  <input 
                    type="text" 
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                    className={`w-14 h-14 text-center text-3xl rounded-xl focus:ring-2 focus:ring-amber-200 outline-none ${inputSurface}`}
                    maxLength={2}
                  />
              </div>
              <div className="flex-grow">
                  <label className={`block text-[12px] font-semibold uppercase tracking-[0.12em] ${mutedText} mb-2`}>
                    {t('name')}
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="..."
                    className={`w-full p-3.5 rounded-xl focus:ring-2 focus:ring-amber-200 outline-none font-medium ${inputSurface}`}
                    autoFocus
                  />
              </div>
          </div>

          <div>
            <label className={`block text-[12px] font-semibold uppercase tracking-[0.12em] ${mutedText} mb-2`}>
              {t('dataPresets')}
            </label>
            <p className={`text-[12px] ${mutedText} mb-3`}>{t('presetDesc')}</p>
            
            <div className="relative">
                <select 
                    value={selectedTemplateId}
                    onChange={(e) => handleTemplateSelect(e.target.value)}
                    className={`w-full p-3 rounded-xl appearance-none outline-none focus:ring-2 focus:ring-amber-200 font-medium pr-10 ${inputSurface}`}
                >
                    {TEMPLATES.map(temp => (
                        <option key={temp.id} value={temp.id}>{temp.name}</option>
                    ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none">
                    <ChevronDown size={18} />
                </div>
            </div>
          </div>

          <div className={`p-4 rounded-2xl border ${theme === 'vault' ? 'border-white/10 bg-white/5' : 'border-stone-100 bg-stone-50/60'}`}>
            <div className="flex items-start gap-3 mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-inner ${theme === 'vault' ? 'bg-white/10' : 'bg-white'}`}>
                {selectedTemplate.icon}
              </div>
              <div className="flex-1">
                <p className={`text-sm font-semibold ${theme === 'vault' ? 'text-white' : 'text-stone-800'}`}>{t('templatePreview')}</p>
                <p className={`text-[12px] ${mutedText} leading-snug`}>{selectedTemplate.description}</p>
              </div>
            </div>
            <p className={`text-[12px] uppercase font-semibold ${mutedText} tracking-[0.12em] mb-2`}>{t('templateFields')}</p>
            <div className="grid grid-cols-2 gap-2">
              {selectedTemplate.fields.map(field => (
                <div key={field.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border shadow-inner ${theme === 'vault' ? 'bg-white/5 border-white/10' : 'bg-white border-stone-100'}`}>
                  <span className={`text-[11px] font-bold uppercase tracking-[0.12em] ${mutedText}`}>{getFieldLabel(field.id, field.label)}</span>
                  {field.type === 'select' && field.options?.length ? (
                    <span className="text-[11px] text-stone-400 truncate">({field.options.slice(0, 2).join(', ')}{field.options.length > 2 ? '…' : ''})</span>
                  ) : (
                    <span className="text-[11px] text-stone-400 capitalize">{field.type}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className={`flex justify-end gap-3 pt-4 border-t ${theme === 'vault' ? 'border-white/10' : 'border-stone-50'}`}>
             <Button variant="ghost" onClick={onClose}>{t('cancel')}</Button>
             <Button onClick={handleCreate} disabled={!name.trim()} icon={<Check size={16} />}>
               {t('createCollection')}
             </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
