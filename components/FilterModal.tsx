
import React, { useState, useEffect } from 'react';
import { X, Filter, RotateCcw } from 'lucide-react';
import { FieldDefinition } from '../types';
import { Button } from './ui/Button';
import { useTranslation } from '../i18n';
import { useTheme, panelSurfaceClasses, overlaySurfaceClasses, mutedTextClasses } from '../theme';

interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  fields: FieldDefinition[];
  activeFilters: Record<string, string>;
  onApply: (filters: Record<string, string>) => void;
}

export const FilterModal: React.FC<FilterModalProps> = ({ isOpen, onClose, fields, activeFilters, onApply }) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [localFilters, setLocalFilters] = useState<Record<string, string>>(activeFilters);
  const surfaceClass = panelSurfaceClasses[theme];
  const overlayClass = `${overlaySurfaceClasses[theme]} motion-overlay`;
  const borderClass = theme === 'vault' ? 'border-white/10' : 'border-stone-100';
  const inputSurface = theme === 'vault' ? 'bg-white/5 border border-white/10 text-white placeholder:text-stone-400' : 'bg-stone-50 border border-stone-200';
  const mutedText = mutedTextClasses[theme];

  useEffect(() => {
    if (isOpen) setLocalFilters(activeFilters);
  }, [isOpen, activeFilters]);

  if (!isOpen) return null;

  const handleApply = () => {
    onApply(localFilters);
    onClose();
  };

  const handleClear = () => {
    setLocalFilters({});
    onApply({});
    onClose();
  };

  const activeCount = Object.values(localFilters).filter(Boolean).length;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${overlayClass} backdrop-blur-sm`}>
      <div className={`${surfaceClass} rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[85vh] motion-panel border`}>
        <div className={`flex items-center justify-between p-4 border-b ${borderClass}`}>
          <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-lg ${theme === 'vault' ? 'bg-white/5 text-white' : 'bg-stone-100 text-stone-600'}`}><Filter size={18} /></div>
              <h2 className={`font-serif font-bold text-lg ${theme === 'vault' ? 'text-white' : 'text-stone-800'}`}>{t('filterCollection')}</h2>
          </div>
          <button onClick={onClose} className={`p-1 rounded-full transition-colors ${theme === 'vault' ? 'hover:bg-white/5 text-stone-300 hover:text-white' : 'hover:bg-stone-100 text-stone-400 hover:text-stone-800'}`}><X size={20} /></button>
        </div>
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
            <div>
                 <label className={`block text-[12px] font-semibold uppercase tracking-[0.12em] ${mutedText} mb-2`}>{t('rating')}</label>
                 <select value={localFilters['rating'] || ''} onChange={e => setLocalFilters({...localFilters, rating: e.target.value})} className={`w-full p-2.5 rounded-xl text-sm outline-none ${inputSurface}`}>
                     <option value="">{t('anyRating')}</option>
                     <option value="5">5 Stars</option>
                     <option value="4">4+ Stars</option>
                     <option value="3">3+ Stars</option>
                 </select>
            </div>
            {fields.map(field => (
                <div key={field.id}>
                    <label className={`block text-[12px] font-semibold uppercase tracking-[0.12em] ${mutedText} mb-2`}>{field.label}</label>
                    <input 
                      type="text" 
                      value={localFilters[field.id] || ''} 
                      onChange={e => setLocalFilters({...localFilters, [field.id]: e.target.value})} 
                      className={`w-full p-2.5 rounded-xl text-sm outline-none ${inputSurface}`} 
                      placeholder="..."
                    />
                </div>
            ))}
        </div>
        <div className={`p-4 border-t flex justify-between items-center gap-3 ${theme === 'vault' ? 'border-white/10 bg-white/5' : 'border-stone-100 bg-white'}`}>
             <button onClick={handleClear} className="text-stone-500 hover:text-stone-800 text-sm font-medium flex items-center gap-1 px-2"><RotateCcw size={14} /> {t('clear')}</button>
             <div className="flex gap-2">
                <Button variant="ghost" onClick={onClose}>{t('cancel')}</Button>
                <Button onClick={handleApply}>{t('apply')} {activeCount > 0 ? `(${activeCount})` : ''}</Button>
             </div>
        </div>
      </div>
    </div>
  );
};
