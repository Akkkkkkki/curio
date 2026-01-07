/**
 * Phase 4: CollectionCard Component Tests
 *
 * Tests the CollectionCard component which displays collection previews.
 * Validates rendering, accessibility, theme support, and interaction behavior.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  renderWithProviders,
  screen,
  fireEvent,
  setMockTheme,
  createThemeMock,
} from '../utils/test-utils';
import { CollectionCard } from '@/components/CollectionCard';
import { UserCollection } from '@/types';

// Use centralized configurable theme mock
vi.mock('@/theme', async () => {
  const { createThemeMock } = await import('../utils/test-utils');
  return createThemeMock();
});

// Test data factory
const createMockCollection = (overrides: Partial<UserCollection> = {}): UserCollection => ({
  id: 'test-collection-1',
  templateId: 'vinyl',
  name: 'My Vinyl Collection',
  icon: '🎵',
  customFields: [],
  items: [],
  ownerId: 'test-user-id',
  settings: { displayFields: [], badgeFields: [] },
  updatedAt: new Date('2024-01-01').toISOString(),
  ...overrides,
});

describe('CollectionCard Component', () => {
  // Reset theme to gallery before each test
  beforeEach(() => {
    setMockTheme('gallery');
  });

  describe('Basic Rendering', () => {
    it('renders collection name', () => {
      const collection = createMockCollection({ name: 'Test Collection' });
      const onClick = vi.fn();

      renderWithProviders(<CollectionCard collection={collection} onClick={onClick} />);

      expect(screen.getByText('Test Collection')).toBeInTheDocument();
    });

    it('renders with data-testid for testing', () => {
      const collection = createMockCollection();
      const onClick = vi.fn();

      renderWithProviders(<CollectionCard collection={collection} onClick={onClick} />);

      const card = screen.getByTestId('collection-card');
      expect(card).toBeInTheDocument();
      expect(card).toHaveAttribute('data-collection-id', 'test-collection-1');
    });

    it('displays the collection icon', () => {
      const collection = createMockCollection({ icon: '🍫' });
      const onClick = vi.fn();

      renderWithProviders(<CollectionCard collection={collection} onClick={onClick} />);

      // The icon appears in the background decoration
      expect(screen.getByText('🍫')).toBeInTheDocument();
    });

    it('displays template icon when collection has no custom icon', () => {
      const collection = createMockCollection({ icon: undefined, templateId: 'vinyl' });
      const onClick = vi.fn();

      renderWithProviders(<CollectionCard collection={collection} onClick={onClick} />);

      // Vinyl template has 🎵 icon
      expect(screen.getByText('🎵')).toBeInTheDocument();
    });

    it('displays template description', () => {
      const collection = createMockCollection({ templateId: 'chocolate' });
      const onClick = vi.fn();

      renderWithProviders(<CollectionCard collection={collection} onClick={onClick} />);

      expect(
        screen.getByText('Track terroir, cocoa percentages, and nuanced flavor profiles.'),
      ).toBeInTheDocument();
    });
  });

  describe('Item Count Display', () => {
    it('displays singular item count', () => {
      const collection = createMockCollection({
        items: [
          {
            id: 'item-1',
            collectionId: 'test-collection-1',
            photoUrl: 'blob:test',
            title: 'Item 1',
            rating: 5,
            notes: '',
            data: {},
            createdAt: new Date().toISOString(),
          },
        ],
      });
      const onClick = vi.fn();

      renderWithProviders(<CollectionCard collection={collection} onClick={onClick} />);

      expect(screen.getByText('1 item')).toBeInTheDocument();
    });

    it('displays plural item count for multiple items', () => {
      const items = Array.from({ length: 5 }, (_, i) => ({
        id: `item-${i}`,
        collectionId: 'test-collection-1',
        photoUrl: 'blob:test',
        title: `Item ${i}`,
        rating: 5,
        notes: '',
        data: {},
        createdAt: new Date().toISOString(),
      }));
      const collection = createMockCollection({ items });
      const onClick = vi.fn();

      renderWithProviders(<CollectionCard collection={collection} onClick={onClick} />);

      expect(screen.getByText('5 items')).toBeInTheDocument();
    });

    it('displays 0 items for empty collection', () => {
      const collection = createMockCollection({ items: [] });
      const onClick = vi.fn();

      renderWithProviders(<CollectionCard collection={collection} onClick={onClick} />);

      expect(screen.getByText('0 items')).toBeInTheDocument();
    });
  });

  describe('Sample/Public Collection Indicator', () => {
    it('displays read-only badge for public collection', () => {
      const collection = createMockCollection({ isPublic: true });
      const onClick = vi.fn();

      renderWithProviders(<CollectionCard collection={collection} onClick={onClick} />);

      expect(screen.getByText('Read-only')).toBeInTheDocument();
    });

    it('displays read-only badge for sample collection (id starts with sample)', () => {
      const collection = createMockCollection({ id: 'sample-vinyl-1', isPublic: false });
      const onClick = vi.fn();

      renderWithProviders(<CollectionCard collection={collection} onClick={onClick} />);

      expect(screen.getByText('Read-only')).toBeInTheDocument();
    });

    it('does not display read-only badge for regular collection', () => {
      const collection = createMockCollection({ isPublic: false });
      const onClick = vi.fn();

      renderWithProviders(<CollectionCard collection={collection} onClick={onClick} />);

      expect(screen.queryByText('Read-only')).not.toBeInTheDocument();
    });
  });

  describe('Click Handling', () => {
    it('calls onClick when card is clicked', () => {
      const collection = createMockCollection();
      const onClick = vi.fn();

      renderWithProviders(<CollectionCard collection={collection} onClick={onClick} />);

      fireEvent.click(screen.getByTestId('collection-card'));
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('calls onClick on Enter key press', () => {
      const collection = createMockCollection();
      const onClick = vi.fn();

      renderWithProviders(<CollectionCard collection={collection} onClick={onClick} />);

      const card = screen.getByTestId('collection-card');
      fireEvent.keyDown(card, { key: 'Enter' });
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('calls onClick on Space key press', () => {
      const collection = createMockCollection();
      const onClick = vi.fn();

      renderWithProviders(<CollectionCard collection={collection} onClick={onClick} />);

      const card = screen.getByTestId('collection-card');
      fireEvent.keyDown(card, { key: ' ' });
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('does not call onClick on other key presses', () => {
      const collection = createMockCollection();
      const onClick = vi.fn();

      renderWithProviders(<CollectionCard collection={collection} onClick={onClick} />);

      const card = screen.getByTestId('collection-card');
      fireEvent.keyDown(card, { key: 'Tab' });
      fireEvent.keyDown(card, { key: 'Escape' });
      fireEvent.keyDown(card, { key: 'a' });
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has role="button" for accessibility', () => {
      const collection = createMockCollection();
      const onClick = vi.fn();

      renderWithProviders(<CollectionCard collection={collection} onClick={onClick} />);

      const card = screen.getByTestId('collection-card');
      expect(card).toHaveAttribute('role', 'button');
    });

    it('has tabIndex=0 for keyboard focus', () => {
      const collection = createMockCollection();
      const onClick = vi.fn();

      renderWithProviders(<CollectionCard collection={collection} onClick={onClick} />);

      const card = screen.getByTestId('collection-card');
      expect(card).toHaveAttribute('tabIndex', '0');
    });

    it('is focusable via keyboard', () => {
      const collection = createMockCollection();
      const onClick = vi.fn();

      renderWithProviders(<CollectionCard collection={collection} onClick={onClick} />);

      const card = screen.getByTestId('collection-card');
      card.focus();
      expect(document.activeElement).toBe(card);
    });
  });

  describe('Theme Support', () => {
    describe.each([
      { theme: 'gallery' as const, bgPattern: /bg-white/, description: 'light background' },
      { theme: 'vault' as const, bgPattern: /bg-stone-950/, description: 'dark background' },
      { theme: 'atelier' as const, bgPattern: /bg-\[#f8f6f1\]/, description: 'cream background' },
    ])('Theme: $theme', ({ theme, bgPattern, description }) => {
      beforeEach(() => {
        setMockTheme(theme);
      });

      it(`renders correctly with ${theme} theme`, () => {
        const collection = createMockCollection();
        const onClick = vi.fn();

        renderWithProviders(<CollectionCard collection={collection} onClick={onClick} />);

        const card = screen.getByTestId('collection-card');
        expect(card).toBeInTheDocument();
        expect(screen.getByText('My Vinyl Collection')).toBeInTheDocument();
      });

      it(`applies ${description} styling for ${theme} theme`, () => {
        const collection = createMockCollection();
        const onClick = vi.fn();

        renderWithProviders(<CollectionCard collection={collection} onClick={onClick} />);

        const card = screen.getByTestId('collection-card');
        expect(card.className).toMatch(bgPattern);
      });

      it(`maintains interactive behavior with ${theme} theme`, () => {
        const collection = createMockCollection();
        const onClick = vi.fn();

        renderWithProviders(<CollectionCard collection={collection} onClick={onClick} />);

        fireEvent.click(screen.getByTestId('collection-card'));
        expect(onClick).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Template Accent Colors', () => {
    it('applies orange accent for chocolate template', () => {
      const collection = createMockCollection({ templateId: 'chocolate' });
      const onClick = vi.fn();

      renderWithProviders(<CollectionCard collection={collection} onClick={onClick} />);

      const card = screen.getByTestId('collection-card');
      expect(card.className).toMatch(/border-orange/);
    });

    it('applies indigo accent for vinyl template', () => {
      const collection = createMockCollection({ templateId: 'vinyl' });
      const onClick = vi.fn();

      renderWithProviders(<CollectionCard collection={collection} onClick={onClick} />);

      const card = screen.getByTestId('collection-card');
      expect(card.className).toMatch(/border-indigo/);
    });

    it('falls back to stone accent for unknown template', () => {
      const collection = createMockCollection({ templateId: 'unknown-template' });
      const onClick = vi.fn();

      renderWithProviders(<CollectionCard collection={collection} onClick={onClick} />);

      const card = screen.getByTestId('collection-card');
      // Should fall back to first template (general) or stone color
      expect(card.className).toMatch(/border-stone/);
    });
  });

  describe('Edge Cases', () => {
    it('handles very long collection name with truncation', () => {
      const longName =
        'This is a very long collection name that should be truncated in the UI to prevent layout issues';
      const collection = createMockCollection({ name: longName });
      const onClick = vi.fn();

      renderWithProviders(<CollectionCard collection={collection} onClick={onClick} />);

      const nameElement = screen.getByText(longName);
      expect(nameElement).toBeInTheDocument();
      expect(nameElement.className).toContain('truncate');
    });

    it('handles collection with no items array', () => {
      const collection = { ...createMockCollection(), items: [] };
      const onClick = vi.fn();

      renderWithProviders(<CollectionCard collection={collection} onClick={onClick} />);

      expect(screen.getByText('0 items')).toBeInTheDocument();
    });

    it('handles collection with undefined icon', () => {
      const collection = createMockCollection({ icon: undefined, templateId: 'general' });
      const onClick = vi.fn();

      renderWithProviders(<CollectionCard collection={collection} onClick={onClick} />);

      // Should fall back to template icon (general is ✨)
      expect(screen.getByText('✨')).toBeInTheDocument();
    });
  });

  describe('Visual Elements', () => {
    it('renders chevron right icon for navigation hint', () => {
      const collection = createMockCollection();
      const onClick = vi.fn();

      renderWithProviders(<CollectionCard collection={collection} onClick={onClick} />);

      // ChevronRight icon is rendered as SVG
      const svgElement = document.querySelector('svg');
      expect(svgElement).toBeInTheDocument();
    });

    it('has cursor-pointer for interactive indication', () => {
      const collection = createMockCollection();
      const onClick = vi.fn();

      renderWithProviders(<CollectionCard collection={collection} onClick={onClick} />);

      const card = screen.getByTestId('collection-card');
      expect(card.className).toContain('cursor-pointer');
    });
  });
});
