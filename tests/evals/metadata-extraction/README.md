# Metadata-extraction eval (CUR-173)

A small, repeatable harness for judging Curio's **metadata extraction** as a
product operation: photo + collection context + field schema → title, factual
visual description, and field values. It exists so any future model, provider,
or prompt change can be compared against the current Gemini baseline _before_
rollout, rather than adopted on release hype.

This is the **first step** of CUR-173. What lands here is the deterministic,
provider-neutral core; wiring live provider calls and expanding the fixture set
are tracked follow-ups (see [Not yet done](#not-yet-done)).

## Layout

| File                      | Purpose                                                                        |
| ------------------------- | ------------------------------------------------------------------------------ |
| `types.ts`                | Shared contracts: `EvalCase`, `FieldExpectation`, `MetadataAnalyzer`, metrics. |
| `fixtures.ts`             | `METADATA_EVAL_CASES` — versioned cases, expected/acceptable answers.          |
| `scoring.ts`              | Pure scoring: one `AnalyzeResult` → `CaseScore`; many → `AggregateMetrics`.    |
| `runHarness.ts`           | `runEval(cases, analyze, loadImage)` — loads images, calls analyzer, scores.   |
| `../metadataEval.test.ts` | Deterministic CI subset (fixture analyzer, stub loader — no model/network).    |

The analyzer and the image loader are **injected**. That is the whole point: the
same fixtures grade the Gemini baseline, a future OpenAI adapter, or a canned
fixture in CI, on identical footing. `MetadataAnalyzer` mirrors the product's
`analyzeImage(imageBase64, fields, { collectionContext, locale })` contract.

## Fixtures

Every asset is from Curio's **public sample gallery**
(`public/assets/sample-vinyl*.jpg`), and expected answers are the facts already
published for those records in `src/services/seedCollections.ts`. No private
user photo or story is copied into a test corpus (AC7).

Each field is graded one of three ways:

- **`match`** — must equal one of `acceptable` (normalized). A wrong or blank
  value is incorrect; a wrong value is also a hallucination.
- **`abstain`** — the truth is not in the photo (e.g. physical media
  `condition`, or a specific pressing `label`/`year` from a front cover). A
  blank is correct; any confident value is a hallucination.
- **`optional`** — a value in `acceptable` is credited, a blank is not
  penalized, anything else is wrong-but-not-a-hallucination.

The set deliberately includes a clear-identity case, an **abstention** case
(blank beats a guess), and a **collection-context pair** (same image, two
contexts). The pair forwards context distinctly and each `CaseScore` retains the
raw values, so a caller can compare the two answers; both cases still accept the
factually-correct genre (a right answer isn't marked wrong for context), so a
built-in pairwise sensitivity metric is a follow-up rather than something the
per-case rates measure today.

## Metrics (`AggregateMetrics`)

Deterministic today: `schemaValidRate`, `titleCorrectRate`,
`fieldCorrectnessRate`, `usefulFillRate` (only a _correct_ non-empty value
counts — a wrong guess is not a useful fill), `hallucinationRate`,
`abstentionQuality`, `storyCleanRate`. Populated only on a live run:
`p50/p95LatencyMs`, `avgCostUsd` (the harness accepts a clock; cost is reported
by the live adapter).

`storyClean` enforces a product principle — the factual description is metadata,
never the owner's story, so invented memories/emotional claims fail the case.

## Running

- **CI / deterministic** (no cost, runs in the normal suite):
  `npm test -- tests/evals/metadataEval.test.ts`
- **Live baseline** (opt-in, cost-bearing): not wired yet. It will supply a real
  `MetadataAnalyzer` (Gemini adapter over `analyzeImage`) and an `ImageLoader`
  that reads `public/assets/<file>`, then record the baseline aggregate.

The harness grades at `FIXTURE_LOCALE` (English). The acceptable answers and the
exact-match scorer are English-only, so an arbitrary `locale` is deliberately
**not** forwarded — a correctly-translated result would otherwise score wrong.
Localized fixtures are a follow-up.

## Decision rule (for adopting a future model/provider)

A candidate replaces the default only when, on this eval at the current
`EVAL_SET_VERSION`, it:

1. does **not** regress `hallucinationRate` or `abstentionQuality` versus the
   recorded Gemini baseline (trust before growth — a model that fabricates more
   is disqualified even if it fills more). Off-schema fabrication counts toward
   `hallucinationRate`, and a blank factual description fails `storyClean`, so
   neither can be gamed for a perfect trust score;
2. keeps `schemaValidRate` at **1.0** — inventing off-schema keys or emitting an
   invalid `select` option is a hard blocker, not a trade-off;
3. does **not** regress `titleCorrectRate` or `fieldCorrectnessRate` on any
   weighted category;
4. improves the weighted trade-off of correctness, useful fill, latency, and
   cost, with any per-category regression documented and accepted.

Winning a single metric is not sufficient. Record the baseline and each
candidate's aggregate alongside the `EVAL_SET_VERSION` they ran against.

## Not yet done (follow-ups on CUR-173)

- Live Gemini baseline run + recorded aggregate.
- Latency/cost capture through a real adapter.
- A pairwise context-sensitivity metric over the retained `CaseScore.values`.
- Localized fixtures + locale-aware scoring (so a non-English `locale` can be graded).
- Fixture breadth beyond vinyl (tea tins, chocolate wrappers, bottles/labels,
  tickets/posters, cameras) using approved assets.
