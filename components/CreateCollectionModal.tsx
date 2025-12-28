
import React, { useState } from 'react';
import { X, Check, ChevronDown } from 'lucide-react';
import { TEMPLATES } from '../constants';
import { Button } from './ui/Button';
import { useTranslation } from '../i18n';

interface CreateCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (templateId: string, name: string, icon: string) => void;
}

export const CreateCollectionModal: React.FC<CreateCollectionModalProps> = ({ isOpen, onClose, onCreate }) => {
  const { t } = useTranslation();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(TEMPLATES[0].id);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('✨');
  const selectedTemplate = TEMPLATES.find(temp => temp.id === selectedTemplateId) || TEMPLATES[0];

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-stone-100">
          <h2 className="font-serif font-bold text-lg text-stone-800">{t('newArchive')}</h2>
          <button onClick={onClose} className="p-1 hover:bg-stone-100 rounded-full text-stone-400 hover:text-stone-800 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex gap-4">
              <div className="flex-shrink-0">
                  <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">{t('icon')}</label>
                  <input 
                    type="text" 
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                    className="w-14 h-14 text-center text-3xl bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-200 outline-none"
                    maxLength={2}
                  />
              </div>
              <div className="flex-grow">
                  <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">
                    {t('name')}
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="..."
                    className="w-full p-3.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-200 outline-none font-medium text-stone-800"
                    autoFocus
                  />
              </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">
              {t('dataPresets')}
            </label>
            <p className="text-xs text-stone-400 mb-3">{t('presetDesc')}</p>
            
            <div className="relative">
                <select 
                    value={selectedTemplateId}
                    onChange={(e) => handleTemplateSelect(e.target.value)}
                    className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl appearance-none outline-none focus:ring-2 focus:ring-amber-200 font-medium text-stone-800 pr-10"
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

          <div className="p-4 rounded-2xl border border-stone-100 bg-stone-50/60">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-xl shadow-inner">
                {selectedTemplate.icon}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-stone-800">{t('templatePreview')}</p>
                <p className="text-xs text-stone-500 leading-snug">{selectedTemplate.description}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {selectedTemplate.fields.map(field => (
                <div key={field.id} className="flex items-center gap-2 px-2 py-1.5 bg-white rounded-lg border border-stone-100 shadow-inner">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">{getFieldLabel(field.id, field.label)}</span>
                  {field.type === 'select' && field.options?.length ? (
                    <span className="text-[10px] text-stone-400 truncate">({field.options.slice(0, 2).join(', ')}{field.options.length > 2 ? '…' : ''})</span>
                  ) : (
                    <span className="text-[10px] text-stone-400 capitalize">{field.type}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-stone-50">
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
