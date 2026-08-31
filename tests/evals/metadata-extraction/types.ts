import type { FieldDefinition } from '@/types';
import type { AnalyzeResult } from '@/services/aiService';

/**
 * Metadata-extraction eval — shared contracts (CUR-173, first step).
 *
 * The point of this harness is to judge Curio's *product* operation — turn a
 * photo + collection context + field schema into a title, a factual visual
 * description, and field values — not a generic chatbot benchmark. Everything
 * here is provider-neutral and deterministic: the analyzer is injected, so the
 * same cases can grade the current Gemini baseline, a future OpenAI adapter, or
 * a canned fixture in CI, without this module ever knowing which is which.
 *
 * Latency and cost are deliberately optional (see {@link AnalyzedCase}). They
 * only exist on a real, cost-bearing run; the deterministic CI subset leaves
 * them undefined and the aggregate simply omits them. Wiring live provider
 * calls, capturing latency/cost, and expanding the fixture set beyond the
 * public sample gallery are tracked as follow-ups on CUR-173.
 */

/** Bumped whenever the fixture set or its expected answers change materially. */
export const EVAL_SET_VERSION = 1;

/**
 * How a single field is graded against the analyzer's output.
 *
 * - `match`    — the value must be one of `acceptable` (normalized compare).
 * - `abstain`  — the truth is not determinable from the photo (e.g. physical
 *                media condition from a catalog cover). A blank is correct;
 *                any confident value counts as a hallucination.
 * - `optional` — a value in `acceptable` is credited, a blank is not penalized,
 *                anything else is wrong-but-not-hallucinated.
 */
export type FieldGrade = 'match' | 'abstain' | 'optional';

export interface FieldExpectation {
  grade: FieldGrade;
  /** Accepted answers. Numbers and strings compare after normalization. */
  acceptable?: Array<string | number>;
  /**
   * Substrings that must never appear in the value (case-insensitive). Used to
   * catch invented provenance, e.g. a fabricated pressing plant or owner name.
   */
  forbiddenSubstrings?: string[];
}

export type TitleExpectation =
  | { acceptable: string[]; requiredSubstrings?: string[] }
  /** The image is too ambiguous to name; a blank/generic title is correct. */
  | { abstain: true };

export interface EvalCase {
  id: string;
  /** One line on what this case probes — read in test output and the report. */
  description: string;
  /**
   * Filename under `public/assets/`. Kept as a bare name (not a Vite
   * `BASE_URL` URL) so a live runner can read it off disk while the
   * deterministic runner never touches the file at all.
   */
  assetFile: string;
  /** Collection context handed to the analyzer, mirroring the product call. */
  collectionContext?: { name?: string; description?: string };
  /** The field schema the analyzer must fill — a real Curio template's fields. */
  fields: FieldDefinition[];
  expectedTitle: TitleExpectation;
  /** Keyed by field id. Fields absent here are graded as `optional`. */
  fieldExpectations: Record<string, FieldExpectation>;
  /**
   * Phrases the factual description must not contain. The visual description is
   * factual metadata, never the owner's story, so it must not invent memories
   * or emotional claims ("reminds me of", "a gift from", …).
   */
  forbiddenStoryPhrases?: string[];
}

/**
 * The analyze contract, mirroring {@link import('@/services/aiService').analyzeImage}
 * (its positional arguments packed into one object). A real adapter wraps
 * `analyzeImage`; the CI fake returns canned {@link AnalyzeResult}s.
 */
export interface AnalyzeItemInput {
  imageBase64: string;
  fields: FieldDefinition[];
  collectionContext?: { name?: string; description?: string };
  locale?: string;
}

export type MetadataAnalyzer = (input: AnalyzeItemInput) => Promise<AnalyzeResult>;

/**
 * Turns a case's {@link EvalCase.assetFile} into base64. Injected so the
 * harness core stays free of `fs`/network: CI passes a stub, a live runner
 * reads `public/assets/<file>`.
 */
export type ImageLoader = (assetFile: string) => Promise<string>;

export interface FieldScore {
  fieldId: string;
  grade: FieldGrade;
  /** The analyzer produced a non-empty value. */
  filled: boolean;
  /** Credited as correct for its grade (right value, or a correct abstention). */
  correct: boolean;
  /** Filled where it should have abstained, off-schema, or a forbidden value. */
  hallucinated: boolean;
}

export interface CaseScore {
  caseId: string;
  /** Analyzer returned `status: 'success'` and parsed into the schema. */
  schemaValid: boolean;
  /** Raw title the analyzer produced ('' on a non-success result). */
  title: string;
  /**
   * Raw value per schema field id (as the analyzer returned it, `undefined`
   * when blank). Retained so callers can compare cases — e.g. the same image
   * under two contexts — which the boolean rates alone cannot express.
   */
  values: Record<string, unknown>;
  titleCorrect: boolean;
  fields: FieldScore[];
  /** The factual description avoided invented story/memory phrases. */
  storyClean: boolean;
  /** Present only when the analyzer/runner reported it (live runs). */
  latencyMs?: number;
  costUsd?: number;
  /** Non-fatal problems (off-schema keys, invalid select option, …). */
  issues: string[];
}

export interface AggregateMetrics {
  evalSetVersion: number;
  caseCount: number;
  schemaValidRate: number;
  titleCorrectRate: number;
  /** Correct values ÷ gradeable (`match`/`abstain`) fields. */
  fieldCorrectnessRate: number;
  /**
   * Correct non-empty values ÷ answerable (`match`/`optional`) fields. A wrong
   * value is not a useful fill, so it does not count toward the numerator.
   */
  usefulFillRate: number;
  /** Hallucinated fields ÷ all graded fields. */
  hallucinationRate: number;
  /** Correct abstentions ÷ fields that should abstain. `null` when none exist. */
  abstentionQuality: number | null;
  storyCleanRate: number;
  /** Averages over cases that reported the figure; `null` when none did. */
  p50LatencyMs: number | null;
  p95LatencyMs: number | null;
  avgCostUsd: number | null;
}

export interface EvalReport {
  aggregate: AggregateMetrics;
  cases: CaseScore[];
}

/** Present on {@link AnalyzeResult} only in the success variant. */
export type AnalyzeSuccess = Extract<AnalyzeResult, { status: 'success' }>;
