import React from 'react';
import { CheckCircle, AlertTriangle, Info } from 'lucide-react';

export type StatusTone = 'success' | 'error' | 'info';

interface StatusToastProps {
  message: string;
  tone?: StatusTone;
  onDismiss?: () => void;
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
  };

export const StatusToast: React.FC<StatusToastProps> = ({ message, tone = 'info', onDismiss }) => {
  const { bg, text, Icon } = toneStyles[tone];
  return (
    <div
      className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-lg ${bg} ${text} motion-pop`}
    >
      <Icon size={18} />
      <span className="text-sm font-semibold leading-tight">{message}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="ml-2 text-xs font-bold uppercase tracking-[0.08em] text-stone-400 hover:text-stone-600"
        >
          Close
        </button>
      )}
    </div>
  );
};
