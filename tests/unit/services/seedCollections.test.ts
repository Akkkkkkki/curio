/**
 * CUR-143: buildSeedRepairs — cloud sample drift reconciliation
 *
 * The master sample is code-defined (INITIAL_COLLECTIONS); its cloud copy can
 * drift (rows toggled private, seed items lost, photo paths nulled). The admin
 * load path uses buildSeedRepairs to decide which seed collections must be
 * re-upserted. These tests pin the drift conditions and the non-destructive
 * repair shape (curator-added items are preserved).
 */

import { existsSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import type { CollectionItem, UserCollection } from '@/types';
import { buildSeedRepairs, INITIAL_COLLECTIONS } from '@/services/seedCollections';

const ADMIN_ID = 'admin-1';
const masterSeed = INITIAL_COLLECTIONS[0];
const PUBLIC_ASSETS = resolve(__dirname, '../../../public/assets');
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);

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

  it('repairs a public seed photo that was migrated into private Storage (#447)', () => {
    const items = masterSeed.items.map((item, index) =>
      index === 0
        ? {
            ...item,
            photoUrl: `${ADMIN_ID}/collections/${masterSeed.id}/${item.id}/display.jpg`,
          }
        : { ...item },
    );

    const repairs = buildSeedRepairs([healthyCloudSeed({ items })], ADMIN_ID);

    expect(repairs).toHaveLength(1);
    expect(repairs[0].items[0].photoUrl).toBe(masterSeed.items[0].photoUrl);
  });

  it('repairs a cloud seed item whose photo path is stale after a content bump (#373)', () => {
    // Pre-#373 cloud: items 2–5 still point at the shared sample-vinyl.jpg.
    // A fresh admin device (seed version 0) skips the force path, so drift
    // detection must catch the superseded URL or the new art never propagates.
    const items = masterSeed.items.map((item) => ({
      ...item,
      photoUrl: '/assets/sample-vinyl.jpg',
    }));
    const repairs = buildSeedRepairs([healthyCloudSeed({ items })], ADMIN_ID);
    expect(repairs).toHaveLength(1);
    expect(repairs[0].items.map((item) => item.photoUrl)).toEqual(
      masterSeed.items.map((item) => item.photoUrl),
    );
  });

  it('leaves an admin-customized seed photo alone (not treated as drift, #373)', () => {
    // The Update Photo control persists a chosen image as a data URL. That is a
    // valid customization, not the superseded shared image, so it must survive.
    const items = masterSeed.items.map((item, index) =>
      index === 1 ? { ...item, photoUrl: 'data:image/jpeg;base64,QUJD' } : { ...item },
    );
    expect(buildSeedRepairs([healthyCloudSeed({ items })], ADMIN_ID)).toEqual([]);
  });

  it('preserves an admin-customized seed photo during a forced content upgrade (#373)', () => {
    const customPhoto = 'data:image/jpeg;base64,QUJD';
    const legacySharedPhoto = masterSeed.items[0].photoUrl;
    const items = masterSeed.items.map((item, index) => ({
      ...item,
      photoUrl: index === 1 ? customPhoto : legacySharedPhoto,
    }));

    const repairs = buildSeedRepairs([healthyCloudSeed({ items })], ADMIN_ID, { force: true });
    expect(repairs).toHaveLength(1);
    expect(repairs[0].items.slice(0, masterSeed.items.length).map((item) => item.photoUrl)).toEqual(
      masterSeed.items.map((item, index) => (index === 1 ? customPhoto : item.photoUrl)),
    );
  });

  it('replaces a historical code-defined sample photo during a forced upgrade', () => {
    // A future seed version may remove an older sample asset from
    // INITIAL_COLLECTIONS. It is still code-owned, not an admin customization.
    const historicalSeedPhoto = '/assets/sample-vinyl-retired.jpg';
    const items = masterSeed.items.map((item, index) => ({
      ...item,
      photoUrl: index === 1 ? historicalSeedPhoto : item.photoUrl,
    }));

    const repairs = buildSeedRepairs([healthyCloudSeed({ items })], ADMIN_ID, { force: true });
    expect(repairs).toHaveLength(1);
    expect(repairs[0].items[1].photoUrl).toBe(masterSeed.items[1].photoUrl);
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

  it('ignores non-seed cloud collections entirely (CUR-143)', () => {
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

/**
 * GitHub #373: the pre-login Vinyl Vault is the strongest "delight before auth"
 * moment. Every seed item previously shared one photo, so the grid read as
 * placeholder content. Each item now carries its own still-life; these guards
 * keep the set distinct and keep every referenced file a real, shipped JPEG.
 */
describe('seedCollections.ts — distinct sample photos (#373)', () => {
  const photoUrls = masterSeed.items.map((item) => item.photoUrl ?? '');

  it('gives every Vinyl Vault item a non-empty photo', () => {
    expect(photoUrls.every((url) => url.length > 0)).toBe(true);
  });

  it('gives every Vinyl Vault item a distinct photo', () => {
    expect(new Set(photoUrls).size).toBe(masterSeed.items.length);
  });

  it('points every item photo at a real JPEG shipped under public/assets', () => {
    for (const url of photoUrls) {
      const filePath = resolve(PUBLIC_ASSETS, basename(url));
      expect(existsSync(filePath), `${url} should exist`).toBe(true);
      const head = readFileSync(filePath).subarray(0, JPEG_SIGNATURE.length);
      expect(head.equals(JPEG_SIGNATURE), `${url} should be a JPEG`).toBe(true);
    }
  });
});
