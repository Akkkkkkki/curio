import { UserCollection } from '../types';
import { TEMPLATES } from '../constants';

export const CURRENT_SEED_VERSION = 5;
const seedImage = (file: string) => `${import.meta.env.BASE_URL}assets/${file}`;
// Each sample record has its own original cover artwork (an abstract vinyl
// motif) so the pre-login gallery no longer repeats a single image across all
// five items. SEED_IMAGE_PATH stays pointed at the first cover for callers that
// import it (e.g. the live Gemini proxy fixture).
export const SEED_IMAGE_PATH = seedImage('sample-vinyl.jpg');
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
        photoUrl: seedImage('sample-vinyl-2.jpg'),
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
        photoUrl: seedImage('sample-vinyl-3.jpg'),
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
        photoUrl: seedImage('sample-vinyl-4.jpg'),
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
        photoUrl: seedImage('sample-vinyl-5.jpg'),
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
