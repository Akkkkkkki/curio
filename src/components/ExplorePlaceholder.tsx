import React from 'react';
import { Compass } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../i18n';
import { useTheme } from '../theme';
import { Button } from './ui/Button';

interface ExplorePlaceholderProps {
  sampleCollectionId?: string | null;
  onExploreSamples?: () => void;
}

export const ExplorePlaceholder: React.FC<ExplorePlaceholderProps> = ({
  sampleCollectionId,
  onExploreSamples,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const surfaceClass =
    theme === 'vault'
      ? 'bg-stone-900/80 border-white/10 text-white'
      : theme === 'atelier'
        ? 'bg-[#F5EFE4]/85 border-[#D4C9B8] text-stone-800'
        : 'bg-white/70 border-stone-200 text-stone-900';
  const subTextClass =
    theme === 'vault' ? 'text-stone-300' : theme === 'atelier' ? 'text-stone-500' : 'text-stone-500';
  const iconClass =
    theme === 'vault'
      ? 'bg-white/10 text-white/70'
      : theme === 'atelier'
        ? 'bg-[#efe6d6] text-stone-500'
        : 'bg-stone-100 text-stone-500';

  return (
    <div
      className="flex flex-col items-center justify-center px-4 py-16 sm:py-24"
      data-testid="explore-placeholder"
    >
      <div
        className={`max-w-md w-full text-center rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-10 shadow-xl border ${surfaceClass}`}
      >
        <div
          className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 sm:mb-6 ${iconClass}`}
        >
          <Compass size={24} />
        </div>
        <h1 className="font-serif text-2xl font-bold mb-2">
          {t('explorePlaceholderTitle')}
        </h1>
        <p className={`text-sm mb-6 ${subTextClass}`}>{t('explorePlaceholderBody')}</p>
        {sampleCollectionId && (
          <Link to={`/collection/${sampleCollectionId}`} onClick={onExploreSamples}>
            <Button size="lg" variant="secondary" className="w-full">
              {t('explorePlaceholderAction')}
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
};
