import { describe, expect, it, vi } from 'vitest';
import {
  AGENT_READ_TOOL_NAMES,
  AGENT_TOOL_LIMITS,
  createCurioReadTools,
} from '../../server/agent/tools.js';

const ownedCollection = {
  id: 'collection-1',
  user_id: 'user-1',
  template_id: 'custom',
  name: 'Tea tins',
  icon: '🫖',
  is_public: false,
  settings: {
    customFields: [{ id: 'origin', label: 'Origin', type: 'text', displayMode: 'detail' }],
  },
};

const makeGateway = () => ({
  getCollection: vi.fn(async ({ collectionId }) =>
    collectionId === ownedCollection.id ? ownedCollection : null,
  ),
  listCollectionItems: vi.fn(async () => ({
    items: [
      {
        id: 'item-1',
        collection_id: 'collection-1',
        user_id: 'user-1',
        title: 'Kyoto tin',
        rating: 4,
        notes: 'Bought on a rainy afternoon.',
        data: { origin: 'Kyoto' },
        photo_original_path: 'private/path.jpg',
        created_at: '2026-08-01T00:00:00.000Z',
      },
    ],
    nextCursor: null,
  })),
  getItem: vi.fn(async () => ({
    id: 'item-1',
    collection_id: 'collection-1',
    user_id: 'user-1',
    title: 'Kyoto tin',
    rating: 4,
    notes: 'Bought on a rainy afternoon.',
    data: { origin: 'Kyoto' },
  })),
  computeCollectionStats: vi.fn(async () => ({
    itemCount: 1,
    ratedItemCount: 1,
    averageRating: 4,
  })),
});

describe('createCurioReadTools', () => {
  it('exposes only the narrow read-only domain surface', () => {
    const tools = createCurioReadTools({
      gateway: makeGateway(),
      context: { userId: 'user-1' },
    });
    expect(Object.keys(tools).sort()).toEqual([...AGENT_READ_TOOL_NAMES].sort());
    expect('querySql' in tools).toBe(false);
    expect('updateItem' in tools).toBe(false);
  });

  it('derives user identity from verified context rather than model arguments', async () => {
    const gateway = makeGateway();
    const tools = createCurioReadTools({ gateway, context: { userId: 'user-1' } });

    await tools.getCollection({ collectionId: 'collection-1', userId: 'attacker-user' });

    expect(gateway.getCollection).toHaveBeenCalledWith({
      collectionId: 'collection-1',
      userId: 'user-1',
    });
  });

  it('rejects a private collection owned by another user even if a gateway returns it', async () => {
    const gateway = makeGateway();
    gateway.getCollection.mockResolvedValueOnce({ ...ownedCollection, user_id: 'user-2' });
    const tools = createCurioReadTools({ gateway, context: { userId: 'user-1' } });

    await expect(tools.getCollection({ collectionId: 'collection-1' })).rejects.toThrow(
      'Collection is not accessible',
    );
  });

  it('allows an explicitly public collection while still using authenticated context', async () => {
    const gateway = makeGateway();
    gateway.getCollection.mockResolvedValueOnce({
      ...ownedCollection,
      user_id: 'user-2',
      is_public: true,
    });
    const tools = createCurioReadTools({ gateway, context: { userId: 'user-1' } });

    const result = await tools.getCollection({ collectionId: 'collection-1' });
    expect(result?.name).toBe('Tea tins');
  });

  it('caps page size and strips storage paths and ownership fields from item results', async () => {
    const gateway = makeGateway();
    const tools = createCurioReadTools({ gateway, context: { userId: 'user-1' } });

    const result = await tools.listCollectionItems({
      collectionId: 'collection-1',
      limit: 10_000,
    });

    expect(gateway.listCollectionItems).toHaveBeenCalledWith({
      collectionId: 'collection-1',
      userId: 'user-1',
      cursor: null,
      limit: AGENT_TOOL_LIMITS.maxPageSize,
    });
    expect(result.items[0]).not.toHaveProperty('user_id');
    expect(result.items[0]).not.toHaveProperty('photo_original_path');
  });

  it('requires authenticated context before creating any tools', () => {
    expect(() => createCurioReadTools({ gateway: makeGateway(), context: {} })).toThrow(
      'Authenticated agent context is required',
    );
  });
});
