import React from 'react';
import { Globe } from 'lucide-react';
import { useTheme } from '../theme';
import { useTranslation } from '../i18n';

export const LanguageToggle: React.FC = () => {
  const { language, setLanguage, t } = useTranslation();
  const { theme } = useTheme();
  const targetLang = language === 'en' ? 'zh' : 'en';
  const targetName = t(targetLang === 'zh' ? 'languageZh' : 'languageEn');

  return (
    <button
      onClick={() => setLanguage(targetLang)}
      className={`p-2 rounded-full transition-colors flex items-center justify-center gap-1 sm:gap-1.5 [@media(pointer:coarse)]:min-h-[44px] [@media(pointer:coarse)]:min-w-[44px] ${
        theme === 'vault'
          ? 'text-white/70 hover:text-white hover:bg-white/10'
          : theme === 'atelier'
            ? 'text-[#6B5344] hover:text-[#3D3530] hover:bg-[#EDE4D3]'
            : 'text-stone-500 hover:text-stone-900 hover:bg-stone-100'
      }`}
      aria-label={t('switchLanguageTo', { target: targetName })}
      title={t('switchLanguage')}
    >
      <Globe size={18} aria-hidden="true" />
      <span
        aria-hidden="true"
        className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.14em]"
      >
        {targetLang.toUpperCase()}
      </span>
    </button>
  );
};

export default LanguageToggle;
