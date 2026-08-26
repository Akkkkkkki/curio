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
  const getInitialTheme = (): AppTheme => {
    if (typeof window === 'undefined') return 'gallery';
    const stored = window.localStorage?.getItem('curio_theme');
    if (stored === 'gallery' || stored === 'vault' || stored === 'atelier') {
      return stored;
    }
    return 'gallery';
  };

  const [theme, setThemeState] = useState<AppTheme>(() => getInitialTheme());

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const db = await initDB();
        const tx = db.transaction('settings', 'readonly');
        const req = tx.objectStore('settings').get('app_theme');
        req.onsuccess = () => {
          if (req.result) {
            const nextTheme = req.result as AppTheme;
            setThemeState(nextTheme);
            if (typeof window !== 'undefined') {
              window.localStorage?.setItem('curio_theme', nextTheme);
            }
          }
        };
      } catch (e) {
        console.warn('Theme load failed', e);
      }
    };
    void loadTheme();
  }, []);

  const persistTheme = useCallback(async (nextTheme: AppTheme) => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage?.setItem('curio_theme', nextTheme);
      }
      const db = await initDB();
      const tx = db.transaction('settings', 'readwrite');
      tx.objectStore('settings').put(nextTheme, 'app_theme');
    } catch (e) {
      console.warn('Theme persist failed', e);
    }
  }, []);

  const THEME_COLORS: Record<AppTheme, string> = {
    gallery: '#f5f5f4',
    vault: '#111827',
    atelier: '#F5EFE4',
  };

  useEffect(() => {
    const meta = document.getElementById('theme-color-meta');
    if (meta) meta.setAttribute('content', THEME_COLORS[theme] || '#f5f5f4');
  }, [theme]);

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
  atelier: 'bg-[#F5EFE4] text-[#3D3530] border-[#D4C9B8]',
};

export const cardSurfaceClasses: Record<AppTheme, string> = {
  gallery: 'bg-white text-stone-900 border-stone-100',
  vault: 'bg-stone-950 text-white border-white/10',
  atelier: 'bg-[#F5EFE4] text-[#3D3530] border-[#D4C9B8]',
};

export const softSurfaceClasses: Record<AppTheme, string> = {
  gallery: 'bg-white/80 text-stone-800 border-stone-100',
  vault: 'bg-white/5 text-white border-white/10',
  atelier: 'bg-[#EDE4D3] text-[#3D3530] border-[#D4C9B8]',
};

export const overlaySurfaceClasses: Record<AppTheme, string> = {
  gallery: 'bg-stone-900/45',
  vault: 'bg-stone-950/70',
  atelier: 'bg-[#3D3530]/50', // Warm brown overlay instead of cool gray
};

export const mutedTextClasses: Record<AppTheme, string> = {
  gallery: 'text-stone-500',
  vault: 'text-stone-300',
  atelier: 'text-[#6F6257]', // AA-compliant sepia muted text
};

export const useTheme = () => useContext(ThemeContext);

export const typographyClasses = {
  title: 'font-serif text-lg sm:text-xl font-bold tracking-tight',
  titleLarge: 'font-serif text-2xl sm:text-3xl font-bold tracking-tight',
  titleHero: 'font-serif text-3xl sm:text-5xl font-bold tracking-tight',
  titleDisplay: 'font-serif text-4xl sm:text-6xl font-bold tracking-tight',
  label:
    'font-mono text-[11px] sm:text-[12px] uppercase tracking-[0.1em] sm:tracking-[0.2em] font-bold',
  labelMuted:
    'font-mono text-[11px] sm:text-[12px] uppercase tracking-[0.1em] sm:tracking-[0.2em] font-medium opacity-50',
  labelSmall: 'font-mono text-[10px] uppercase tracking-[0.08em] sm:tracking-[0.15em] font-medium',
  body: 'font-sans text-sm leading-relaxed',
  bodyLarge: 'font-sans text-base leading-relaxed',
  bodyMuted: 'font-sans text-sm leading-relaxed opacity-60',
  accession: 'font-mono text-[10px] tracking-[0.15em] opacity-30 uppercase',
  quote: 'font-serif italic text-lg leading-relaxed',
} as const;

export const labelColorClasses: Record<AppTheme, string> = {
  gallery: 'text-stone-500',
  vault: 'text-stone-400',
  atelier: 'text-[#6F6257]',
};

export const themeColors = {
  gallery: {
    mat: '#F5F5F5',
    frameAccent: '#1A1A1A',
    surface: '#FFFFFF',
    surfaceMuted: '#F5F5F5',
    text: '#1C1917',
    textMuted: '#78716C',
    border: '#E7E5E4',
    accent: '#D97706',
    accentHover: '#B45309',
  },
  vault: {
    mat: '#1C1917',
    frameAccent: '#D4A574',
    surface: '#0C0A09',
    surfaceMuted: '#1C1917',
    text: '#FFFFFF',
    textMuted: '#A8A29E',
    border: 'rgba(255,255,255,0.1)',
    accent: '#D4A574',
    accentHover: '#E0B585',
  },
  atelier: {
    mat: '#EDE4D3',
    frameAccent: '#6B5344',
    surface: '#F5EFE4',
    surfaceMuted: '#EDE4D3',
    text: '#3D3530',
    textMuted: '#6F6257',
    border: '#D4C9B8',
    accent: '#8B5A2B',
    accentHover: '#73481F',
  },
} as const;

export const matSurfaceClasses: Record<AppTheme, string> = {
  gallery: 'bg-[#F5F5F5]',
  vault: 'bg-[#1C1917]',
  atelier: 'bg-[#EDE4D3]',
};

export const frameAccentClasses: Record<AppTheme, string> = {
  gallery: 'border-[#1A1A1A]',
  vault: 'border-[#D4A574]',
  atelier: 'border-[#6B5344]',
};

export const accentColorClasses: Record<AppTheme, string> = {
  gallery: 'text-amber-600 hover:text-amber-700',
  vault: 'text-[#D4A574] hover:text-[#E0B585]',
  atelier: 'text-[#8B5A2B] hover:text-[#73481F]',
};

export const accentLabelColorClasses: Record<AppTheme, string> = {
  gallery: 'text-amber-700',
  vault: 'text-[#D4A574]',
  atelier: 'text-[#8B5A2B]',
};

export const accentBgClasses: Record<AppTheme, string> = {
  gallery: 'bg-amber-500 hover:bg-amber-600 text-white',
  vault: 'bg-[#D4A574] hover:bg-[#E0B585] text-stone-900',
  atelier: 'bg-[#8B5A2B] hover:bg-[#73481F] text-white',
};

export const cardHoverClasses: Record<AppTheme, string> = {
  gallery: 'hover:shadow-gallery-hover hover:border-stone-200 transition-all duration-200',
  vault: 'hover:shadow-vault-hover hover:border-[#D4A574]/30 transition-all duration-200',
  atelier: 'hover:shadow-atelier-hover hover:border-[#8B5A2B]/30 transition-all duration-200',
};

export const cardSurfaceEnhancedClasses: Record<AppTheme, string> = {
  gallery: 'bg-white text-stone-900 border border-stone-100 shadow-gallery',
  vault: 'bg-stone-950 text-white border border-white/10 shadow-vault',
  atelier: 'bg-[#F5EFE4] text-[#3D3530] border border-[#D4C9B8] shadow-atelier',
};

export const dividerClasses: Record<AppTheme, string> = {
  gallery: 'border-stone-200',
  vault: 'border-white/10',
  atelier: 'border-[#D4C9B8]',
};

export const ratingColorClasses: Record<AppTheme, string> = {
  gallery: 'text-amber-500',
  vault: 'text-[#D4A574]',
  atelier: 'text-[#8B5A2B]',
};

export const ratingEmptyClasses: Record<AppTheme, string> = {
  gallery: 'text-amber-500/30',
  vault: 'text-[#D4A574]/30',
  atelier: 'text-[#8B5A2B]/30',
};

export const inputClasses: Record<AppTheme, string> = {
  gallery:
    'bg-white border-stone-200 text-stone-900 placeholder:text-stone-300 focus:ring-amber-500/10 focus:border-amber-200',
  vault:
    'bg-stone-900 border-white/10 text-white placeholder:text-stone-400 focus:ring-[#D4A574]/10 focus:border-[#D4A574]/30',
  atelier:
    'bg-[#F5EFE4] border-[#D4C9B8] text-[#3D3530] placeholder:text-[#6F6257] focus:ring-[#8B5A2B]/10 focus:border-[#8B5A2B]/30',
};
