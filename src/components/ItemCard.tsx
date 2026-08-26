import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CollectionItem, FieldDefinition } from '../types';
import { Star, Check } from 'lucide-react';
import { ItemImage } from './ItemImage';
import { useTranslation, getFieldTranslation } from '../i18n';
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
  onClick: () => void;
  layout?: 'grid' | 'masonry';
  isSelectable?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
}

export const ItemCard: React.FC<ItemCardProps> = React.memo(function ItemCard({
  item,
  fields,
  onClick,
  layout = 'grid',
  isSelectable = false,
  isSelected = false,
  onSelect,
}) {
  // Derive display and badge fields from displayMode on each field
  const { displayFields, badgeFields } = useMemo(() => {
    const display: string[] = [];
    const badge: string[] = [];
    for (const field of fields) {
      if (field.displayMode === 'primary') {
        display.push(field.id);
      } else if (field.displayMode === 'badge') {
        badge.push(field.id);
      }
    }
    return { displayFields: display, badgeFields: badge };
  }, [fields]);

  const { t } = useTranslation();
  const { theme } = useTheme();
  // The title clamps to two lines. Only mount the full-title reveal when the
  // text is actually clipped — otherwise a short title pops a redundant
  // duplicate over the fields below on every hover/focus (reads as a glitch).
  // The two-line clamp usually overflows vertically (height), but a long
  // unbroken token (a catalog id or URL) clips horizontally on one line
  // instead, so check both axes.
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [isTitleTruncated, setIsTitleTruncated] = useState(false);
  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    const measure = () =>
      setIsTitleTruncated(
        el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1,
      );
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [item.title]);
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
    return getFieldTranslation(t, fieldId, fields.find((f) => f.id === fieldId)?.label);
  };

  const handleCardClick = () => {
    if (isSelectable && onSelect) {
      onSelect();
      return;
    }
    onClick();
  };

  return (
    <div
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleCardClick();
        }
      }}
      data-testid="item-card"
      data-item-id={item.id}
      data-item-title={item.title}
      data-selected={isSelected ? 'true' : 'false'}
      className={`group rounded-xl sm:rounded-2xl transition-all duration-300 ease-out overflow-hidden border cursor-pointer flex flex-col motion-safe:active:scale-[0.98] ${layout === 'grid' ? 'h-full' : ''} motion-card ${cardSurface} ${cardShadow} ${tapRing} ${isSelected ? 'ring-2 ring-amber-400' : ''}`}
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

        {isSelectable && (
          <div
            className={`absolute top-2 left-2 w-7 h-7 rounded-full border flex items-center justify-center ${
              isSelected
                ? 'bg-amber-500 border-amber-500 text-white'
                : theme === 'vault'
                  ? 'bg-stone-900/80 border-white/20 text-white/60'
                  : 'bg-white/80 border-stone-200 text-stone-400'
            }`}
            aria-label={isSelected ? t('bulkSelected') : t('bulkSelect')}
          >
            {isSelected ? <Check size={14} /> : null}
          </div>
        )}

        {item.rating > 0 && (
          <div
            className={`absolute top-2 right-2 backdrop-blur-sm px-1.5 py-0.5 rounded-md flex items-center gap-1 shadow-sm ${ratingSurface}`}
          >
            <Star size={9} className={`fill-current ${ratingColorClasses[theme]}`} />
            <span className="text-[11px] sm:text-xs font-bold">{item.rating}</span>
          </div>
        )}
      </div>

      <div className="p-2.5 sm:p-3 md:p-4 flex flex-col flex-grow">
        <div className="relative">
          <h4
            ref={titleRef}
            title={item.title}
            aria-label={item.title}
            className={`${typographyClasses.title} text-sm sm:text-base line-clamp-2 mb-1`}
          >
            {item.title}
          </h4>
          {isTitleTruncated && (
            <span
              className={`pointer-events-none absolute left-0 top-full mt-2 w-max max-w-[90vw] rounded-2xl px-3 py-2 text-sm leading-snug shadow-lg opacity-0 scale-95 transition duration-200 ease-out whitespace-normal break-words [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-hover:scale-100 group-focus-visible:opacity-100 group-focus-visible:scale-100 sm:max-w-[18rem] ${theme === 'vault' ? 'bg-stone-900 text-white' : 'bg-white text-stone-900 border border-stone-200/70'}`}
            >
              {item.title}
            </span>
          )}
        </div>

        <div className="space-y-0.5 sm:space-y-1 mb-2 sm:mb-3">
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

        <div
          className={`mt-auto flex flex-wrap gap-1 sm:gap-1.5 pt-1.5 sm:pt-2 border-t ${dividerClasses[theme]}`}
        >
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
