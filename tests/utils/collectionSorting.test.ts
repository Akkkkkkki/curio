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
  it('sorts by newest first', () => {
    const items = [
      createItem({ title: 'Old', updatedAt: '2024-01-01T00:00:00Z' }),
      createItem({ title: 'New', updatedAt: '2024-02-01T00:00:00Z' }),
    ];
    expect(runSort(items, 'newest')).toEqual(['New', 'Old']);
  });

  it('sorts by oldest first', () => {
    const items = [
      createItem({ title: 'Old', updatedAt: '2024-01-01T00:00:00Z' }),
      createItem({ title: 'New', updatedAt: '2024-02-01T00:00:00Z' }),
    ];
    expect(runSort(items, 'oldest')).toEqual(['Old', 'New']);
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
