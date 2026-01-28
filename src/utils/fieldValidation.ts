export const FIELD_MIN_COUNT = 3;
export const FIELD_MAX_COUNT = 6;
export const FIELD_LABEL_MAX_LENGTH = 32;
export const PINNED_MIN_COUNT = 1;
export const PINNED_MAX_COUNT = 2;

const RESERVED_FIELD_LABELS = [
  'notes',
  'description',
  'diary',
  'comments',
  'title',
  'name',
  'rating',
];

const RESERVED_FIELD_SET = new Set(RESERVED_FIELD_LABELS.map((label) => label.toLowerCase()));

export const normalizeFieldLabel = (value: string) => value.trim().replace(/\s+/g, ' ');

export const isReservedFieldLabel = (label: string) =>
  RESERVED_FIELD_SET.has(normalizeFieldLabel(label).toLowerCase());

export const findDuplicateLabel = (label: string, existing: string[]) => {
  const normalized = normalizeFieldLabel(label).toLowerCase();
  return existing.some((item) => normalizeFieldLabel(item).toLowerCase() === normalized);
};

export const validateFieldLabel = (label: string, existing: string[]) => {
  const normalized = normalizeFieldLabel(label);
  if (!normalized) {
    return { ok: false, reason: 'empty', label: normalized };
  }
  if (normalized.length > FIELD_LABEL_MAX_LENGTH) {
    return { ok: false, reason: 'too-long', label: normalized };
  }
  if (isReservedFieldLabel(normalized)) {
    return { ok: false, reason: 'reserved', label: normalized };
  }
  if (findDuplicateLabel(normalized, existing)) {
    return { ok: false, reason: 'duplicate', label: normalized };
  }
  return { ok: true, reason: null, label: normalized };
};

export const validateFieldSelection = (fields: string[], pinnedFields: string[]) => {
  const count = fields.length;
  const pinnedCount = pinnedFields.length;
  if (count < FIELD_MIN_COUNT) return { ok: false, reason: 'min' };
  if (count > FIELD_MAX_COUNT) return { ok: false, reason: 'max' };
  if (pinnedCount < PINNED_MIN_COUNT) return { ok: false, reason: 'pin-min' };
  if (pinnedCount > PINNED_MAX_COUNT) return { ok: false, reason: 'pin-max' };
  return { ok: true, reason: null };
};
