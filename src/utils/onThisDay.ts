import { CollectionItem } from '@/types';

const compareHistoryItems = (a: CollectionItem, b: CollectionItem) => {
  const dateA = new Date(a.createdAt);
  const dateB = new Date(b.createdAt);
  const yearDiff = dateB.getFullYear() - dateA.getFullYear();
  if (yearDiff !== 0) return yearDiff;
  const timeDiff = dateB.getTime() - dateA.getTime();
  if (timeDiff !== 0) return timeDiff;
  return a.id.localeCompare(b.id);
};

export const getOnThisDayItems = (
  items: CollectionItem[],
  now: Date = new Date(),
): CollectionItem[] => {
  const targetMonth = now.getMonth();
  const targetDate = now.getDate();
  const targetYear = now.getFullYear();

  const matchesForDate = (year: number, month: number, date: number, requirePriorYear = false) =>
    items
      .filter((item) => {
        const createdAt = new Date(item.createdAt);
        if (Number.isNaN(createdAt.getTime())) return false;
        const matchesDay =
          createdAt.getDate() === date && createdAt.getMonth() === month;
        if (!matchesDay) return false;
        return requirePriorYear ? createdAt.getFullYear() < year : createdAt.getFullYear() === year;
      })
      .sort(compareHistoryItems);

  const priorYearMatches = matchesForDate(targetYear, targetMonth, targetDate, true);
  if (priorYearMatches.length > 0) return priorYearMatches;

  if (targetDate <= 28) {
    const priorMonth = new Date(now);
    priorMonth.setMonth(now.getMonth() - 1);
    const priorMonthMatches = matchesForDate(
      priorMonth.getFullYear(),
      priorMonth.getMonth(),
      targetDate,
    );
    if (priorMonthMatches.length > 0) return priorMonthMatches;
  }

  const priorWeek = new Date(now);
  priorWeek.setDate(now.getDate() - 7);
  return matchesForDate(priorWeek.getFullYear(), priorWeek.getMonth(), priorWeek.getDate());
};
