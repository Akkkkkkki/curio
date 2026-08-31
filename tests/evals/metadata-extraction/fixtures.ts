import type { CollectionTemplate, FieldDefinition } from '@/types';
import { TEMPLATES } from '@/constants';
import type { EvalCase } from './types';

/**
 * Versioned fixture set for the metadata-extraction eval (CUR-173, first step).
 *
 * Every asset here is from Curio's own **public sample gallery**
 * (`public/assets/sample-vinyl*.jpg`, the seeded Vinyl Vault) — no private user
 * photo or story is copied into a test corpus (AC7). Expected answers are the
 * facts already published for those records in `seedCollections.ts`.
 *
 * The set intentionally covers three things beyond a plain happy path:
 * - a clear-identity case (a well-known cover the model should name),
 * - an abstention case (fields the photo can't reveal — a value there is a
 *   hallucination, a blank is correct),
 * - a collection-context pair (same image, different context) so a candidate's
 *   context-sensitivity can be measured.
 *
 * Breadth beyond vinyl (tea tins, chocolate wrappers, bottles/labels, tickets,
 * cameras, hard/ambiguous images) needs approved fixtures that don't exist in
 * the repo yet; adding them is a tracked follow-up on CUR-173.
 */

const vinylTemplate: CollectionTemplate = TEMPLATES.find((t) => t.id === 'vinyl')!;
const vinylFields: FieldDefinition[] = vinylTemplate.fields;

const VINYL_CONTEXT = {
  name: 'The Vinyl Vault',
  description: 'A curated archive of landmark vinyl pressings.',
} as const;

// `condition` is a physical grading (surface wear, sleeve state) that a single
// catalog-cover photo cannot establish, so it should be left blank on every
// case; a confident grade is an invented fact.
const conditionAbstains = { grade: 'abstain' as const };
// `speed` is almost always 33 1/3 for an LP and reasonably inferable, but a
// blank is not wrong, so it is graded leniently.
const speed33 = { grade: 'optional' as const, acceptable: ['33 1/3 RPM'] };

export const METADATA_EVAL_CASES: EvalCase[] = [
  {
    id: 'vinyl-kind-of-blue',
    description: 'Clear identity: iconic cover should be named and correctly attributed.',
    assetFile: 'sample-vinyl.jpg',
    collectionContext: VINYL_CONTEXT,
    fields: vinylFields,
    expectedTitle: { acceptable: ['Kind of Blue'] },
    fieldExpectations: {
      artist: { grade: 'match', acceptable: ['Miles Davis'] },
      label: { grade: 'match', acceptable: ['Columbia'] },
      year: { grade: 'match', acceptable: [1959] },
      genre: { grade: 'match', acceptable: ['Modal Jazz', 'Jazz'] },
      speed: speed33,
      condition: conditionAbstains,
    },
    forbiddenStoryPhrases: ['reminds me', 'my grandfather', 'a gift from', 'i remember'],
  },
  {
    id: 'vinyl-a-love-supreme',
    description: 'Clear identity with a genre that has more than one acceptable label.',
    assetFile: 'sample-vinyl-2.jpg',
    collectionContext: VINYL_CONTEXT,
    fields: vinylFields,
    expectedTitle: { acceptable: ['A Love Supreme'] },
    fieldExpectations: {
      artist: { grade: 'match', acceptable: ['John Coltrane'] },
      label: { grade: 'match', acceptable: ['Impulse!', 'Impulse'] },
      year: { grade: 'match', acceptable: [1965] },
      genre: { grade: 'match', acceptable: ['Spiritual Jazz', 'Jazz'] },
      speed: speed33,
      condition: conditionAbstains,
    },
    forbiddenStoryPhrases: ['reminds me', 'a gift from', 'i remember'],
  },
  {
    id: 'vinyl-ambiguous-pressing',
    description:
      'Ambiguous pressing: front cover identifies the album but not which reissue, so label/year must abstain rather than be fabricated.',
    assetFile: 'sample-vinyl-3.jpg',
    collectionContext: VINYL_CONTEXT,
    fields: vinylFields,
    expectedTitle: { acceptable: ["What's Going On"] },
    fieldExpectations: {
      artist: { grade: 'match', acceptable: ['Marvin Gaye'] },
      genre: { grade: 'match', acceptable: ['Soul', 'R&B'] },
      // A front cover does not distinguish an original Tamla press from a
      // reissue, so a specific label/year is a guess: prefer a blank.
      label: { grade: 'abstain' },
      year: { grade: 'abstain' },
      speed: speed33,
      condition: conditionAbstains,
    },
    forbiddenStoryPhrases: ['reminds me', 'a gift from', 'i remember'],
  },
  // --- Collection-context pair -------------------------------------------
  // Same image, two contexts. With a music context the electronic sub-genre is
  // the useful read; with a neutral archive the model has less to lean on. The
  // pair lets a candidate's context-sensitivity be measured rather than assumed.
  {
    id: 'vinyl-context-electronic',
    description: 'Collection context (electronic vinyl) should sharpen the genre read.',
    assetFile: 'sample-vinyl-5.jpg',
    collectionContext: {
      name: 'Electronic & House',
      description: 'Late-90s and 2000s electronic, house, and French touch records.',
    },
    fields: vinylFields,
    expectedTitle: { acceptable: ['Discovery'] },
    fieldExpectations: {
      artist: { grade: 'match', acceptable: ['Daft Punk'] },
      genre: { grade: 'match', acceptable: ['French House', 'House', 'Electronic'] },
      year: { grade: 'optional', acceptable: [2001] },
      label: { grade: 'optional', acceptable: ['Virgin'] },
      speed: speed33,
      condition: conditionAbstains,
    },
    forbiddenStoryPhrases: ['reminds me', 'a gift from', 'i remember'],
  },
  {
    id: 'vinyl-context-neutral',
    description: 'Same image, neutral context: a broader genre answer is still acceptable.',
    assetFile: 'sample-vinyl-5.jpg',
    collectionContext: VINYL_CONTEXT,
    fields: vinylFields,
    expectedTitle: { acceptable: ['Discovery'] },
    fieldExpectations: {
      artist: { grade: 'match', acceptable: ['Daft Punk'] },
      genre: { grade: 'match', acceptable: ['French House', 'House', 'Electronic', 'Dance'] },
      year: { grade: 'optional', acceptable: [2001] },
      label: { grade: 'optional', acceptable: ['Virgin'] },
      speed: speed33,
      condition: conditionAbstains,
    },
    forbiddenStoryPhrases: ['reminds me', 'a gift from', 'i remember'],
  },
];
