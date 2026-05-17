import React from 'react';
import { X, GitMerge, Cloud, Laptop, ArrowRight } from 'lucide-react';
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
  cloudPayload: any;
};

interface ConflictResolutionModalProps {
  isOpen: boolean;
  conflicts: ConflictEntry[];
  onClose: () => void;
  onKeepCloud: (conflictId: string) => void;
  onUseLocal: (conflict: ConflictEntry) => void;
}

const formatTime = (isoString?: string) => {
  if (!isoString) return '—';
  const date = new Date(isoString);
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).format(date);
};

const getChangedFields = (local: any, cloud: any, type: 'item' | 'collection') => {
  const changes: string[] = [];
  if (type === 'item') {
    if (local.title !== cloud.title) changes.push('Title');
    if (local.rating !== cloud.rating) changes.push('Rating');
    if (local.notes !== cloud.notes) changes.push('Story');
    // Simple check for data fields
    const localData = JSON.stringify(local.data || {});
    const cloudData = JSON.stringify(cloud.data || {});
    if (localData !== cloudData) changes.push('Details');
  } else {
    if (local.name !== cloud.name) changes.push('Name');
    if (local.icon !== cloud.icon) changes.push('Icon');
    if (local.description !== cloud.description) changes.push('Description');
  }
  return changes;
};

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
        <div className="sm:hidden h-3" />
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
          {conflicts.map((conflict) => {
            const localTime = new Date(conflict.localUpdatedAt || 0).getTime();
            const cloudTime = new Date(conflict.cloudUpdatedAt || 0).getTime();
            const isLocalNewer = localTime > cloudTime;
            const isCloudNewer = cloudTime > localTime;
            const changes = getChangedFields(
              conflict.localPayload,
              conflict.cloudPayload,
              conflict.type,
            );

            return (
              <div
                key={conflict.id}
                className={`rounded-2xl border p-4 space-y-4 ${theme === 'vault' ? 'border-white/10 bg-white/5' : 'border-stone-100 bg-white'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded">
                        {conflict.type === 'item' ? t('conflictItem') : t('conflictCollection')}
                      </span>
                      {changes.length > 0 && (
                        <span className="text-[10px] text-amber-600 font-medium">
                          Changed: {changes.join(', ')}
                        </span>
                      )}
                    </div>
                    <p
                      className={`text-base font-bold ${theme === 'vault' ? 'text-white' : 'text-stone-800'}`}
                    >
                      {conflict.cloudLabel}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Cloud Option */}
                  <div
                    className={`relative p-3 rounded-xl border ${isCloudNewer ? 'border-amber-200 bg-amber-50/50' : theme === 'vault' ? 'border-white/5 bg-white/5' : 'border-stone-100 bg-stone-50/50'}`}
                  >
                    {isCloudNewer && (
                      <div className="absolute -top-2 left-3 px-2 py-0.5 bg-amber-500 text-white text-[10px] font-bold uppercase tracking-wider rounded-full shadow-sm">
                        Newer
                      </div>
                    )}
                    <div className="flex items-center gap-2 mb-2 text-stone-500">
                      <Cloud size={14} />
                      <span className="text-xs font-semibold">{t('cloudVersion')}</span>
                    </div>
                    <div className="text-xs font-medium mb-3">
                      {formatTime(conflict.cloudUpdatedAt)}
                    </div>
                    <button
                      onClick={() => onKeepCloud(conflict.id)}
                      className={`w-full py-2 rounded-lg text-xs font-bold transition-colors ${
                        isCloudNewer
                          ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-sm'
                          : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
                      }`}
                    >
                      {t('keepCloud')}
                    </button>
                  </div>

                  {/* Local Option */}
                  <div
                    className={`relative p-3 rounded-xl border ${isLocalNewer ? 'border-amber-200 bg-amber-50/50' : theme === 'vault' ? 'border-white/5 bg-white/5' : 'border-stone-100 bg-stone-50/50'}`}
                  >
                    {isLocalNewer && (
                      <div className="absolute -top-2 left-3 px-2 py-0.5 bg-amber-500 text-white text-[10px] font-bold uppercase tracking-wider rounded-full shadow-sm">
                        Newer
                      </div>
                    )}
                    <div className="flex items-center gap-2 mb-2 text-stone-500">
                      <Laptop size={14} />
                      <span className="text-xs font-semibold">{t('localVersion')}</span>
                    </div>
                    <div className="text-xs font-medium mb-3">
                      {formatTime(conflict.localUpdatedAt)}
                    </div>
                    <button
                      onClick={() => onUseLocal(conflict)}
                      className={`w-full py-2 rounded-lg text-xs font-bold transition-colors ${
                        isLocalNewer
                          ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-sm'
                          : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
                      }`}
                    >
                      {t('useLocal')}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
