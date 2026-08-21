import { CollectionItem, UserCollection } from '../types';
import { TEMPLATES } from '../constants';

export const CURRENT_SEED_VERSION = 5;
const sampleAsset = (file: string) => `${import.meta.env.BASE_URL}assets/${file}`;
// Each Vinyl Vault item has its own still-life so the pre-login gallery reads as
// a curated collection rather than five copies of one placeholder (GitHub #373).
// Re-render the artwork with `node scripts/generate-sample-vinyl.mjs`.
export const SEED_IMAGE_PATH = sampleAsset('sample-vinyl.jpg');
const SEED_TIMESTAMP = new Date().toISOString();

export const INITIAL_COLLECTIONS: UserCollection[] = [
  {
    id: 'sample-vinyl',
    seedKey: 'master_vinyl_seed',
    templateId: 'vinyl',
    name: 'The Vinyl Vault',
    icon: '🎷',
    customFields: TEMPLATES.find((t) => t.id === 'vinyl')!.fields,
    items: [
      {
        id: 'seed-vinyl-1',
        seedKey: 'kind_of_blue_seed',
        collectionId: 'sample-vinyl',
        photoUrl: SEED_IMAGE_PATH,
        title: 'Kind of Blue',
        rating: 5,
        data: {
          artist: 'Miles Davis',
          label: 'Columbia',
          year: 1959,
          genre: 'Modal Jazz',
          speed: '33 1/3 RPM',
          _isLegacyAiNotes: false,
          condition: 'Mint (M)',
        },
        createdAt: SEED_TIMESTAMP,
        updatedAt: SEED_TIMESTAMP,
        notes:
          'The definitive statement of modal jazz. This 180g pressing keeps the cymbals airy and the bass warm, with space around every phrase. A cornerstone of any serious archive.',
      },
      {
        id: 'seed-vinyl-2',
        seedKey: 'a_love_supreme_seed',
        collectionId: 'sample-vinyl',
        photoUrl: sampleAsset('sample-vinyl-2.jpg'),
        title: 'A Love Supreme',
        rating: 5,
        data: {
          artist: 'John Coltrane',
          label: 'Impulse!',
          year: 1965,
          genre: 'Spiritual Jazz',
          speed: '33 1/3 RPM',
          _isLegacyAiNotes: false,
          condition: 'Near Mint (NM)',
        },
        createdAt: SEED_TIMESTAMP,
        updatedAt: SEED_TIMESTAMP,
        notes:
          "Coltrane's four-part suite is both devotional and urgent. Keep it in a poly-lined sleeve; the quiet passages reward careful handling.",
      },
      {
        id: 'seed-vinyl-3',
        seedKey: 'whats_going_on_seed',
        collectionId: 'sample-vinyl',
        photoUrl: sampleAsset('sample-vinyl-3.jpg'),
        title: "What's Going On",
        rating: 5,
        data: {
          artist: 'Marvin Gaye',
          label: 'Tamla',
          year: 1971,
          genre: 'Soul',
          speed: '33 1/3 RPM',
          _isLegacyAiNotes: false,
          condition: 'Very Good Plus (VG+)',
        },
        createdAt: SEED_TIMESTAMP,
        updatedAt: SEED_TIMESTAMP,
        notes:
          'A lush, cinematic mix of protest and prayer. The original gatefold is worth preserving; its sequencing still feels like one continuous breath.',
      },
      {
        id: 'seed-vinyl-4',
        seedKey: 'rumours_seed',
        collectionId: 'sample-vinyl',
        photoUrl: sampleAsset('sample-vinyl-4.jpg'),
        title: 'Rumours',
        rating: 4,
        data: {
          artist: 'Fleetwood Mac',
          label: 'Warner Bros.',
          year: 1977,
          genre: 'Soft Rock',
          speed: '33 1/3 RPM',
          _isLegacyAiNotes: false,
          condition: 'Near Mint (NM)',
        },
        createdAt: SEED_TIMESTAMP,
        updatedAt: SEED_TIMESTAMP,
        notes:
          'An immaculate pop-rock masterclass with a wide, punchy stereo image. Seek the palm tree label for the warmest playback.',
      },
      {
        id: 'seed-vinyl-5',
        seedKey: 'discovery_seed',
        collectionId: 'sample-vinyl',
        photoUrl: sampleAsset('sample-vinyl-5.jpg'),
        title: 'Discovery',
        rating: 4,
        data: {
          artist: 'Daft Punk',
          label: 'Virgin',
          year: 2001,
          genre: 'French House',
          speed: '33 1/3 RPM',
          _isLegacyAiNotes: false,
          condition: 'Very Good Plus (VG+)',
        },
        createdAt: SEED_TIMESTAMP,
        updatedAt: SEED_TIMESTAMP,
        notes:
          'A shimmering, forward-looking press with crisp transients. A great reference for soundstage and stereo imaging.',
      },
    ],
    updatedAt: SEED_TIMESTAMP,
  },
];

type SeedRef = { id: string; seedKey?: string };

const matchesSeed = (candidate: SeedRef, seed: SeedRef) =>
  candidate.id === seed.id || (Boolean(candidate.seedKey) && candidate.seedKey === seed.seedKey);

const CODE_DEFINED_SEED_PHOTO_URLS = new Set<string>(
  INITIAL_COLLECTIONS.flatMap((collection) =>
    collection.items.flatMap((item) => (item.photoUrl ? [item.photoUrl] : [])),
  ),
);

const isCustomSeedPhoto = (photoUrl?: string): boolean =>
  Boolean(photoUrl && !CODE_DEFINED_SEED_PHOTO_URLS.has(photoUrl));

const hasSeedDrift = (seed: UserCollection, cloud: UserCollection | undefined): boolean => {
  if (!cloud) return true;
  if (!cloud.isPublic) return true;
  return seed.items.some((seedItem) => {
    const cloudItem = cloud.items.find((item) => matchesSeed(item, seedItem));
    if (!cloudItem) return true;
    if (!seedItem.photoUrl) return false;
    // A seed item that lost its photo path (e.g. drifted to NULL in cloud)
    // renders as a broken card on the exact surface meant to delight.
    if (!cloudItem.photoUrl) return true;
    // #373 migration: items 2–5 whose cloud copy is still the pre-#373 shared
    // image, while the code now gives each its own art. Scoped to that exact
    // superseded path so any admin load repairs it (even a fresh, seed-version-0
    // device that skips the version-bump force path) without mistaking an
    // admin's own Update Photo (a data URL / storage path) for drift.
    return cloudItem.photoUrl !== seedItem.photoUrl && cloudItem.photoUrl === SEED_IMAGE_PATH;
  });
};

/**
 * The master sample is code-defined; its cloud copy can drift (rows toggled
 * private, seed items lost or stripped of photo paths outside the app).
 * Returns the seed collections whose cloud copy must be re-upserted so the
 * admin load path can repair drift instead of only seeding an empty cloud
 * (CUR-143). Curator-added items and explicit custom seed photos are preserved.
 * Pass `force` to re-push healthy seed content too (seed-version upgrades).
 */
export const buildSeedRepairs = (
  cloudCollections: UserCollection[],
  ownerId: string,
  { force = false }: { force?: boolean } = {},
): UserCollection[] =>
  INITIAL_COLLECTIONS.flatMap((seed) => {
    const cloud = cloudCollections.find((collection) => matchesSeed(collection, seed));
    if (!force && !hasSeedDrift(seed, cloud)) return [];
    const repairedSeedItems: CollectionItem[] = seed.items.map((seedItem) => {
      const cloudItem = cloud?.items.find((item) => matchesSeed(item, seedItem));
      // A photo outside the code-defined seed asset set came from the admin's
      // Update Photo path. Preserve that explicit customization even during a
      // forced content upgrade; missing photos and known seed assets still take
      // the canonical value from the current seed (including the #373 migration
      // away from the old shared sample-vinyl.jpg path).
      if (cloudItem?.photoUrl && isCustomSeedPhoto(cloudItem.photoUrl)) {
        return { ...seedItem, photoUrl: cloudItem.photoUrl };
      }
      return seedItem;
    });
    const curatorItems: CollectionItem[] = (cloud?.items ?? []).filter(
      (item) => !seed.items.some((seedItem) => matchesSeed(item, seedItem)),
    );
    // Repair the row where it lives: keep the matched cloud id and owner so a
    // re-keyed or re-owned copy is fixed in place instead of duplicated.
    const targetId = cloud?.id ?? seed.id;
    return [
      {
        ...seed,
        id: targetId,
        ownerId: cloud?.ownerId || ownerId,
        isPublic: true,
        items: [...repairedSeedItems, ...curatorItems].map((item) => ({
          ...item,
          collectionId: targetId,
        })),
      },
    ];
  });
