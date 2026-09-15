import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders, screen, fireEvent, act, waitFor } from '../utils/test-utils';
import { setMockTheme } from '../utils/test-utils';
import { ItemImage } from '@/components/ItemImage';
import { getAsset } from '@/services/db';

vi.mock('@/services/db', () => ({
  extractCurioAssetPath: vi.fn(() => null),
  getAsset: vi.fn(async () => null),
  getEnhancedAsset: vi.fn(async () => null),
}));

// Route the real useTheme through the test-utils mock state so tests can drive
// theme via setMockTheme('vault' | 'atelier' | 'gallery').
vi.mock('@/theme', async () => {
  const { createThemeMock } = await import('../utils/test-utils');
  return createThemeMock();
});

describe('ItemImage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMockTheme('gallery');
  });

  afterEach(() => {
    setMockTheme('gallery');
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

  describe('themed placeholder surface (CUR-96)', () => {
    it('paints the no-source placeholder with the Vault mat instead of bg-stone-100', () => {
      setMockTheme('vault');
      const { container } = renderWithProviders(
        <ItemImage itemId="empty" photoUrl="" alt="Empty" className="h-full w-full" />,
      );

      const label = screen.getByText(/no photo/i);
      const placeholder = label.parentElement as HTMLElement | null;
      expect(placeholder).not.toBeNull();
      expect(placeholder!.className).toMatch(/bg-\[#1C1917\]/);
      expect(placeholder!.className).not.toMatch(/bg-stone-100/);
    });

    it('paints the error placeholder with the Vault mat when a direct-URL photo fails', () => {
      setMockTheme('vault');
      renderWithProviders(
        <ItemImage
          itemId="err"
          photoUrl="https://example.com/missing.jpg"
          alt="Broken"
          className="h-full w-full"
        />,
      );

      const img = screen.getByAltText('Broken') as HTMLImageElement;
      fireEvent.error(img);

      const label = screen.getByText(/image error/i);
      const placeholder = label.parentElement as HTMLElement | null;
      expect(placeholder).not.toBeNull();
      expect(placeholder!.className).toMatch(/bg-\[#1C1917\]/);
      expect(placeholder!.className).not.toMatch(/bg-stone-100/);
    });
  });

  describe('viewport-deferred asset loading (#147)', () => {
    it('does not fetch a DB-backed asset until the tile scrolls near the viewport', async () => {
      // Controllable IntersectionObserver that captures the callback instead of
      // firing it, so we can prove the fetch is gated on intersection.
      let trigger: ((isIntersecting: boolean) => void) | null = null;
      const observe = vi.fn();
      const disconnect = vi.fn();
      const originalIO = global.IntersectionObserver;
      global.IntersectionObserver = class {
        constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
          trigger = (isIntersecting) => cb([{ isIntersecting }]);
        }
        observe = observe;
        disconnect = disconnect;
        unobserve() {}
        takeRecords() {
          return [];
        }
      } as unknown as typeof IntersectionObserver;

      try {
        vi.mocked(getAsset).mockResolvedValue(new Blob(['x'], { type: 'image/jpeg' }));
        renderWithProviders(<ItemImage itemId="asset-1" photoUrl="asset" alt="Deferred" />);

        // Mounted but offscreen: the observer is watching, nothing fetched yet.
        expect(observe).toHaveBeenCalled();
        expect(getAsset).not.toHaveBeenCalled();

        // Scroll into view.
        await act(async () => {
          trigger?.(true);
        });

        await waitFor(() => expect(getAsset).toHaveBeenCalled());
        expect(disconnect).toHaveBeenCalled();
      } finally {
        global.IntersectionObserver = originalIO;
      }
    });

    it('reserves placeholder height for a deferred tile so masonry columns do not collapse', () => {
      // IO that never fires — the tile stays in the pending (offscreen) state.
      const originalIO = global.IntersectionObserver;
      global.IntersectionObserver = class {
        constructor() {}
        observe() {}
        disconnect() {}
        unobserve() {}
        takeRecords() {
          return [];
        }
      } as unknown as typeof IntersectionObserver;

      try {
        const { container } = renderWithProviders(
          <ItemImage itemId="asset-3" photoUrl="asset" alt="Pending" className="w-full h-auto" />,
        );
        // The pending skeleton must reserve vertical space; without it the
        // masonry wrapper (h-auto + absolute pulse) would be zero-height.
        const skeleton = container.firstElementChild as HTMLElement | null;
        expect(skeleton).not.toBeNull();
        expect(skeleton!.className).toMatch(/min-h-\[100px\]/);
      } finally {
        global.IntersectionObserver = originalIO;
      }
    });

    it('fetches immediately when IntersectionObserver is unavailable', async () => {
      const originalIO = global.IntersectionObserver;
      // Simulate an environment without IntersectionObserver support.
      delete (global as { IntersectionObserver?: unknown }).IntersectionObserver;

      try {
        vi.mocked(getAsset).mockResolvedValue(new Blob(['x'], { type: 'image/jpeg' }));
        renderWithProviders(<ItemImage itemId="asset-2" photoUrl="asset" alt="Immediate" />);

        await waitFor(() => expect(getAsset).toHaveBeenCalled());
      } finally {
        global.IntersectionObserver = originalIO;
      }
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
