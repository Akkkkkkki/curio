
import React, { useState } from 'react';
import { X, Mail, Lock, Loader2, Info, Database } from 'lucide-react';
import { Button } from './ui/Button';
import { signInWithEmail, signUpWithEmail, isSupabaseConfigured } from '../services/supabase';
import { useTranslation } from '../i18n';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabaseActive = isSupabaseConfigured();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await (mode === 'signin' ? signInWithEmail(email, password) : signUpWithEmail(email, password));
      onClose();
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden flex flex-col border border-stone-200">
        <div className="flex items-center justify-between p-8 border-b border-stone-100">
          <div>
            <h2 className="font-serif font-bold text-2xl text-stone-800">
              {mode === 'signin' ? t('loginTitle') : t('registerTitle')}
            </h2>
            {!supabaseActive && (
              <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mt-1 flex items-center gap-1">
                <Database size={10} /> {t('localArchiveMode')}
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full text-stone-400 hover:text-stone-800 transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 pt-6 space-y-6">
          {!supabaseActive && (
            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3">
              <Info className="text-amber-600 shrink-0" size={18} />
              <p className="text-xs text-amber-900 leading-relaxed">
                {t('supabaseNotice')}
              </p>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100 font-medium animate-in slide-in-from-top-1">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1.5">{t('email')}</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" size={16} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-4 focus:ring-amber-500/5 focus:border-amber-200 outline-none font-medium transition-all"
                  placeholder="curator@museum.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1.5">{t('password')}</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" size={16} />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-4 focus:ring-amber-500/5 focus:border-amber-200 outline-none font-medium transition-all"
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
              className="text-sm font-semibold text-stone-500 hover:text-amber-600 transition-colors"
            >
              {mode === 'signin' ? t('noAccount') : t('hasAccount')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
