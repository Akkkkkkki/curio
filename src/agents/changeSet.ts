import type { CollectionItem, UserCollection } from '../types';

export type ChangeValue = string | number | boolean | null;
export type ChangeEntity = 'collection' | 'item';

export interface ProposedChange {
  id: string;
  entity: ChangeEntity;
  entityId: string;
  field: string;
  before: ChangeValue;
  after: ChangeValue;
  reason: string;
  confidence: number;
}

export interface ChangeSet {
  id: string;
  changes: ProposedChange[];
}

export interface ChangeSetValidationResult {
  valid: boolean;
  errors: string[];
  value?: ChangeSet;
}

export interface ApplyChangeSetResult {
  collection: UserCollection;
  appliedChangeIds: string[];
  conflictedChangeIds: string[];
}

const MAX_CHANGES = 100;
const COLLECTION_FIELDS = new Set(['name', 'icon', 'collectionDescription']);
const ITEM_FIELDS = new Set(['title', 'rating', 'notes']);
const DATA_FIELD_PREFIX = 'data.';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isChangeValue = (value: unknown): value is ChangeValue =>
  value === null || ['string', 'number', 'boolean'].includes(typeof value);

const isSafeDataField = (field: string): boolean => {
  if (!field.startsWith(DATA_FIELD_PREFIX)) return false;
  const key = field.slice(DATA_FIELD_PREFIX.length);
  return key.length > 0 && !key.startsWith('_') && !key.includes('.');
};

export const isSupportedChangeField = (entity: ChangeEntity, field: string): boolean => {
  if (entity === 'collection') return COLLECTION_FIELDS.has(field);
  return ITEM_FIELDS.has(field) || isSafeDataField(field);
};

export const validateChangeSet = (input: unknown): ChangeSetValidationResult => {
  const errors: string[] = [];
  if (!isRecord(input)) return { valid: false, errors: ['ChangeSet must be an object'] };

  if (typeof input.id !== 'string' || input.id.trim().length === 0) {
    errors.push('ChangeSet.id must be a non-empty string');
  }

  if (!Array.isArray(input.changes)) {
    errors.push('ChangeSet.changes must be an array');
    return { valid: false, errors };
  }
  if (input.changes.length > MAX_CHANGES) {
    errors.push(`ChangeSet cannot contain more than ${MAX_CHANGES} changes`);
  }

  const seenIds = new Set<string>();
  const changes: ProposedChange[] = [];

  input.changes.forEach((raw, index) => {
    const prefix = `changes[${index}]`;
    if (!isRecord(raw)) {
      errors.push(`${prefix} must be an object`);
      return;
    }

    const entity = raw.entity;
    const id = raw.id;
    const entityId = raw.entityId;
    const field = raw.field;
    const reason = raw.reason;
    const confidence = raw.confidence;

    if (typeof id !== 'string' || id.trim().length === 0) {
      errors.push(`${prefix}.id is required`);
    } else if (seenIds.has(id)) {
      errors.push(`${prefix}.id must be unique`);
    } else {
      seenIds.add(id);
    }

    if (entity !== 'collection' && entity !== 'item') {
      errors.push(`${prefix}.entity is invalid`);
    }
    if (typeof entityId !== 'string' || entityId.trim().length === 0) {
      errors.push(`${prefix}.entityId is required`);
    }
    if (typeof field !== 'string' || field.trim().length === 0) {
      errors.push(`${prefix}.field is required`);
    } else if (
      (entity === 'collection' || entity === 'item') &&
      !isSupportedChangeField(entity, field)
    ) {
      errors.push(`${prefix}.field is not writable through ChangeSet`);
    }
    if (!isChangeValue(raw.before)) {
      errors.push(`${prefix}.before must be a scalar JSON value`);
    }
    if (!isChangeValue(raw.after)) {
      errors.push(`${prefix}.after must be a scalar JSON value`);
    }
    if (typeof reason !== 'string' || reason.trim().length === 0) {
      errors.push(`${prefix}.reason is required`);
    }
    if (
      typeof confidence !== 'number' ||
      !Number.isFinite(confidence) ||
      confidence < 0 ||
      confidence > 1
    ) {
      errors.push(`${prefix}.confidence must be between 0 and 1`);
    }

    const canBuildChange =
      typeof id === 'string' &&
      (entity === 'collection' || entity === 'item') &&
      typeof entityId === 'string' &&
      typeof field === 'string' &&
      isChangeValue(raw.before) &&
      isChangeValue(raw.after) &&
      typeof reason === 'string' &&
      typeof confidence === 'number';

    if (canBuildChange) {
      changes.push({
        id,
        entity,
        entityId,
        field,
        before: raw.before,
        after: raw.after,
        reason,
        confidence,
      });
    }
  });

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true, errors: [], value: { id: input.id as string, changes } };
};

const valuesEqual = (left: unknown, right: ChangeValue): boolean => left === right;

const getItemField = (item: CollectionItem, field: string): unknown => {
  if (ITEM_FIELDS.has(field)) return item[field as 'title' | 'rating' | 'notes'];
  if (isSafeDataField(field)) return item.data[field.slice(DATA_FIELD_PREFIX.length)] ?? null;
  return undefined;
};

const applyItemField = (
  item: CollectionItem,
  field: string,
  value: ChangeValue,
): CollectionItem => {
  if (field === 'title' && typeof value === 'string') return { ...item, title: value };
  if (field === 'rating' && typeof value === 'number' && value >= 0 && value <= 5) {
    return { ...item, rating: value };
  }
  if (field === 'notes' && typeof value === 'string') return { ...item, notes: value };
  if (isSafeDataField(field)) {
    const key = field.slice(DATA_FIELD_PREFIX.length);
    return { ...item, data: { ...item.data, [key]: value } };
  }
  return item;
};

const getCollectionField = (collection: UserCollection, field: string): unknown => {
  if (field === 'name') return collection.name;
  if (field === 'icon') return collection.icon ?? null;
  if (field === 'collectionDescription') return collection.collectionDescription ?? null;
  return undefined;
};

const applyCollectionField = (
  collection: UserCollection,
  field: string,
  value: ChangeValue,
): UserCollection => {
  if (field === 'name' && typeof value === 'string') return { ...collection, name: value };
  if (field === 'icon' && (typeof value === 'string' || value === null)) {
    return { ...collection, icon: value ?? undefined };
  }
  if (field === 'collectionDescription' && (typeof value === 'string' || value === null)) {
    return { ...collection, collectionDescription: value ?? undefined };
  }
  return collection;
};

/**
 * Applies only explicitly approved changes to an in-memory collection.
 * The caller remains responsible for committing the returned collection via
 * Curio's existing local-first save path. Stale proposals are treated as
 * conflicts instead of overwriting values that changed after the agent run.
 */
export const applyApprovedChangeSet = (
  collection: UserCollection,
  changeSet: ChangeSet,
  approvedChangeIds: ReadonlySet<string>,
): ApplyChangeSetResult => {
  let next = {
    ...collection,
    items: collection.items.map((item) => ({ ...item, data: { ...item.data } })),
  };
  const appliedChangeIds: string[] = [];
  const conflictedChangeIds: string[] = [];

  for (const change of changeSet.changes) {
    if (!approvedChangeIds.has(change.id)) continue;
    if (!isSupportedChangeField(change.entity, change.field)) {
      conflictedChangeIds.push(change.id);
      continue;
    }

    if (change.entity === 'collection') {
      const isStale =
        change.entityId !== next.id ||
        !valuesEqual(getCollectionField(next, change.field), change.before);
      if (isStale) {
        conflictedChangeIds.push(change.id);
        continue;
      }
      const updated = applyCollectionField(next, change.field, change.after);
      if (updated === next) {
        conflictedChangeIds.push(change.id);
      } else {
        next = updated;
        appliedChangeIds.push(change.id);
      }
      continue;
    }

    const index = next.items.findIndex((item) => item.id === change.entityId);
    const isStale =
      index < 0 || !valuesEqual(getItemField(next.items[index], change.field), change.before);
    if (isStale) {
      conflictedChangeIds.push(change.id);
      continue;
    }
    const updatedItem = applyItemField(next.items[index], change.field, change.after);
    if (updatedItem === next.items[index]) {
      conflictedChangeIds.push(change.id);
    } else {
      next.items[index] = updatedItem;
      appliedChangeIds.push(change.id);
    }
  }

  return { collection: next, appliedChangeIds, conflictedChangeIds };
};
