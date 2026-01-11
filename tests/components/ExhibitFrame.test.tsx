/**
 * ExhibitFrame Component Tests
 *
 * Tests the ExhibitFrame component which wraps images in a museum-style frame.
 * Validates rendering, theme support, sizing, and structure.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, setMockTheme, createThemeMock } from '../utils/test-utils';
import { ExhibitFrame } from '@/components/ExhibitFrame';

// Use centralized configurable theme mock
vi.mock('@/theme', async () => {
  const { createThemeMock } = await import('../utils/test-utils');
  return createThemeMock();
});

describe('ExhibitFrame Component', () => {
  // Reset theme to gallery before each test
  beforeEach(() => {
    setMockTheme('gallery');
  });

  describe('Basic Rendering', () => {
    it('renders children correctly', () => {
      renderWithProviders(
        <ExhibitFrame>
          <div data-testid="child-content">Test Content</div>
        </ExhibitFrame>,
      );

      expect(screen.getByTestId('child-content')).toBeInTheDocument();
      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('renders with default md size', () => {
      const { container } = renderWithProviders(
        <ExhibitFrame>
          <div>Content</div>
        </ExhibitFrame>,
      );

      const frame = container.firstChild as HTMLElement;
      expect(frame.className).toContain('sm:p-3');
      expect(frame.className).toContain('rounded');
    });

    it('renders with sm size when specified', () => {
      const { container } = renderWithProviders(
        <ExhibitFrame size="sm">
          <div>Content</div>
        </ExhibitFrame>,
      );

      const frame = container.firstChild as HTMLElement;
      expect(frame.className).toContain('sm:p-2');
      expect(frame.className).toContain('rounded-sm');
    });

    it('applies custom className', () => {
      const { container } = renderWithProviders(
        <ExhibitFrame className="custom-class">
          <div>Content</div>
        </ExhibitFrame>,
      );

      const frame = container.firstChild as HTMLElement;
      expect(frame.className).toContain('custom-class');
    });
  });

  describe('Structure', () => {
    it('has outer frame div with border', () => {
      const { container } = renderWithProviders(
        <ExhibitFrame>
          <div>Content</div>
        </ExhibitFrame>,
      );

      const frame = container.firstChild as HTMLElement;
      expect(frame.className).toContain('border');
    });

    it('has inner container with overflow hidden', () => {
      const { container } = renderWithProviders(
        <ExhibitFrame>
          <div>Content</div>
        </ExhibitFrame>,
      );

      const innerDiv = (container.firstChild as HTMLElement).firstChild as HTMLElement;
      expect(innerDiv.className).toContain('overflow-hidden');
    });
  });

  describe('Theme Support', () => {
    describe('Gallery theme', () => {
      beforeEach(() => {
        setMockTheme('gallery');
      });

      it('applies gallery frame classes', () => {
        const { container } = renderWithProviders(
          <ExhibitFrame>
            <div>Content</div>
          </ExhibitFrame>,
        );

        const frame = container.firstChild as HTMLElement;
        expect(frame.className).toContain('bg-stone-200/80');
        expect(frame.className).toContain('border-stone-300');
      });

      it('applies gallery inner ring classes', () => {
        const { container } = renderWithProviders(
          <ExhibitFrame>
            <div>Content</div>
          </ExhibitFrame>,
        );

        const innerDiv = (container.firstChild as HTMLElement).firstChild as HTMLElement;
        expect(innerDiv.className).toContain('ring-1');
        expect(innerDiv.className).toContain('ring-stone-300/80');
      });
    });

    describe('Vault theme', () => {
      beforeEach(() => {
        setMockTheme('vault');
      });

      it('applies vault frame classes with amber accent', () => {
        const { container } = renderWithProviders(
          <ExhibitFrame>
            <div>Content</div>
          </ExhibitFrame>,
        );

        const frame = container.firstChild as HTMLElement;
        expect(frame.className).toContain('bg-stone-800');
        expect(frame.className).toContain('border-amber-500/50');
      });

      it('applies vault inner ring classes with amber accent', () => {
        const { container } = renderWithProviders(
          <ExhibitFrame>
            <div>Content</div>
          </ExhibitFrame>,
        );

        const innerDiv = (container.firstChild as HTMLElement).firstChild as HTMLElement;
        expect(innerDiv.className).toContain('ring-1');
        expect(innerDiv.className).toContain('ring-amber-500/30');
      });
    });

    describe('Atelier theme', () => {
      beforeEach(() => {
        setMockTheme('atelier');
      });

      it('applies atelier frame classes with cream/brown colors', () => {
        const { container } = renderWithProviders(
          <ExhibitFrame>
            <div>Content</div>
          </ExhibitFrame>,
        );

        const frame = container.firstChild as HTMLElement;
        expect(frame.className).toContain('bg-[#e8e2d5]');
        expect(frame.className).toContain('border-[#c9bfab]');
      });

      it('applies atelier inner ring classes', () => {
        const { container } = renderWithProviders(
          <ExhibitFrame>
            <div>Content</div>
          </ExhibitFrame>,
        );

        const innerDiv = (container.firstChild as HTMLElement).firstChild as HTMLElement;
        expect(innerDiv.className).toContain('ring-1');
        expect(innerDiv.className).toContain('ring-[#c4b8a5]');
      });
    });
  });

  describe('Size Variants', () => {
    it('sm size has correct padding and border radius', () => {
      const { container } = renderWithProviders(
        <ExhibitFrame size="sm">
          <div>Content</div>
        </ExhibitFrame>,
      );

      const frame = container.firstChild as HTMLElement;
      const innerDiv = frame.firstChild as HTMLElement;

      // Outer - responsive padding
      expect(frame.className).toContain('p-1.5');
      expect(frame.className).toContain('sm:p-2');
      expect(frame.className).toContain('rounded-sm');

      // Inner
      expect(innerDiv.className).toContain('rounded-[2px]');
    });

    it('md size has correct padding and border radius', () => {
      const { container } = renderWithProviders(
        <ExhibitFrame size="md">
          <div>Content</div>
        </ExhibitFrame>,
      );

      const frame = container.firstChild as HTMLElement;
      const innerDiv = frame.firstChild as HTMLElement;

      // Outer - responsive padding
      expect(frame.className).toContain('p-2');
      expect(frame.className).toContain('sm:p-3');
      expect(frame.className).toMatch(/\brounded\b/);

      // Inner
      expect(innerDiv.className).toContain('rounded-sm');
    });
  });

  describe('Integration with ItemCard', () => {
    it('works correctly when wrapping an image element', () => {
      renderWithProviders(
        <ExhibitFrame size="sm">
          <img src="test.jpg" alt="Test Image" data-testid="test-image" />
        </ExhibitFrame>,
      );

      const image = screen.getByTestId('test-image');
      expect(image).toBeInTheDocument();
      expect(image.closest('div')).toHaveClass('overflow-hidden');
    });

    it('applies h-full class when passed', () => {
      const { container } = renderWithProviders(
        <ExhibitFrame className="h-full">
          <div>Content</div>
        </ExhibitFrame>,
      );

      const frame = container.firstChild as HTMLElement;
      expect(frame.className).toContain('h-full');
    });
  });
});
