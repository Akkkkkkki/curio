import React from 'react';
import { UserCollection } from '../types';
import { ChevronRight } from 'lucide-react';
import { TEMPLATES } from '../constants';
import { useTranslation } from '../i18n';
import { useTheme, cardSurfaceClasses, mutedTextClasses } from '../theme';

interface CollectionCardProps {
  collection: UserCollection;
  onClick: () => void;
}

export const CollectionCard: React.FC<CollectionCardProps> = ({ collection, onClick }) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const template = TEMPLATES.find(t => t.id === collection.templateId) || TEMPLATES[0];
  const itemCount = collection.items.length;
  const isSample = Boolean(collection.isPublic) || collection.id.startsWith('sample');
  const baseSurface = cardSurfaceClasses[theme];
  const mutedText = mutedTextClasses[theme];
  const accentBorder: Record<string, string> = {
    orange: 'border-orange-100/80',
    indigo: 'border-indigo-100/70',
    rose: 'border-rose-100/70',
    emerald: 'border-emerald-100/70',
    stone: 'border-stone-200',
  };
  const badgeSurface = theme === 'vault'
    ? 'bg-white/10 text-white border border-white/10'
    : 'bg-white/80 text-stone-700 border border-white/60';
  const tapRing = theme === 'vault' ? 'ring-1 ring-white/10' : 'ring-1 ring-black/5';
  const tapShadow = theme === 'vault'
    ? 'shadow-[0_12px_30px_rgba(0,0,0,0.35)] hover:shadow-[0_18px_40px_rgba(0,0,0,0.45)]'
    : 'shadow-[0_6px_18px_rgba(15,23,42,0.08)] hover:shadow-[0_12px_26px_rgba(15,23,42,0.14)]';
  
  const displayIcon = collection.icon || template.icon;

  return (
    <div 
      onClick={onClick}
      className={`group relative p-8 rounded-[2.5rem] border ${baseSurface} ${accentBorder[template.accentColor] || accentBorder['stone']} transition-all duration-500 cursor-pointer ${tapShadow} ${tapRing} flex flex-col justify-between h-52 overflow-hidden motion-card`}
    >
      <div className="absolute top-0 right-0 p-8 opacity-10 text-7xl select-none group-hover:scale-110 group-hover:rotate-12 transition-transform duration-700 pointer-events-none">
        {displayIcon}
      </div>

      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-serif text-2xl sm:text-3xl font-bold group-hover:text-amber-600 leading-tight truncate max-w-[80%]">
            {collection.name}
          </h3>
          {isSample && (
            <span className="text-[13px] sm:text-[12px] font-mono tracking-[0.1em] px-2 py-0.5 rounded border uppercase font-bold shrink-0 bg-amber-50 text-amber-700 border-amber-100">
              {t('readOnlyMode')}
            </span>
          )}
        </div>
        <p className={`${mutedText} text-sm mt-1 sm:mt-2 line-clamp-2 max-w-[90%] font-medium leading-relaxed`}>
          {template.description}
        </p>
      </div>

      <div className="flex items-center justify-between mt-4 relative z-10">
        <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-sm font-semibold backdrop-blur-sm shadow-sm ${badgeSurface}`}>
          {t(itemCount === 1 ? 'itemCount' : 'itemsCount', { n: itemCount })}
        </span>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-sm group-hover:shadow-md border ${theme === 'vault' ? 'bg-white/10 text-white/80 border-white/20 group-hover:bg-white/20 group-hover:text-white' : 'bg-white text-stone-500 border-stone-200/70 group-hover:text-stone-900 group-hover:bg-white'}`}>
          <ChevronRight size={20} />
        </div>
      </div>
    </div>
  );
};
