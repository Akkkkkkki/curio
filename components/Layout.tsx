import React from 'react';
import { Home, Plus, Settings } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
  onAddItem: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, onAddItem }) => {
  const location = useLocation();
  const isHome = location.pathname === '/';

  return (
    <div className="min-h-screen bg-stone-50 text-stone-800 font-sans selection:bg-amber-200">
      <header className="sticky top-0 z-20 bg-stone-50/80 backdrop-blur-md border-b border-stone-200/50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-stone-900 rounded-lg flex items-center justify-center text-white font-serif font-bold text-xl group-hover:bg-amber-600 transition-colors">
              C
            </div>
            <span className="font-serif text-xl font-bold tracking-tight text-stone-900">Curio</span>
          </Link>
          
          <nav className="flex items-center gap-2">
            {!isHome && (
                <Link to="/">
                    <button className="p-2 hover:bg-stone-100 rounded-full text-stone-500 hover:text-stone-900 transition-colors">
                        <Home size={20} />
                    </button>
                </Link>
            )}
            <button 
                onClick={onAddItem}
                className="bg-stone-900 hover:bg-amber-600 text-white rounded-full px-4 py-1.5 text-sm font-medium flex items-center gap-2 transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Add Item</span>
              <span className="sm:hidden">Add</span>
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 pb-24">
        {children}
      </main>

      <footer className="fixed bottom-0 left-0 w-full bg-gradient-to-t from-stone-50 via-stone-50 to-transparent pointer-events-none h-12 z-10" />
    </div>
  );
};
