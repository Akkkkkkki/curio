import { describe, it, expect } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { LanguageProvider } from '@/i18n';
import { ThemeProvider } from '@/theme';
import { LegalPage } from '@/components/LegalPage';

function renderAtPath(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LanguageProvider>
        <ThemeProvider>
          <Routes>
            <Route path="/legal/:doc" element={<LegalPage />} />
          </Routes>
        </ThemeProvider>
      </LanguageProvider>
    </MemoryRouter>,
  );
}

describe('LegalPage (CUR-57)', () => {
  it('renders the Privacy Policy at /legal/privacy with all summary sections', () => {
    renderAtPath('/legal/privacy');

    expect(screen.getByTestId('legal-page-privacy')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: /privacy policy/i })).toBeInTheDocument();
    // A few section headings we promised in the EN copy.
    expect(screen.getByRole('heading', { name: /what we store/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /ai metadata extraction/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /deleting your data/i })).toBeInTheDocument();
    // Beta badge so users do not mistake this for a finalized policy.
    expect(screen.getByText(/beta — plain-language summary/i)).toBeInTheDocument();
  });

  it('renders the Terms of Service at /legal/terms and links over to Privacy', () => {
    renderAtPath('/legal/terms');

    expect(screen.getByTestId('legal-page-terms')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: /terms of service/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /your content/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /acceptable use/i })).toBeInTheDocument();

    // Cross-link to the sibling doc.
    const sibling = screen.getByRole('link', { name: /privacy policy/i });
    expect(sibling).toHaveAttribute('href', '/legal/privacy');
  });

  it('always provides a Back to Curio link out of the legal pages', () => {
    renderAtPath('/legal/privacy');
    const back = screen.getByRole('link', { name: /back to curio/i });
    expect(back).toHaveAttribute('href', '/');
  });

  it('falls back to the Privacy doc when the param is unknown', () => {
    renderAtPath('/legal/something-else');
    expect(screen.getByTestId('legal-page-privacy')).toBeInTheDocument();
  });
});
