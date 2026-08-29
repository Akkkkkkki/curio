const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

const assertContext = (context) => {
  if (!context || typeof context.userId !== 'string' || context.userId.trim().length === 0) {
    throw new Error('Authenticated agent context is required');
  }
};

const assertCollectionVisible = (collection, userId) => {
  if (!collection) return null;
  const ownerId = collection.ownerId ?? collection.user_id ?? collection.userId;
  const isPublic = collection.isPublic ?? collection.is_public ?? false;
  if (ownerId !== userId && !isPublic) throw new Error('Collection is not accessible');
  return collection;
};

const sanitizePageSize = (value) => {
  if (!Number.isFinite(value)) return DEFAULT_PAGE_SIZE;
  return Math.max(1, Math.min(Math.floor(value), MAX_PAGE_SIZE));
};

const publicCollectionShape = (collection) => ({
  id: collection.id,
  templateId: collection.templateId ?? collection.template_id,
  name: collection.name,
  icon: collection.icon ?? '',
  customFields:
    collection.customFields ?? collection.custom_fields ?? collection.settings?.customFields ?? [],
  collectionDescription:
    collection.collectionDescription ??
    collection.collection_description ??
    collection.settings?.description ??
    '',
  isPublic: collection.isPublic ?? collection.is_public ?? false,
});

const publicItemShape = (item) => ({
  id: item.id,
  collectionId: item.collectionId ?? item.collection_id,
  title: item.title,
  rating: item.rating ?? 0,
  notes: item.notes ?? '',
  data: item.data ?? {},
  createdAt: item.createdAt ?? item.created_at,
  updatedAt: item.updatedAt ?? item.updated_at,
});

/**
 * Creates the narrow domain-tool surface exposed to an agent runtime.
 *
 * `context.userId` must come from a verified server-side session. It is never
 * accepted from tool arguments. `gateway` is deliberately injected so this
 * contract stays independent of Supabase and of any particular agent SDK.
 */
export const createCurioReadTools = ({ gateway, context }) => {
  assertContext(context);
  if (!gateway) throw new Error('Agent data gateway is required');

  const getVisibleCollection = async (collectionId) => {
    if (typeof collectionId !== 'string' || collectionId.trim().length === 0) {
      throw new Error('collectionId is required');
    }
    const collection = await gateway.getCollection({
      collectionId,
      userId: context.userId,
    });
    return assertCollectionVisible(collection, context.userId);
  };

  return {
    async getCollection({ collectionId }) {
      const collection = await getVisibleCollection(collectionId);
      return collection ? publicCollectionShape(collection) : null;
    },

    async listCollectionItems({ collectionId, cursor = null, limit = DEFAULT_PAGE_SIZE } = {}) {
      const collection = await getVisibleCollection(collectionId);
      if (!collection) return { items: [], nextCursor: null };

      const page = await gateway.listCollectionItems({
        collectionId,
        userId: context.userId,
        cursor,
        limit: sanitizePageSize(limit),
      });
      return {
        items: (page?.items ?? []).map(publicItemShape),
        nextCursor: page?.nextCursor ?? null,
      };
    },

    async getItem({ itemId }) {
      if (typeof itemId !== 'string' || itemId.trim().length === 0) {
        throw new Error('itemId is required');
      }
      const item = await gateway.getItem({ itemId, userId: context.userId });
      if (!item) return null;
      const collectionId = item.collectionId ?? item.collection_id;
      await getVisibleCollection(collectionId);
      return publicItemShape(item);
    },

    async getCollectionSchema({ collectionId }) {
      const collection = await getVisibleCollection(collectionId);
      if (!collection) return null;
      return {
        collectionId: collection.id,
        templateId: collection.templateId ?? collection.template_id,
        fields:
          collection.customFields ??
          collection.custom_fields ??
          collection.settings?.customFields ??
          [],
      };
    },

    async computeCollectionStats({ collectionId }) {
      const collection = await getVisibleCollection(collectionId);
      if (!collection) return null;
      const stats = await gateway.computeCollectionStats({
        collectionId,
        userId: context.userId,
      });
      return {
        collectionId,
        itemCount: Number(stats?.itemCount ?? 0),
        ratedItemCount: Number(stats?.ratedItemCount ?? 0),
        averageRating: stats?.averageRating == null ? null : Number(stats.averageRating),
      };
    },
  };
};

export const AGENT_READ_TOOL_NAMES = Object.freeze([
  'getCollection',
  'listCollectionItems',
  'getItem',
  'getCollectionSchema',
  'computeCollectionStats',
]);

export const AGENT_TOOL_LIMITS = Object.freeze({
  defaultPageSize: DEFAULT_PAGE_SIZE,
  maxPageSize: MAX_PAGE_SIZE,
});
