import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { HashRouter } from 'react-router-dom';
import { LanguageProvider } from '@/i18n';

/**
 * Custom render function that wraps components with necessary providers
 * Use this instead of RTL's render for component tests
 */

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  // Add custom options here if needed
  initialLanguage?: 'en' | 'zh';
}

function AllTheProviders({ children }: { children: React.ReactNode }) {
  return (
    <HashRouter>
      <LanguageProvider>{children}</LanguageProvider>
    </HashRouter>
  );
}

export function renderWithProviders(ui: ReactElement, options?: CustomRenderOptions) {
  return render(ui, { wrapper: AllTheProviders, ...options });
}

// Re-export everything from React Testing Library
export * from '@testing-library/react';
export { renderWithProviders as render };
