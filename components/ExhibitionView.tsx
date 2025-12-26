import React, { useState } from 'react';
import { X, ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { UserCollection } from '../types';
import { ItemImage } from './ItemImage';
import { useTranslation } from '../i18n';

interface ExhibitionViewProps {
  collection: UserCollection;
  initialIndex?: number;
  isOpen: boolean;
  onClose: () => void;
}

export const ExhibitionView: React.FC<ExhibitionViewProps> = ({ collection, initialIndex = 0, isOpen, onClose }) => {
  const { t } = useTranslation();
  const [index, setIndex] = useState(initialIndex);
  
  if (!isOpen || collection.items.length === 0) return null;

  const item = collection.items[index];
  const next = () => setIndex((i) => (i + 1) % collection.items.length);
  const prev = () => setIndex((i) => (i - 1 + collection.items.length) % collection.items.length);

  return (
    <div className="fixed inset-0 z-[70] bg-stone-950 text-white flex flex-col animate-in fade-in duration-500 overflow-y-auto sm:overflow-hidden">
      <header className="p-6 sm:p-8 flex justify-between items-center bg-gradient-to-b from-stone-950/80 to-transparent sticky top-0 z-10">
        <div>
          <h2 className="text-[10px] font-mono tracking-[0.2em] uppercase opacity-40 mb-0.5">{collection.name}</h2>
          <p className="text-lg sm:text-xl font-serif italic text-amber-500">{t('exhibitNo', { n: index + 1, total: collection.items.length })}</p>
        </div>
        <button onClick={onClose} className="p-2 sm:p-3 bg-white/10 hover:bg-white/20 rounded-full transition-all">
          <X size={20} className="sm:w-6 sm:h-6" />
        </button>
      </header>

      <div className="flex-1 relative flex flex-col sm:flex-row items-center justify-center px-6 sm:px-12 pb-12 gap-8 sm:gap-16">
        <button onClick={prev} className="absolute left-4 sm:left-12 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-16 sm:h-16 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all hover:scale-110 z-10">
          <ChevronLeft size={24} className="sm:w-8 sm:h-8" />
        </button>

        <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-16 items-center animate-in zoom-in-95 duration-700">
          <div className="aspect-[3/4] sm:aspect-[3/4] rounded-2xl sm:rounded-[3rem] overflow-hidden shadow-2xl border border-white/10 group relative max-h-[40vh] sm:max-h-none">
             <ItemImage 
                itemId={item.id} 
                photoUrl={item.photoUrl}
                type="master" 
                className="w-full h-full object-cover transition-transform duration-[2s] group-hover:scale-110" 
             />
             <div className="absolute inset-0 bg-gradient-to-t from-stone-950/40 to-transparent" />
          </div>

          <div className="space-y-6 sm:space-y-8 text-center sm:text-left">
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center justify-center sm:justify-start gap-1 sm:gap-2 text-amber-500">
                {[...Array(item.rating)].map((_, i) => <Star key={i} size={16} className="sm:w-[18px]" fill="currentColor" />)}
              </div>
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-serif font-bold leading-tight">{item.title}</h1>
              <p className="text-stone-400 text-base sm:text-xl font-light leading-relaxed font-serif italic border-none sm:border-l-2 border-stone-800 px-0 sm:pl-6 line-clamp-4">
                {item.notes || "..."}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-x-6 sm:gap-x-12 gap-y-4 sm:gap-y-6 pt-6 sm:pt-8 border-t border-white/10 text-left">
               {collection.customFields.slice(0, 4).map(f => (
                 <div key={f.id}>
                    <p className="text-[8px] sm:text-[10px] font-mono tracking-widest uppercase opacity-40 mb-0.5">{f.label}</p>
                    <p className="text-sm sm:text-lg font-medium truncate">{item.data[f.id] || "—"}</p>
                 </div>
               ))}
            </div>
          </div>
        </div>

        <button onClick={next} className="absolute right-4 sm:right-12 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-16 sm:h-16 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all hover:scale-110 z-10">
          <ChevronRight size={24} className="sm:w-8 sm:h-8" />
        </button>
      </div>

      <footer className="p-6 sm:p-12 flex justify-center sticky bottom-0 bg-gradient-to-t from-stone-950 to-transparent">
         <div className="flex gap-1.5 sm:gap-2">
            {collection.items.slice(0, 10).map((_, i) => (
              <button key={i} onClick={() => setIndex(i)} className={`h-1 rounded-full transition-all ${i === index ? 'w-8 sm:w-12 bg-amber-500' : 'w-2 sm:w-4 bg-white/10'}`} />
            ))}
            {collection.items.length > 10 && <span className="text-[8px] opacity-30 self-center">+</span>}
         </div>
      </footer>
    </div>
  );
};