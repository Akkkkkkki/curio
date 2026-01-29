import React from 'react';
import { X, GitMerge, Cloud, Laptop } from 'lucide-react';
import { useTranslation } from '../i18n';
import { useTheme, panelSurfaceClasses, overlaySurfaceClasses } from '../theme';

export type ConflictEntry = {
  id: string;
  type: 'collection' | 'item';
  collectionId: string;
  itemId?: string;
  localLabel: string;
  cloudLabel: string;
  localUpdatedAt?: string;
  cloudUpdatedAt?: string;
  localPayload: any;
};

interface ConflictResolutionModalProps {
  isOpen: boolean;
  conflicts: ConflictEntry[];
  onClose: () => void;
  onKeepCloud: (conflictId: string) => void;
  onUseLocal: (conflict: ConflictEntry) => void;
}

export const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
  isOpen,
  conflicts,
  onClose,
  onKeepCloud,
  onUseLocal,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const surfaceClass = panelSurfaceClasses[theme];
  const overlayClass = `${overlaySurfaceClasses[theme]} motion-overlay`;
  const borderClass = theme === 'vault' ? 'border-white/10' : 'border-stone-100';

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 ${overlayClass} backdrop-blur-sm`}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="conflict-resolution-title"
        className={`${surfaceClass} rounded-t-3xl rounded-b-none sm:rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col motion-panel border pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] sm:pt-0 sm:pb-0`}
      >
        <div className="sm:hidden flex items-center justify-center pt-2">
          <span
            className={`${theme === 'vault' ? 'bg-white/20' : 'bg-stone-200'} h-1.5 w-12 rounded-full`}
          />
        </div>
        <div className={`flex items-center justify-between p-4 border-b ${borderClass}`}>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <GitMerge size={18} />
            </div>
            <h2
              id="conflict-resolution-title"
              className={`font-serif font-bold text-lg ${theme === 'vault' ? 'text-white' : 'text-stone-800'}`}
            >
              {t('conflictTitle')}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label={t('close')}
            className={`p-2 rounded-full transition-colors ${theme === 'vault' ? 'hover:bg-white/5 text-stone-300 hover:text-white' : 'hover:bg-stone-100 text-stone-400 hover:text-stone-800'}`}
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <p className={`text-sm ${theme === 'vault' ? 'text-stone-300' : 'text-stone-600'}`}>
            {t('conflictDesc')}
          </p>
          {conflicts.length === 0 && (
            <div className="text-sm text-stone-500">{t('conflictEmpty')}</div>
          )}
          {conflicts.map((conflict) => (
            <div
              key={conflict.id}
              className={`rounded-2xl border p-4 space-y-3 ${theme === 'vault' ? 'border-white/10 bg-white/5' : 'border-stone-100 bg-white'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-400">
                    {conflict.type === 'item' ? t('conflictItem') : t('conflictCollection')}
                  </p>
                  <p
                    className={`text-base font-semibold ${theme === 'vault' ? 'text-white' : 'text-stone-800'}`}
                  >
                    {conflict.cloudLabel}
                  </p>
                </div>
                <div className="text-[11px] text-stone-400 text-right">
                  {conflict.cloudUpdatedAt || conflict.localUpdatedAt ? (
                    <>
                      <div>
                        {t('conflictCloudUpdated')} {conflict.cloudUpdatedAt || '—'}
                      </div>
                      <div>
                        {t('conflictLocalUpdated')} {conflict.localUpdatedAt || '—'}
                      </div>
                    </>
                  ) : null}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => onKeepCloud(conflict.id)}
                  className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold border border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100 transition-colors"
                >
                  <Cloud size={16} />
                  {t('keepCloud')}
                </button>
                <button
                  onClick={() => onUseLocal(conflict)}
                  className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold border ${
                    theme === 'vault'
                      ? 'border-white/10 bg-white/5 text-white hover:bg-white/10'
                      : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                  }`}
                >
                  <Laptop size={16} />
                  {t('useLocal')}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
