/**
 * CUR-54: LanguageProvider memoization regression test.
 *
 * LanguageProvider sits at the top of the tree, so every render of its parent
 * (App / route changes / theme changes / unrelated state) used to recreate the
 * context value object and the `t` function. That forced every consumer of
 * `useTranslation()` to re-render, even when `language` hadn't changed. These
 * tests pin that behavior in place:
 *
 * 1. A consumer of `useTranslation()` only re-renders when `language` actually
 *    changes — not when the LanguageProvider's parent re-renders.
 * 2. Toggling the language still propagates to consumers (no broken memo).
 */

import React, { useRef } from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { LanguageProvider, useTranslation } from '@/i18n';

// React.memo'd so the consumer only re-renders when its context value
// reference changes — exactly the behavior we want to gate on.
const Consumer = React.memo(function Consumer() {
  const { t } = useTranslation();
  const renders = useRef(0);
  renders.current += 1;
  return (
    <div>
      <span data-testid="render-count">{renders.current}</span>
      <span data-testid="translated">{t('artifacts')}</span>
    </div>
  );
});

function LanguageSwitcher() {
  const { language, setLanguage } = useTranslation();
  return <button onClick={() => setLanguage(language === 'en' ? 'zh' : 'en')}>switch</button>;
}

describe('LanguageProvider memoization (CUR-54)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('does not re-render translation consumers when the provider parent re-renders', () => {
    let bumpParent: () => void = () => {};

    function Parent() {
      const [, setN] = React.useState(0);
      bumpParent = () => setN((n) => n + 1);
      return (
        <LanguageProvider>
          <Consumer />
        </LanguageProvider>
      );
    }

    render(<Parent />);
    const initial = Number(screen.getByTestId('render-count').textContent);
    expect(initial).toBeGreaterThan(0);

    act(() => {
      bumpParent();
      bumpParent();
      bumpParent();
    });

    // Without memoization the consumer would tick to `initial + 3` here.
    expect(Number(screen.getByTestId('render-count').textContent)).toBe(initial);
  });

  it('still propagates language changes through to consumers', () => {
    render(
      <LanguageProvider>
        <LanguageSwitcher />
        <Consumer />
      </LanguageProvider>,
    );

    expect(screen.getByTestId('translated').textContent).toBe('Pieces');

    fireEvent.click(screen.getByRole('button', { name: 'switch' }));

    expect(screen.getByTestId('translated').textContent).toBe('藏品');
  });
});
