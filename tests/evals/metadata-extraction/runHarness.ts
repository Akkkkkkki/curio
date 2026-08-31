import type { CaseScore, EvalCase, EvalReport, ImageLoader, MetadataAnalyzer } from './types';
import { aggregateScores, scoreCase } from './scoring';

/**
 * Runs the metadata-extraction eval (CUR-173, first step).
 *
 * For each case it loads the image (via the injected {@link ImageLoader}),
 * calls the injected {@link MetadataAnalyzer} with the exact same inputs the
 * product uses — image + field schema + collection context — and scores the
 * result. The analyzer decides which model/provider (or fixture) answers; this
 * function only measures. That separation is what lets one fixture set grade
 * the Gemini baseline and any future candidate on equal footing.
 */
export interface RunEvalOptions {
  /** Passed straight through to the analyzer, matching the product call. */
  locale?: string;
  /**
   * Optional per-case timing. When provided it wraps the analyzer call and
   * records wall-clock latency onto the score; live runners use this, the
   * deterministic CI runner omits it. Defaults to no timing.
   */
  now?: () => number;
}

export const runEval = async (
  cases: EvalCase[],
  analyze: MetadataAnalyzer,
  loadImage: ImageLoader,
  options: RunEvalOptions = {},
): Promise<EvalReport> => {
  const scores: CaseScore[] = [];

  for (const evalCase of cases) {
    const imageBase64 = await loadImage(evalCase.assetFile);
    const start = options.now?.();
    const result = await analyze({
      imageBase64,
      fields: evalCase.fields,
      collectionContext: evalCase.collectionContext,
      locale: options.locale,
    });
    const score = scoreCase(evalCase, result);
    if (options.now && start !== undefined) {
      score.latencyMs = options.now() - start;
    }
    scores.push(score);
  }

  return { aggregate: aggregateScores(scores), cases: scores };
};
