
import React from 'react';
import { UserCollection } from '../types';
import { ChevronRight } from 'lucide-react';
import { TEMPLATES } from '../constants';

interface CollectionCardProps {
  collection: UserCollection;
  onClick: () => void;
}

export const CollectionCard: React.FC<CollectionCardProps> = ({ collection, onClick }) => {
  const template = TEMPLATES.find(t => t.id === collection.templateId) || TEMPLATES[0];
  const itemCount = collection.items.length;
  const isSample = collection.id.startsWith('sample');
  
  // Use collection icon if available (custom), else template default
  const displayIcon = collection.icon || template.icon;

  // Dynamic background classes based on template color
  const bgClasses: Record<string, string> = {
    orange: 'bg-orange-50 hover:bg-orange-100 border-orange-100',
    indigo: 'bg-indigo-50 hover:bg-indigo-100 border-indigo-100',
    rose: 'bg-rose-50 hover:bg-rose-100 border-rose-100',
    emerald: 'bg-emerald-50 hover:bg-emerald-100 border-emerald-100',
    stone: 'bg-stone-100 hover:bg-stone-200 border-stone-200',
  };

  const bgClass = bgClasses[template.accentColor] || bgClasses['stone'];

  return (
    <div 
      onClick={onClick}
      className={`group relative p-8 rounded-[2.5rem] border ${bgClass} transition-all duration-500 cursor-pointer shadow-sm hover:shadow-xl flex flex-col justify-between h-52 overflow-hidden`}
    >
      <div className="absolute top-0 right-0 p-8 opacity-10 text-7xl select-none group-hover:scale-110 group-hover:rotate-12 transition-transform duration-700 pointer-events-none">
        {displayIcon}
      </div>

      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-1">
          <h3 className="font-serif text-3xl font-bold text-stone-900 group-hover:text-black leading-tight">
            {collection.name}
          </h3>
          {isSample && (
            <span className="text-[8px] font-mono tracking-[0.2em] bg-white/40 text-stone-500 px-1.5 py-0.5 rounded border border-black/5 uppercase font-bold shrink-0">Sample</span>
          )}
        </div>
        <p className="text-stone-500 text-sm mt-2 line-clamp-2 max-w-[85%] font-medium leading-relaxed">
          {template.description}
        </p>
      </div>

      <div className="flex items-center justify-between mt-4 relative z-10">
        <span className="inline-flex items-center px-4 py-1 rounded-full text-xs font-bold bg-white/60 text-stone-700 backdrop-blur-sm border border-white/40 shadow-sm">
          {itemCount} {itemCount === 1 ? 'item' : 'items'}
        </span>
        <div className="w-10 h-10 rounded-full bg-white/60 flex items-center justify-center text-stone-400 group-hover:text-stone-900 group-hover:bg-white transition-all shadow-sm group-hover:shadow-md">
          <ChevronRight size={18} />
        </div>
      </div>
    </div>
  );
};
