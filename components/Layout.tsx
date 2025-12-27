
import React, { useState } from 'react';
import { Home, Plus, User, LogOut, Cloud, CloudOff } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from '../i18n';
import { supabase, signOutUser, isSupabaseConfigured } from '../services/supabase';
import { AuthModal } from './AuthModal';

interface LayoutProps {
  children: React.ReactNode;
  onAddItem: () => void;
  headerExtras?: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children, onAddItem, headerExtras }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const isHome = location.pathname === '/';
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  
  // Track actual Supabase user
  const [user, setUser] = React.useState<any>(null);
  const isCloudActive = isSupabaseConfigured();

  React.useEffect(() => {
    if (supabase) {
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user && !user.is_anonymous) setUser(user);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (session?.user && !session.user.is_anonymous) {
                setUser(session.user);
            } else {
                setUser(null);
            }
        });

        return () => subscription.unsubscribe();
    }
  }, []);

  const handleSignOut = async () => {
    await signOutUser();
    setIsProfileOpen(false);
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-800 font-sans selection:bg-amber-200">
      <header className="sticky top-0 z-20 bg-stone-50/80 backdrop-blur-md border-b border-stone-200/50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-stone-900 rounded-lg flex items-center justify-center text-white font-serif font-bold text-xl group-hover:bg-amber-600 transition-colors">
              C
            </div>
            <div className="flex flex-col -space-y-1">
              <span className="font-serif text-xl font-bold tracking-tight text-stone-900 leading-none">{t('appTitle')}</span>
              <div className="flex items-center gap-1 opacity-40">
                {isCloudActive ? <Cloud size={10} className="text-emerald-600" /> : <CloudOff size={10} className="text-amber-600" />}
                <span className="text-[8px] font-bold uppercase tracking-widest">{isCloudActive ? 'Cloud Sync' : 'Local Archive'}</span>
              </div>
            </div>
          </Link>
          
          <nav className="flex items-center gap-2">
            {headerExtras}
            
            <div className="relative">
                {user ? (
                    <button 
                        onClick={() => setIsProfileOpen(!isProfileOpen)}
                        className="p-2 hover:bg-stone-100 rounded-full text-stone-500 hover:text-stone-900 transition-colors"
                        title={user.email}
                    >
                        <User size={20} className="text-amber-600" />
                    </button>
                ) : (
                    <button 
                        onClick={() => setIsAuthModalOpen(true)}
                        className="p-2 hover:bg-stone-100 rounded-full text-stone-500 hover:text-stone-900 transition-colors"
                        title={t('login')}
                    >
                        <User size={20} />
                    </button>
                )}

                {isProfileOpen && user && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-stone-100 p-2 animate-in slide-in-from-top-2 duration-200">
                        <div className="px-3 py-2 border-b border-stone-50 mb-1">
                            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">{t('signedInAs')}</p>
                            <p className="text-sm font-medium text-stone-800 truncate">{user.email}</p>
                        </div>
                        <button 
                            onClick={handleSignOut}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-xl transition-colors font-medium"
                        >
                            <LogOut size={16} />
                            {t('signOut')}
                        </button>
                    </div>
                )}
            </div>

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
              <span className="hidden sm:inline">{t('addItem')}</span>
              <span className="sm:hidden">{t('add')}</span>
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 pb-24">
        {children}
      </main>

      <footer className="fixed bottom-0 left-0 w-full bg-gradient-to-t from-stone-50 via-stone-50 to-transparent pointer-events-none h-12 z-10" />
      
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </div>
  );
};
