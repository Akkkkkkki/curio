import React, { useRef, useState } from 'react';
import { CheckCircle, AlertTriangle, Info, AlertCircle } from 'lucide-react';
import { useTranslation } from '../i18n';
import { useTheme } from '../theme';
import { AppTheme } from '../types';

export type StatusTone = 'success' | 'error' | 'info' | 'warning';

interface StatusToastProps {
  message: string;
  tone?: StatusTone;
  onDismiss?: () => void;
  actionLabel?: string;
  onAction?: () => void;
}

// Minimum vertical travel before a swipe is treated as dismiss intent — keeps
// a passive read or accidental brush from clearing the toast.
const SWIPE_DISMISS_DISTANCE = 48;

// Toast on-screen time. Trust-bearing tones (Saved / Synced / Will sync / Sync
// error) need at least ~3s on mobile so users can read them; info recovery
// notes can clear faster (CUR-109). Action toasts stay longest so the user
// can actually reach the button.
export const STATUS_TOAST_DURATIONS = {
  withAction: 6000,
  trust: 3500,
  info: 2400,
} as const;

export const getStatusToastDurationMs = (
  tone: StatusTone,
  options?: { actionLabel?: string; durationMs?: number },
): number => {
  if (options?.durationMs != null) return options.durationMs;
  if (options?.actionLabel != null) return STATUS_TOAST_DURATIONS.withAction;
  return tone === 'info' ? STATUS_TOAST_DURATIONS.info : STATUS_TOAST_DURATIONS.trust;
};

// Toast tones keep their semantic hue across the three themes, with luminance
// tuned so each surface sits clearly above the page beneath it (white in
// Gallery, near-black in Vault, warm cream in Atelier). Mirrors the
// StatusBanner palette (CUR-81) — toast is the most frequent trust surface
// in the app, so the two should feel like one system.
const toneSurfaceClasses: Record<StatusTone, Record<AppTheme, string>> = {
  success: {
    gallery: 'bg-emerald-50 text-emerald-800 border-emerald-100',
    vault: 'bg-emerald-500/10 text-emerald-200 border-emerald-400/30',
    atelier: 'bg-emerald-100/70 text-emerald-900 border-emerald-300/60',
  },
  error: {
    gallery: 'bg-red-50 text-red-700 border-red-100',
    vault: 'bg-red-500/10 text-red-200 border-red-400/30',
    atelier: 'bg-red-100/70 text-red-800 border-red-300/60',
  },
  info: {
    gallery: 'bg-stone-50 text-stone-700 border-stone-200',
    vault: 'bg-white/5 text-stone-200 border-white/10',
    atelier: 'bg-[#EDE4D3] text-[#3D3530] border-[#D4C9B8]',
  },
  warning: {
    gallery: 'bg-amber-50 text-amber-800 border-amber-100',
    vault: 'bg-amber-500/10 text-amber-200 border-amber-400/20',
    atelier: 'bg-amber-100/70 text-amber-900 border-amber-300/60',
  },
};

const toneIcons: Record<StatusTone, React.ComponentType<{ size?: number }>> = {
  success: CheckCircle,
  error: AlertTriangle,
  info: Info,
  warning: AlertCircle,
};

const actionClasses: Record<AppTheme, string> = {
  gallery: 'text-amber-700 hover:text-amber-900',
  vault: 'text-amber-200 hover:text-amber-100',
  atelier: 'text-[#A86F3C] hover:text-[#8B5A2B]',
};

const dismissClasses: Record<AppTheme, string> = {
  gallery: 'text-stone-400 hover:text-stone-600',
  vault: 'text-stone-400 hover:text-stone-200',
  atelier: 'text-[#8B7355] hover:text-[#3D3530]',
};

export const StatusToast: React.FC<StatusToastProps> = ({
  message,
  tone = 'info',
  onDismiss,
  actionLabel,
  onAction,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const surface = toneSurfaceClasses[tone][theme];
  const Icon = toneIcons[tone];
  const touchStartYRef = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  // Mobile swipe-to-dismiss: toast sits at the bottom of the screen, so a
  // downward drag is the natural "push away" gesture. We track vertical travel
  // and only commit a dismiss past SWIPE_DISMISS_DISTANCE — anything less
  // springs back so a near-tap doesn't clear feedback the user is still
  // reading. No-ops if there's no onDismiss handler.
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!onDismiss) return;
    touchStartYRef.current = e.touches[0].clientY;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartYRef.current == null) return;
    const delta = e.touches[0].clientY - touchStartYRef.current;
    setDragOffset(delta > 0 ? delta : 0);
  };
  const handleTouchEnd = () => {
    if (touchStartYRef.current == null) return;
    const committed = dragOffset >= SWIPE_DISMISS_DISTANCE;
    touchStartYRef.current = null;
    setDragOffset(0);
    if (committed) onDismiss?.();
  };
  const handleTouchCancel = () => {
    touchStartYRef.current = null;
    setDragOffset(0);
  };

  const isDragging = dragOffset > 0;
  const dragStyle = isDragging
    ? { transform: `translateY(${dragOffset}px)`, transition: 'none' as const }
    : undefined;

  return (
    <div
      data-testid="status-toast"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      style={dragStyle}
      className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-lg touch-pan-x select-none ${surface} ${isDragging ? '' : 'motion-pop'}`}
    >
      <Icon size={18} />
      <span className="text-sm font-semibold leading-tight" data-testid="status-toast-message">
        {message}
      </span>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className={`ml-2 text-xs font-bold uppercase tracking-[0.08em] ${actionClasses[theme]}`}
        >
          {actionLabel}
        </button>
      )}
      {onDismiss && (
        <button
          onClick={onDismiss}
          className={`ml-2 text-xs font-bold uppercase tracking-[0.08em] ${dismissClasses[theme]}`}
        >
          {t('close')}
        </button>
      )}
    </div>
  );
};
