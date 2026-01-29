import React from 'react';
import { AlertCircle, Info, AlertTriangle, CheckCircle } from 'lucide-react';
import { useTheme } from '../theme';

export type BannerTone = 'info' | 'warning' | 'error' | 'success';

interface StatusBannerProps {
  title: string;
  message: string;
  tone?: BannerTone;
  actionLabel?: string;
  onAction?: () => void;
}

const toneStyles: Record<
  BannerTone,
  { bg: string; text: string; border: string; Icon: React.ComponentType<any> }
> = {
  info: {
    bg: 'bg-stone-50',
    text: 'text-stone-700',
    border: 'border-stone-200',
    Icon: Info,
  },
  warning: {
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
    Icon: AlertTriangle,
  },
  error: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    Icon: AlertCircle,
  },
  success: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    Icon: CheckCircle,
  },
};

export const StatusBanner: React.FC<StatusBannerProps> = ({
  title,
  message,
  tone = 'info',
  actionLabel,
  onAction,
}) => {
  const { theme } = useTheme();
  const { bg, text, border, Icon } = toneStyles[tone];
  const vaultSurface = theme === 'vault' ? 'bg-white/5 text-white/80 border-white/10' : '';
  const actionClass =
    theme === 'vault'
      ? 'text-amber-200 hover:text-amber-100'
      : 'text-amber-700 hover:text-amber-900';

  return (
    <div
      className={`rounded-2xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 shadow-sm ${bg} ${text} ${border} ${vaultSurface}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2">
        <Icon size={18} />
        <span className="font-semibold">{title}</span>
      </div>
      <p className="text-sm flex-1">{message}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className={`text-xs font-bold uppercase tracking-[0.12em] ${actionClass}`}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
