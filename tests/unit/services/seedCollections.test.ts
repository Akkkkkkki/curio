/**
 * CUR-143: buildSeedRepairs — cloud sample drift reconciliation
 *
 * The master sample is code-defined (INITIAL_COLLECTIONS); its cloud copy can
 * drift (rows toggled private, seed items lost, photo paths nulled). The admin
 * load path uses buildSeedRepairs to decide which seed collections must be
 * re-upserted. These tests pin the drift conditions and the non-destructive
 * repair shape (curator-added items are preserved).
 */

import { describe, it, expect } from 'vitest';
import type { CollectionItem, UserCollection } from '@/types';
import { buildSeedRepairs, INITIAL_COLLECTIONS } from '@/services/seedCollections';

const ADMIN_ID = 'admin-1';
const masterSeed = INITIAL_COLLECTIONS[0];

/** A faithful cloud copy of the master seed, as fetchCloudCollections returns it. */
function healthyCloudSeed(overrides: Partial<UserCollection> = {}): UserCollection {
  return {
    ...masterSeed,
    ownerId: ADMIN_ID,
    isPublic: true,
    items: masterSeed.items.map((item) => ({ ...item })),
    ...overrides,
  };
}

describe('seedCollections.ts — buildSeedRepairs (CUR-143)', () => {
  it('returns no repairs when the cloud copy is healthy', () => {
    expect(buildSeedRepairs([healthyCloudSeed()], ADMIN_ID)).toEqual([]);
  });

  it('repairs an entirely missing cloud copy (first-time seeding)', () => {
    const repairs = buildSeedRepairs([], ADMIN_ID);
    expect(repairs).toHaveLength(INITIAL_COLLECTIONS.length);
    expect(repairs[0]).toMatchObject({ id: masterSeed.id, ownerId: ADMIN_ID, isPublic: true });
    expect(repairs[0].items).toHaveLength(masterSeed.items.length);
  });

  it('repairs a cloud copy that drifted to private', () => {
    const repairs = buildSeedRepairs([healthyCloudSeed({ isPublic: false })], ADMIN_ID);
    expect(repairs).toHaveLength(1);
    expect(repairs[0].isPublic).toBe(true);
  });

  it('repairs a cloud copy missing seed items (partial seed)', () => {
    // The production drift: only seed-vinyl-1 survived in cloud.
    const partial = healthyCloudSeed({ items: [{ ...masterSeed.items[0] }] });
    const repairs = buildSeedRepairs([partial], ADMIN_ID);
    expect(repairs).toHaveLength(1);
    expect(repairs[0].items.map((item) => item.id)).toEqual(
      masterSeed.items.map((item) => item.id),
    );
  });

  it('repairs a cloud seed item that lost its photo path', () => {
    const items = masterSeed.items.map((item, index) =>
      index === 0 ? { ...item, photoUrl: '' } : { ...item },
    );
    const repairs = buildSeedRepairs([healthyCloudSeed({ items })], ADMIN_ID);
    expect(repairs).toHaveLength(1);
    expect(repairs[0].items[0].photoUrl).toBe(masterSeed.items[0].photoUrl);
  });

  it('preserves curator-added items when repairing', () => {
    const curatorItem: CollectionItem = {
      id: 'curator-pick-1',
      collectionId: masterSeed.id,
      photoUrl: '/assets/sample-vinyl.jpg',
      title: 'Blue Train',
      rating: 5,
      data: {},
      createdAt: new Date().toISOString(),
      notes: 'A curator addition beyond the code-defined seed.',
    };
    const drifted = healthyCloudSeed({
      isPublic: false,
      items: [...masterSeed.items.map((item) => ({ ...item })), curatorItem],
    });
    const repairs = buildSeedRepairs([drifted], ADMIN_ID);
    expect(repairs).toHaveLength(1);
    expect(repairs[0].items.map((item) => item.id)).toContain('curator-pick-1');
    expect(repairs[0].items).toHaveLength(masterSeed.items.length + 1);
  });

  it('matches the cloud copy by seedKey when the id differs, and leaves it alone if healthy', () => {
    const rekeyed = healthyCloudSeed({ id: 'legacy-id' });
    rekeyed.items = rekeyed.items.map((item) => ({ ...item, collectionId: 'legacy-id' }));
    expect(buildSeedRepairs([rekeyed], ADMIN_ID)).toEqual([]);
  });

  it('repairs a re-keyed cloud copy in place instead of duplicating it under the canonical id', () => {
    const rekeyed = healthyCloudSeed({ id: 'legacy-id', isPublic: false });
    rekeyed.items = rekeyed.items.map((item) => ({ ...item, collectionId: 'legacy-id' }));
    const repairs = buildSeedRepairs([rekeyed], ADMIN_ID);
    expect(repairs).toHaveLength(1);
    expect(repairs[0].id).toBe('legacy-id');
    expect(repairs[0].items.every((item) => item.collectionId === 'legacy-id')).toBe(true);
    expect(repairs[0].items.map((item) => item.id)).toEqual(
      masterSeed.items.map((item) => item.id),
    );
  });

  it('preserves the existing cloud owner when repairing; assigns the caller only for missing copies', () => {
    const drifted = healthyCloudSeed({ isPublic: false, ownerId: 'original-admin' });
    expect(buildSeedRepairs([drifted], 'another-admin')[0].ownerId).toBe('original-admin');
    expect(buildSeedRepairs([], 'another-admin')[0].ownerId).toBe('another-admin');
  });

  it('force re-pushes healthy seeds (seed-version content upgrades)', () => {
    const repairs = buildSeedRepairs([healthyCloudSeed()], ADMIN_ID, { force: true });
    expect(repairs).toHaveLength(INITIAL_COLLECTIONS.length);
  });

  it('ignores non-seed cloud collections entirely', () => {
    const personal: UserCollection = {
      id: 'my-teas',
      templateId: 'general',
      name: 'Tea Tins',
      customFields: [],
      items: [],
      ownerId: ADMIN_ID,
      updatedAt: new Date().toISOString(),
    };
    const repairs = buildSeedRepairs([personal, healthyCloudSeed()], ADMIN_ID);
    expect(repairs).toEqual([]);
  });
});
