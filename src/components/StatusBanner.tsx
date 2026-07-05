import React from 'react';
import { AlertCircle, Info, AlertTriangle, CheckCircle } from 'lucide-react';
import { useTheme } from '../theme';
import { AppTheme } from '../types';

export type BannerTone = 'info' | 'warning' | 'error' | 'success';

interface StatusBannerProps {
  title: string;
  message: string;
  tone?: BannerTone;
  actionLabel?: string;
  onAction?: () => void;
}

// Each tone keeps its semantic hue across themes, with luminance tuned so
// the banner remains distinct from the surface beneath it (white in Gallery,
// near-black in Vault, warm cream in Atelier) — sync feedback is one of the
// few surfaces where users need an at-a-glance signal.
const toneSurfaceClasses: Record<BannerTone, Record<AppTheme, string>> = {
  info: {
    gallery: 'bg-stone-50 text-stone-700 border-stone-200',
    vault: 'bg-white/5 text-stone-300 border-white/10',
    atelier: 'bg-[#EDE4D3] text-[#3D3530] border-[#D4C9B8]',
  },
  warning: {
    gallery: 'bg-amber-50 text-amber-800 border-amber-200',
    vault: 'bg-amber-500/10 text-amber-200 border-amber-400/20',
    atelier: 'bg-amber-100/70 text-amber-900 border-amber-300/60',
  },
  error: {
    gallery: 'bg-red-50 text-red-700 border-red-200',
    vault: 'bg-red-500/10 text-red-300 border-red-400/30',
    atelier: 'bg-red-100/70 text-red-800 border-red-300/60',
  },
  success: {
    gallery: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    vault: 'bg-emerald-500/10 text-emerald-300 border-emerald-400/30',
    atelier: 'bg-emerald-100/70 text-emerald-800 border-emerald-300/60',
  },
};

const toneIcons: Record<BannerTone, React.ComponentType<{ size?: number }>> = {
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
  success: CheckCircle,
};

const actionClasses: Record<AppTheme, string> = {
  gallery: 'text-amber-700 hover:text-amber-900',
  vault: 'text-amber-200 hover:text-amber-100',
  atelier: 'text-[#A86F3C] hover:text-[#8B5A2B]',
};

export const StatusBanner: React.FC<StatusBannerProps> = ({
  title,
  message,
  tone = 'info',
  actionLabel,
  onAction,
}) => {
  const { theme } = useTheme();
  const surface = toneSurfaceClasses[tone][theme];
  const Icon = toneIcons[tone];

  return (
    <div
      className={`rounded-2xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 shadow-sm ${surface}`}
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
          className={`text-xs font-bold uppercase tracking-[0.12em] ${actionClasses[theme]}`}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
