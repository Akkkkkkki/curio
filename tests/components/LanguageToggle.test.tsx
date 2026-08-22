/**
 * CUR-113: Language toggle in the header must expose an accessible name that
 * conveys both the action ("Switch language to …") and the target language,
 * not just an opaque "ZH" / "EN" code. The Globe icon and visible code are
 * decorative — only the aria-label should drive the accessible name.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  renderWithProviders,
  screen,
  fireEvent,
  setMockTheme,
  createThemeMock,
} from '../utils/test-utils';
import { LanguageToggle } from '@/components/LanguageToggle';

vi.mock('@/theme', async () => {
  const { createThemeMock } = await import('../utils/test-utils');
  return createThemeMock();
});

describe('LanguageToggle (CUR-113)', () => {
  beforeEach(() => {
    setMockTheme('gallery');
    // LanguageProvider persists the active language to localStorage; reset so
    // each test starts from the EN default regardless of execution order.
    window.localStorage.clear();
  });

  it('exposes an accessible name pointing at the target language and flips on click', () => {
    renderWithProviders(<LanguageToggle />);

    // EN is the default; the button should offer to switch to Chinese.
    const enButton = screen.getByRole('button', { name: 'Switch language to Chinese' });
    expect(enButton).toHaveAttribute('title', 'Switch language');

    fireEvent.click(enButton);

    // After toggling, the locale flips to ZH so both the action verb and the
    // target language name are now localised — this proves the new keys are
    // wired through `t()` rather than hardcoded English.
    expect(screen.getByRole('button', { name: '切换语言为英文' })).toBeInTheDocument();
  });

  it('reserves a >=44px coarse-pointer hit area without enlarging the desktop glyph', () => {
    // Issue #425: the header toggle rendered ~34px tall, below the 44px touch
    // minimum. The larger hit area is applied only on coarse pointers so the
    // desktop (fine-pointer) header keeps its compact height.
    renderWithProviders(<LanguageToggle />);

    const button = screen.getByRole('button', { name: /switch language to/i });
    expect(button.className).toContain('[@media(pointer:coarse)]:min-h-[44px]');
    expect(button.className).toContain('[@media(pointer:coarse)]:min-w-[44px]');
    expect(button.className).toContain('justify-center');
  });

  it('hides the Globe icon and target-code text from the accessibility tree', () => {
    renderWithProviders(<LanguageToggle />);

    const button = screen.getByRole('button', { name: /switch language to/i });

    // The "ZH" / "EN" code is purely visual — it must not contribute to the
    // accessible name. With aria-hidden the SR will only announce the label.
    const visibleCode = button.querySelector('span');
    expect(visibleCode).not.toBeNull();
    expect(visibleCode).toHaveAttribute('aria-hidden', 'true');
    expect(visibleCode?.textContent).toBe('ZH');

    const icon = button.querySelector('svg');
    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });
});
