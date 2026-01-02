
import React from 'react';
import { CollectionItem, FieldDefinition } from '../types';
import { Star } from 'lucide-react';
import { ItemImage } from './ItemImage';
import { useTranslation } from '../i18n';
import { useTheme, cardSurfaceClasses, mutedTextClasses } from '../theme';

interface ItemCardProps {
  item: CollectionItem;
  fields: FieldDefinition[];
  displayFields: string[];
  badgeFields: string[];
  onClick: () => void;
  layout?: 'grid' | 'masonry';
}

export const ItemCard: React.FC<ItemCardProps> = ({ item, fields, displayFields, badgeFields, onClick, layout = 'grid' }) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const cardSurface = cardSurfaceClasses[theme];
  const labelText = mutedTextClasses[theme];
  const valueText = theme === 'vault' ? 'text-white' : 'text-stone-700';
  const badgeSurface = theme === 'vault'
    ? 'bg-white/10 text-white border border-white/10'
    : 'bg-stone-100 text-stone-600';
  const ratingSurface = theme === 'vault' ? 'bg-stone-900/80 text-white' : 'bg-white/90 text-stone-700';
  const cardShadow = theme === 'vault'
    ? 'shadow-[0_12px_30px_rgba(0,0,0,0.35)] hover:shadow-[0_16px_40px_rgba(0,0,0,0.45)]'
    : 'shadow-[0_6px_18px_rgba(15,23,42,0.08)] hover:shadow-[0_10px_24px_rgba(15,23,42,0.12)]';
  const tapRing = theme === 'vault' ? 'ring-1 ring-white/10' : 'ring-1 ring-black/5';
  
  const getValue = (fieldId: string) => {
    const val = item.data[fieldId];
    if (val === undefined || val === null) return null;
    const def = fields.find(f => f.id === fieldId);
    
    if (def?.type === 'boolean') return val ? t('yes') : t('no');
    if (def?.type === 'number' && fieldId.includes('percent')) return `${val}%`;
    return val.toString();
  };

  const getLabel = (fieldId: string) => {
    const fieldKey = `label_${fieldId}` as any;
    const translated = t(fieldKey);
    // If translation doesn't exist for this specific custom field, fallback to saved label
    if (translated === fieldKey) {
        return fields.find(f => f.id === fieldId)?.label || fieldId;
    }
    return translated;
  };

  return (
    <div 
      onClick={onClick}
      className={`group rounded-2xl transition-all duration-300 overflow-hidden border cursor-pointer flex flex-col ${layout === 'grid' ? 'h-full' : ''} motion-card ${cardSurface} ${cardShadow} ${tapRing}`}
    >
      <div className={`${layout === 'grid' ? 'aspect-[4/3]' : ''} ${theme === 'vault' ? 'bg-stone-800' : 'bg-stone-100'} overflow-hidden relative`}>
        <ItemImage 
            itemId={item.id} 
            collectionId={item.collectionId}
            photoUrl={item.photoUrl}
            alt={item.title} 
            className={`w-full group-hover:scale-105 transition-transform duration-500 ${layout === 'grid' ? 'h-full' : 'h-auto'}`}
        />
        
        {item.rating > 0 && (
          <div className={`absolute top-2 right-2 backdrop-blur-sm px-1.5 py-0.5 rounded-md flex items-center gap-1 shadow-sm ${ratingSurface}`}>
            <Star size={10} className="fill-amber-400 text-amber-400" />
            <span className="text-[13px] sm:text-xs font-bold">{item.rating}</span>
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col flex-grow">
        <h4 className="font-bold line-clamp-1 text-lg mb-1 tracking-tight">{item.title}</h4>
        
        <div className="space-y-1 mb-3">
          {displayFields.map(fieldId => {
            const val = getValue(fieldId);
            const label = getLabel(fieldId);
            if (!val) return null;
            return (
              <p key={fieldId} className={`text-sm line-clamp-1 flex items-center gap-1.5 ${valueText}`}>
                <span className={`text-[13px] sm:text-[12px] uppercase tracking-[0.1em] ${labelText}`}>{label}:</span>
                <span className="font-medium">{val}</span>
              </p>
            );
          })}
        </div>

        <div className={`mt-auto flex flex-wrap gap-1.5 pt-2 border-t ${theme === 'vault' ? 'border-white/10' : 'border-stone-50'}`}>
          {badgeFields.map(fieldId => {
            const val = getValue(fieldId);
            if (!val) return null;
            return (
              <span key={fieldId} className={`inline-flex items-center px-2 py-0.5 rounded-md text-[13px] sm:text-[12px] font-semibold uppercase tracking-[0.08em] ${badgeSurface}`}>
                {val}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
};
