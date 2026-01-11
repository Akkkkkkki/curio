import React, {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useState,
  ReactNode,
} from 'react';
import { AppTheme } from './types';
import { initDB } from './services/db';

type ThemeContextValue = {
  theme: AppTheme;
  setTheme: (t: AppTheme) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'gallery',
  setTheme: () => {},
});

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<AppTheme>('gallery');

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const db = await initDB();
        const tx = db.transaction('settings', 'readonly');
        const req = tx.objectStore('settings').get('app_theme');
        req.onsuccess = () => {
          if (req.result) setThemeState(req.result as AppTheme);
        };
      } catch (e) {
        console.warn('Theme load failed', e);
      }
    };
    void loadTheme();
  }, []);

  const persistTheme = useCallback(async (nextTheme: AppTheme) => {
    try {
      const db = await initDB();
      const tx = db.transaction('settings', 'readwrite');
      tx.objectStore('settings').put(nextTheme, 'app_theme');
    } catch (e) {
      console.warn('Theme persist failed', e);
    }
  }, []);

  const updateTheme = useCallback(
    (nextTheme: AppTheme) => {
      setThemeState(nextTheme);
      void persistTheme(nextTheme);
    },
    [persistTheme],
  );

  return (
    <ThemeContext.Provider value={{ theme, setTheme: updateTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const panelSurfaceClasses: Record<AppTheme, string> = {
  gallery: 'bg-white text-stone-900 border-stone-200',
  vault: 'bg-stone-900 text-white border-white/10',
  atelier: 'bg-[#f8f6f1] text-stone-900 border-[#e6e1d5]',
};

export const cardSurfaceClasses: Record<AppTheme, string> = {
  gallery: 'bg-white text-stone-900 border-stone-100',
  vault: 'bg-stone-950 text-white border-white/10',
  atelier: 'bg-[#f8f6f1] text-stone-900 border-[#e6e1d5]',
};

export const softSurfaceClasses: Record<AppTheme, string> = {
  gallery: 'bg-white/80 text-stone-800 border-stone-100',
  vault: 'bg-white/5 text-white border-white/10',
  atelier: 'bg-[#f5f1e7] text-stone-900 border-[#e6e1d5]',
};

export const overlaySurfaceClasses: Record<AppTheme, string> = {
  gallery: 'bg-stone-900/45',
  vault: 'bg-stone-950/70',
  atelier: 'bg-stone-900/40',
};

export const mutedTextClasses: Record<AppTheme, string> = {
  gallery: 'text-stone-500',
  vault: 'text-stone-300',
  atelier: 'text-stone-500',
};

export const frameClasses: Record<AppTheme, string> = {
  gallery: 'bg-stone-200/80 border-stone-300 shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)]',
  vault: 'bg-stone-800 border-amber-500/50 shadow-[inset_0_1px_3px_rgba(0,0,0,0.3)]',
  atelier: 'bg-[#e8e2d5] border-[#c9bfab] shadow-[inset_0_1px_2px_rgba(87,83,78,0.08)]',
};

export const frameInnerClasses: Record<AppTheme, string> = {
  gallery: 'ring-1 ring-stone-300/80 shadow-[0_1px_3px_rgba(0,0,0,0.1)]',
  vault: 'ring-1 ring-amber-500/30 shadow-[0_2px_8px_rgba(0,0,0,0.4)]',
  atelier: 'ring-1 ring-[#c4b8a5] shadow-[0_1px_4px_rgba(87,83,78,0.12)]',
};

export const useTheme = () => useContext(ThemeContext);
