/**
 * StatusToast Component Tests
 *
 * Toast is the highest-frequency trust surface in Curio (every save, sync,
 * and error). This suite locks in that each tone keeps its semantic hue
 * across all three themes and that action / dismiss buttons stay readable
 * — previously the toast hardcoded the Gallery palette and looked like a
 * foreign object on Vault / Atelier (CUR-88, mirrors CUR-81 on StatusBanner).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, setMockTheme, createThemeMock } from '../utils/test-utils';
import userEvent from '@testing-library/user-event';
import { StatusToast, StatusTone } from '@/components/StatusToast';
import { AppTheme } from '@/types';

vi.mock('@/theme', async () => {
  const { createThemeMock } = await import('../utils/test-utils');
  return createThemeMock();
});

const getToast = () => screen.getByTestId('status-toast');

describe('StatusToast', () => {
  beforeEach(() => {
    setMockTheme('gallery');
  });

  describe('rendering and accessibility', () => {
    it('renders message with default info tone and status role', () => {
      renderWithProviders(<StatusToast message="Saved to archive" />);
      const toast = getToast();
      expect(toast).toHaveAttribute('role', 'status');
      expect(toast).toHaveAttribute('aria-live', 'polite');
      expect(screen.getByTestId('status-toast-message')).toHaveTextContent('Saved to archive');
    });

    it('renders action button and calls onAction', async () => {
      const onAction = vi.fn();
      const user = userEvent.setup();
      renderWithProviders(
        <StatusToast message="Sync failed" tone="error" actionLabel="Retry" onAction={onAction} />,
      );
      await user.click(screen.getByRole('button', { name: /retry/i }));
      expect(onAction).toHaveBeenCalledTimes(1);
    });

    it('renders dismiss button and calls onDismiss', async () => {
      const onDismiss = vi.fn();
      const user = userEvent.setup();
      renderWithProviders(<StatusToast message="Will sync later" onDismiss={onDismiss} />);
      await user.click(screen.getByRole('button', { name: /close/i }));
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });
  });

  describe('theme-aware tone surfaces (CUR-88)', () => {
    const cases: Array<[StatusTone, AppTheme, string[]]> = [
      ['success', 'gallery', ['bg-emerald-50', 'text-emerald-800', 'border-emerald-100']],
      ['success', 'vault', ['bg-emerald-500/10', 'text-emerald-200']],
      ['success', 'atelier', ['bg-emerald-100/70', 'text-emerald-900']],
      ['error', 'gallery', ['bg-red-50', 'text-red-700', 'border-red-100']],
      ['error', 'vault', ['bg-red-500/10', 'text-red-200']],
      ['error', 'atelier', ['bg-red-100/70', 'text-red-800']],
      ['warning', 'gallery', ['bg-amber-50', 'text-amber-800', 'border-amber-100']],
      ['warning', 'vault', ['bg-amber-500/10', 'text-amber-200']],
      ['warning', 'atelier', ['bg-amber-100/70', 'text-amber-900']],
      ['info', 'gallery', ['bg-stone-50', 'text-stone-700', 'border-stone-200']],
      ['info', 'vault', ['bg-white/5', 'text-stone-200']],
      ['info', 'atelier', ['bg-[#EDE4D3]', 'text-[#3D3530]']],
    ];

    it.each(cases)('%s tone uses theme-appropriate classes in %s', (tone, theme, fragments) => {
      setMockTheme(theme);
      renderWithProviders(<StatusToast message="m" tone={tone} />);
      const toast = getToast();
      for (const fragment of fragments) {
        expect(toast).toHaveClass(fragment);
      }
    });

    it('does not collapse non-info tones to the Gallery palette in Vault', () => {
      setMockTheme('vault');
      renderWithProviders(<StatusToast message="Sync failed" tone="error" />);
      const toast = getToast();
      // Pre-fix bug: every tone rendered with bg-red-50 in Vault, a foreign
      // light-mode surface floating over near-black. Guard explicitly.
      expect(toast).not.toHaveClass('bg-red-50');
      expect(toast.className).toMatch(/bg-red-500\/10/);
    });

    it('keeps action and dismiss buttons readable across themes', () => {
      const onAction = vi.fn();
      const onDismiss = vi.fn();
      setMockTheme('vault');
      renderWithProviders(
        <StatusToast
          message="Sync failed"
          tone="error"
          actionLabel="Retry"
          onAction={onAction}
          onDismiss={onDismiss}
        />,
      );
      // In Vault, the original `text-amber-700` action and `text-stone-400`
      // dismiss were too dim against the dark page — confirm they upgraded.
      expect(screen.getByRole('button', { name: /retry/i })).toHaveClass('text-amber-200');
      expect(screen.getByRole('button', { name: /close/i }).className).toMatch(/text-stone-/);
    });
  });
});
