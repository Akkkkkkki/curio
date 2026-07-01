import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '../utils/test-utils';
import { ItemImage } from '@/components/ItemImage';

vi.mock('@/services/db', () => ({
  extractCurioAssetPath: vi.fn(() => null),
  getAsset: vi.fn(async () => null),
  getEnhancedAsset: vi.fn(async () => null),
}));

describe('ItemImage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Direct-source fallback (CUR-120)', () => {
    it('renders the Image Error tile when a direct-URL photo fails to load', () => {
      renderWithProviders(
        <ItemImage itemId="truffle-1" photoUrl="https://example.com/missing.jpg" alt="A truffle" />,
      );

      const img = screen.getByAltText('A truffle') as HTMLImageElement;
      expect(img.src).toBe('https://example.com/missing.jpg');

      fireEvent.error(img);

      expect(screen.getByText('Image Error')).toBeInTheDocument();
      expect(screen.queryByAltText('A truffle')).not.toBeInTheDocument();
      expect(
        screen
          .queryAllByRole('img')
          .some((node) => (node as HTMLImageElement).src.includes('sample-vinyl.jpg')),
      ).toBe(false);
    });

    it('keeps a successful direct-URL render intact', () => {
      renderWithProviders(
        <ItemImage itemId="truffle-2" photoUrl="https://example.com/photo.jpg" alt="A photo" />,
      );

      const img = screen.getByAltText('A photo') as HTMLImageElement;
      expect(img.src).toBe('https://example.com/photo.jpg');
    });
  });

  describe('object-fit resolution (CUR-133)', () => {
    it('defaults to object-cover when the caller has not chosen a fit', () => {
      renderWithProviders(
        <ItemImage
          itemId="default-fit"
          photoUrl="https://example.com/a.jpg"
          alt="Default fit"
          className="w-full h-full"
        />,
      );
      const img = screen.getByAltText('Default fit') as HTMLImageElement;
      expect(img.className).toContain('object-cover');
      expect(img.className).toContain('w-full');
    });

    it('yields to a caller-provided object-contain (no object-cover collision)', () => {
      renderWithProviders(
        <ItemImage
          itemId="contain-caller"
          photoUrl="https://example.com/b.jpg"
          alt="Contain caller"
          className="w-full h-full object-contain"
        />,
      );
      const img = screen.getByAltText('Contain caller') as HTMLImageElement;
      // Without this guard, Tailwind's stylesheet order makes object-cover win
      // over object-contain, silently cropping the exhibition hero.
      expect(img.className).toContain('object-contain');
      expect(img.className).not.toMatch(/\bobject-cover\b/);
    });
  });
});
