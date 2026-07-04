import { describe, it, expect } from 'vitest';
import { deriveSelectOptions, matchesItemFilters } from '@/utils/itemFilter';
import { CollectionItem, FieldDefinition } from '@/types';

const createItem = (overrides: Partial<CollectionItem> = {}): CollectionItem => ({
  id: Math.random().toString(36).slice(2),
  collectionId: 'col-1',
  title: 'Item',
  rating: 0,
  notes: '',
  data: {},
  photoUrl: '',
  createdAt: new Date('2026-01-01').toISOString(),
  ...overrides,
});

const fields: FieldDefinition[] = [
  {
    id: 'genre',
    label: 'Genre',
    type: 'select',
    options: ['Jazz', 'Funk', 'Hip-Hop'],
    displayMode: 'primary',
  },
  { id: 'artist', label: 'Artist', type: 'text', displayMode: 'primary' },
  { id: 'year', label: 'Year', type: 'number', displayMode: 'badge' },
];

describe('matchesItemFilters', () => {
  it('passes when there are no active filters', () => {
    const item = createItem();
    expect(matchesItemFilters(item, {}, fields)).toBe(true);
  });

  it('ignores filters whose value is an empty string', () => {
    const item = createItem({ data: { genre: 'Jazz' } });
    expect(matchesItemFilters(item, { genre: '' }, fields)).toBe(true);
  });

  it('matches select fields by exact equality, ignoring case and stray whitespace', () => {
    const item = createItem({ data: { genre: 'Jazz' } });
    expect(matchesItemFilters(item, { genre: 'jazz' }, fields)).toBe(true);
    expect(matchesItemFilters(item, { genre: '  Jazz  ' }, fields)).toBe(true);
  });

  it('does not treat a select filter as a substring match', () => {
    // Guard against the previous behaviour where filtering by "Jazz" would
    // also match a value like "Free Jazz Improv".
    const item = createItem({ data: { genre: 'Free Jazz Improv' } });
    expect(matchesItemFilters(item, { genre: 'Jazz' }, fields)).toBe(false);
  });

  it('rejects items that are missing the select value entirely', () => {
    const item = createItem({ data: {} });
    expect(matchesItemFilters(item, { genre: 'Jazz' }, fields)).toBe(false);
  });

  it('still uses a substring match for plain text fields', () => {
    const item = createItem({ data: { artist: 'John Coltrane' } });
    expect(matchesItemFilters(item, { artist: 'coltrane' }, fields)).toBe(true);
  });

  it('applies the rating filter against the top-level rating, not item.data', () => {
    expect(matchesItemFilters(createItem({ rating: 4 }), { rating: '4' }, fields)).toBe(true);
    expect(matchesItemFilters(createItem({ rating: 3 }), { rating: '4' }, fields)).toBe(false);
  });

  it('requires all active filters to match', () => {
    const item = createItem({ rating: 5, data: { genre: 'Jazz', artist: 'Coltrane' } });
    expect(matchesItemFilters(item, { genre: 'Jazz', artist: 'davis' }, fields)).toBe(false);
    expect(matchesItemFilters(item, { genre: 'Jazz', artist: 'coltrane' }, fields)).toBe(true);
  });
});

describe('deriveSelectOptions', () => {
  it('returns declared options when no items are present', () => {
    expect(deriveSelectOptions('genre', ['Jazz', 'Funk'], [])).toEqual(['Funk', 'Jazz']);
  });

  it('unions declared options with values actually present on items', () => {
    const items = [
      createItem({ data: { genre: 'Ambient' } }),
      createItem({ data: { genre: 'Jazz' } }),
    ];
    expect(deriveSelectOptions('genre', ['Jazz', 'Funk'], items)).toEqual([
      'Ambient',
      'Funk',
      'Jazz',
    ]);
  });

  it('deduplicates case-insensitively while keeping the first spelling seen', () => {
    const items = [createItem({ data: { genre: 'jazz' } })];
    expect(deriveSelectOptions('genre', ['Jazz'], items)).toEqual(['Jazz']);
  });

  it('trims whitespace and drops empty values', () => {
    const items = [
      createItem({ data: { genre: '  Jazz  ' } }),
      createItem({ data: { genre: '' } }),
      createItem({ data: {} }),
    ];
    expect(deriveSelectOptions('genre', undefined, items)).toEqual(['Jazz']);
  });
});
