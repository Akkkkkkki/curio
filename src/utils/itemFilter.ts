import { CollectionItem, FieldDefinition } from '../types';

const normalize = (value: string) => value.trim().toLocaleLowerCase();

// `rating` is a reserved filter key that always compares against the item's
// top-level rating field, not a custom-field lookup on `item.data`.
export const RATING_FILTER_KEY = 'rating';

export function matchesItemFilters(
  item: CollectionItem,
  activeFilters: Record<string, string>,
  fields: FieldDefinition[],
): boolean {
  const fieldById = new Map(fields.map((f) => [f.id, f]));
  return Object.entries(activeFilters).every(([key, value]) => {
    if (!value) return true;
    if (key === RATING_FILTER_KEY) return item.rating >= parseInt(value, 10);
    const itemVal = item.data[key];
    if (itemVal === undefined || itemVal === null || itemVal === '') return false;
    const field = fieldById.get(key);
    // Select fields are picked from a canonical list, so a substring match would
    // silently include unrelated values (e.g. filtering by "Milk" would also
    // match "Milk Chocolate" if we ever added that option). Exact-equality —
    // case-insensitive to tolerate AI-extracted capitalisation drift — is the
    // right shape here.
    if (field?.type === 'select') {
      return normalize(String(itemVal)) === normalize(value);
    }
    return String(itemVal).toLocaleLowerCase().includes(value.toLocaleLowerCase());
  });
}

export function deriveSelectOptions(
  fieldId: string,
  declaredOptions: string[] | undefined,
  items: CollectionItem[],
): string[] {
  const seen = new Map<string, string>();
  const add = (raw: unknown) => {
    if (raw === undefined || raw === null) return;
    const value = String(raw).trim();
    if (!value) return;
    const key = value.toLocaleLowerCase();
    if (!seen.has(key)) seen.set(key, value);
  };
  for (const opt of declaredOptions ?? []) add(opt);
  for (const item of items) add(item.data[fieldId]);
  return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
}
