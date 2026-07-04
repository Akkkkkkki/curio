import React, { useRef } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { UserCollection } from '../types';
import { Button } from './ui/Button';
import { useTranslation } from '../i18n';
import { useTheme, panelSurfaceClasses, overlaySurfaceClasses } from '../theme';
import { useModalA11y } from '../hooks/useModalA11y';

interface DeleteCollectionModalProps {
  isOpen: boolean;
  collection: UserCollection | null;
  onClose: () => void;
  onConfirm: () => void;
}

export const DeleteCollectionModal: React.FC<DeleteCollectionModalProps> = ({
  isOpen,
  collection,
  onClose,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const surfaceClass = panelSurfaceClasses[theme];
  const overlayClass = `${overlaySurfaceClasses[theme]} motion-overlay`;
  const borderClass = theme === 'vault' ? 'border-white/10' : 'border-stone-100';

  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  useModalA11y(dialogRef, isOpen, onClose, { initialFocusRef: cancelRef });

  if (!isOpen || !collection) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 ${overlayClass} backdrop-blur-sm`}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-collection-modal-title"
        className={`${surfaceClass} rounded-t-[1.75rem] rounded-b-none sm:rounded-[1.75rem] shadow-2xl w-full max-w-md overflow-hidden flex flex-col motion-panel border pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] sm:pt-0 sm:pb-0`}
      >
        <div className="sm:hidden h-3" />
        <div className={`flex items-center justify-between px-6 py-5 border-b ${borderClass}`}>
          <div className="flex items-center gap-2">
            <div
              data-testid="delete-collection-warning-icon"
              className={`p-1.5 rounded-lg ${
                theme === 'vault'
                  ? 'bg-red-500/15 text-red-300'
                  : theme === 'atelier'
                    ? 'bg-red-100/70 text-red-700'
                    : 'bg-red-100 text-red-600'
              }`}
            >
              <AlertTriangle size={18} />
            </div>
            <h2
              id="delete-collection-modal-title"
              className={`font-serif font-bold text-lg ${theme === 'vault' ? 'text-white' : 'text-stone-800'}`}
            >
              {t('deleteCollectionTitle')}
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
              {t('deleteCollectionWarning')
                .replace('{name}', collection.name)
                .replace('{count}', String(collection.items.length))}
            </p>
          </div>
        </div>
        <div
          className={`px-6 py-4 border-t flex items-center justify-end gap-2 ${theme === 'vault' ? 'border-white/10 bg-white/5' : 'border-stone-100 bg-white'}`}
        >
          <Button ref={cancelRef} variant="ghost" onClick={onClose}>
            {t('cancel')}
          </Button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-colors bg-red-600 text-white hover:bg-red-700"
          >
            {t('deleteCollection')}
          </button>
        </div>
      </div>
    </div>
  );
};
