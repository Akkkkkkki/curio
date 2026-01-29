import { CollectionItem, UserCollection } from '../types';
import { compareTimestamps } from '../services/db';

export type ConflictEntry = {
  id: string;
  type: 'collection' | 'item';
  collectionId: string;
  itemId?: string;
  local: CollectionItem | UserCollection;
  cloud: CollectionItem | UserCollection;
};

const normalizeObject = (value: any): any => {
  if (Array.isArray(value)) {
    return value.map(normalizeObject);
  }
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, any>>((acc, key) => {
        acc[key] = normalizeObject(value[key]);
        return acc;
      }, {});
  }
  return value;
};

const collectionSignature = (collection: UserCollection) =>
  JSON.stringify(
    normalizeObject({
      name: collection.name,
      icon: collection.icon,
      templateId: collection.templateId,
      customFields: collection.customFields,
      collectionDescription: collection.collectionDescription,
      isPublic: collection.isPublic,
      isLocked: collection.isLocked,
    }),
  );

const itemSignature = (item: CollectionItem) =>
  JSON.stringify(
    normalizeObject({
      title: item.title,
      notes: item.notes,
      rating: item.rating,
      data: item.data,
      photoUrl: item.photoUrl,
      photoEnhancedPath: item.photoEnhancedPath,
    }),
  );

export const detectConflicts = (
  localCollections: UserCollection[],
  cloudCollections: UserCollection[],
): ConflictEntry[] => {
  const conflicts: ConflictEntry[] = [];
  const localMap = new Map(localCollections.map((col) => [col.id, col]));

  cloudCollections.forEach((cloudCol) => {
    const localCol = localMap.get(cloudCol.id);
    if (!localCol) return;

    const localStamp = localCol.updatedAt || localCol.createdAt;
    const cloudStamp = cloudCol.updatedAt || cloudCol.createdAt;
    const cloudWins = compareTimestamps(localStamp, cloudStamp) <= 0;

    if (cloudWins && collectionSignature(localCol) !== collectionSignature(cloudCol)) {
      conflicts.push({
        id: `collection:${cloudCol.id}:${cloudStamp || 'unknown'}`,
        type: 'collection',
        collectionId: cloudCol.id,
        local: localCol,
        cloud: cloudCol,
      });
    }

    const localItems = new Map(localCol.items.map((item) => [item.id, item]));
    cloudCol.items.forEach((cloudItem) => {
      const localItem = localItems.get(cloudItem.id);
      if (!localItem) return;
      const localItemStamp = localItem.updatedAt || localItem.createdAt;
      const cloudItemStamp = cloudItem.updatedAt || cloudItem.createdAt;
      const cloudItemWins = compareTimestamps(localItemStamp, cloudItemStamp) <= 0;
      if (cloudItemWins && itemSignature(localItem) !== itemSignature(cloudItem)) {
        conflicts.push({
          id: `item:${cloudCol.id}:${cloudItem.id}:${cloudItemStamp || 'unknown'}`,
          type: 'item',
          collectionId: cloudCol.id,
          itemId: cloudItem.id,
          local: localItem,
          cloud: cloudItem,
        });
      }
    });
  });

  return conflicts;
};
