
import React, { useState } from 'react';
import { Home, Plus, User, LogOut, Cloud, CloudOff, Zap, ArrowUpRight, Download } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from '../i18n';

interface LayoutProps {
  children: React.ReactNode;
  onAddItem: () => void;
  onOpenAuth: () => void;
  onSignOut: () => void;
  onImportLocal?: () => void;
  hasLocalImport?: boolean;
  importState?: 'idle' | 'running' | 'done' | 'error';
  importMessage?: string | null;
  user: any | null;
  isSupabaseConfigured: boolean;
  headerExtras?: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children, onAddItem, onOpenAuth, onSignOut, onImportLocal, hasLocalImport = false, importState = 'idle', importMessage = null, user, isSupabaseConfigured, headerExtras }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const isHome = location.pathname === '/';
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const isAuthenticated = Boolean(user);
  const statusLabel = !isSupabaseConfigured
    ? t('cloudRequiredStatus')
    : isAuthenticated
      ? t('authStatusSignedIn')
      : t('authStatusSignedOut');
  const statusDesc = !isSupabaseConfigured
    ? t('cloudRequiredDesc')
    : isAuthenticated
      ? t('authDescSignedIn', { email: user?.email })
      : t('authDescSignedOut');
  const statusIcon = !isSupabaseConfigured ? <CloudOff size={18} /> : <Cloud size={18} />;
  const statusColor = !isSupabaseConfigured
    ? 'text-stone-400'
    : isAuthenticated
      ? 'text-emerald-600'
      : 'text-amber-600';

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
                {!isSupabaseConfigured ? (
                    <CloudOff size={10} className="text-stone-400" />
                ) : (
                    <Cloud size={10} className={isAuthenticated ? "text-emerald-600" : "text-amber-600"} />
                )}
                <span className="text-[8px] font-bold uppercase tracking-widest">
                    {statusLabel}
                </span>
              </div>
            </div>
          </Link>
          
          <nav className="flex items-center gap-2">
            {headerExtras}
            
            <div className="relative">
                <button 
                    onClick={() => setIsProfileOpen(!isProfileOpen)}
                    className={`p-2 hover:bg-stone-100 rounded-full transition-colors ${statusColor}`}
                >
                    <User size={20} />
                </button>

                {isProfileOpen && (
                    <div className="absolute right-0 mt-2 w-72 bg-white rounded-[1.5rem] shadow-2xl border border-stone-100 p-2 animate-in slide-in-from-top-2 duration-200 z-50">
                        <div className="p-4 border-b border-stone-50 mb-1">
                            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">{t('authStatus')}</p>
                            
                            <div className="flex items-start gap-3 mt-3">
                                <div className={`p-2 rounded-xl ${isSupabaseConfigured ? (isAuthenticated ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600') : 'bg-stone-50 text-stone-400'}`}>
                                    {statusIcon}
                                </div>
                                <div className="flex-1 overflow-hidden">
                                    <p className="text-sm font-bold text-stone-900">
                                        {statusLabel}
                                    </p>
                                    <p className="text-[11px] text-stone-500 leading-snug">
                                        {statusDesc}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {isAuthenticated ? (
                            <button 
                                onClick={() => { onSignOut(); setIsProfileOpen(false); }}
                                className="w-full flex items-center gap-2 px-4 py-3 text-sm text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors font-medium"
                            >
                                <LogOut size={16} />
                                {t('signOut')}
                            </button>
                        ) : (
                            <div className="p-2">
                                <button 
                                    onClick={() => { onOpenAuth(); setIsProfileOpen(false); }}
                                    className="w-full flex items-center justify-between px-4 py-3 text-sm rounded-xl transition-all font-bold bg-stone-900 text-white hover:bg-stone-800"
                                >
                                    <div className="flex items-center gap-2">
                                        <Zap size={16} />
                                        {t('login')}
                                    </div>
                                    <ArrowUpRight size={16} className="opacity-50" />
                                </button>
                            </div>
                        )}

                        {hasLocalImport && isAuthenticated && onImportLocal && (
                            <div className="p-2 border-t border-stone-50">
                                <div className="p-3 rounded-xl border border-amber-100 bg-amber-50/60">
                                    <p className="text-[10px] font-bold text-amber-900 uppercase tracking-widest mb-1">{t('importLocalTitle')}</p>
                                    <p className="text-[11px] text-stone-600 leading-snug mb-3">{t('importLocalDesc')}</p>
                                    <button
                                        onClick={onImportLocal}
                                        disabled={importState === 'running'}
                                        className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-60"
                                    >
                                        <Download size={14} />
                                        {importState === 'running' ? t('importing') : t('importLocalAction')}
                                    </button>
                                    {importMessage && (
                                        <p className={`text-[10px] mt-2 ${importState === 'error' ? 'text-red-500' : 'text-amber-700'}`}>
                                            {importMessage}
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
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
              <span className="hidden sm:inline">{isAuthenticated ? t('addItem') : t('login')}</span>
              <span className="sm:hidden">{isAuthenticated ? t('add') : t('login')}</span>
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
