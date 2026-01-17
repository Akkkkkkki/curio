/**
 * Unit test for "On This Day" logic
 *
 * Tests the computation of history items that match the current month/day
 * from previous years.
 */

import { describe, it, expect } from 'vitest';
import { CollectionItem } from '@/types';

/**
 * Simulates the "On This Day" logic from App.tsx stats computation
 */
function findHistoryItem(allItems: CollectionItem[]): CollectionItem | undefined {
  const now = new Date();
  return allItems.find((i) => {
    const d = new Date(i.createdAt);
    return (
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() < now.getFullYear()
    );
  });
}

describe('On This Day Logic', () => {
  it('returns undefined when there are no matching items', () => {
    const items: CollectionItem[] = [];
    const result = findHistoryItem(items);
    expect(result).toBeUndefined();
  });

  it('returns undefined when items exist but none match current date from previous years', () => {
    const today = new Date();
    const differentDate = new Date(today);
    differentDate.setDate(today.getDate() + 1); // Different day

    const items: CollectionItem[] = [
      {
        id: 'item-1',
        collectionId: 'col-1',
        photoUrl: 'blob:test',
        title: 'Test Item',
        rating: 5,
        notes: '',
        data: {},
        createdAt: differentDate.toISOString(),
        updatedAt: differentDate.toISOString(),
      },
    ];

    const result = findHistoryItem(items);
    expect(result).toBeUndefined();
  });

  it('returns item created on same month/day in a previous year', () => {
    const today = new Date();
    const lastYear = new Date(today);
    lastYear.setFullYear(today.getFullYear() - 1);

    const items: CollectionItem[] = [
      {
        id: 'item-1',
        collectionId: 'col-1',
        photoUrl: 'blob:test',
        title: 'Last Year Item',
        rating: 5,
        notes: '',
        data: {},
        createdAt: lastYear.toISOString(),
        updatedAt: lastYear.toISOString(),
      },
    ];

    const result = findHistoryItem(items);
    expect(result).toBeDefined();
    expect(result?.id).toBe('item-1');
  });

  it('returns undefined for items created on same date but current year', () => {
    const today = new Date();

    const items: CollectionItem[] = [
      {
        id: 'item-1',
        collectionId: 'col-1',
        photoUrl: 'blob:test',
        title: 'Today Item',
        rating: 5,
        notes: '',
        data: {},
        createdAt: today.toISOString(),
        updatedAt: today.toISOString(),
      },
    ];

    const result = findHistoryItem(items);
    expect(result).toBeUndefined();
  });

  it('returns the first matching item when multiple exist from previous years', () => {
    const today = new Date();
    const twoYearsAgo = new Date(today);
    twoYearsAgo.setFullYear(today.getFullYear() - 2);
    const oneYearAgo = new Date(today);
    oneYearAgo.setFullYear(today.getFullYear() - 1);

    const items: CollectionItem[] = [
      {
        id: 'item-1',
        collectionId: 'col-1',
        photoUrl: 'blob:test',
        title: 'Two Years Ago',
        rating: 5,
        notes: '',
        data: {},
        createdAt: twoYearsAgo.toISOString(),
        updatedAt: twoYearsAgo.toISOString(),
      },
      {
        id: 'item-2',
        collectionId: 'col-1',
        photoUrl: 'blob:test',
        title: 'One Year Ago',
        rating: 5,
        notes: '',
        data: {},
        createdAt: oneYearAgo.toISOString(),
        updatedAt: oneYearAgo.toISOString(),
      },
    ];

    const result = findHistoryItem(items);
    expect(result).toBeDefined();
    expect(result?.id).toBe('item-1'); // First match
  });
});
