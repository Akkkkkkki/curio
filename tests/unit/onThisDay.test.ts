/**
 * Unit test for "On This Day" logic with cascading fallbacks
 *
 * Tests the computation of history items that match with priority order:
 * 1. Same Month/Day from Prior Year
 * 2. Same Day from Prior Month (days 1-28 only)
 * 3. Same Day from Prior Week
 */

import { describe, it, expect } from 'vitest';
import { CollectionItem } from '@/types';

/**
 * Simulates the "On This Day" logic from App.tsx stats computation
 * with cascading fallback logic
 */
function findHistoryItem(allItems: CollectionItem[]): CollectionItem | undefined {
  const now = new Date();
  let historyItem: CollectionItem | undefined;

  // 1. Try: Same Month/Day from Prior Year
  historyItem = allItems.find((i) => {
    const d = new Date(i.createdAt);
    return (
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() < now.getFullYear()
    );
  });

  // 2. Fallback: Same Day from Prior Month (days 1-28 only)
  if (!historyItem && now.getDate() <= 28) {
    const priorMonth = new Date(now);
    priorMonth.setMonth(now.getMonth() - 1);

    historyItem = allItems.find((i) => {
      const d = new Date(i.createdAt);
      return (
        d.getDate() === now.getDate() &&
        d.getMonth() === priorMonth.getMonth() &&
        d.getFullYear() === priorMonth.getFullYear()
      );
    });
  }

  // 3. Fallback: Same Day from Prior Week
  if (!historyItem) {
    const priorWeek = new Date(now);
    priorWeek.setDate(now.getDate() - 7);

    historyItem = allItems.find((i) => {
      const d = new Date(i.createdAt);
      return (
        d.getDate() === priorWeek.getDate() &&
        d.getMonth() === priorWeek.getMonth() &&
        d.getFullYear() === priorWeek.getFullYear()
      );
    });
  }

  return historyItem;
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

  describe('Fallback: Same Day Prior Month (days 1-28)', () => {
    it('returns item from same day of prior month when no prior year match (day 15)', () => {
      // Use a fixed date to ensure stable test behavior
      const testDate = new Date(2026, 0, 15); // January 15, 2026
      const priorMonth = new Date(2025, 11, 15); // December 15, 2025

      const items: CollectionItem[] = [
        {
          id: 'item-prior-month',
          collectionId: 'col-1',
          photoUrl: 'blob:test',
          title: 'Prior Month Item',
          rating: 5,
          notes: '',
          data: {},
          createdAt: priorMonth.toISOString(),
          updatedAt: priorMonth.toISOString(),
        },
      ];

      // Mock the current date for this test
      const originalDate = Date;
      global.Date = class extends Date {
        constructor(...args: any[]) {
          if (args.length === 0) {
            super(testDate);
          } else {
            super(...args);
          }
        }
      } as any;

      const result = findHistoryItem(items);

      // Restore original Date
      global.Date = originalDate;

      expect(result).toBeDefined();
      expect(result?.id).toBe('item-prior-month');
    });

    it('skips prior month fallback for days > 28', () => {
      const testDate = new Date(2026, 0, 31); // January 31, 2026
      const priorMonth = new Date(2025, 11, 31); // December 31, 2025

      const items: CollectionItem[] = [
        {
          id: 'item-prior-month',
          collectionId: 'col-1',
          photoUrl: 'blob:test',
          title: 'Prior Month Item',
          rating: 5,
          notes: '',
          data: {},
          createdAt: priorMonth.toISOString(),
          updatedAt: priorMonth.toISOString(),
        },
      ];

      const originalDate = Date;
      global.Date = class extends Date {
        constructor(...args: any[]) {
          if (args.length === 0) {
            super(testDate);
          } else {
            super(...args);
          }
        }
      } as any;

      const result = findHistoryItem(items);

      global.Date = originalDate;

      // Should skip prior month fallback and try prior week instead
      // Since prior week doesn't match, result should be undefined
      expect(result).toBeUndefined();
    });

    it('prioritizes prior year over prior month', () => {
      const testDate = new Date(2026, 0, 15); // January 15, 2026
      const priorYear = new Date(2025, 0, 15); // January 15, 2025
      const priorMonth = new Date(2025, 11, 15); // December 15, 2025

      const items: CollectionItem[] = [
        {
          id: 'item-prior-month',
          collectionId: 'col-1',
          photoUrl: 'blob:test',
          title: 'Prior Month Item',
          rating: 5,
          notes: '',
          data: {},
          createdAt: priorMonth.toISOString(),
          updatedAt: priorMonth.toISOString(),
        },
        {
          id: 'item-prior-year',
          collectionId: 'col-1',
          photoUrl: 'blob:test',
          title: 'Prior Year Item',
          rating: 5,
          notes: '',
          data: {},
          createdAt: priorYear.toISOString(),
          updatedAt: priorYear.toISOString(),
        },
      ];

      const originalDate = Date;
      global.Date = class extends Date {
        constructor(...args: any[]) {
          if (args.length === 0) {
            super(testDate);
          } else {
            super(...args);
          }
        }
      } as any;

      const result = findHistoryItem(items);

      global.Date = originalDate;

      expect(result).toBeDefined();
      expect(result?.id).toBe('item-prior-year'); // Prior year takes priority
    });
  });

  describe('Fallback: Same Day Prior Week', () => {
    it('returns item from same day of prior week when no other matches', () => {
      const testDate = new Date(2026, 0, 17); // January 17, 2026 (Friday)
      const priorWeek = new Date(2026, 0, 10); // January 10, 2026 (Friday, 7 days ago)

      const items: CollectionItem[] = [
        {
          id: 'item-prior-week',
          collectionId: 'col-1',
          photoUrl: 'blob:test',
          title: 'Prior Week Item',
          rating: 5,
          notes: '',
          data: {},
          createdAt: priorWeek.toISOString(),
          updatedAt: priorWeek.toISOString(),
        },
      ];

      const originalDate = Date;
      global.Date = class extends Date {
        constructor(...args: any[]) {
          if (args.length === 0) {
            super(testDate);
          } else {
            super(...args);
          }
        }
      } as any;

      const result = findHistoryItem(items);

      global.Date = originalDate;

      expect(result).toBeDefined();
      expect(result?.id).toBe('item-prior-week');
    });

    it('prioritizes prior year and prior month over prior week', () => {
      const testDate = new Date(2026, 0, 15); // January 15, 2026
      const priorYear = new Date(2025, 0, 15); // January 15, 2025
      const priorMonth = new Date(2025, 11, 15); // December 15, 2025
      const priorWeek = new Date(2026, 0, 8); // January 8, 2026

      const items: CollectionItem[] = [
        {
          id: 'item-prior-week',
          collectionId: 'col-1',
          photoUrl: 'blob:test',
          title: 'Prior Week Item',
          rating: 5,
          notes: '',
          data: {},
          createdAt: priorWeek.toISOString(),
          updatedAt: priorWeek.toISOString(),
        },
        {
          id: 'item-prior-month',
          collectionId: 'col-1',
          photoUrl: 'blob:test',
          title: 'Prior Month Item',
          rating: 5,
          notes: '',
          data: {},
          createdAt: priorMonth.toISOString(),
          updatedAt: priorMonth.toISOString(),
        },
        {
          id: 'item-prior-year',
          collectionId: 'col-1',
          photoUrl: 'blob:test',
          title: 'Prior Year Item',
          rating: 5,
          notes: '',
          data: {},
          createdAt: priorYear.toISOString(),
          updatedAt: priorYear.toISOString(),
        },
      ];

      const originalDate = Date;
      global.Date = class extends Date {
        constructor(...args: any[]) {
          if (args.length === 0) {
            super(testDate);
          } else {
            super(...args);
          }
        }
      } as any;

      const result = findHistoryItem(items);

      global.Date = originalDate;

      expect(result).toBeDefined();
      expect(result?.id).toBe('item-prior-year'); // Prior year takes highest priority
    });

    it('returns undefined when no fallback matches', () => {
      const testDate = new Date(2026, 0, 17); // January 17, 2026
      const randomDate = new Date(2025, 5, 20); // June 20, 2025 (no match)

      const items: CollectionItem[] = [
        {
          id: 'item-random',
          collectionId: 'col-1',
          photoUrl: 'blob:test',
          title: 'Random Item',
          rating: 5,
          notes: '',
          data: {},
          createdAt: randomDate.toISOString(),
          updatedAt: randomDate.toISOString(),
        },
      ];

      const originalDate = Date;
      global.Date = class extends Date {
        constructor(...args: any[]) {
          if (args.length === 0) {
            super(testDate);
          } else {
            super(...args);
          }
        }
      } as any;

      const result = findHistoryItem(items);

      global.Date = originalDate;

      expect(result).toBeUndefined();
    });
  });
});
