import { UserCollection, CollectionItem, FieldDefinition } from '@/types';

/**
 * Mock test data for collections and items
 * Used across all test phases
 */

// Mock custom fields for vinyl collection template
export const mockVinylFields: FieldDefinition[] = [
  { id: 'artist', label: 'Artist', type: 'text', displayMode: 'primary' },
  { id: 'album', label: 'Album', type: 'text', displayMode: 'primary' },
  { id: 'year', label: 'Release Year', type: 'text', displayMode: 'badge' },
  {
    id: 'condition',
    label: 'Condition',
    type: 'select',
    options: ['Mint', 'Excellent', 'Good', 'Fair', 'Poor'],
    displayMode: 'badge',
  },
  { id: 'genre', label: 'Genre', type: 'text', displayMode: 'detail' },
];

// Mock custom fields for chocolate collection template
export const mockChocolateFields: FieldDefinition[] = [
  { id: 'brand', label: 'Brand', type: 'text', displayMode: 'primary' },
  { id: 'origin', label: 'Origin', type: 'text', displayMode: 'badge' },
  { id: 'cacao_percentage', label: 'Cacao %', type: 'text', displayMode: 'primary' },
  { id: 'tasting_notes', label: 'Tasting Notes', type: 'long_text', displayMode: 'detail' },
];

export const mockCollection: UserCollection = {
  id: 'test-collection-1',
  templateId: 'vinyl',
  name: 'Test Vinyl Collection',
  icon: '🎵',
  customFields: mockVinylFields,
  updatedAt: new Date('2024-01-01').toISOString(),
  items: [],
};

export const mockItem: CollectionItem = {
  id: 'test-item-1',
  collectionId: 'test-collection-1',
  title: 'Test Vinyl Record',
  rating: 5,
  notes: 'Classic album',
  data: {
    artist: 'The Beatles',
    album: 'Abbey Road',
    year: '1969',
  },
  photoUrl: 'blob:test-display',
  createdAt: new Date('2024-01-01').toISOString(),
  updatedAt: new Date('2024-01-01').toISOString(),
};

export const mockItemWithLegacyPath: CollectionItem = {
  ...mockItem,
  id: 'test-item-legacy',
  photoUrl: 'legacy/path.jpg',
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
    customFields: overrides.customFields || mockVinylFields,
    ...overrides,
    id: overrides.id || `mock-collection-${Date.now()}`,
  };
}

/**
 * Create a mock chocolate collection with chocolate fields
 */
export function createMockChocolateCollection(
  overrides: Partial<UserCollection> = {},
): UserCollection {
  return createMockCollection({
    templateId: 'chocolate',
    name: 'Test Chocolate Collection',
    icon: '🍫',
    customFields: mockChocolateFields,
    ...overrides,
  });
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
      collectionId: collectionId,
      title: `Test Item ${i + 1}`,
    }),
  );
}
