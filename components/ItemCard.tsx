import React from 'react';
import { CollectionItem, FieldDefinition } from '../types';
import { Star } from 'lucide-react';
import { ItemImage } from './ItemImage';

interface ItemCardProps {
  item: CollectionItem;
  fields: FieldDefinition[];
  displayFields: string[];
  badgeFields: string[];
  onClick: () => void;
  layout?: 'grid' | 'masonry';
}

export const ItemCard: React.FC<ItemCardProps> = ({ item, fields, displayFields, badgeFields, onClick, layout = 'grid' }) => {
  
  const getValue = (fieldId: string) => {
    const val = item.data[fieldId];
    if (val === undefined || val === null) return null;
    const def = fields.find(f => f.id === fieldId);
    
    if (def?.type === 'boolean') return val ? 'Yes' : 'No';
    if (def?.type === 'number' && fieldId.includes('percent')) return `${val}%`;
    return val.toString();
  };

  return (
    <div 
      onClick={onClick}
      className={`group bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden border border-stone-100 cursor-pointer flex flex-col ${layout === 'grid' ? 'h-full' : ''}`}
    >
      <div className={`${layout === 'grid' ? 'aspect-[4/3]' : ''} bg-stone-100 overflow-hidden relative`}>
        <ItemImage 
            itemId={item.id} 
            alt={item.title} 
            className={`w-full group-hover:scale-105 transition-transform duration-500 ${layout === 'grid' ? 'h-full' : 'h-auto'}`}
        />
        
        {item.rating > 0 && (
          <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-1.5 py-0.5 rounded-md flex items-center gap-1 shadow-sm">
            <Star size={10} className="fill-amber-400 text-amber-400" />
            <span className="text-xs font-bold text-stone-700">{item.rating}</span>
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col flex-grow">
        <h4 className="font-bold text-stone-900 line-clamp-1 text-lg mb-1">{item.title}</h4>
        
        <div className="space-y-1 mb-3">
          {displayFields.map(fieldId => {
            const val = getValue(fieldId);
            const label = fields.find(f => f.id === fieldId)?.label;
            if (!val) return null;
            return (
              <p key={fieldId} className="text-sm text-stone-600 line-clamp-1 flex items-center gap-1.5">
                <span className="text-stone-400 text-xs uppercase tracking-wider">{label}:</span>
                <span className="font-medium text-stone-700">{val}</span>
              </p>
            );
          })}
        </div>

        <div className="mt-auto flex flex-wrap gap-1.5 pt-2 border-t border-stone-50">
          {badgeFields.map(fieldId => {
            const val = getValue(fieldId);
            if (!val) return null;
            return (
              <span key={fieldId} className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-stone-100 text-stone-600 uppercase tracking-wide">
                {val}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
};