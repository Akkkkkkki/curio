import { CollectionItem, UserCollection } from '../types';

export interface WrappedCollectionBreakdown {
  collectionId: string;
  name: string;
  itemCount: number;
}

export interface WrappedMonth {
  month: number;
  itemCount: number;
}

export interface WrappedSummary {
  year: number;
  totalCollections: number;
  totalItems: number;
  itemsAddedThisYear: number;
  collectionBreakdown: WrappedCollectionBreakdown[];
  busiestMonth: WrappedMonth | null;
  standoutItem: CollectionItem | null;
  storyHighlight: CollectionItem | null;
  onThisDay: CollectionItem[];
}

const parseDate = (value: string): Date | null => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const compareItems = (a: CollectionItem, b: CollectionItem): number => {
  if (a.rating !== b.rating) return b.rating - a.rating;

  const aStoryLength = a.notes?.trim().length ?? 0;
  const bStoryLength = b.notes?.trim().length ?? 0;
  if (aStoryLength !== bStoryLength) return bStoryLength - aStoryLength;

  const aCreated = parseDate(a.createdAt)?.getTime() ?? 0;
  const bCreated = parseDate(b.createdAt)?.getTime() ?? 0;
  return bCreated - aCreated;
};

export const buildWrappedSummary = (
  collections: UserCollection[],
  year: number,
  now: Date = new Date(),
): WrappedSummary => {
  const items = collections.flatMap((collection) => collection.items);
  const itemsThisYear = items.filter((item) => parseDate(item.createdAt)?.getUTCFullYear() === year);

  const monthCounts = new Map<number, number>();
  for (const item of itemsThisYear) {
    const month = parseDate(item.createdAt)?.getUTCMonth();
    if (month === undefined || month === null) continue;
    monthCounts.set(month, (monthCounts.get(month) ?? 0) + 1);
  }

  const busiestMonth =
    [...monthCounts.entries()]
      .sort(([monthA, countA], [monthB, countB]) => countB - countA || monthA - monthB)
      .map(([month, itemCount]) => ({ month, itemCount }))[0] ?? null;

  const standoutItem = [...itemsThisYear].sort(compareItems)[0] ?? null;
  const storyHighlight =
    [...itemsThisYear]
      .filter((item) => Boolean(item.notes?.trim()))
      .sort((a, b) => (b.notes?.trim().length ?? 0) - (a.notes?.trim().length ?? 0))[0] ?? null;

  const todayMonth = now.getUTCMonth();
  const todayDate = now.getUTCDate();
  const onThisDay = items
    .filter((item) => {
      const created = parseDate(item.createdAt);
      return (
        created !== null &&
        created.getUTCFullYear() < now.getUTCFullYear() &&
        created.getUTCMonth() === todayMonth &&
        created.getUTCDate() === todayDate
      );
    })
    .sort(compareItems)
    .slice(0, 3);

  const collectionBreakdown = collections
    .map((collection) => ({
      collectionId: collection.id,
      name: collection.name,
      itemCount: collection.items.filter(
        (item) => parseDate(item.createdAt)?.getUTCFullYear() === year,
      ).length,
    }))
    .filter((collection) => collection.itemCount > 0)
    .sort((a, b) => b.itemCount - a.itemCount || a.name.localeCompare(b.name));

  return {
    year,
    totalCollections: collectionBreakdown.length,
    totalItems: items.length,
    itemsAddedThisYear: itemsThisYear.length,
    collectionBreakdown,
    busiestMonth,
    standoutItem,
    storyHighlight,
    onThisDay,
  };
};
