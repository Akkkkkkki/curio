/**
 * CUR-162: the header theme toggle's accessible name must describe the action
 * (change theme) and reflect the currently active theme, rather than exposing
 * the noun "App Aesthetic". The visible "App Aesthetic" heading inside the
 * open picker menu is intentionally left unchanged.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders, setMockTheme, getMockSetTheme } from '../utils/test-utils';
import { ThemeQuickToggle } from '@/components/ThemeQuickToggle';

vi.mock('@/theme', async () => {
  const { createThemeMock } = await import('../utils/test-utils');
  return createThemeMock();
});

describe('ThemeQuickToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMockTheme('gallery');
    getMockSetTheme().mockClear();
  });

  it('names the toggle by its action and the active theme, not "App Aesthetic"', () => {
    renderWithProviders(<ThemeQuickToggle />);

    const toggle = screen.getByTestId('theme-picker');
    const name = toggle.getAttribute('aria-label') || '';
    expect(name).toMatch(/change theme/i);
    expect(name).toMatch(/gallery/i);
    expect(name).not.toBe('App Aesthetic');
    expect(toggle.getAttribute('title')).toBe('Change theme');
  });

  it('reflects the current theme in the accessible name', () => {
    setMockTheme('vault');
    renderWithProviders(<ThemeQuickToggle />);

    const toggle = screen.getByTestId('theme-picker');
    expect(toggle.getAttribute('aria-label')).toMatch(/vault/i);
  });

  it('keeps the popup semantics intact', () => {
    renderWithProviders(<ThemeQuickToggle />);

    const toggle = screen.getByTestId('theme-picker');
    expect(toggle.getAttribute('aria-haspopup')).toBe('menu');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });
});
