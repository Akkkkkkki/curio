import type { AnalyzeResult } from '@/services/aiService';
import type {
  AggregateMetrics,
  CaseScore,
  EvalCase,
  FieldExpectation,
  FieldScore,
  TitleExpectation,
} from './types';
import { EVAL_SET_VERSION } from './types';

/**
 * Scoring for the metadata-extraction eval (CUR-173). Pure and deterministic:
 * given a case's expectations and an {@link AnalyzeResult}, produce a
 * {@link CaseScore}; given many, aggregate them. No I/O, no model, no clock.
 */

const normalize = (value: unknown): string =>
  value === null || value === undefined
    ? ''
    : String(value).trim().toLowerCase().replace(/\s+/g, ' ');

const isBlank = (value: unknown): boolean => normalize(value) === '';

const matchesAcceptable = (value: unknown, acceptable: Array<string | number>): boolean => {
  const target = normalize(value);
  return acceptable.some((candidate) => normalize(candidate) === target);
};

const hasForbiddenSubstring = (value: unknown, forbidden: string[] | undefined): boolean => {
  if (!forbidden || forbidden.length === 0) return false;
  const haystack = normalize(value);
  return forbidden.some((needle) => haystack.includes(normalize(needle)));
};

const scoreField = (
  fieldId: string,
  expectation: FieldExpectation,
  rawValue: unknown,
): FieldScore => {
  const filled = !isBlank(rawValue);
  const forbiddenHit = hasForbiddenSubstring(rawValue, expectation.forbiddenSubstrings);

  if (expectation.grade === 'abstain') {
    // Truth isn't in the photo — a blank is the right answer, a value is invented.
    return { fieldId, grade: 'abstain', filled, correct: !filled, hallucinated: filled };
  }

  const inAcceptable = filled && matchesAcceptable(rawValue, expectation.acceptable ?? []);

  if (expectation.grade === 'optional') {
    // A blank is fine; a right value is credited; a wrong value is neither
    // correct nor a hallucination (the field is genuinely answerable).
    return {
      fieldId,
      grade: 'optional',
      filled,
      correct: !filled || inAcceptable,
      hallucinated: forbiddenHit,
    };
  }

  // grade === 'match': a specific answer is expected.
  return {
    fieldId,
    grade: 'match',
    filled,
    correct: inAcceptable && !forbiddenHit,
    hallucinated: (filled && !inAcceptable) || forbiddenHit,
  };
};

const scoreTitle = (expectation: TitleExpectation, title: string): boolean => {
  if ('abstain' in expectation) {
    // A blank or a deliberately generic title is acceptable when the object
    // can't be identified; a specific-looking title is not verifiable, so we
    // only credit a genuine abstention.
    return isBlank(title);
  }
  const normalizedTitle = normalize(title);
  if (isBlank(title)) return false;
  const acceptableHit = expectation.acceptable.some(
    (candidate) => normalize(candidate) === normalizedTitle,
  );
  const substringHit =
    expectation.requiredSubstrings?.every((sub) => normalizedTitle.includes(normalize(sub))) ??
    false;
  return acceptableHit || substringHit;
};

/**
 * Validate the analyzer output against the schema: it must be a success, its
 * `data` keys must all be known fields (ignoring underscore-prefixed system
 * keys), and any `select` field must hold one of its options. Returns the list
 * of issues found; empty means schema-valid.
 */
const collectSchemaIssues = (evalCase: EvalCase, result: AnalyzeResult): string[] => {
  const issues: string[] = [];
  if (result.status !== 'success') {
    issues.push(`analyzer returned status "${result.status}"`);
    return issues;
  }
  const knownIds = new Set(evalCase.fields.map((f) => f.id));
  for (const key of Object.keys(result.data ?? {})) {
    if (key.startsWith('_')) continue; // system metadata, not a schema field
    if (!knownIds.has(key)) issues.push(`off-schema field "${key}"`);
  }
  for (const field of evalCase.fields) {
    if (field.type !== 'select' || !field.options) continue;
    const value = result.data?.[field.id];
    if (isBlank(value)) continue;
    if (!field.options.some((opt) => normalize(opt) === normalize(value))) {
      issues.push(`field "${field.id}" is not a valid option: "${String(value)}"`);
    }
  }
  return issues;
};

export const scoreCase = (evalCase: EvalCase, result: AnalyzeResult): CaseScore => {
  const issues = collectSchemaIssues(evalCase, result);
  const schemaValid = issues.length === 0 && result.status === 'success';
  const data = result.status === 'success' ? (result.data ?? {}) : {};
  const title = result.status === 'success' ? result.title : '';
  const description = result.status === 'success' ? result.aiDescription : '';

  const fields = evalCase.fields.map((field) => {
    const expectation = evalCase.fieldExpectations[field.id] ?? { grade: 'optional' as const };
    return scoreField(field.id, expectation, data[field.id]);
  });

  const storyClean = !hasForbiddenSubstring(description, evalCase.forbiddenStoryPhrases);
  if (!storyClean) issues.push('description contains invented story/memory language');

  return {
    caseId: evalCase.id,
    schemaValid,
    titleCorrect: result.status === 'success' && scoreTitle(evalCase.expectedTitle, title),
    fields,
    storyClean,
    issues,
  };
};

const rate = (numerator: number, denominator: number): number =>
  denominator === 0 ? 0 : numerator / denominator;

const percentile = (values: number[], p: number): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.min(Math.max(rank, 0), sorted.length - 1)];
};

const average = (values: number[]): number | null =>
  values.length === 0 ? null : values.reduce((sum, v) => sum + v, 0) / values.length;

export const aggregateScores = (scores: CaseScore[]): AggregateMetrics => {
  const allFields = scores.flatMap((s) => s.fields);
  const gradedFields = allFields.filter((f) => f.grade === 'match' || f.grade === 'abstain');
  const answerableFields = allFields.filter((f) => f.grade === 'match' || f.grade === 'optional');
  const abstainFields = allFields.filter((f) => f.grade === 'abstain');

  const latencies = scores
    .map((s) => s.latencyMs)
    .filter((v): v is number => typeof v === 'number');
  const costs = scores.map((s) => s.costUsd).filter((v): v is number => typeof v === 'number');

  return {
    evalSetVersion: EVAL_SET_VERSION,
    caseCount: scores.length,
    schemaValidRate: rate(scores.filter((s) => s.schemaValid).length, scores.length),
    titleCorrectRate: rate(scores.filter((s) => s.titleCorrect).length, scores.length),
    fieldCorrectnessRate: rate(gradedFields.filter((f) => f.correct).length, gradedFields.length),
    fieldFillRate: rate(answerableFields.filter((f) => f.filled).length, answerableFields.length),
    hallucinationRate: rate(allFields.filter((f) => f.hallucinated).length, allFields.length),
    abstentionQuality:
      abstainFields.length === 0
        ? null
        : rate(abstainFields.filter((f) => f.correct).length, abstainFields.length),
    storyCleanRate: rate(scores.filter((s) => s.storyClean).length, scores.length),
    p50LatencyMs: percentile(latencies, 50),
    p95LatencyMs: percentile(latencies, 95),
    avgCostUsd: average(costs),
  };
};
