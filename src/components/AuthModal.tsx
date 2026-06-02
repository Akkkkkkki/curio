import React, { useEffect, useState } from 'react';
import { X, Mail, Lock, Loader2, Info, ShieldCheck, Zap, Cloud, KeyRound } from 'lucide-react';
import { Button } from './ui/Button';
import {
  signInWithEmail,
  signUpWithEmail,
  isSupabaseConfigured,
  resetPasswordForEmail,
  updateUserPassword,
} from '../services/supabase';
import { useTranslation } from '../i18n';
import { useTheme, panelSurfaceClasses, overlaySurfaceClasses, mutedTextClasses } from '../theme';

export type AuthModalMode = 'signin' | 'signup' | 'reset-request' | 'reset-sent' | 'set-password';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess?: () => void;
  /** Forces the modal to open in a specific mode. Used for the password-recovery redirect. */
  initialMode?: AuthModalMode;
}

const MIN_PASSWORD_LENGTH = 8;

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
  initialMode,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [mode, setMode] = useState<AuthModalMode>(initialMode ?? 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentToEmail, setSentToEmail] = useState('');

  // Reset state whenever the modal opens or a forced mode changes,
  // so a fresh open never leaks stale form values.
  useEffect(() => {
    if (!isOpen) return;
    setMode(initialMode ?? 'signin');
    setError(null);
    setPassword('');
    setNewPassword('');
    setConfirmPassword('');
    if (!initialMode) setEmail('');
  }, [isOpen, initialMode]);
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const lastFocusedElementRef = React.useRef<HTMLElement | null>(null);

  const supabaseActive = isSupabaseConfigured();
  const surfaceClass = panelSurfaceClasses[theme];
  const overlayClass = `${overlaySurfaceClasses[theme]} motion-overlay`;
  const dividerBorder = theme === 'vault' ? 'border-white/10' : 'border-stone-100';
  const mutedText = mutedTextClasses[theme];
  const inputSurface =
    theme === 'vault'
      ? 'bg-white/5 border border-white/10 text-white placeholder:text-stone-400'
      : 'bg-stone-50 border border-stone-200 text-stone-900';

  // Basic modal a11y: Escape-to-close, focus trap, and focus restore.
  React.useEffect(() => {
    if (!isOpen) return;
    lastFocusedElementRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;

    requestAnimationFrame(() => {
      const firstFocusable = dialog?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      firstFocusable?.focus?.();
    });

    const getFocusable = () => {
      const el = dialogRef.current;
      if (!el) return [];
      return Array.from(
        el.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((n) => n.offsetParent !== null);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key !== 'Tab') return;
      const focusable = getFocusable();
      if (focusable.length === 0) return;

      const active = document.activeElement as HTMLElement | null;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const isInside = active ? focusable.includes(active) : false;

      if (!isInside) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
        return;
      }

      if (e.shiftKey) {
        if (!active || active === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      lastFocusedElementRef.current?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  if (!supabaseActive) {
    return (
      <div
        className={`fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 ${overlayClass} backdrop-blur-md`}
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="auth-modal-title"
          data-testid="auth-modal"
          className={`${surfaceClass} rounded-t-[2.5rem] rounded-b-none sm:rounded-[2.5rem] shadow-2xl w-full max-w-md h-[100dvh] sm:h-auto max-h-[100dvh] overflow-hidden flex flex-col border motion-panel pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] sm:pt-0 sm:pb-0`}
        >
          <div className="sm:hidden h-3" />
          <div className={`flex items-center justify-between p-8 border-b ${dividerBorder}`}>
            <div>
              <h2
                id="auth-modal-title"
                className={`font-serif font-bold text-2xl ${theme === 'vault' ? 'text-white' : 'text-stone-800'}`}
              >
                {t('cloudRequiredTitle')}
              </h2>
              <p className={`text-[11px] font-bold uppercase tracking-[0.14em] ${mutedText} mt-1`}>
                {t('cloudRequiredStatus')}
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label={t('close')}
              className={`p-2 -mr-2 rounded-full transition-colors ${theme === 'vault' ? 'hover:bg-white/5 text-stone-300 hover:text-white' : 'hover:bg-stone-100 text-stone-400 hover:text-stone-800'}`}
            >
              <X size={24} />
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-8 pb-24 sm:pb-8 space-y-4">
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
      if (mode === 'reset-request') {
        await resetPasswordForEmail(email);
        setSentToEmail(email);
        setMode('reset-sent');
        return;
      }
      if (mode === 'set-password') {
        if (newPassword.length < MIN_PASSWORD_LENGTH) {
          setError(t('passwordTooShort'));
          return;
        }
        if (newPassword !== confirmPassword) {
          setError(t('passwordsDontMatch'));
          return;
        }
        await updateUserPassword(newPassword);
        onAuthSuccess?.();
        onClose();
        return;
      }
      await (mode === 'signin'
        ? signInWithEmail(email, password)
        : signUpWithEmail(email, password));
      onAuthSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message || t('authFailed'));
    } finally {
      setLoading(false);
    }
  };

  const titleForMode = () => {
    switch (mode) {
      case 'reset-request':
      case 'reset-sent':
        return t('resetPasswordTitle');
      case 'set-password':
        return t('setPasswordTitle');
      case 'signup':
        return t('registerTitle');
      default:
        return t('loginTitle');
    }
  };

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 ${overlayClass} backdrop-blur-md`}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        data-testid="auth-modal"
        className={`${surfaceClass} rounded-t-[2.5rem] rounded-b-none sm:rounded-[2.5rem] shadow-2xl w-full max-w-md h-[100dvh] sm:h-auto max-h-[100dvh] overflow-hidden flex flex-col border motion-panel pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] sm:pt-0 sm:pb-0`}
      >
        <div className="sm:hidden flex items-center justify-center pt-2">
          <span
            className={`${theme === 'vault' ? 'bg-white/20' : 'bg-stone-200'} h-1.5 w-12 rounded-full`}
          />
        </div>
        <div className={`flex items-center justify-between p-8 border-b ${dividerBorder}`}>
          <div>
            <h2
              id="auth-modal-title"
              className={`font-serif font-bold text-2xl ${theme === 'vault' ? 'text-white' : 'text-stone-800'}`}
            >
              {titleForMode()}
            </h2>
            <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-[0.14em] mt-1 flex items-center gap-1">
              <Cloud size={10} /> {t('cloudSyncActive')}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label={t('close')}
            className={`p-2 -mr-2 rounded-full transition-colors ${theme === 'vault' ? 'hover:bg-white/5 text-stone-300 hover:text-white' : 'hover:bg-stone-100 text-stone-400 hover:text-stone-800'}`}
          >
            <X size={24} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex-1 min-h-0 overflow-y-auto px-8 pb-24 pt-6 sm:pb-8 space-y-6"
        >
          {(mode === 'signin' || mode === 'signup') && (
            <div className="space-y-4">
              <div
                className={`p-4 rounded-2xl border flex gap-3 ${theme === 'vault' ? 'bg-white/5 border-white/10' : 'bg-amber-50 border-amber-100'}`}
              >
                <Info className="text-amber-600 shrink-0 mt-0.5" size={18} />
                <div className="space-y-1">
                  <p className="text-[12px] font-bold text-amber-900">{t('cloudSyncTitle')}</p>
                  <p className={`text-[11px] ${mutedText} leading-relaxed`}>{t('cloudSyncDesc')}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div
                  className={`p-3 rounded-xl border ${theme === 'vault' ? 'bg-white/5 border-white/10 text-white' : 'bg-stone-50 border-stone-100'}`}
                >
                  <ShieldCheck size={14} className={`${mutedText} mb-1`} />
                  <p
                    className={`text-[11px] font-bold uppercase tracking-tight ${theme === 'vault' ? 'text-white' : 'text-stone-700'}`}
                  >
                    {t('authPrivateTitle')}
                  </p>
                  <p className={`text-[11px] ${mutedText}`}>{t('authPrivateDesc')}</p>
                </div>
                <div
                  className={`p-3 rounded-xl border ${theme === 'vault' ? 'bg-white/5 border-white/10 text-white' : 'bg-stone-50 border-stone-100'}`}
                >
                  <Zap size={14} className={`${mutedText} mb-1`} />
                  <p
                    className={`text-[11px] font-bold uppercase tracking-tight ${theme === 'vault' ? 'text-white' : 'text-stone-700'}`}
                  >
                    {t('authFastTitle')}
                  </p>
                  <p className={`text-[11px] ${mutedText}`}>{t('authFastDesc')}</p>
                </div>
              </div>
            </div>
          )}

          {mode === 'reset-request' && (
            <p className={`text-sm ${mutedText} leading-relaxed`}>{t('resetPasswordDesc')}</p>
          )}

          {mode === 'set-password' && (
            <p className={`text-sm ${mutedText} leading-relaxed`}>{t('setPasswordDesc')}</p>
          )}

          {error && (
            <div
              role="alert"
              className="p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100 font-medium animate-in slide-in-from-top-1"
            >
              {error}
            </div>
          )}

          {mode === 'reset-sent' ? (
            <div
              className={`p-4 rounded-2xl border flex gap-3 ${theme === 'vault' ? 'bg-white/5 border-white/10' : 'bg-emerald-50 border-emerald-100'}`}
            >
              <Mail className="text-emerald-600 shrink-0 mt-0.5" size={18} />
              <div className="space-y-1">
                <p
                  className={`text-[12px] font-bold ${theme === 'vault' ? 'text-white' : 'text-emerald-900'}`}
                >
                  {t('resetEmailSentTitle')}
                </p>
                <p className={`text-[12px] ${mutedText} leading-relaxed`}>
                  {t('resetEmailSentDesc').replace('{email}', sentToEmail)}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {(mode === 'signin' || mode === 'signup' || mode === 'reset-request') && (
                <div>
                  <label
                    className={`block text-[11px] font-semibold uppercase tracking-[0.12em] ${mutedText} mb-1.5`}
                  >
                    {t('email')}
                  </label>
                  <div className="relative">
                    <Mail
                      className={`absolute left-4 top-1/2 -translate-y-1/2 ${mutedText}`}
                      size={16}
                    />
                    <input
                      type="email"
                      required
                      disabled={loading}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={`w-full pl-11 pr-4 py-3.5 rounded-2xl focus:ring-4 focus:ring-amber-500/5 focus:border-amber-200 outline-none font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed ${inputSurface}`}
                      placeholder="curator@museum.com"
                    />
                  </div>
                </div>
              )}

              {(mode === 'signin' || mode === 'signup') && (
                <div>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <label
                      className={`block text-[11px] font-semibold uppercase tracking-[0.12em] ${mutedText}`}
                    >
                      {t('password')}
                    </label>
                    {mode === 'signin' && (
                      <button
                        type="button"
                        onClick={() => {
                          setMode('reset-request');
                          setError(null);
                        }}
                        className={`text-[11px] font-semibold transition-colors ${theme === 'vault' ? 'text-stone-300 hover:text-amber-300' : 'text-stone-500 hover:text-amber-600'}`}
                      >
                        {t('forgotPassword')}
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock
                      className={`absolute left-4 top-1/2 -translate-y-1/2 ${mutedText}`}
                      size={16}
                    />
                    <input
                      type="password"
                      required
                      disabled={loading}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`w-full pl-11 pr-4 py-3.5 rounded-2xl focus:ring-4 focus:ring-amber-500/5 focus:border-amber-200 outline-none font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed ${inputSurface}`}
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              )}

              {mode === 'set-password' && (
                <>
                  <div>
                    <label
                      htmlFor="auth-new-password"
                      className={`block text-[11px] font-semibold uppercase tracking-[0.12em] ${mutedText} mb-1.5`}
                    >
                      {t('newPassword')}
                    </label>
                    <div className="relative">
                      <KeyRound
                        className={`absolute left-4 top-1/2 -translate-y-1/2 ${mutedText}`}
                        size={16}
                      />
                      <input
                        id="auth-new-password"
                        type="password"
                        required
                        disabled={loading}
                        minLength={MIN_PASSWORD_LENGTH}
                        autoComplete="new-password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className={`w-full pl-11 pr-4 py-3.5 rounded-2xl focus:ring-4 focus:ring-amber-500/5 focus:border-amber-200 outline-none font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed ${inputSurface}`}
                        placeholder="••••••••"
                      />
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="auth-confirm-password"
                      className={`block text-[11px] font-semibold uppercase tracking-[0.12em] ${mutedText} mb-1.5`}
                    >
                      {t('confirmNewPassword')}
                    </label>
                    <div className="relative">
                      <Lock
                        className={`absolute left-4 top-1/2 -translate-y-1/2 ${mutedText}`}
                        size={16}
                      />
                      <input
                        id="auth-confirm-password"
                        type="password"
                        required
                        disabled={loading}
                        minLength={MIN_PASSWORD_LENGTH}
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={`w-full pl-11 pr-4 py-3.5 rounded-2xl focus:ring-4 focus:ring-amber-500/5 focus:border-amber-200 outline-none font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed ${inputSurface}`}
                        placeholder="••••••••"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {mode !== 'reset-sent' && (
            <Button
              type="submit"
              className="w-full h-14 text-lg"
              disabled={loading}
              aria-busy={loading}
            >
              {loading ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Loader2 className="animate-spin" size={20} aria-hidden="true" />
                  <span>
                    {mode === 'signin'
                      ? t('signingIn')
                      : mode === 'signup'
                        ? t('creatingAccount')
                        : mode === 'reset-request'
                          ? t('sendingResetLink')
                          : t('savingPassword')}
                  </span>
                </span>
              ) : mode === 'signin' ? (
                t('login')
              ) : mode === 'signup' ? (
                t('register')
              ) : mode === 'reset-request' ? (
                t('sendResetLink')
              ) : (
                t('savePassword')
              )}
            </Button>
          )}

          <div className="text-center pt-2">
            {mode === 'signin' || mode === 'signup' ? (
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'signin' ? 'signup' : 'signin');
                  setError(null);
                }}
                className={`text-sm font-semibold transition-colors ${theme === 'vault' ? 'text-white/70 hover:text-amber-300' : 'text-stone-500 hover:text-amber-600'}`}
              >
                {mode === 'signin' ? t('noAccount') : t('hasAccount')}
              </button>
            ) : mode === 'reset-request' || mode === 'reset-sent' ? (
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setError(null);
                }}
                className={`text-sm font-semibold transition-colors ${theme === 'vault' ? 'text-white/70 hover:text-amber-300' : 'text-stone-500 hover:text-amber-600'}`}
              >
                {t('backToSignIn')}
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
};
