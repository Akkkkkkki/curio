import { describe, it, expect } from 'vitest';
import { detectConflicts } from '@/utils/conflictDetection';
import { createMockCollection, createMockItem } from './fixtures/collections';

describe('detectConflicts', () => {
  it('detects item conflicts when cloud is newer', () => {
    const itemId = 'item-1';
    const localItem = createMockItem({
      id: itemId,
      title: 'Local Title',
      updatedAt: '2024-01-01T00:00:00Z',
    });
    const cloudItem = createMockItem({
      id: itemId,
      title: 'Cloud Title',
      updatedAt: '2024-02-01T00:00:00Z',
    });

    const localCollection = createMockCollection({
      id: 'col-1',
      items: [localItem],
      updatedAt: '2024-01-01T00:00:00Z',
    });
    const cloudCollection = createMockCollection({
      id: 'col-1',
      items: [cloudItem],
      updatedAt: '2024-02-01T00:00:00Z',
    });

    const conflicts = detectConflicts([localCollection], [cloudCollection]);
    expect(
      conflicts.some((conflict) => conflict.type === 'item' && conflict.itemId === itemId),
    ).toBe(true);
  });

  it('does not flag conflicts when local is newer', () => {
    const itemId = 'item-2';
    const localItem = createMockItem({
      id: itemId,
      title: 'Local Wins',
      updatedAt: '2024-03-01T00:00:00Z',
    });
    const cloudItem = createMockItem({
      id: itemId,
      title: 'Cloud',
      updatedAt: '2024-02-01T00:00:00Z',
    });

    const localCollection = createMockCollection({
      id: 'col-2',
      items: [localItem],
      updatedAt: '2024-03-01T00:00:00Z',
    });
    const cloudCollection = createMockCollection({
      id: 'col-2',
      items: [cloudItem],
      updatedAt: '2024-02-01T00:00:00Z',
    });

    const conflicts = detectConflicts([localCollection], [cloudCollection]);
    expect(conflicts.length).toBe(0);
  });
});
