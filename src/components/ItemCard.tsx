import React from 'react';
import { CollectionItem, FieldDefinition } from '../types';
import { Star } from 'lucide-react';
import { ItemImage } from './ItemImage';
import { useTranslation } from '../i18n';
import {
  useTheme,
  cardSurfaceClasses,
  mutedTextClasses,
  typographyClasses,
  ratingColorClasses,
  dividerClasses,
} from '../theme';

interface ItemCardProps {
  item: CollectionItem;
  fields: FieldDefinition[];
  displayFields: string[];
  badgeFields: string[];
  onClick: () => void;
  layout?: 'grid' | 'masonry';
}

export const ItemCard: React.FC<ItemCardProps> = React.memo(function ItemCard({
  item,
  fields,
  displayFields,
  badgeFields,
  onClick,
  layout = 'grid',
}) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const cardSurface = cardSurfaceClasses[theme];
  const labelText = mutedTextClasses[theme];
  const valueText = theme === 'vault' ? 'text-white' : 'text-stone-700';
  const badgeSurface =
    theme === 'vault'
      ? 'bg-white/10 text-white border border-white/10'
      : 'bg-stone-100 text-stone-600';
  const ratingSurface =
    theme === 'vault' ? 'bg-stone-900/80 text-white' : 'bg-white/90 text-stone-700';
  const cardShadow =
    theme === 'vault'
      ? 'shadow-[0_12px_30px_rgba(0,0,0,0.35)] hover:shadow-[0_16px_40px_rgba(0,0,0,0.45)]'
      : 'shadow-[0_6px_18px_rgba(15,23,42,0.08)] hover:shadow-[0_10px_24px_rgba(15,23,42,0.12)]';
  const tapRing = theme === 'vault' ? 'ring-1 ring-white/10' : 'ring-1 ring-black/5';

  const getValue = (fieldId: string) => {
    const val = item.data[fieldId];
    if (val === undefined || val === null) return null;
    const def = fields.find((f) => f.id === fieldId);

    if (def?.type === 'boolean') return val ? t('yes') : t('no');
    if (def?.type === 'number' && fieldId.includes('percent')) return `${val}%`;
    return val.toString();
  };

  const getLabel = (fieldId: string) => {
    const fieldKey = `label_${fieldId}` as any;
    const translated = t(fieldKey);
    // If translation doesn't exist for this specific custom field, fallback to saved label
    if (translated === fieldKey) {
      return fields.find((f) => f.id === fieldId)?.label || fieldId;
    }
    return translated;
  };

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      data-testid="item-card"
      data-item-id={item.id}
      data-item-title={item.title}
      className={`group rounded-2xl transition-all duration-300 overflow-hidden border cursor-pointer flex flex-col ${layout === 'grid' ? 'h-full' : ''} motion-card ${cardSurface} ${cardShadow} ${tapRing}`}
    >
      <div
        className={`${layout === 'grid' ? 'aspect-[4/3]' : ''} ${theme === 'vault' ? 'bg-stone-800' : 'bg-stone-100'} overflow-hidden relative`}
      >
        <ItemImage
          itemId={item.id}
          photoUrl={item.photoUrl}
          enhancedPath={item.photoEnhancedPath}
          collectionId={item.collectionId}
          alt={item.title}
          type="enhanced"
          className={`w-full group-hover:scale-105 transition-transform duration-500 ${layout === 'grid' ? 'h-full' : 'h-auto'}`}
        />

        {item.rating > 0 && (
          <div
            className={`absolute top-2 right-2 backdrop-blur-sm px-1.5 py-0.5 rounded-md flex items-center gap-1 shadow-sm ${ratingSurface}`}
          >
            <Star size={10} className={`fill-current ${ratingColorClasses[theme]}`} />
            <span className="text-[13px] sm:text-xs font-bold">{item.rating}</span>
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col flex-grow">
        <div className="relative">
          <h4
            title={item.title}
            aria-label={item.title}
            className={`${typographyClasses.title} line-clamp-1 mb-1`}
          >
            {item.title}
          </h4>
          <span
            className={`pointer-events-none absolute left-0 top-full mt-2 w-max max-w-[90vw] rounded-2xl px-3 py-2 text-sm leading-snug shadow-lg opacity-0 scale-95 transition duration-200 ease-out whitespace-normal break-words group-hover:opacity-100 group-hover:scale-100 group-focus-within:opacity-100 group-focus-within:scale-100 group-active:opacity-100 group-active:scale-100 sm:max-w-[18rem] ${theme === 'vault' ? 'bg-stone-900 text-white' : 'bg-white text-stone-900 border border-stone-200/70'}`}
          >
            {item.title}
          </span>
        </div>

        <div className="space-y-1 mb-3">
          {displayFields.map((fieldId) => {
            const val = getValue(fieldId);
            const label = getLabel(fieldId);
            if (!val) return null;
            return (
              <p
                key={fieldId}
                className={`${typographyClasses.body} line-clamp-1 flex items-center gap-1.5 ${valueText}`}
              >
                <span className={`${typographyClasses.labelSmall} ${labelText}`}>{label}:</span>
                <span className="font-medium">{val}</span>
              </p>
            );
          })}
        </div>

        <div className={`mt-auto flex flex-wrap gap-1.5 pt-2 border-t ${dividerClasses[theme]}`}>
          {badgeFields.map((fieldId) => {
            const val = getValue(fieldId);
            if (!val) return null;
            return (
              <span
                key={fieldId}
                className={`inline-flex items-center px-2 py-0.5 rounded-md ${typographyClasses.labelSmall} font-semibold ${badgeSurface}`}
              >
                {val}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
});
