import React from 'react';
import { CheckCircle, AlertTriangle, Info, AlertCircle } from 'lucide-react';
import { useTranslation } from '../i18n';

export type StatusTone = 'success' | 'error' | 'info' | 'warning';

interface StatusToastProps {
  message: string;
  tone?: StatusTone;
  onDismiss?: () => void;
  actionLabel?: string;
  onAction?: () => void;
}

const toneStyles: Record<StatusTone, { bg: string; text: string; Icon: React.ComponentType<any> }> =
  {
    success: {
      bg: 'bg-emerald-50 border-emerald-100',
      text: 'text-emerald-800',
      Icon: CheckCircle,
    },
    error: {
      bg: 'bg-red-50 border-red-100',
      text: 'text-red-700',
      Icon: AlertTriangle,
    },
    info: {
      bg: 'bg-stone-50 border-stone-200',
      text: 'text-stone-700',
      Icon: Info,
    },
    warning: {
      bg: 'bg-amber-50 border-amber-100',
      text: 'text-amber-800',
      Icon: AlertCircle,
    },
  };

export const StatusToast: React.FC<StatusToastProps> = ({
  message,
  tone = 'info',
  onDismiss,
  actionLabel,
  onAction,
}) => {
  const { t } = useTranslation();
  const { bg, text, Icon } = toneStyles[tone];
  return (
    <div
      data-testid="status-toast"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-lg ${bg} ${text} motion-pop`}
    >
      <Icon size={18} />
      <span className="text-sm font-semibold leading-tight" data-testid="status-toast-message">
        {message}
      </span>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="ml-2 text-xs font-bold uppercase tracking-[0.08em] text-amber-700 hover:text-amber-900"
        >
          {actionLabel}
        </button>
      )}
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="ml-2 text-xs font-bold uppercase tracking-[0.08em] text-stone-400 hover:text-stone-600"
        >
          {t('close')}
        </button>
      )}
    </div>
  );
};
