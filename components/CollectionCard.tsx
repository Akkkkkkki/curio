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
      className={`group relative p-6 rounded-2xl border ${bgClass} transition-all duration-300 cursor-pointer shadow-sm hover:shadow-md flex flex-col justify-between h-40 overflow-hidden`}
    >
      <div className="absolute top-0 right-0 p-6 opacity-10 text-6xl select-none group-hover:scale-110 group-hover:rotate-12 transition-transform duration-500">
        {displayIcon}
      </div>

      <div>
        <h3 className="font-serif text-2xl font-bold text-stone-900 group-hover:text-black">
          {collection.name}
        </h3>
        <p className="text-stone-500 text-sm mt-1 line-clamp-1">{template.description}</p>
      </div>

      <div className="flex items-center justify-between mt-4">
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/60 text-stone-700 backdrop-blur-sm">
          {itemCount} {itemCount === 1 ? 'item' : 'items'}
        </span>
        <div className="w-8 h-8 rounded-full bg-white/60 flex items-center justify-center text-stone-400 group-hover:text-stone-900 group-hover:bg-white transition-all">
          <ChevronRight size={16} />
        </div>
      </div>
    </div>
  );
};
