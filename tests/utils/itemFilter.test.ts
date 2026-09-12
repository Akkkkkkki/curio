import { describe, it, expect } from 'vitest';
import {
  ADDED_MONTH_FILTER_KEY,
  deriveAddedMonthOptions,
  deriveSelectOptions,
  formatAddedMonthLabel,
  matchesItemFilters,
  matchesSearchTerm,
} from '@/utils/itemFilter';
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

  it('filters by the item created month using a stable UTC year-month key', () => {
    const march = createItem({ createdAt: '2026-03-31T23:30:00.000Z' });
    expect(matchesItemFilters(march, { [ADDED_MONTH_FILTER_KEY]: '2026-03' }, fields)).toBe(true);
    expect(matchesItemFilters(march, { [ADDED_MONTH_FILTER_KEY]: '2026-04' }, fields)).toBe(false);
  });

  it('requires all active filters to match', () => {
    const item = createItem({
      rating: 5,
      createdAt: '2026-03-15T12:00:00.000Z',
      data: { genre: 'Jazz', artist: 'Coltrane' },
    });
    expect(matchesItemFilters(item, { genre: 'Jazz', artist: 'davis' }, fields)).toBe(false);
    expect(matchesItemFilters(item, { genre: 'Jazz', artist: 'coltrane' }, fields)).toBe(true);
    expect(
      matchesItemFilters(item, { genre: 'Jazz', [ADDED_MONTH_FILTER_KEY]: '2026-03' }, fields),
    ).toBe(true);
  });
});

describe('matchesSearchTerm', () => {
  it('matches every item when the term is empty', () => {
    expect(matchesSearchTerm(createItem(), '', fields)).toBe(true);
  });

  it('matches the title and the human-authored story (notes), case-insensitively', () => {
    const item = createItem({ title: 'Kind of Blue', notes: 'A gift from my father.' });
    expect(matchesSearchTerm(item, 'blue', fields)).toBe(true);
    expect(matchesSearchTerm(item, 'FATHER', fields)).toBe(true);
  });

  it('matches declared custom-field values', () => {
    const item = createItem({ data: { artist: 'John Coltrane', genre: 'Jazz' } });
    expect(matchesSearchTerm(item, 'coltrane', fields)).toBe(true);
    expect(matchesSearchTerm(item, 'jazz', fields)).toBe(true);
  });

  it('does not match hidden underscore-prefixed AI metadata', () => {
    const item = createItem({
      title: 'Untitled',
      data: { _aiDescription: 'A worn vinyl sleeve with faded gold lettering' },
    });
    expect(matchesSearchTerm(item, 'faded', fields)).toBe(false);
    // The visible title still matches as normal.
    expect(matchesSearchTerm(item, 'untitled', fields)).toBe(true);
  });

  it('does not match internal boolean flags stringified as true/false', () => {
    const item = createItem({
      data: { _storyMigrationDismissed: true, _isLegacyAiNotes: false },
    });
    expect(matchesSearchTerm(item, 'true', fields)).toBe(false);
    expect(matchesSearchTerm(item, 'false', fields)).toBe(false);
  });

  it('ignores data keys that are not declared fields even without an underscore', () => {
    const item = createItem({ data: { strayInternalKey: 'orphaned' } });
    expect(matchesSearchTerm(item, 'orphaned', fields)).toBe(false);
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

describe('deriveAddedMonthOptions', () => {
  it('returns only months represented by valid item dates, newest first', () => {
    const items = [
      createItem({ createdAt: '2025-12-04T12:00:00.000Z' }),
      createItem({ createdAt: '2026-03-02T12:00:00.000Z' }),
      createItem({ createdAt: '2026-03-28T12:00:00.000Z' }),
      createItem({ createdAt: 'not-a-date' }),
    ];

    expect(deriveAddedMonthOptions(items, 'en-US')).toEqual([
      { value: '2026-03', label: 'March 2026' },
      { value: '2025-12', label: 'December 2025' },
    ]);
  });

  it('formats labels using the active locale without changing filter keys', () => {
    const items = [createItem({ createdAt: '2026-03-02T12:00:00.000Z' })];
    const [option] = deriveAddedMonthOptions(items, 'zh-CN');
    expect(option.value).toBe('2026-03');
    expect(option.label).toContain('2026');
    expect(option.label).toContain('3');
  });
});

describe('formatAddedMonthLabel', () => {
  it('localizes a YYYY-MM filter value for chip display', () => {
    expect(formatAddedMonthLabel('2026-03', 'en-US')).toBe('March 2026');
    expect(formatAddedMonthLabel('2026-03', 'zh-CN')).toContain('2026');
  });

  it('returns the raw value when it is not a month key', () => {
    expect(formatAddedMonthLabel('5', 'en-US')).toBe('5');
    expect(formatAddedMonthLabel('2026-13', 'en-US')).toBe('2026-13');
  });
});
