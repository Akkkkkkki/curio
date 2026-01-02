
import React, { useState } from 'react';
import { X, Mail, Lock, Loader2, Info, ShieldCheck, Zap, Cloud } from 'lucide-react';
import { Button } from './ui/Button';
import { signInWithEmail, signUpWithEmail, isSupabaseConfigured } from '../services/supabase';
import { useTranslation } from '../i18n';
import { useTheme, panelSurfaceClasses, overlaySurfaceClasses, mutedTextClasses } from '../theme';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onAuthSuccess }) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabaseActive = isSupabaseConfigured();
  const surfaceClass = panelSurfaceClasses[theme];
  const overlayClass = `${overlaySurfaceClasses[theme]} motion-overlay`;
  const dividerBorder = theme === 'vault' ? 'border-white/10' : 'border-stone-100';
  const mutedText = mutedTextClasses[theme];
  const inputSurface = theme === 'vault' ? 'bg-white/5 border border-white/10 text-white placeholder:text-stone-400' : 'bg-stone-50 border border-stone-200 text-stone-900';

  if (!isOpen) return null;

  if (!supabaseActive) {
    return (
      <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pl-[calc(1rem+env(safe-area-inset-left,0px))] pr-[calc(1rem+env(safe-area-inset-right,0px))] ${overlayClass} backdrop-blur-md`}>
        <div className={`${surfaceClass} rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden flex flex-col border motion-panel`}>
          <div className={`flex items-center justify-between p-8 border-b ${dividerBorder}`}>
            <div>
              <h2 className={`font-serif font-bold text-2xl ${theme === 'vault' ? 'text-white' : 'text-stone-800'}`}>
                {t('cloudRequiredTitle')}
              </h2>
              <p className={`text-[11px] font-bold uppercase tracking-[0.14em] ${mutedText} mt-1`}>
                {t('cloudRequiredStatus')}
              </p>
            </div>
            <button onClick={onClose} className={`p-2 -mr-2 rounded-full transition-colors ${theme === 'vault' ? 'hover:bg-white/5 text-stone-300 hover:text-white' : 'hover:bg-stone-100 text-stone-400 hover:text-stone-800'}`}>
              <X size={24} />
            </button>
          </div>
          <div className="p-8 space-y-4">
            <p className={`text-sm ${mutedText}`}>{t('cloudRequiredDesc')}</p>
            <Button type="button" className="w-full h-12" onClick={onClose}>
              {t('close')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await (mode === 'signin' ? signInWithEmail(email, password) : signUpWithEmail(email, password));
      onAuthSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pl-[calc(1rem+env(safe-area-inset-left,0px))] pr-[calc(1rem+env(safe-area-inset-right,0px))] ${overlayClass} backdrop-blur-md`}>
      <div className={`${surfaceClass} rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden flex flex-col border motion-panel`}>
        <div className={`flex items-center justify-between p-8 border-b ${dividerBorder}`}>
          <div>
            <h2 className={`font-serif font-bold text-2xl ${theme === 'vault' ? 'text-white' : 'text-stone-800'}`}>
              {mode === 'signin' ? t('loginTitle') : t('registerTitle')}
            </h2>
            <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-[0.14em] mt-1 flex items-center gap-1">
              <Cloud size={10} /> {t('cloudSyncActive')}
            </p>
          </div>
          <button onClick={onClose} className={`p-2 -mr-2 rounded-full transition-colors ${theme === 'vault' ? 'hover:bg-white/5 text-stone-300 hover:text-white' : 'hover:bg-stone-100 text-stone-400 hover:text-stone-800'}`}>
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 pt-6 space-y-6">
          <div className="space-y-4">
            <div className={`p-4 rounded-2xl border flex gap-3 ${theme === 'vault' ? 'bg-white/5 border-white/10' : 'bg-amber-50 border-amber-100'}`}>
              <Info className="text-amber-600 shrink-0 mt-0.5" size={18} />
              <div className="space-y-1">
                  <p className="text-[12px] font-bold text-amber-900">
                    {t('cloudSyncTitle')}
                  </p>
                  <p className={`text-[11px] ${mutedText} leading-relaxed`}>
                      {t('cloudSyncDesc')}
                  </p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
                <div className={`p-3 rounded-xl border ${theme === 'vault' ? 'bg-white/5 border-white/10 text-white' : 'bg-stone-50 border-stone-100'}`}>
                    <ShieldCheck size={14} className={`${mutedText} mb-1`} />
                    <p className={`text-[11px] font-bold uppercase tracking-tight ${theme === 'vault' ? 'text-white' : 'text-stone-700'}`}>Private</p>
                    <p className={`text-[11px] ${mutedText}`}>Your data is yours alone.</p>
                </div>
                <div className={`p-3 rounded-xl border ${theme === 'vault' ? 'bg-white/5 border-white/10 text-white' : 'bg-stone-50 border-stone-100'}`}>
                    <Zap size={14} className={`${mutedText} mb-1`} />
                    <p className={`text-[11px] font-bold uppercase tracking-tight ${theme === 'vault' ? 'text-white' : 'text-stone-700'}`}>Fast</p>
                    <p className={`text-[11px] ${mutedText}`}>Optimized for speed & offline.</p>
                </div>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100 font-medium animate-in slide-in-from-top-1">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className={`block text-[11px] font-semibold uppercase tracking-[0.12em] ${mutedText} mb-1.5`}>{t('email')}</label>
              <div className="relative">
                <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 ${mutedText}`} size={16} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full pl-11 pr-4 py-3.5 rounded-2xl focus:ring-4 focus:ring-amber-500/5 focus:border-amber-200 outline-none font-medium transition-all ${inputSurface}`}
                  placeholder="curator@museum.com"
                />
              </div>
            </div>

            <div>
              <label className={`block text-[11px] font-semibold uppercase tracking-[0.12em] ${mutedText} mb-1.5`}>{t('password')}</label>
              <div className="relative">
                <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 ${mutedText}`} size={16} />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full pl-11 pr-4 py-3.5 rounded-2xl focus:ring-4 focus:ring-amber-500/5 focus:border-amber-200 outline-none font-medium transition-all ${inputSurface}`}
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>

          <Button type="submit" className="w-full h-14 text-lg" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" size={20} /> : (mode === 'signin' ? t('login') : t('register'))}
          </Button>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
              className={`text-sm font-semibold transition-colors ${theme === 'vault' ? 'text-white/70 hover:text-amber-300' : 'text-stone-500 hover:text-amber-600'}`}
            >
              {mode === 'signin' ? t('noAccount') : t('hasAccount')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
