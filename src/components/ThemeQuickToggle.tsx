import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Paintbrush } from 'lucide-react';
import { ThemePicker } from './ThemePicker';
import { AppTheme } from '../types';
import { useTheme, cardSurfaceClasses } from '../theme';
import { useTranslation, type TranslationKey } from '../i18n';

// CUR-162: the toggle's accessible name must describe the action and the
// current theme (not the noun "App Aesthetic"), mirroring the language
// toggle's action-oriented "Switch language to …" name.
const themeLabelKeys: Record<AppTheme, TranslationKey> = {
  gallery: 'themeGallery',
  vault: 'themeVault',
  atelier: 'themeAtelier',
};

// CUR-127: theme switching is a frequent, playful action that was buried inside
// the account menu. This header control makes the three themes directly
// reachable without opening the profile grab-bag.
export const ThemeQuickToggle: React.FC = () => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setIsOpen(false), []);

  // Click-outside closes, mirroring the header profile dropdown in Layout.
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen, close]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, close]);

  const buttonClass =
    theme === 'vault'
      ? 'text-white/70 hover:text-white hover:bg-white/10'
      : theme === 'atelier'
        ? 'text-[#6B5344] hover:text-[#3D3530] hover:bg-[#EDE4D3]'
        : 'text-stone-500 hover:text-stone-900 hover:bg-stone-100';

  return (
    <div className="relative" ref={containerRef}>
      <button
        data-testid="theme-picker"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={t('changeThemeCurrent', { theme: t(themeLabelKeys[theme]) })}
        title={t('changeTheme')}
        className={`p-2 rounded-full transition-colors inline-flex items-center justify-center [@media(any-pointer:coarse)]:min-h-[44px] [@media(any-pointer:coarse)]:min-w-[44px] ${buttonClass}`}
      >
        <Paintbrush size={18} aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          data-testid="theme-quick-menu"
          role="menu"
          className={`absolute right-0 mt-2 w-64 max-w-[calc(100vw-2rem)] ${cardSurfaceClasses[theme]} rounded-[1.5rem] shadow-2xl border p-4 animate-in slide-in-from-top-2 duration-200 z-50`}
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] opacity-70 mb-2">
            {t('themeSelection')}
          </p>
          <ThemePicker layout="stacked" />
        </div>
      )}
    </div>
  );
};
