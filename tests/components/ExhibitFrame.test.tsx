/**
 * ExhibitFrame Component Tests
 *
 * Tests the ExhibitFrame component which wraps images in a museum-style frame.
 * Validates rendering, theme support, sizing, and hover behavior.
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
      expect(frame.className).toContain('p-3');
      expect(frame.className).toContain('rounded-md');
    });

    it('renders with sm size when specified', () => {
      const { container } = renderWithProviders(
        <ExhibitFrame size="sm">
          <div>Content</div>
        </ExhibitFrame>,
      );

      const frame = container.firstChild as HTMLElement;
      expect(frame.className).toContain('p-2');
      expect(frame.className).toContain('rounded');
      expect(frame.className).not.toContain('rounded-md');
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
    it('has outer frame div with border and transition', () => {
      const { container } = renderWithProviders(
        <ExhibitFrame>
          <div>Content</div>
        </ExhibitFrame>,
      );

      const frame = container.firstChild as HTMLElement;
      expect(frame.className).toContain('border');
      expect(frame.className).toContain('transition-all');
      expect(frame.className).toContain('duration-200');
    });

    it('has hover lift effect', () => {
      const { container } = renderWithProviders(
        <ExhibitFrame>
          <div>Content</div>
        </ExhibitFrame>,
      );

      const frame = container.firstChild as HTMLElement;
      expect(frame.className).toContain('hover:-translate-y-0.5');
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
        expect(frame.className).toContain('bg-stone-100');
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
        expect(innerDiv.className).toContain('ring-stone-200');
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
        expect(frame.className).toContain('border-amber-600/40');
      });

      it('applies vault inner ring classes with amber accent', () => {
        const { container } = renderWithProviders(
          <ExhibitFrame>
            <div>Content</div>
          </ExhibitFrame>,
        );

        const innerDiv = (container.firstChild as HTMLElement).firstChild as HTMLElement;
        expect(innerDiv.className).toContain('ring-1');
        expect(innerDiv.className).toContain('ring-amber-500/20');
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
        expect(frame.className).toContain('bg-[#f0ebe0]');
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
        expect(innerDiv.className).toContain('ring-[#d4c9b8]');
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

      // Outer
      expect(frame.className).toContain('p-2');
      expect(frame.className).toMatch(/\brounded\b/);

      // Inner
      expect(innerDiv.className).toContain('rounded-sm');
    });

    it('md size has correct padding and border radius', () => {
      const { container } = renderWithProviders(
        <ExhibitFrame size="md">
          <div>Content</div>
        </ExhibitFrame>,
      );

      const frame = container.firstChild as HTMLElement;
      const innerDiv = frame.firstChild as HTMLElement;

      // Outer
      expect(frame.className).toContain('p-3');
      expect(frame.className).toContain('rounded-md');

      // Inner
      expect(innerDiv.className).toMatch(/\brounded\b/);
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
