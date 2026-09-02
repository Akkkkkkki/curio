import { describe, it, expect } from 'vitest';
import type { AnalyzeResult } from '@/services/aiService';
import { METADATA_EVAL_CASES } from './metadata-extraction/fixtures';
import { runEval } from './metadata-extraction/runHarness';
import { scoreCase, aggregateScores } from './metadata-extraction/scoring';
import { EVAL_SET_VERSION } from './metadata-extraction/types';
import type {
  AnalyzeItemInput,
  EvalCase,
  MetadataAnalyzer,
  ImageLoader,
} from './metadata-extraction/types';

/**
 * Deterministic CI subset for CUR-173. No live model, no image bytes, no
 * network — the analyzer is a fixture and the image loader is a stub — so this
 * runs for free on every push. It proves the harness/scoring behave: a faithful
 * analyzer scores clean, and each failure mode (hallucination, fabricated
 * pressing details, off-schema output, invented story) is actually caught.
 *
 * Grading a real provider is the opt-in live half of the ticket and is not run
 * here.
 */

const findCase = (id: string): EvalCase => {
  const found = METADATA_EVAL_CASES.find((c) => c.id === id);
  if (!found) throw new Error(`fixture "${id}" not found`);
  return found;
};

const success = (
  title: string,
  data: Record<string, unknown>,
  aiDescription = 'A factual visual description of the record sleeve.',
): AnalyzeResult => ({
  status: 'success',
  title,
  data: data as Record<string, any>,
  aiDescription,
  notes: aiDescription,
});

/** A perfect answer for one case: right title, acceptable values, blanks where
 * the case expects abstention. Drives the "clean run" baseline. */
const idealResultFor = (evalCase: EvalCase): AnalyzeResult => {
  const data: Record<string, unknown> = {};
  for (const field of evalCase.fields) {
    const expectation = evalCase.fieldExpectations[field.id];
    if (!expectation || expectation.grade === 'abstain') continue;
    const first = expectation.acceptable?.[0];
    if (first !== undefined) data[field.id] = first;
  }
  const title = 'abstain' in evalCase.expectedTitle ? '' : evalCase.expectedTitle.acceptable[0];
  return success(title, data);
};

const idealAnalyzer: MetadataAnalyzer = async (input: AnalyzeItemInput) => {
  // The stub loader embeds the asset filename in the base64, so the analyzer can
  // recover which case it is looking at — and disambiguate the two cases that
  // share an image by their collection context.
  const match =
    METADATA_EVAL_CASES.find(
      (c) =>
        input.imageBase64.includes(c.assetFile) &&
        c.collectionContext?.name === input.collectionContext?.name,
    ) ?? METADATA_EVAL_CASES[0];
  return idealResultFor(match);
};

const stubLoader: ImageLoader = async (assetFile: string) => `stub-base64-for:${assetFile}`;

describe('metadata-extraction eval harness (CUR-173)', () => {
  it('exposes a versioned fixture set backed only by public sample assets', () => {
    expect(EVAL_SET_VERSION).toBeGreaterThanOrEqual(1);
    expect(METADATA_EVAL_CASES.length).toBeGreaterThanOrEqual(4);
    for (const c of METADATA_EVAL_CASES) {
      // Every asset is a public sample-gallery file — no private user photo.
      expect(c.assetFile).toMatch(/^sample-vinyl.*\.jpg$/);
    }
    // At least one case demands abstention, and one image appears under two
    // different contexts (the context-sensitivity pair).
    const hasAbstain = METADATA_EVAL_CASES.some((c) =>
      Object.values(c.fieldExpectations).some((e) => e.grade === 'abstain'),
    );
    expect(hasAbstain).toBe(true);
    const contextPair = METADATA_EVAL_CASES.filter((c) => c.assetFile === 'sample-vinyl-5.jpg');
    expect(contextPair.length).toBe(2);
    expect(contextPair[0].collectionContext?.name).not.toBe(contextPair[1].collectionContext?.name);
  });

  it('scores a faithful analyzer as clean across every case', async () => {
    const report = await runEval(METADATA_EVAL_CASES, idealAnalyzer, stubLoader);
    expect(report.aggregate.evalSetVersion).toBe(EVAL_SET_VERSION);
    expect(report.aggregate.caseCount).toBe(METADATA_EVAL_CASES.length);
    expect(report.aggregate.schemaValidRate).toBe(1);
    expect(report.aggregate.titleCorrectRate).toBe(1);
    expect(report.aggregate.fieldCorrectnessRate).toBe(1);
    expect(report.aggregate.usefulFillRate).toBe(1);
    expect(report.aggregate.hallucinationRate).toBe(0);
    expect(report.aggregate.abstentionQuality).toBe(1);
    expect(report.aggregate.storyCleanRate).toBe(1);
    // Deterministic run reports no latency/cost.
    expect(report.aggregate.p50LatencyMs).toBeNull();
    expect(report.aggregate.avgCostUsd).toBeNull();
  });

  it('penalizes fabricated values on fields the photo cannot reveal', () => {
    const evalCase = findCase('vinyl-kind-of-blue');
    const hallucinated = success('Kind of Blue', {
      artist: 'Miles Davis',
      label: 'Columbia',
      year: 1959,
      genre: 'Modal Jazz',
      condition: 'Mint (M)', // invented — not knowable from a cover photo
    });
    const score = scoreCase(evalCase, hallucinated);
    const condition = score.fields.find((f) => f.fieldId === 'condition');
    expect(condition?.hallucinated).toBe(true);
    expect(condition?.correct).toBe(false);
    // The determinable fields are still correct.
    expect(score.fields.find((f) => f.fieldId === 'artist')?.correct).toBe(true);
    expect(score.titleCorrect).toBe(true);
  });

  it('rewards leaving an ambiguous pressing blank instead of guessing', () => {
    const evalCase = findCase('vinyl-ambiguous-pressing');

    const abstained = success("What's Going On", {
      artist: 'Marvin Gaye',
      genre: 'Soul',
      // label + year intentionally omitted
    });
    const abstainedScore = scoreCase(evalCase, abstained);
    const abstainedLabel = abstainedScore.fields.find((f) => f.fieldId === 'label');
    expect(abstainedLabel?.correct).toBe(true);
    expect(abstainedLabel?.hallucinated).toBe(false);

    const guessed = success("What's Going On", {
      artist: 'Marvin Gaye',
      genre: 'Soul',
      label: 'Tamla',
      year: 1971,
    });
    const guessedScore = scoreCase(evalCase, guessed);
    const guessedLabel = guessedScore.fields.find((f) => f.fieldId === 'label');
    expect(guessedLabel?.hallucinated).toBe(true);
    expect(guessedLabel?.correct).toBe(false);
  });

  it('flags off-schema fields and invalid select options as not schema-valid', () => {
    const evalCase = findCase('vinyl-kind-of-blue');
    const offSchema = success('Kind of Blue', {
      artist: 'Miles Davis',
      mood: 'contemplative', // not a field in the schema
      condition: 'Pristine', // not one of the select options
    });
    const score = scoreCase(evalCase, offSchema);
    expect(score.schemaValid).toBe(false);
    expect(score.issues.some((i) => i.includes('off-schema'))).toBe(true);
    expect(score.issues.some((i) => i.includes('valid option'))).toBe(true);
    // Underscore-prefixed system keys are not treated as off-schema.
    const withSystemKey = success('Kind of Blue', {
      artist: 'Miles Davis',
      _isLegacyAiNotes: false,
    });
    expect(scoreCase(evalCase, withSystemKey).issues.some((i) => i.includes('off-schema'))).toBe(
      false,
    );
  });

  it('counts an off-schema key as a hallucination, not just a schema issue', () => {
    const evalCase = findCase('vinyl-kind-of-blue');
    // All declared fields answered correctly, but the candidate invents an
    // extra key. hallucinationRate must reflect that rather than staying zero.
    const withExtra = success('Kind of Blue', {
      artist: 'Miles Davis',
      label: 'Columbia',
      year: 1959,
      genre: 'Modal Jazz',
      provenance: 'formerly owned by a jazz critic', // fabricated, off-schema
    });
    const score = scoreCase(evalCase, withExtra);
    expect(score.offSchemaHallucinations).toBe(1);
    expect(score.fields.every((f) => !f.hallucinated)).toBe(true); // declared fields are clean
    const agg = aggregateScores([score]);
    expect(agg.schemaValidRate).toBe(0);
    expect(agg.hallucinationRate).toBeGreaterThan(0);
  });

  it('catches invented owner memories in the factual description', () => {
    const evalCase = findCase('vinyl-kind-of-blue');
    const withStory = success(
      'Kind of Blue',
      { artist: 'Miles Davis' },
      'A gift from my grandfather that reminds me of Sunday mornings.',
    );
    const score = scoreCase(evalCase, withStory);
    expect(score.storyClean).toBe(false);
    expect(score.issues.some((i) => i.includes('invented story'))).toBe(true);
  });

  it('does not treat a blank factual description as clean', () => {
    const evalCase = findCase('vinyl-kind-of-blue');
    const noDescription = success('Kind of Blue', { artist: 'Miles Davis' }, '');
    const score = scoreCase(evalCase, noDescription);
    expect(score.storyClean).toBe(false);
    expect(score.issues.some((i) => i.includes('missing factual description'))).toBe(true);
  });

  it('treats an errored analysis as schema-invalid without throwing', () => {
    const evalCase = findCase('vinyl-kind-of-blue');
    const errored: AnalyzeResult = {
      status: 'error',
      message: 'timeout',
      retryable: true,
    };
    const score = scoreCase(evalCase, errored);
    expect(score.schemaValid).toBe(false);
    expect(score.titleCorrect).toBe(false);
  });

  it('forwards collection context to the analyzer for the context pair', async () => {
    const seen: Array<string | undefined> = [];
    const spyAnalyzer: MetadataAnalyzer = async (input) => {
      seen.push(input.collectionContext?.name);
      return idealResultFor(METADATA_EVAL_CASES[0]);
    };
    const pair = METADATA_EVAL_CASES.filter((c) => c.assetFile === 'sample-vinyl-5.jpg');
    await runEval(pair, spyAnalyzer, stubLoader);
    expect(seen).toEqual(['Electronic & House', 'The Vinyl Vault']);
  });

  it('records latency when a clock is supplied (live-run shape)', async () => {
    let tick = 0;
    const clock = () => (tick += 5);
    const report = await runEval([findCase('vinyl-kind-of-blue')], idealAnalyzer, stubLoader, {
      now: clock,
    });
    expect(report.cases[0].latencyMs).toBe(5);
    expect(report.aggregate.p50LatencyMs).toBe(5);
  });

  it('aggregates abstentionQuality as null when no field abstains', () => {
    const noAbstain = aggregateScores([
      {
        caseId: 'x',
        schemaValid: true,
        title: 'X',
        values: { a: 'v' },
        titleCorrect: true,
        fields: [
          { fieldId: 'a', grade: 'match', filled: true, correct: true, hallucinated: false },
        ],
        offSchemaHallucinations: 0,
        storyClean: true,
        issues: [],
      },
    ]);
    expect(noAbstain.abstentionQuality).toBeNull();
  });

  it('does not count a wrong optional guess as a useful fill', () => {
    const evalCase = findCase('vinyl-context-electronic');
    // `year` is optional/acceptable=[2001]; a wrong guess is neither a
    // hallucination nor counted against correctness, so it must not inflate fill.
    const wrongOptional = success('Discovery', {
      artist: 'Daft Punk',
      genre: 'French House',
      year: 1998, // wrong, but a plausible-looking guess
    });
    const score = scoreCase(evalCase, wrongOptional);
    const year = score.fields.find((f) => f.fieldId === 'year');
    expect(year?.filled).toBe(true);
    expect(year?.correct).toBe(false);
    expect(year?.hallucinated).toBe(false);

    const agg = aggregateScores([score]);
    // artist + genre are correct answerable fills; the wrong year is excluded.
    const answerable = evalCase.fields.filter(
      (f) => (evalCase.fieldExpectations[f.id]?.grade ?? 'optional') !== 'abstain',
    ).length;
    expect(agg.usefulFillRate).toBeCloseTo(2 / answerable);
    // Raw values are retained for pairwise comparison.
    expect(score.values.genre).toBe('French House');
    expect(score.values.year).toBe(1998);
  });
});
