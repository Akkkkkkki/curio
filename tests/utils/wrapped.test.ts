import { describe, expect, it } from 'vitest';
import { buildWrappedSummary } from '../../src/utils/wrapped';
import type { CollectionItem, UserCollection } from '../../src/types';

const item = (
  overrides: Partial<CollectionItem> & Pick<CollectionItem, 'id' | 'createdAt'>,
): CollectionItem => ({
  id: overrides.id,
  collectionId: overrides.collectionId ?? 'c1',
  photoUrl: overrides.photoUrl ?? '',
  title: overrides.title ?? overrides.id,
  rating: overrides.rating ?? 0,
  data: overrides.data ?? {},
  createdAt: overrides.createdAt,
  updatedAt: overrides.updatedAt,
  notes: overrides.notes ?? '',
});

const collection = (id: string, name: string, items: CollectionItem[]): UserCollection => ({
  id,
  name,
  templateId: 'custom',
  customFields: [],
  items,
});

describe('buildWrappedSummary', () => {
  it('derives factual stats only from items created in the selected year', () => {
    const summary = buildWrappedSummary(
      [
        collection('c1', 'Cameras', [
          item({ id: 'a', createdAt: '2026-01-05T10:00:00Z', rating: 4 }),
          item({ id: 'b', createdAt: '2026-01-20T10:00:00Z', rating: 5 }),
        ]),
        collection('c2', 'Books', [
          item({ id: 'old', createdAt: '2025-01-20T10:00:00Z' }),
        ]),
      ],
      2026,
      new Date('2026-09-01T12:00:00Z'),
    );

    expect(summary.itemsAddedThisYear).toBe(2);
    expect(summary.totalCollections).toBe(1);
    expect(summary.collectionBreakdown).toEqual([
      { collectionId: 'c1', name: 'Cameras', itemCount: 2 },
    ]);
    expect(summary.busiestMonth).toEqual({ month: 0, itemCount: 2 });
    expect(summary.standoutItem?.id).toBe('b');
  });

  it('uses story depth only as a deterministic highlight signal and never invents copy', () => {
    const summary = buildWrappedSummary(
      [
        collection('c1', 'Objects', [
          item({ id: 'short', createdAt: '2026-02-01T00:00:00Z', notes: 'Found in Kyoto.' }),
          item({
            id: 'long',
            createdAt: '2026-03-01T00:00:00Z',
            notes: 'A longer memory written by the collector about why this object matters.',
          }),
        ]),
      ],
      2026,
    );

    expect(summary.storyHighlight?.id).toBe('long');
    expect(summary.storyHighlight?.notes).toContain('written by the collector');
  });

  it('keeps on-this-day candidates historical and caps them for a compact evidence payload', () => {
    const sameDay = [2021, 2022, 2023, 2024].map((year, index) =>
      item({
        id: `history-${year}`,
        createdAt: `${year}-09-01T08:00:00Z`,
        rating: index,
      }),
    );
    const currentYear = item({
      id: 'current',
      createdAt: '2026-09-01T08:00:00Z',
      rating: 5,
    });

    const summary = buildWrappedSummary(
      [collection('c1', 'Archive', [...sameDay, currentYear])],
      2026,
      new Date('2026-09-01T12:00:00Z'),
    );

    expect(summary.onThisDay).toHaveLength(3);
    expect(summary.onThisDay.map((candidate) => candidate.id)).not.toContain('current');
    expect(summary.onThisDay[0].id).toBe('history-2024');
  });

  it('ignores invalid dates instead of producing misleading stats', () => {
    const summary = buildWrappedSummary(
      [collection('c1', 'Archive', [item({ id: 'bad', createdAt: 'not-a-date', rating: 5 })])],
      2026,
    );

    expect(summary.itemsAddedThisYear).toBe(0);
    expect(summary.busiestMonth).toBeNull();
    expect(summary.standoutItem).toBeNull();
    expect(summary.collectionBreakdown).toEqual([]);
  });
});
