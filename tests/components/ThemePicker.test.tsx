/**
 * Phase 4: ThemePicker Component Tests
 *
 * Validates layout rendering and theme selection actions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, setMockTheme, getMockSetTheme } from '../utils/test-utils';
import { ThemePicker } from '@/components/ThemePicker';

vi.mock('@/theme', async () => {
  const { createThemeMock } = await import('../utils/test-utils');
  return createThemeMock();
});

describe('ThemePicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMockTheme('gallery');
    getMockSetTheme().mockClear();
  });

  it('renders inline layout by default', () => {
    renderWithProviders(<ThemePicker />);

    expect(screen.getByText('App Aesthetic')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /gallery/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /vault/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /atelier/i })).toBeInTheDocument();
  });

  it('calls setTheme when a theme option is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ThemePicker />);

    await user.click(screen.getByRole('button', { name: /vault/i }));
    expect(getMockSetTheme()).toHaveBeenCalledWith('vault');
  });

  it('renders stacked layout when configured', () => {
    renderWithProviders(<ThemePicker layout="stacked" />);

    expect(screen.getByRole('button', { name: /gallery/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /vault/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /atelier/i })).toBeInTheDocument();
  });
});
