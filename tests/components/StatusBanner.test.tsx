/**
 * StatusBanner Component Tests
 *
 * Sync feedback is one of the highest-trust surfaces in Curio; this suite
 * locks in that each tone keeps its semantic hue across the three themes.
 * Previously every tone collapsed to a neutral surface in Vault and the
 * light-mode hues clashed with the cream background in Atelier (CUR-81).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, setMockTheme, createThemeMock } from '../utils/test-utils';
import { StatusBanner, BannerTone } from '@/components/StatusBanner';
import { AppTheme } from '@/types';

// Use the centralized configurable theme mock so we can flip themes per test.
vi.mock('@/theme', async () => {
  const { createThemeMock } = await import('../utils/test-utils');
  return createThemeMock();
});

const getBanner = () => screen.getByRole('status');

describe('StatusBanner', () => {
  beforeEach(() => {
    setMockTheme('gallery');
  });

  describe('rendering and accessibility', () => {
    it('renders title and message with status role', () => {
      renderWithProviders(<StatusBanner title="Saved" message="Synced to cloud" />);
      const banner = getBanner();
      expect(banner).toHaveAttribute('aria-live', 'polite');
      expect(banner).toHaveTextContent('Saved');
      expect(banner).toHaveTextContent('Synced to cloud');
    });

    it('renders an optional action button and invokes the handler', async () => {
      const onAction = vi.fn();
      const userEvent = (await import('@testing-library/user-event')).default;
      const user = userEvent.setup();
      renderWithProviders(
        <StatusBanner
          title="Sync issue"
          message="We could not reach the cloud"
          tone="error"
          actionLabel="Retry"
          onAction={onAction}
        />,
      );
      await user.click(screen.getByRole('button', { name: /retry/i }));
      expect(onAction).toHaveBeenCalledTimes(1);
    });
  });

  describe('theme-aware tone surfaces (CUR-81)', () => {
    // Each entry: [tone, theme, expected class fragments that prove the tone
    // kept its semantic hue on that theme's surface].
    const cases: Array<[BannerTone, AppTheme, string[]]> = [
      ['error', 'gallery', ['bg-red-50', 'text-red-700', 'border-red-200']],
      ['error', 'vault', ['bg-red-500/10', 'text-red-300']],
      ['error', 'atelier', ['bg-red-100/70', 'text-red-800']],
      ['warning', 'gallery', ['bg-amber-50', 'text-amber-800', 'border-amber-200']],
      ['warning', 'vault', ['bg-amber-500/10', 'text-amber-200']],
      ['warning', 'atelier', ['bg-amber-100/70', 'text-amber-900']],
      ['success', 'gallery', ['bg-emerald-50', 'text-emerald-700', 'border-emerald-200']],
      ['success', 'vault', ['bg-emerald-500/10', 'text-emerald-300']],
      ['success', 'atelier', ['bg-emerald-100/70', 'text-emerald-800']],
      ['info', 'gallery', ['bg-stone-50', 'text-stone-700']],
      ['info', 'vault', ['bg-white/5', 'text-stone-300']],
      ['info', 'atelier', ['bg-[#EDE4D3]', 'text-[#3D3530]']],
    ];

    it.each(cases)('%s tone uses theme-appropriate classes in %s', (tone, theme, fragments) => {
      setMockTheme(theme);
      renderWithProviders(<StatusBanner title="T" message="M" tone={tone} />);
      const banner = getBanner();
      for (const fragment of fragments) {
        expect(banner).toHaveClass(fragment);
      }
    });

    it('does not collapse non-info tones to a neutral surface in Vault', () => {
      setMockTheme('vault');
      renderWithProviders(<StatusBanner title="Sync failed" message="Retry needed" tone="error" />);
      const banner = getBanner();
      // The pre-fix bug applied bg-white/5 to every tone in Vault, erasing the
      // semantic red. Guard against that regression explicitly.
      expect(banner).not.toHaveClass('bg-white/5');
      expect(banner.className).toMatch(/bg-red-/);
    });
  });
});
