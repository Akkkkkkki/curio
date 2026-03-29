import { describe, it, expect } from 'vitest';
import { sortCollectionItems, ItemSort } from '@/utils/collectionSorting';
import { CollectionItem } from '@/types';

const createItem = (overrides: Partial<CollectionItem> = {}): CollectionItem => ({
  id: Math.random().toString(36).slice(2),
  collectionId: 'col-1',
  title: 'Item',
  rating: 0,
  notes: '',
  data: {},
  photoUrl: '',
  createdAt: new Date('2024-01-01').toISOString(),
  updatedAt: new Date('2024-01-01').toISOString(),
  ...overrides,
});

const runSort = (items: CollectionItem[], sortBy: ItemSort) =>
  sortCollectionItems(items, sortBy).map((item) => item.title);

describe('sortCollectionItems', () => {
  it('sorts by newest first (using createdAt)', () => {
    const items = [
      createItem({ title: 'Old', createdAt: '2024-01-01T00:00:00Z' }),
      createItem({ title: 'New', createdAt: '2024-02-01T00:00:00Z' }),
    ];
    expect(runSort(items, 'newest')).toEqual(['New', 'Old']);
  });

  it('sorts by oldest first (using createdAt)', () => {
    const items = [
      createItem({ title: 'Old', createdAt: '2024-01-01T00:00:00Z' }),
      createItem({ title: 'New', createdAt: '2024-02-01T00:00:00Z' }),
    ];
    expect(runSort(items, 'oldest')).toEqual(['Old', 'New']);
  });

  it('ignores updatedAt for newest/oldest sort', () => {
    const items = [
      createItem({
        title: 'Added first, edited recently',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-12-01T00:00:00Z',
      }),
      createItem({
        title: 'Added second, never edited',
        createdAt: '2024-06-01T00:00:00Z',
        updatedAt: '2024-06-01T00:00:00Z',
      }),
    ];
    expect(runSort(items, 'newest')).toEqual([
      'Added second, never edited',
      'Added first, edited recently',
    ]);
  });

  it('sorts by title', () => {
    const items = [createItem({ title: 'Bravo' }), createItem({ title: 'Alpha' })];
    expect(runSort(items, 'title')).toEqual(['Alpha', 'Bravo']);
  });

  it('sorts by rating descending', () => {
    const items = [
      createItem({ title: 'Low', rating: 2 }),
      createItem({ title: 'High', rating: 5 }),
    ];
    expect(runSort(items, 'rating')).toEqual(['High', 'Low']);
  });
});
