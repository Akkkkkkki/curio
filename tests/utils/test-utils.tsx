import React, { ReactElement, useState, createContext, useContext } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { HashRouter } from 'react-router-dom';
import { LanguageProvider } from '@/i18n';
import { AppTheme } from '@/types';

/**
 * Custom render function that wraps components with necessary providers
 * Use this instead of RTL's render for component tests
 */

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialLanguage?: 'en' | 'zh';
  initialTheme?: AppTheme;
}

/**
 * Mock ThemeProvider for testing
 * Uses in-memory state instead of IndexedDB
 */
type ThemeContextValue = {
  theme: AppTheme;
  setTheme: (t: AppTheme) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'gallery',
  setTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

function MockThemeProvider({
  children,
  initialTheme = 'gallery',
}: {
  children: React.ReactNode;
  initialTheme?: AppTheme;
}) {
  const [theme, setTheme] = useState<AppTheme>(initialTheme);
  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

function createAllTheProviders(options?: CustomRenderOptions) {
  return function AllTheProviders({ children }: { children: React.ReactNode }) {
    return (
      <HashRouter>
        <LanguageProvider>
          <MockThemeProvider initialTheme={options?.initialTheme}>{children}</MockThemeProvider>
        </LanguageProvider>
      </HashRouter>
    );
  };
}

export function renderWithProviders(ui: ReactElement, options?: CustomRenderOptions) {
  const Wrapper = createAllTheProviders(options);
  return render(ui, { wrapper: Wrapper, ...options });
}

// Re-export everything from React Testing Library
export * from '@testing-library/react';
export { renderWithProviders as render };
