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

  it('shows checkmark for active theme', () => {
    setMockTheme('vault');
    renderWithProviders(<ThemePicker />);

    // The checkmark is an SVG, so we can check if the active button contains an SVG
    // or we can check if the active button has a specific class that indicates selection
    // In our implementation, we check if the checkmark icon is present within the active button

    const vaultButton = screen.getByRole('button', { name: /vault/i });
    // Lucide icons are rendered as SVGs. We can check for the presence of an SVG inside the button.
    expect(vaultButton.querySelector('svg.lucide-check')).toBeInTheDocument();

    const galleryButton = screen.getByRole('button', { name: /gallery/i });
    expect(galleryButton.querySelector('svg.lucide-check')).not.toBeInTheDocument();
  });
});
