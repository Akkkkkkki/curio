import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders, setMockTheme } from '../utils/test-utils';
import { ExhibitionView } from '@/components/ExhibitionView';
import { UserCollection } from '@/types';

vi.mock('@/theme', async () => {
  const { createThemeMock } = await import('../utils/test-utils');
  return createThemeMock();
});

vi.mock('@/components/ItemImage', () => ({
  ItemImage: ({ alt, className }: { alt: string; className?: string }) => (
    <div data-testid="mock-item-image" aria-label={alt} data-classname={className}>
      Mock Image
    </div>
  ),
}));

const collection: UserCollection = {
  id: 'col-1',
  templateId: 'vinyl',
  name: 'Vinyl Vault',
  customFields: [],
  items: [
    {
      id: 'item-1',
      collectionId: 'col-1',
      photoUrl: 'asset',
      title: 'Blue Train',
      rating: 5,
      data: {},
      notes: '',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'item-2',
      collectionId: 'col-1',
      photoUrl: 'asset',
      title: 'Kind of Blue',
      rating: 4,
      data: {},
      notes: '',
      createdAt: '2026-01-02T00:00:00.000Z',
    },
  ],
};

describe('ExhibitionView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMockTheme('gallery');
    document.body.innerHTML = '';
  });

  it('renders nothing when closed', () => {
    renderWithProviders(
      <ExhibitionView collection={collection} isOpen={false} onClose={vi.fn()} />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  describe('accessibility (CUR-131)', () => {
    it('renders as a labelled modal dialog', () => {
      renderWithProviders(
        <ExhibitionView collection={collection} isOpen={true} onClose={vi.fn()} />,
      );
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      // Accessible name should carry both the collection identity and the
      // current exhibit position so screen readers announce useful context.
      expect(dialog).toHaveAccessibleName(/Vinyl Vault/);
      expect(dialog).toHaveAccessibleName(/1.*2/);
    });

    it('closes on Escape via the shared modal primitive', async () => {
      const onClose = vi.fn();
      renderWithProviders(
        <ExhibitionView collection={collection} isOpen={true} onClose={onClose} />,
      );

      fireEvent.keyDown(document, { key: 'Escape' });

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1);
      });
    });

    it('keeps landscape/square photos uncropped on both layouts (CUR-133)', () => {
      renderWithProviders(
        <ExhibitionView collection={collection} isOpen={true} onClose={vi.fn()} />,
      );
      // Both mobile and desktop layouts render an ItemImage; neither should
      // crop with object-cover — the exhibit is the "show off" surface.
      const images = screen.getAllByTestId('mock-item-image');
      expect(images.length).toBeGreaterThanOrEqual(2);
      for (const image of images) {
        const className = image.getAttribute('data-classname') ?? '';
        expect(className).toContain('object-contain');
        expect(className).not.toContain('object-cover');
      }
    });

    it('labels pagination dots and marks the current exhibit (CUR-132)', async () => {
      renderWithProviders(
        <ExhibitionView collection={collection} isOpen={true} onClose={vi.fn()} />,
      );

      const firstExhibitDots = screen.getAllByRole('button', { name: 'Jump to exhibit 1' });
      const secondExhibitDots = screen.getAllByRole('button', { name: 'Jump to exhibit 2' });

      // Both mobile and desktop layouts are mounted; the ARIA contract must
      // stay consistent across each set of pagination controls.
      expect(firstExhibitDots).toHaveLength(2);
      expect(secondExhibitDots).toHaveLength(2);
      for (const dot of firstExhibitDots) {
        expect(dot).toHaveAttribute('aria-current', 'true');
      }
      for (const dot of secondExhibitDots) {
        expect(dot).not.toHaveAttribute('aria-current');
      }

      fireEvent.click(secondExhibitDots[0]);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toHaveAccessibleName(/2.*2/);
      });
      for (const dot of screen.getAllByRole('button', { name: 'Jump to exhibit 2' })) {
        expect(dot).toHaveAttribute('aria-current', 'true');
      }
      for (const dot of screen.getAllByRole('button', { name: 'Jump to exhibit 1' })) {
        expect(dot).not.toHaveAttribute('aria-current');
      }
    });

    it('keeps ArrowRight / ArrowLeft navigation working alongside Esc', async () => {
      const onClose = vi.fn();
      renderWithProviders(
        <ExhibitionView collection={collection} isOpen={true} onClose={onClose} />,
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAccessibleName(/1.*2/);

      fireEvent.keyDown(window, { key: 'ArrowRight' });
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toHaveAccessibleName(/2.*2/);
      });
      // Navigation must not trigger the close handler.
      expect(onClose).not.toHaveBeenCalled();

      fireEvent.keyDown(window, { key: 'ArrowLeft' });
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toHaveAccessibleName(/1.*2/);
      });
      expect(onClose).not.toHaveBeenCalled();
    });

    it('clamps the active exhibit when live sync removes later items', async () => {
      const { rerender } = renderWithProviders(
        <ExhibitionView collection={collection} initialIndex={1} isOpen={true} onClose={vi.fn()} />,
      );
      expect(screen.getByRole('dialog')).toHaveAccessibleName(/2.*2/);

      rerender(
        <ExhibitionView
          collection={{ ...collection, items: [collection.items[0]] }}
          initialIndex={1}
          isOpen={true}
          onClose={vi.fn()}
        />,
      );

      expect(screen.getByRole('dialog')).toHaveAccessibleName(/1.*1/);
      expect(screen.getAllByText('Blue Train').length).toBeGreaterThan(0);
    });
  });

  describe('auto-play (CUR-32)', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('offers no auto-play controls for a single-item collection', () => {
      const single: UserCollection = { ...collection, items: [collection.items[0]] };
      renderWithProviders(<ExhibitionView collection={single} isOpen={true} onClose={vi.fn()} />);
      expect(screen.queryByRole('button', { name: 'Start auto-play' })).not.toBeInTheDocument();
    });

    it('advances on the selected interval and stops when paused', () => {
      vi.useFakeTimers();
      renderWithProviders(
        <ExhibitionView collection={collection} isOpen={true} onClose={vi.fn()} />,
      );

      // Both layouts mount, so the toggle exists twice; either drives shared state.
      const play = screen.getAllByRole('button', { name: 'Start auto-play' });
      expect(play).toHaveLength(2);
      act(() => {
        fireEvent.click(play[0]);
      });

      // Default cadence is 10s; nothing should advance before it elapses.
      act(() => {
        vi.advanceTimersByTime(9000);
      });
      expect(screen.getByRole('dialog')).toHaveAccessibleName(/1.*2/);

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.getByRole('dialog')).toHaveAccessibleName(/2.*2/);

      // Pausing halts the timer.
      const pause = screen.getAllByRole('button', { name: 'Pause auto-play' });
      act(() => {
        fireEvent.click(pause[0]);
      });
      act(() => {
        vi.advanceTimersByTime(20000);
      });
      expect(screen.getByRole('dialog')).toHaveAccessibleName(/2.*2/);
    });

    it('honors a shorter selected interval', () => {
      vi.useFakeTimers();
      renderWithProviders(
        <ExhibitionView collection={collection} isOpen={true} onClose={vi.fn()} />,
      );

      act(() => {
        fireEvent.click(screen.getAllByRole('button', { name: 'Start auto-play' })[0]);
      });
      act(() => {
        fireEvent.click(screen.getAllByRole('button', { name: 'Auto-advance every 5 seconds' })[0]);
      });

      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(screen.getByRole('dialog')).toHaveAccessibleName(/2.*2/);
    });

    it('restarts the countdown when the user navigates manually', () => {
      vi.useFakeTimers();
      renderWithProviders(
        <ExhibitionView collection={collection} isOpen={true} onClose={vi.fn()} />,
      );

      act(() => {
        fireEvent.click(screen.getAllByRole('button', { name: 'Start auto-play' })[0]);
      });
      // Part-way through the interval, the user jumps ahead themselves.
      act(() => {
        vi.advanceTimersByTime(6000);
      });
      act(() => {
        fireEvent.click(screen.getAllByRole('button', { name: 'Jump to exhibit 2' })[0]);
      });
      expect(screen.getByRole('dialog')).toHaveAccessibleName(/2.*2/);

      // The remaining 4s of the old countdown must not trigger an advance —
      // the timer restarts from the interaction.
      act(() => {
        vi.advanceTimersByTime(4000);
      });
      expect(screen.getByRole('dialog')).toHaveAccessibleName(/2.*2/);

      // A full interval after the interaction does advance (wrapping to 1).
      act(() => {
        vi.advanceTimersByTime(6000);
      });
      expect(screen.getByRole('dialog')).toHaveAccessibleName(/1.*2/);
    });
  });
});
