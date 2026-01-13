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

export const useTheme = () => useContext(ThemeContext);

// =============================================================================
// TYPOGRAPHY HIERARCHY
// Consistent text styles following the design system:
// - Titles: Serif, bold, for headings and item names
// - Labels: Mono, uppercase, for metadata and categories
// - Body: Sans, for descriptions and notes
// - Accession: Mono, very small, for catalog numbers
// =============================================================================

export const typographyClasses = {
  // Titles: Serif, 18-20px, bold, tight tracking
  title: 'font-serif text-lg sm:text-xl font-bold tracking-tight',
  titleLarge: 'font-serif text-2xl sm:text-3xl font-bold tracking-tight',
  titleHero: 'font-serif text-3xl sm:text-5xl font-bold tracking-tight',
  titleDisplay: 'font-serif text-4xl sm:text-6xl font-bold tracking-tight',

  // Labels/Metadata: Mono, 11-12px, uppercase, wide tracking
  label: 'font-mono text-[11px] sm:text-[12px] uppercase tracking-[0.2em] font-bold',
  labelMuted:
    'font-mono text-[11px] sm:text-[12px] uppercase tracking-[0.2em] font-medium opacity-50',
  labelSmall: 'font-mono text-[10px] uppercase tracking-[0.15em] font-medium',

  // Body text: Sans, 14-16px, relaxed leading
  body: 'font-sans text-sm leading-relaxed',
  bodyLarge: 'font-sans text-base leading-relaxed',
  bodyMuted: 'font-sans text-sm leading-relaxed opacity-60',

  // Accession numbers: Mono, 10px, very muted
  accession: 'font-mono text-[10px] tracking-[0.15em] opacity-30 uppercase',

  // Special: Italic serif for quotes/descriptions
  quote: 'font-serif italic text-lg leading-relaxed',
} as const;

// Theme-aware label colors
export const labelColorClasses: Record<AppTheme, string> = {
  gallery: 'text-stone-400',
  vault: 'text-stone-500',
  atelier: 'text-stone-400',
};

// =============================================================================
// ENHANCED THEME COLOR PALETTES
// Each theme has a refined color system:
// - Gallery: Clean, editorial, high-contrast (white + charcoal)
// - Vault: Cinematic, luxurious (dark + brass/gold accents)
// - Atelier: Warm, tactile, vintage (cream + warm brown)
// =============================================================================

export const themeColors = {
  gallery: {
    mat: '#F5F5F5', // Soft gray mat for subtle depth
    frameAccent: '#1A1A1A', // Charcoal for refined contrast
    surface: '#FFFFFF',
    surfaceMuted: '#F5F5F5',
    text: '#1C1917', // stone-900
    textMuted: '#78716C', // stone-500
    border: '#E7E5E4', // stone-200
    accent: '#D97706', // amber-600
    accentHover: '#B45309', // amber-700
  },
  vault: {
    mat: '#1C1917', // stone-900 for layered depth
    frameAccent: '#D4A574', // Brass/gold for warmth
    surface: '#0C0A09', // stone-950
    surfaceMuted: '#1C1917', // stone-900
    text: '#FFFFFF',
    textMuted: '#A8A29E', // stone-400
    border: 'rgba(255,255,255,0.1)',
    accent: '#D4A574', // Brass highlight
    accentHover: '#E0B585',
  },
  atelier: {
    mat: '#F5F1E7', // Darker cream for texture
    frameAccent: '#8B7355', // Warm brown for earthiness
    surface: '#FAF9F6',
    surfaceMuted: '#F5F1E7',
    text: '#1C1917', // stone-900
    textMuted: '#78716C', // stone-500
    border: '#E6E1D5',
    accent: '#8B7355', // Warm brown
    accentHover: '#9D856A',
  },
} as const;

// =============================================================================
// ENHANCED SURFACE CLASSES
// Pre-built Tailwind class combinations for common UI patterns
// =============================================================================

// Mat/background surfaces (for cards, panels with subtle depth)
export const matSurfaceClasses: Record<AppTheme, string> = {
  gallery: 'bg-[#F5F5F5]',
  vault: 'bg-[#1C1917]',
  atelier: 'bg-[#F5F1E7]',
};

// Frame accent colors (for borders, dividers, highlights)
export const frameAccentClasses: Record<AppTheme, string> = {
  gallery: 'border-[#1A1A1A]',
  vault: 'border-[#D4A574]',
  atelier: 'border-[#8B7355]',
};

// Interactive element accent colors
export const accentColorClasses: Record<AppTheme, string> = {
  gallery: 'text-amber-600 hover:text-amber-700',
  vault: 'text-[#D4A574] hover:text-[#E0B585]',
  atelier: 'text-[#8B7355] hover:text-[#9D856A]',
};

// Accent background classes (for buttons, badges)
export const accentBgClasses: Record<AppTheme, string> = {
  gallery: 'bg-amber-500 hover:bg-amber-600 text-white',
  vault: 'bg-[#D4A574] hover:bg-[#E0B585] text-stone-900',
  atelier: 'bg-[#8B7355] hover:bg-[#9D856A] text-white',
};

// Card hover states with enhanced shadows
export const cardHoverClasses: Record<AppTheme, string> = {
  gallery: 'hover:shadow-gallery-hover hover:border-stone-200 transition-all duration-200',
  vault: 'hover:shadow-vault-hover hover:border-[#D4A574]/30 transition-all duration-200',
  atelier: 'hover:shadow-atelier-hover hover:border-[#8B7355]/30 transition-all duration-200',
};

// Enhanced card surfaces with theme-specific shadows
export const cardSurfaceEnhancedClasses: Record<AppTheme, string> = {
  gallery: 'bg-white text-stone-900 border border-stone-100 shadow-gallery',
  vault: 'bg-stone-950 text-white border border-white/10 shadow-vault',
  atelier: 'bg-[#faf9f6] text-stone-900 border border-[#e6e1d5] shadow-atelier',
};

// Divider/separator classes
export const dividerClasses: Record<AppTheme, string> = {
  gallery: 'border-stone-200',
  vault: 'border-white/10',
  atelier: 'border-[#e6e1d5]',
};

// Rating star colors (muted amber instead of bright yellow)
export const ratingColorClasses: Record<AppTheme, string> = {
  gallery: 'text-amber-500',
  vault: 'text-[#D4A574]',
  atelier: 'text-amber-600',
};

export const ratingEmptyClasses: Record<AppTheme, string> = {
  gallery: 'text-amber-500/30',
  vault: 'text-[#D4A574]/30',
  atelier: 'text-amber-600/30',
};

// Input field classes
export const inputClasses: Record<AppTheme, string> = {
  gallery:
    'bg-white border-stone-200 text-stone-900 placeholder:text-stone-300 focus:ring-amber-500/10 focus:border-amber-200',
  vault:
    'bg-stone-900 border-white/10 text-white placeholder:text-stone-500 focus:ring-[#D4A574]/10 focus:border-[#D4A574]/30',
  atelier:
    'bg-[#faf9f6] border-[#e6e1d5] text-stone-900 placeholder:text-stone-300 focus:ring-[#8B7355]/10 focus:border-[#8B7355]/30',
};
