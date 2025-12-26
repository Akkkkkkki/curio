
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
    <div className="fixed inset-0 z-[70] bg-stone-950 text-white flex flex-col animate-in fade-in duration-500">
      <header className="p-8 flex justify-between items-center bg-gradient-to-b from-stone-950/80 to-transparent">
        <div>
          <h2 className="text-sm font-mono tracking-[0.3em] uppercase opacity-40 mb-1">{collection.name}</h2>
          <p className="text-xl font-serif italic text-amber-500">{t('exhibitNo', { n: index + 1, total: collection.items.length })}</p>
        </div>
        <button onClick={onClose} className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-all">
          <X size={24} />
        </button>
      </header>

      <div className="flex-1 relative flex items-center justify-center px-12 pb-12">
        <button onClick={prev} className="absolute left-12 w-16 h-16 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all hover:scale-110">
          <ChevronLeft size={32} />
        </button>

        <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-16 items-center animate-in zoom-in-95 duration-700">
          <div className="aspect-[3/4] rounded-[3rem] overflow-hidden shadow-2xl border border-white/10 group relative">
             <ItemImage 
                itemId={item.id} 
                photoUrl={item.photoUrl}
                type="master" 
                className="w-full h-full object-cover transition-transform duration-[2s] group-hover:scale-110" 
             />
             <div className="absolute inset-0 bg-gradient-to-t from-stone-950/40 to-transparent" />
          </div>

          <div className="space-y-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-amber-500">
                {[...Array(item.rating)].map((_, i) => <Star key={i} size={18} fill="currentColor" />)}
              </div>
              <h1 className="text-6xl font-serif font-bold leading-tight">{item.title}</h1>
              <p className="text-stone-400 text-xl font-light leading-relaxed font-serif italic border-l-2 border-stone-800 pl-6">
                {item.notes || "..."}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-x-12 gap-y-6 pt-8 border-t border-white/10">
               {collection.customFields.slice(0, 4).map(f => (
                 <div key={f.id}>
                    <p className="text-[10px] font-mono tracking-widest uppercase opacity-40 mb-1">{f.label}</p>
                    <p className="text-lg font-medium">{item.data[f.id] || "—"}</p>
                 </div>
               ))}
            </div>
          </div>
        </div>

        <button onClick={next} className="absolute right-12 w-16 h-16 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all hover:scale-110">
          <ChevronRight size={32} />
        </button>
      </div>

      <footer className="p-12 flex justify-center">
         <div className="flex gap-2">
            {collection.items.map((_, i) => (
              <button key={i} onClick={() => setIndex(i)} className={`h-1 rounded-full transition-all ${i === index ? 'w-12 bg-amber-500' : 'w-4 bg-white/10'}`} />
            ))}
         </div>
      </footer>
    </div>
  );
};
