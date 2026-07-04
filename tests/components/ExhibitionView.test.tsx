import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
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
  });
});
