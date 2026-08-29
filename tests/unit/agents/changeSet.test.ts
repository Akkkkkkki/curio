import { describe, expect, it } from 'vitest';
import { applyApprovedChangeSet, validateChangeSet } from '../../../src/agents/changeSet';
import type { UserCollection } from '../../../src/types';

const collection: UserCollection = {
  id: 'collection-1',
  templateId: 'custom',
  name: 'Tea tins',
  customFields: [],
  items: [
    {
      id: 'item-1',
      collectionId: 'collection-1',
      photoUrl: '',
      title: 'Old title',
      rating: 3,
      notes: 'A story',
      data: { origin: 'Unknown', _aiDescription: 'private system note' },
      createdAt: '2026-08-01T00:00:00.000Z',
    },
  ],
};

const validChangeSet = {
  id: 'run-1',
  changes: [
    {
      id: 'change-title',
      entity: 'item',
      entityId: 'item-1',
      field: 'title',
      before: 'Old title',
      after: 'Kyoto tea tin',
      reason: 'The maker mark identifies the object.',
      confidence: 0.94,
    },
    {
      id: 'change-origin',
      entity: 'item',
      entityId: 'item-1',
      field: 'data.origin',
      before: 'Unknown',
      after: 'Kyoto, Japan',
      reason: 'The label names Kyoto.',
      confidence: 0.88,
    },
  ],
};

describe('validateChangeSet', () => {
  it('accepts a machine-reviewable ChangeSet', () => {
    const result = validateChangeSet(validChangeSet);
    expect(result.valid).toBe(true);
    expect(result.value?.changes).toHaveLength(2);
  });

  it('rejects direct ownership, publication, and system-field changes', () => {
    const result = validateChangeSet({
      id: 'unsafe',
      changes: [
        {
          ...validChangeSet.changes[0],
          id: 'owner',
          entity: 'collection',
          field: 'ownerId',
        },
        {
          ...validChangeSet.changes[0],
          id: 'publish',
          entity: 'collection',
          field: 'isPublic',
        },
        { ...validChangeSet.changes[0], id: 'system', field: 'data._aiDescription' },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.errors.filter((error) => error.includes('not writable'))).toHaveLength(3);
  });

  it('rejects duplicate ids, non-scalar values, and invalid confidence', () => {
    const result = validateChangeSet({
      id: 'bad',
      changes: [
        validChangeSet.changes[0],
        {
          ...validChangeSet.changes[0],
          after: { nested: true },
          confidence: 2,
        },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('unique'))).toBe(true);
    expect(result.errors.some((error) => error.includes('scalar JSON'))).toBe(true);
    expect(result.errors.some((error) => error.includes('between 0 and 1'))).toBe(true);
  });
});

describe('applyApprovedChangeSet', () => {
  it('applies only individually approved changes without mutating the input', () => {
    const result = applyApprovedChangeSet(
      collection,
      validChangeSet as Parameters<typeof applyApprovedChangeSet>[1],
      new Set(['change-origin']),
    );

    expect(result.appliedChangeIds).toEqual(['change-origin']);
    expect(result.conflictedChangeIds).toEqual([]);
    expect(result.collection.items[0].title).toBe('Old title');
    expect(result.collection.items[0].data.origin).toBe('Kyoto, Japan');
    expect(collection.items[0].data.origin).toBe('Unknown');
  });

  it('refuses a stale proposal instead of overwriting a newer local value', () => {
    const locallyEdited = {
      ...collection,
      items: collection.items.map((item) =>
        item.id === 'item-1' ? { ...item, title: 'My newer title' } : item,
      ),
    };

    const result = applyApprovedChangeSet(
      locallyEdited,
      validChangeSet as Parameters<typeof applyApprovedChangeSet>[1],
      new Set(['change-title']),
    );

    expect(result.appliedChangeIds).toEqual([]);
    expect(result.conflictedChangeIds).toEqual(['change-title']);
    expect(result.collection.items[0].title).toBe('My newer title');
  });

  it('keeps approval separate from persistence for the local-first save path', () => {
    const result = applyApprovedChangeSet(
      collection,
      validChangeSet as Parameters<typeof applyApprovedChangeSet>[1],
      new Set(),
    );

    expect(result.collection).toEqual(collection);
    expect(result.appliedChangeIds).toEqual([]);
  });
});
