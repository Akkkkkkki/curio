import React, { useEffect, useState } from 'react';
import {
  X,
  Mail,
  Lock,
  Loader2,
  Info,
  ShieldCheck,
  Zap,
  Cloud,
  KeyRound,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Button } from './ui/Button';
import {
  signInWithEmail,
  signUpWithEmail,
  isSupabaseConfigured,
  resetPasswordForEmail,
  updateUserPassword,
} from '../services/supabase';
import { useTranslation, TranslationKey } from '../i18n';
import { useTheme, panelSurfaceClasses, overlaySurfaceClasses, mutedTextClasses } from '../theme';

type Translate = (
  key: TranslationKey | (string & {}),
  params?: Record<string, string | number>,
) => string;

// Auth calls surface raw provider/browser strings on failure — a network drop
// yields the literal "Failed to fetch" and bad credentials yield Supabase's
// untranslated "Invalid login credentials". Neither is friendly or localized,
// so map the ones we recognize to translated copy and fall back to the generic
// authFailed message for anything unexpected. Exported for unit testing.
export const mapAuthErrorMessage = (raw: string, t: Translate): string => {
  const message = (raw || '').trim();
  if (
    /failed to fetch|networkerror|network (error|request failed)|load failed|fetch failed/i.test(
      message,
    )
  ) {
    return t('authNetworkError');
  }
  if (/invalid login credentials|invalid.*(email|password)|incorrect.*password/i.test(message)) {
    return t('authInvalidCredentials');
  }
  return message || t('authFailed');
};

export type AuthModalMode =
  | 'signin'
  | 'signup'
  | 'reset-request'
  | 'reset-sent'
  | 'confirm-email-sent'
  | 'set-password';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess?: () => void;
  /**
   * Mode the modal opens in. First-run CTAs pass 'signup' so new users are
   * greeted with account creation (CUR-152); the password-recovery redirect
   * passes 'set-password'. Defaults to 'signin'.
   */
  initialMode?: AuthModalMode;
}

const MIN_PASSWORD_LENGTH = 8;
const RESEND_COOLDOWN_SECONDS = 30;

type ResendStatus = 'idle' | 'sending' | 'sent' | 'error';

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
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resendStatus, setResendStatus] = useState<ResendStatus>('idle');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Reset state whenever the modal opens or a forced mode changes,
  // so a fresh open never leaks stale form values.
  useEffect(() => {
    if (!isOpen) return;
    setMode(initialMode ?? 'signin');
    setError(null);
    setPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setResendStatus('idle');
    setResendCooldown(0);
    // Keep the email only across the password-recovery redirect; ordinary
    // sign-in / sign-up opens always start with a blank form.
    if (initialMode !== 'set-password') setEmail('');
  }, [isOpen, initialMode]);

  // Tick the resend cooldown down to zero. Effect cleans itself up when
  // the cooldown hits 0, the modal closes, or the user leaves reset-sent.
  useEffect(() => {
    if (!isOpen || mode !== 'reset-sent' || resendCooldown <= 0) return;
    const id = window.setInterval(() => {
      setResendCooldown((s) => (s > 1 ? s - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [isOpen, mode, resendCooldown]);
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
        // A new reset-sent screen must start fresh: clear any stale
        // resend status / cooldown left over from a previous round so
        // the user sees an enabled Resend button and no leftover copy.
        setResendStatus('idle');
        setResendCooldown(0);
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
      if (mode === 'signup' && password.length < MIN_PASSWORD_LENGTH) {
        setError(t('passwordTooShort'));
        return;
      }
      if (mode === 'signup') {
        const { session } = await signUpWithEmail(email, password);
        if (!session) {
          // Email confirmation is required — the account exists but there is
          // no session yet. Closing here would drop the user back on the
          // access gate with no feedback, so show the check-your-email state
          // and hold the queued post-auth action (CUR-66).
          setSentToEmail(email);
          setMode('confirm-email-sent');
          return;
        }
      } else {
        await signInWithEmail(email, password);
      }
      onAuthSuccess?.();
      onClose();
    } catch (err: any) {
      const raw = err?.message || '';
      // Supabase returns a generic English string for short passwords on sign-up;
      // surface the friendly translated copy instead.
      if (mode === 'signup' && /password.*(short|characters)/i.test(raw)) {
        setError(t('passwordTooShort'));
      } else {
        setError(mapAuthErrorMessage(raw, t));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendResetLink = async () => {
    if (!sentToEmail || resendCooldown > 0 || resendStatus === 'sending') return;
    setResendStatus('sending');
    setError(null);
    try {
      await resetPasswordForEmail(sentToEmail);
      setResendStatus('sent');
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch {
      setResendStatus('error');
    }
  };

  const handleUseDifferentEmail = () => {
    setMode('reset-request');
    setError(null);
    setResendStatus('idle');
    setResendCooldown(0);
    // Keep `email` populated so the user can edit it instead of retyping.
  };

  const titleForMode = () => {
    switch (mode) {
      case 'reset-request':
      case 'reset-sent':
        return t('resetPasswordTitle');
      case 'confirm-email-sent':
        return t('confirmEmailTitle');
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
            <div className="space-y-4">
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
              <div className="space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12"
                  onClick={handleResendResetLink}
                  disabled={resendCooldown > 0 || resendStatus === 'sending'}
                  aria-busy={resendStatus === 'sending'}
                >
                  {resendStatus === 'sending' ? (
                    <span className="inline-flex items-center justify-center gap-2">
                      <Loader2 className="animate-spin" size={18} aria-hidden="true" />
                      <span>{t('resendingResetLink')}</span>
                    </span>
                  ) : resendCooldown > 0 ? (
                    t('resendResetLinkWait').replace('{seconds}', String(resendCooldown))
                  ) : (
                    t('resendResetLink')
                  )}
                </Button>
                {resendStatus === 'sent' && (
                  <p
                    role="status"
                    className={`text-[12px] ${theme === 'vault' ? 'text-emerald-300' : 'text-emerald-700'}`}
                  >
                    {t('resendResetLinkSuccess')}
                  </p>
                )}
                {resendStatus === 'error' && (
                  <p role="alert" className="text-[12px] text-red-600">
                    {t('resendResetLinkError')}
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleUseDifferentEmail}
                  className={`block w-full text-center text-[12px] font-semibold transition-colors py-1 ${theme === 'vault' ? 'text-white/70 hover:text-amber-300' : 'text-stone-500 hover:text-amber-600'}`}
                >
                  {t('useDifferentEmail')}
                </button>
              </div>
            </div>
          ) : mode === 'confirm-email-sent' ? (
            <div
              className={`p-4 rounded-2xl border flex gap-3 ${theme === 'vault' ? 'bg-white/5 border-white/10' : 'bg-emerald-50 border-emerald-100'}`}
              data-testid="confirm-email-sent"
            >
              <Mail className="text-emerald-600 shrink-0 mt-0.5" size={18} />
              <div className="space-y-1">
                <p
                  className={`text-[12px] font-bold ${theme === 'vault' ? 'text-white' : 'text-emerald-900'}`}
                >
                  {t('confirmEmailSentTitle')}
                </p>
                <p className={`text-[12px] ${mutedText} leading-relaxed`}>
                  {t('confirmEmailSentDesc').replace('{email}', sentToEmail)}
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
                      autoComplete="username"
                      inputMode="email"
                      className={`w-full pl-11 pr-4 py-3.5 rounded-2xl focus:ring-4 focus:ring-amber-500/5 focus:border-amber-200 outline-none font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed ${inputSurface}`}
                      placeholder={t('emailPlaceholder')}
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
                      type={showPassword ? 'text' : 'password'}
                      required
                      disabled={loading}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                      className={`w-full pl-11 pr-12 py-3.5 rounded-2xl focus:ring-4 focus:ring-amber-500/5 focus:border-amber-200 outline-none font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed ${inputSurface}`}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      disabled={loading}
                      aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                      aria-pressed={showPassword}
                      className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${theme === 'vault' ? 'text-stone-400 hover:text-white hover:bg-white/5' : 'text-stone-400 hover:text-stone-700 hover:bg-stone-100'}`}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {mode === 'signup' && (
                    <p className={`mt-1.5 text-[11px] ${mutedText}`}>{t('passwordMinHint')}</p>
                  )}
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
                        type={showNewPassword ? 'text' : 'password'}
                        required
                        disabled={loading}
                        minLength={MIN_PASSWORD_LENGTH}
                        autoComplete="new-password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className={`w-full pl-11 pr-12 py-3.5 rounded-2xl focus:ring-4 focus:ring-amber-500/5 focus:border-amber-200 outline-none font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed ${inputSurface}`}
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword((v) => !v)}
                        disabled={loading}
                        aria-label={showNewPassword ? t('hidePassword') : t('showPassword')}
                        aria-pressed={showNewPassword}
                        className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${theme === 'vault' ? 'text-stone-400 hover:text-white hover:bg-white/5' : 'text-stone-400 hover:text-stone-700 hover:bg-stone-100'}`}
                      >
                        {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <p className={`mt-1.5 text-[11px] ${mutedText}`}>{t('passwordMinHint')}</p>
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
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        disabled={loading}
                        minLength={MIN_PASSWORD_LENGTH}
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={`w-full pl-11 pr-12 py-3.5 rounded-2xl focus:ring-4 focus:ring-amber-500/5 focus:border-amber-200 outline-none font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed ${inputSurface}`}
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((v) => !v)}
                        disabled={loading}
                        aria-label={showConfirmPassword ? t('hidePassword') : t('showPassword')}
                        aria-pressed={showConfirmPassword}
                        className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${theme === 'vault' ? 'text-stone-400 hover:text-white hover:bg-white/5' : 'text-stone-400 hover:text-stone-700 hover:bg-stone-100'}`}
                      >
                        {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {mode !== 'reset-sent' && mode !== 'confirm-email-sent' && (
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

          {mode === 'signup' && (
            <p
              className={`text-[11px] leading-relaxed text-center ${mutedText}`}
              data-testid="signup-legal-consent"
            >
              {t('signupLegalConsentLead')}
              <a
                href="#/legal/terms"
                target="_blank"
                rel="noopener noreferrer"
                className={`font-semibold underline-offset-2 hover:underline transition-colors ${
                  theme === 'vault'
                    ? 'text-[#D4A574] hover:text-[#E0B585]'
                    : theme === 'atelier'
                      ? 'text-[#A86F3C] hover:text-[#8B5A2B]'
                      : 'text-amber-700 hover:text-amber-800'
                }`}
              >
                {t('termsOfService')}
              </a>
              {t('signupLegalConsentAnd')}
              <a
                href="#/legal/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className={`font-semibold underline-offset-2 hover:underline transition-colors ${
                  theme === 'vault'
                    ? 'text-[#D4A574] hover:text-[#E0B585]'
                    : theme === 'atelier'
                      ? 'text-[#A86F3C] hover:text-[#8B5A2B]'
                      : 'text-amber-700 hover:text-amber-800'
                }`}
              >
                {t('privacyPolicy')}
              </a>
              {t('signupLegalConsentTail')}
            </p>
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
            ) : mode === 'reset-request' ||
              mode === 'reset-sent' ||
              mode === 'confirm-email-sent' ? (
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
