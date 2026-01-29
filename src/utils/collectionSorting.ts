import { CollectionItem } from '../types';

export type ItemSort = 'newest' | 'oldest' | 'title' | 'rating';

const getTimestamp = (item: CollectionItem) => item.updatedAt || item.createdAt || '';

export const sortCollectionItems = (items: CollectionItem[], sortBy: ItemSort) => {
  const sorted = [...items];
  switch (sortBy) {
    case 'oldest':
      sorted.sort((a, b) => getTimestamp(a).localeCompare(getTimestamp(b)));
      break;
    case 'title':
      sorted.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case 'rating':
      sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      break;
    case 'newest':
    default:
      sorted.sort((a, b) => getTimestamp(b).localeCompare(getTimestamp(a)));
      break;
  }
  return sorted;
};
