/**
 * Phase 4: ItemCard Component Tests
 *
 * Tests the ItemCard component which displays individual collection items.
 * Validates rendering, accessibility, theme support, and interaction behavior.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '../utils/test-utils';
import { ItemCard } from '@/components/ItemCard';
import { CollectionItem, FieldDefinition } from '@/types';

// Mock the theme module - uses gallery theme by default
vi.mock('@/theme', async () => {
  const actual = await vi.importActual('@/theme');
  return {
    ...actual,
    useTheme: () => ({ theme: 'gallery', setTheme: vi.fn() }),
  };
});

// Mock ItemImage component to avoid image loading complexity
vi.mock('@/components/ItemImage', () => ({
  ItemImage: ({ alt }: { alt: string }) => (
    <div data-testid="mock-item-image" aria-label={alt}>
      Mock Image
    </div>
  ),
}));

// Test data
const mockFields: FieldDefinition[] = [
  { id: 'artist', label: 'Artist', type: 'text', required: true },
  { id: 'album', label: 'Album', type: 'text', required: true },
  { id: 'year', label: 'Release Year', type: 'text', required: false },
  {
    id: 'condition',
    label: 'Condition',
    type: 'select',
    options: ['Mint', 'Good', 'Fair'],
    required: false,
  },
  { id: 'is_favorite', label: 'Favorite', type: 'boolean', required: false },
  { id: 'cacao_percent', label: 'Cacao %', type: 'number', required: false },
];

const createMockItem = (overrides: Partial<CollectionItem> = {}): CollectionItem => ({
  id: 'test-item-1',
  collectionId: 'test-collection-1',
  photoUrl: 'blob:test-photo',
  title: 'Abbey Road',
  rating: 4,
  notes: 'Classic album',
  data: {
    artist: 'The Beatles',
    album: 'The Album',
    year: '1969',
    condition: 'Mint',
  },
  createdAt: new Date('2024-01-01').toISOString(),
  updatedAt: new Date('2024-01-02').toISOString(),
  ...overrides,
});

describe('ItemCard Component', () => {
  describe('Basic Rendering', () => {
    it('renders item title', () => {
      const item = createMockItem();
      const onClick = vi.fn();

      renderWithProviders(
        <ItemCard
          item={item}
          fields={mockFields}
          displayFields={['artist', 'album']}
          badgeFields={['year']}
          onClick={onClick}
        />,
      );

      expect(screen.getByText('Abbey Road')).toBeInTheDocument();
    });

    it('renders with data-testid for testing', () => {
      const item = createMockItem();
      const onClick = vi.fn();

      renderWithProviders(
        <ItemCard
          item={item}
          fields={mockFields}
          displayFields={['artist']}
          badgeFields={[]}
          onClick={onClick}
        />,
      );

      const card = screen.getByTestId('item-card');
      expect(card).toBeInTheDocument();
      expect(card).toHaveAttribute('data-item-id', 'test-item-1');
      expect(card).toHaveAttribute('data-item-title', 'Abbey Road');
    });

    it('renders ItemImage component with correct alt text', () => {
      const item = createMockItem({ title: 'Test Album' });
      const onClick = vi.fn();

      renderWithProviders(
        <ItemCard
          item={item}
          fields={mockFields}
          displayFields={[]}
          badgeFields={[]}
          onClick={onClick}
        />,
      );

      const image = screen.getByTestId('mock-item-image');
      expect(image).toHaveAttribute('aria-label', 'Test Album');
    });
  });

  describe('Rating Display', () => {
    it('displays rating when greater than 0', () => {
      const item = createMockItem({ rating: 5 });
      const onClick = vi.fn();

      renderWithProviders(
        <ItemCard
          item={item}
          fields={mockFields}
          displayFields={[]}
          badgeFields={[]}
          onClick={onClick}
        />,
      );

      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('does not display rating when 0', () => {
      const item = createMockItem({ rating: 0 });
      const onClick = vi.fn();

      renderWithProviders(
        <ItemCard
          item={item}
          fields={mockFields}
          displayFields={[]}
          badgeFields={[]}
          onClick={onClick}
        />,
      );

      // Rating badge should not exist
      const ratingElements = screen.queryAllByText('0');
      // Filter to only find elements that would be in a rating context
      const ratingBadge = ratingElements.find((el) => el.closest('[class*="backdrop-blur"]'));
      expect(ratingBadge).toBeUndefined();
    });

    it('displays various rating values correctly', () => {
      [1, 2, 3, 4, 5].forEach((rating) => {
        const item = createMockItem({ id: `item-${rating}`, rating });
        const onClick = vi.fn();

        const { unmount } = renderWithProviders(
          <ItemCard
            item={item}
            fields={mockFields}
            displayFields={[]}
            badgeFields={[]}
            onClick={onClick}
          />,
        );

        expect(screen.getByText(rating.toString())).toBeInTheDocument();
        unmount();
      });
    });
  });

  describe('Display Fields', () => {
    it('renders display fields with labels and values', () => {
      const item = createMockItem();
      const onClick = vi.fn();

      renderWithProviders(
        <ItemCard
          item={item}
          fields={mockFields}
          displayFields={['artist', 'album']}
          badgeFields={[]}
          onClick={onClick}
        />,
      );

      expect(screen.getByText('The Beatles')).toBeInTheDocument();
      expect(screen.getByText('The Album')).toBeInTheDocument();
    });

    it('does not render display field if value is null or undefined', () => {
      const item = createMockItem({
        data: { artist: 'The Beatles' }, // album is missing
      });
      const onClick = vi.fn();

      renderWithProviders(
        <ItemCard
          item={item}
          fields={mockFields}
          displayFields={['artist', 'album']}
          badgeFields={[]}
          onClick={onClick}
        />,
      );

      expect(screen.getByText('The Beatles')).toBeInTheDocument();
      // Album value shouldn't appear since it's undefined
      expect(screen.queryAllByText('Abbey Road')).toHaveLength(1); // Only title, not field
    });

    it('formats boolean fields correctly', () => {
      const item = createMockItem({
        data: { is_favorite: true },
      });
      const onClick = vi.fn();

      renderWithProviders(
        <ItemCard
          item={item}
          fields={mockFields}
          displayFields={['is_favorite']}
          badgeFields={[]}
          onClick={onClick}
        />,
      );

      expect(screen.getByText('Yes')).toBeInTheDocument();
    });

    it('formats number fields with percent for percent fields', () => {
      const item = createMockItem({
        data: { cacao_percent: 72 },
      });
      const onClick = vi.fn();

      renderWithProviders(
        <ItemCard
          item={item}
          fields={mockFields}
          displayFields={['cacao_percent']}
          badgeFields={[]}
          onClick={onClick}
        />,
      );

      expect(screen.getByText('72%')).toBeInTheDocument();
    });
  });

  describe('Badge Fields', () => {
    it('renders badge fields', () => {
      const item = createMockItem({
        data: { year: '1969', condition: 'Mint' },
      });
      const onClick = vi.fn();

      renderWithProviders(
        <ItemCard
          item={item}
          fields={mockFields}
          displayFields={[]}
          badgeFields={['year', 'condition']}
          onClick={onClick}
        />,
      );

      expect(screen.getByText('1969')).toBeInTheDocument();
      expect(screen.getByText('Mint')).toBeInTheDocument();
    });

    it('does not render badge if value is missing', () => {
      const item = createMockItem({
        data: { year: '1969' }, // condition is missing
      });
      const onClick = vi.fn();

      renderWithProviders(
        <ItemCard
          item={item}
          fields={mockFields}
          displayFields={[]}
          badgeFields={['year', 'condition']}
          onClick={onClick}
        />,
      );

      expect(screen.getByText('1969')).toBeInTheDocument();
      expect(screen.queryByText('Mint')).not.toBeInTheDocument();
    });
  });

  describe('Click Handling', () => {
    it('calls onClick when card is clicked', () => {
      const item = createMockItem();
      const onClick = vi.fn();

      renderWithProviders(
        <ItemCard
          item={item}
          fields={mockFields}
          displayFields={[]}
          badgeFields={[]}
          onClick={onClick}
        />,
      );

      fireEvent.click(screen.getByTestId('item-card'));
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('calls onClick on Enter key press', () => {
      const item = createMockItem();
      const onClick = vi.fn();

      renderWithProviders(
        <ItemCard
          item={item}
          fields={mockFields}
          displayFields={[]}
          badgeFields={[]}
          onClick={onClick}
        />,
      );

      const card = screen.getByTestId('item-card');
      fireEvent.keyDown(card, { key: 'Enter' });
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('calls onClick on Space key press', () => {
      const item = createMockItem();
      const onClick = vi.fn();

      renderWithProviders(
        <ItemCard
          item={item}
          fields={mockFields}
          displayFields={[]}
          badgeFields={[]}
          onClick={onClick}
        />,
      );

      const card = screen.getByTestId('item-card');
      fireEvent.keyDown(card, { key: ' ' });
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('does not call onClick on other key presses', () => {
      const item = createMockItem();
      const onClick = vi.fn();

      renderWithProviders(
        <ItemCard
          item={item}
          fields={mockFields}
          displayFields={[]}
          badgeFields={[]}
          onClick={onClick}
        />,
      );

      const card = screen.getByTestId('item-card');
      fireEvent.keyDown(card, { key: 'Tab' });
      fireEvent.keyDown(card, { key: 'Escape' });
      fireEvent.keyDown(card, { key: 'a' });
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has role="button" for accessibility', () => {
      const item = createMockItem();
      const onClick = vi.fn();

      renderWithProviders(
        <ItemCard
          item={item}
          fields={mockFields}
          displayFields={[]}
          badgeFields={[]}
          onClick={onClick}
        />,
      );

      const card = screen.getByTestId('item-card');
      expect(card).toHaveAttribute('role', 'button');
    });

    it('has tabIndex=0 for keyboard focus', () => {
      const item = createMockItem();
      const onClick = vi.fn();

      renderWithProviders(
        <ItemCard
          item={item}
          fields={mockFields}
          displayFields={[]}
          badgeFields={[]}
          onClick={onClick}
        />,
      );

      const card = screen.getByTestId('item-card');
      expect(card).toHaveAttribute('tabIndex', '0');
    });

    it('is focusable via keyboard', () => {
      const item = createMockItem();
      const onClick = vi.fn();

      renderWithProviders(
        <ItemCard
          item={item}
          fields={mockFields}
          displayFields={[]}
          badgeFields={[]}
          onClick={onClick}
        />,
      );

      const card = screen.getByTestId('item-card');
      card.focus();
      expect(document.activeElement).toBe(card);
    });
  });

  describe('Layout Modes', () => {
    it('renders in grid layout by default', () => {
      const item = createMockItem();
      const onClick = vi.fn();

      renderWithProviders(
        <ItemCard
          item={item}
          fields={mockFields}
          displayFields={[]}
          badgeFields={[]}
          onClick={onClick}
        />,
      );

      const card = screen.getByTestId('item-card');
      expect(card.className).toContain('h-full');
    });

    it('renders in grid layout when specified', () => {
      const item = createMockItem();
      const onClick = vi.fn();

      renderWithProviders(
        <ItemCard
          item={item}
          fields={mockFields}
          displayFields={[]}
          badgeFields={[]}
          onClick={onClick}
          layout="grid"
        />,
      );

      const card = screen.getByTestId('item-card');
      expect(card.className).toContain('h-full');
    });

    it('renders in masonry layout when specified', () => {
      const item = createMockItem();
      const onClick = vi.fn();

      renderWithProviders(
        <ItemCard
          item={item}
          fields={mockFields}
          displayFields={[]}
          badgeFields={[]}
          onClick={onClick}
          layout="masonry"
        />,
      );

      const card = screen.getByTestId('item-card');
      // In masonry layout, h-full is not applied
      expect(card.className).not.toContain(' h-full ');
    });
  });

  describe('Theme Support', () => {
    it('renders correctly with default gallery theme', () => {
      const item = createMockItem();
      const onClick = vi.fn();

      renderWithProviders(
        <ItemCard
          item={item}
          fields={mockFields}
          displayFields={['artist']}
          badgeFields={['year']}
          onClick={onClick}
        />,
      );

      const card = screen.getByTestId('item-card');
      expect(card).toBeInTheDocument();
      expect(screen.getByText('Abbey Road')).toBeInTheDocument();
    });

    it('applies gallery theme light styling', () => {
      const item = createMockItem();
      const onClick = vi.fn();

      renderWithProviders(
        <ItemCard
          item={item}
          fields={mockFields}
          displayFields={['artist']}
          badgeFields={['year']}
          onClick={onClick}
        />,
      );

      const card = screen.getByTestId('item-card');
      // Gallery theme should have light background classes
      expect(card.className).toMatch(/bg-white/);
    });
  });

  describe('Edge Cases', () => {
    it('handles empty display fields array', () => {
      const item = createMockItem();
      const onClick = vi.fn();

      renderWithProviders(
        <ItemCard
          item={item}
          fields={mockFields}
          displayFields={[]}
          badgeFields={[]}
          onClick={onClick}
        />,
      );

      expect(screen.getByText('Abbey Road')).toBeInTheDocument();
    });

    it('handles empty badge fields array', () => {
      const item = createMockItem();
      const onClick = vi.fn();

      renderWithProviders(
        <ItemCard
          item={item}
          fields={mockFields}
          displayFields={['artist']}
          badgeFields={[]}
          onClick={onClick}
        />,
      );

      expect(screen.getByText('Abbey Road')).toBeInTheDocument();
      expect(screen.getByText('The Beatles')).toBeInTheDocument();
    });

    it('handles item with empty data object', () => {
      const item = createMockItem({ data: {} });
      const onClick = vi.fn();

      renderWithProviders(
        <ItemCard
          item={item}
          fields={mockFields}
          displayFields={['artist', 'album']}
          badgeFields={['year']}
          onClick={onClick}
        />,
      );

      // Title should still render
      expect(screen.getByText('Abbey Road')).toBeInTheDocument();
    });

    it('handles field not found in fields array', () => {
      const item = createMockItem({
        data: { unknown_field: 'Some value' },
      });
      const onClick = vi.fn();

      renderWithProviders(
        <ItemCard
          item={item}
          fields={mockFields}
          displayFields={['unknown_field']}
          badgeFields={[]}
          onClick={onClick}
        />,
      );

      // Should render the value even if field definition not found
      expect(screen.getByText('Some value')).toBeInTheDocument();
    });

    it('handles very long title with truncation', () => {
      const longTitle = 'This is a very long album title that should be truncated in the UI';
      const item = createMockItem({ title: longTitle });
      const onClick = vi.fn();

      renderWithProviders(
        <ItemCard
          item={item}
          fields={mockFields}
          displayFields={[]}
          badgeFields={[]}
          onClick={onClick}
        />,
      );

      const titleElement = screen.getByText(longTitle);
      expect(titleElement).toBeInTheDocument();
      expect(titleElement.className).toContain('line-clamp-1');
    });
  });
});
