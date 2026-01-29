import React from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { CollectionItem } from '../types';
import { Button } from './ui/Button';
import { useTranslation } from '../i18n';
import { useTheme, panelSurfaceClasses, overlaySurfaceClasses } from '../theme';

interface DeleteItemModalProps {
  isOpen: boolean;
  item: CollectionItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export const DeleteItemModal: React.FC<DeleteItemModalProps> = ({
  isOpen,
  item,
  onClose,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const surfaceClass = panelSurfaceClasses[theme];
  const overlayClass = `${overlaySurfaceClasses[theme]} motion-overlay`;
  const borderClass = theme === 'vault' ? 'border-white/10' : 'border-stone-100';

  if (!isOpen || !item) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 ${overlayClass} backdrop-blur-sm`}
    >
      <div
        className={`${surfaceClass} rounded-t-[1.75rem] rounded-b-none sm:rounded-[1.75rem] shadow-2xl w-full max-w-md overflow-hidden flex flex-col motion-panel border pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] sm:pt-0 sm:pb-0`}
      >
        <div className="sm:hidden flex items-center justify-center pt-2">
          <span
            className={`${theme === 'vault' ? 'bg-white/20' : 'bg-stone-200'} h-1.5 w-12 rounded-full`}
          />
        </div>
        <div className={`flex items-center justify-between px-6 py-5 border-b ${borderClass}`}>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-red-100 text-red-600">
              <AlertTriangle size={18} />
            </div>
            <h2
              className={`font-serif font-bold text-lg ${theme === 'vault' ? 'text-white' : 'text-stone-800'}`}
            >
              {t('deleteItemTitle')}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label={t('close')}
            className={`w-11 h-11 sm:w-9 sm:h-9 flex items-center justify-center rounded-full transition-colors ${theme === 'vault' ? 'hover:bg-white/5 text-stone-300 hover:text-white' : 'hover:bg-stone-100 text-stone-400 hover:text-stone-800'}`}
          >
            <X size={20} />
          </button>
        </div>
        <div className="px-6 py-5">
          <div
            className={`p-4 rounded-xl ${theme === 'vault' ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-100'}`}
          >
            <p className={`text-sm ${theme === 'vault' ? 'text-red-200' : 'text-red-700'}`}>
              {t('deleteItemWarning').replace('{title}', item.title)}
            </p>
          </div>
        </div>
        <div
          className={`px-6 py-4 border-t flex items-center justify-end gap-2 ${theme === 'vault' ? 'border-white/10 bg-white/5' : 'border-stone-100 bg-white'}`}
        >
          <Button variant="ghost" onClick={onClose}>
            {t('cancel')}
          </Button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-colors bg-red-600 text-white hover:bg-red-700"
          >
            {t('deleteItem')}
          </button>
        </div>
      </div>
    </div>
  );
};
