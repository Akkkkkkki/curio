import { describe, it, expect } from 'vitest';
import { getOnThisDayItems } from '@/utils/onThisDay';
import { CollectionItem } from '@/types';

const makeLocalDate = (year: number, month: number, day: number, hour = 12, minute = 0) =>
  new Date(year, month, day, hour, minute, 0, 0);

const makeItem = (overrides: Partial<CollectionItem> & { id: string; createdAt: string }) => ({
  id: overrides.id,
  collectionId: 'col-1',
  photoUrl: 'blob:test',
  title: overrides.title ?? 'Test Item',
  rating: 5,
  notes: '',
  data: {},
  createdAt: overrides.createdAt,
  updatedAt: overrides.updatedAt ?? overrides.createdAt,
  ...overrides,
});

describe('On This Day Logic', () => {
  it('returns empty when there are no matching items', () => {
    const items: CollectionItem[] = [];
    const result = getOnThisDayItems(items, makeLocalDate(2026, 0, 17));
    expect(result).toEqual([]);
  });

  it('excludes items that do not match the current month/day', () => {
    const now = makeLocalDate(2026, 0, 17);
    const items = [
      makeItem({
        id: 'item-1',
        createdAt: makeLocalDate(2025, 0, 18).toISOString(),
      }),
    ];

    const result = getOnThisDayItems(items, now);
    expect(result).toEqual([]);
  });

  it('includes items created on the same month/day in previous years', () => {
    const now = makeLocalDate(2026, 0, 17);
    const items = [
      makeItem({
        id: 'item-1',
        createdAt: makeLocalDate(2025, 0, 17).toISOString(),
      }),
    ];

    const result = getOnThisDayItems(items, now);
    expect(result.map((item) => item.id)).toEqual(['item-1']);
  });

  it('excludes items created on the same month/day in the current year', () => {
    const now = makeLocalDate(2026, 0, 17);
    const items = [
      makeItem({
        id: 'item-1',
        createdAt: makeLocalDate(2026, 0, 17).toISOString(),
      }),
    ];

    const result = getOnThisDayItems(items, now);
    expect(result).toEqual([]);
  });

  it('falls back to prior month when no prior year matches (day <= 28)', () => {
    const now = makeLocalDate(2026, 0, 17);
    const priorMonth = makeLocalDate(2025, 11, 17);
    const items = [
      makeItem({
        id: 'item-prior-month',
        createdAt: priorMonth.toISOString(),
      }),
    ];

    const result = getOnThisDayItems(items, now);
    expect(result.map((item) => item.id)).toEqual(['item-prior-month']);
  });

  it('falls back to prior week when prior year and month are empty', () => {
    const now = makeLocalDate(2026, 0, 17);
    const priorWeek = makeLocalDate(2026, 0, 10);
    const items = [
      makeItem({
        id: 'item-prior-week',
        createdAt: priorWeek.toISOString(),
      }),
    ];

    const result = getOnThisDayItems(items, now);
    expect(result.map((item) => item.id)).toEqual(['item-prior-week']);
  });

  it('skips prior month fallback for days after 28', () => {
    const now = makeLocalDate(2026, 0, 31);
    const priorMonth = makeLocalDate(2025, 11, 31);
    const items = [
      makeItem({
        id: 'item-prior-month',
        createdAt: priorMonth.toISOString(),
      }),
    ];

    const result = getOnThisDayItems(items, now);
    expect(result).toEqual([]);
  });

  it('orders matches by newest year, then newest timestamp', () => {
    const now = makeLocalDate(2026, 0, 17);
    const items = [
      makeItem({
        id: 'item-1',
        createdAt: makeLocalDate(2024, 0, 17, 9).toISOString(),
        title: 'Two Years Ago',
      }),
      makeItem({
        id: 'item-2',
        createdAt: makeLocalDate(2025, 0, 17, 8).toISOString(),
        title: 'Last Year Morning',
      }),
      makeItem({
        id: 'item-3',
        createdAt: makeLocalDate(2025, 0, 17, 18).toISOString(),
        title: 'Last Year Evening',
      }),
    ];

    const result = getOnThisDayItems(items, now);
    expect(result.map((item) => item.id)).toEqual(['item-3', 'item-2', 'item-1']);
  });

  it('uses a stable tie-breaker for identical timestamps', () => {
    const now = makeLocalDate(2026, 0, 17);
    const createdAt = makeLocalDate(2025, 0, 17).toISOString();
    const items = [makeItem({ id: 'item-b', createdAt }), makeItem({ id: 'item-a', createdAt })];

    const result = getOnThisDayItems(items, now);
    expect(result.map((item) => item.id)).toEqual(['item-a', 'item-b']);
  });

  it('handles times near midnight without rolling the day', () => {
    const now = makeLocalDate(2026, 0, 17, 1, 0);
    const items = [
      makeItem({
        id: 'item-early',
        createdAt: makeLocalDate(2025, 0, 17, 0, 1).toISOString(),
      }),
      makeItem({
        id: 'item-late',
        createdAt: makeLocalDate(2025, 0, 17, 23, 59).toISOString(),
      }),
      makeItem({
        id: 'item-prior-day',
        createdAt: makeLocalDate(2025, 0, 16, 23, 59).toISOString(),
      }),
    ];

    const result = getOnThisDayItems(items, now);
    expect(result.map((item) => item.id)).toEqual(['item-late', 'item-early']);
  });
});
