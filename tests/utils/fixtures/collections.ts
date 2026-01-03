import { UserCollection, CollectionItem } from '@/types';

/**
 * Mock test data for collections and items
 * Used across all test phases
 */

export const mockCollection: UserCollection = {
  id: 'test-collection-1',
  user_id: 'test-user-id',
  template_id: 'vinyl',
  name: 'Test Vinyl Collection',
  icon: '🎵',
  settings: {},
  created_at: new Date('2024-01-01').toISOString(),
  updated_at: new Date('2024-01-01').toISOString(),
  items: [],
};

export const mockItem: CollectionItem = {
  id: 'test-item-1',
  collection_id: 'test-collection-1',
  user_id: 'test-user-id',
  title: 'Test Vinyl Record',
  rating: 5,
  notes: 'Classic album',
  data: {
    artist: 'The Beatles',
    album: 'Abbey Road',
    year: '1969',
  },
  photo_original_path: 'blob:test-original',
  photo_display_path: 'blob:test-display',
  created_at: new Date('2024-01-01').toISOString(),
  updated_at: new Date('2024-01-01').toISOString(),
};

export const mockItemWithLegacyPath: CollectionItem = {
  ...mockItem,
  id: 'test-item-legacy',
  photo_path: 'legacy/path.jpg',
  photo_original_path: undefined,
  photo_display_path: undefined,
};

export const mockCollectionWithItems: UserCollection = {
  ...mockCollection,
  items: [mockItem],
};

/**
 * Create a mock collection with custom properties
 */
export function createMockCollection(overrides: Partial<UserCollection> = {}): UserCollection {
  return {
    ...mockCollection,
    ...overrides,
    id: overrides.id || `mock-collection-${Date.now()}`,
  };
}

/**
 * Create a mock item with custom properties
 */
export function createMockItem(overrides: Partial<CollectionItem> = {}): CollectionItem {
  return {
    ...mockItem,
    ...overrides,
    id: overrides.id || `mock-item-${Date.now()}`,
  };
}

/**
 * Create multiple mock collections for batch testing
 */
export function createMockCollections(count: number): UserCollection[] {
  return Array.from({ length: count }, (_, i) =>
    createMockCollection({
      id: `mock-collection-${i}`,
      name: `Test Collection ${i + 1}`,
    }),
  );
}

/**
 * Create multiple mock items for batch testing
 */
export function createMockItems(count: number, collectionId: string): CollectionItem[] {
  return Array.from({ length: count }, (_, i) =>
    createMockItem({
      id: `mock-item-${i}`,
      collection_id: collectionId,
      title: `Test Item ${i + 1}`,
    }),
  );
}
