# Personal Story Prompt — Implementation Plan

> **Status:** Implementation plan (draft)
> **Linear:** [CUR-13](https://linear.app/qiuyue/issue/CUR-13) (implementation) · follows [CUR-5](https://linear.app/qiuyue/issue/CUR-5) (spec, done)
> **Spec:** [`docs/plan/DESIGN_personal_story_prompt.md`](./DESIGN_personal_story_prompt.md)
> **Phase:** Phase 0 · Sprint 2 (Core Loop) · P0
> **Last Updated:** 2026-05-16

This plan turns the approved design spec into ordered, PR-sized commits with the exact file:line touchpoints. Read the spec first — it owns every product decision. This document only covers _how_ we land it without breaking the tree.

---

## 1. Scope reminder (what is and isn't shipping)

In scope (mirrors spec §8 acceptance):

- AI stops auto-filling `CollectionItem.notes` on new items.
- Add Item verify step shows an empty Story textarea above custom fields, with an opt-in `✨ Need a prompt?` reveal.
- New `POST /api/gemini/story-prompts` endpoint returns 3 short, object-specific questions.
- "Archive Narrative" is renamed to "Story" in UI/i18n; legacy items render a one-time migration banner.
- `aiDescription` lives in `item.data._aiDescription` (no schema migration).
- Analytics fire for `add_item_saved_with_story` / `add_item_saved_without_story`.

Out of scope (spec §9): homepage "needs story" nudge, storyteller badge, voice dictation, AI rewrite of drafts, renaming the `notes` column.

---

## 2. Sequencing (5 commits, in this order)

The work is split so each commit leaves `npm run format:check && npm test && npm run build && npm run test:e2e` green. The server alias keeps clients on `main` working through commits 1–4. Commit 5 removes the alias once all clients have shipped.

### Commit A · Types + server schema (backwards-compatible)

Goal: introduce `aiDescription` end-to-end without changing user-visible behaviour. Keep `notes` as a write-through alias on the server response so existing clients still work.

- `src/types.ts:60-64` — extend `AIAnalysisResult` with `aiDescription?: string`. Add a JSDoc on `notes` marking it `@deprecated` (response shape only; the `CollectionItem.notes` storage field stays canonical, per spec §3.1).
- `src/types.ts:31-43` — leave `CollectionItem.notes` unchanged. Add a brief comment that `notes` is the human-authored Story and that AI observations live in `data._aiDescription`.
- `server/geminiProxy.js:275-284` — rename the schema property from `notes` to `aiDescription`; tighten the description string to the spec §4.1 copy ("factual, neutral visual observation … must NOT … speculate"). In the response handler (lines 330-336), destructure `{ title, aiDescription, ...data }` and return `{ title, aiDescription, notes: aiDescription, data }`. The duplicated `notes` field is the one-release alias.
- `tests/services/geminiService.test.ts:58,68,83` and `tests/mocks/gemini.ts:10,25,30` and `tests/mocks/handlers.ts:19` — update mocks to return both `notes` and `aiDescription` so we can flip consumers safely.
- `tests/live/geminiProxy.live.test.ts:63-64` — assert both `notes` (alias) and `aiDescription` exist; flag the `notes` assertion as scheduled for removal in commit E.
- `src/services/geminiService.ts:112-143` — widen `AnalyzeResult` success shape to include `aiDescription: string`. Keep `notes` populated from `aiDescription` for callers that still read it. No callers change yet — that's commit B.

Tests touched: gemini service unit, mocks, live test. No UI changes. Build/format/test/E2E should all stay green.

### Commit B · AddItemModal: stop auto-filling Story, render new verify UX

Goal: the AI no longer writes into `formData.notes`; the verify step shows an empty Story textarea + the "Need a prompt?" affordance (the prompts panel is wired empty here — the endpoint comes in commit C).

- `src/components/AddItemModal.tsx:336` and `:496` — when the analyze call succeeds, route the response into `data._aiDescription` instead of `notes`. New shape:
  ```ts
  createBatchItem(image, {
    id: ...,
    title: result.title || '',
    notes: '', // ← user writes this; never AI-filled
    data: cleanAiData({ ...result.data, _aiDescription: result.aiDescription || '' }),
  })
  ```
- `src/components/AddItemModal.tsx:574,611` — same change on save: `notes: formData.notes || ''` continues to write whatever the user typed (which may be empty). Push `_aiDescription` from the batch-item into `data._aiDescription` if present.
- `src/components/AddItemModal.tsx:991-1004` — reorder the verify step:
  1. Story block (label `t('story')`, textarea bound to `formData.notes`, placeholder `t('storyPlaceholder')`).
  2. `✨ Need a prompt?` button under the textarea (renders a placeholder panel with the static copy `t('storyPromptHelp')` and `t('storyPromptHide')` for now; suggestions list is empty in this commit).
  3. Existing custom-field map (unchanged) below a divider.
  4. Rating block (unchanged).
- `src/components/AddItemModal.tsx` save bar — when `formData.notes.trim() === ''`, change the primary CTA label to `t('storySaveWithout')` and render the hint `t('storySaveWithoutHint')` underneath. The button stays primary visual weight — no warning, no validation gate (spec §5.1).
- `src/components/AddItemModal.tsx:336` (`cleanAiData`) — verify the helper does not strip keys starting with `_`. If it does, allow `_aiDescription` through (and `_storyMigrationDismissed` for completeness). See `clean*` helpers near the top of the file.
- `src/i18n.ts:42-44,433-435` — add the new keys from spec §6 (`story`, `storyPlaceholder`, `storyPromptCta`, `storyPromptHelp`, `storyPromptHide`, `storyPromptInsert`, `storySaveWithout`, `storySaveWithoutHint`). Keep `archiveNarrative` and `provenancePlaceholder` as aliases for one release.
- `tests/components/AddItemModal.test.tsx:113` — assert that after a successful AI analysis the verify step renders an empty `t('story')` textarea. Add a new test: when story is empty, the primary CTA reads `Save without story`. Update any "expect notes prefilled" assertion to the new contract.
- `tests/e2e/add-item.spec.ts` (or closest add-item E2E) — extend the happy-path to verify the user can save an item with an empty Story; assert the saved item has `notes === ''` and `data._aiDescription` is non-empty.

At end of commit B: prompts panel reveals a static "help" block but no AI suggestions; that's wired in commit C.

### Commit C · `/api/gemini/story-prompts` + client + populated suggestion panel

Goal: the `✨ Need a prompt?` affordance returns 3 tailored questions; failure is silent.

- `server/geminiProxy.js` — add a new handler immediately after `/api/gemini/suggest-fields` (around line 399). Mirror the existing structure: `ipLimiter`, `requireAuth`, `userLimiter`. Inputs and outputs per spec §4.1. System prompt verbatim from spec ("You are a thoughtful curator…"). Constrain output to a JSON array of 3 strings, each ≤ 12 words; trim/dedupe defensively (reuse the dedupe-and-cap pattern from `/api/gemini/suggest-fields:380-393`).
  - Add `/api/gemini/story-prompts` to the `METRICS_ROUTES` set (line 21-26).
- `src/services/geminiService.ts` — add `fetchStoryPrompts({ title, collectionContext, aiDescription, knownFields, locale }): Promise<{ prompts: string[] }>`. On any throw or `status === 'disabled'`, resolve `{ prompts: [] }` (never reject). 3-second timeout via a tighter `REQUEST_TIMEOUT_MS` override (spec §8: 3s p95 budget; if we miss, UI silently hides the affordance).
- `src/components/AddItemModal.tsx` — hook the panel up:
  - Lazy-call `fetchStoryPrompts` when the user first opens the panel _or_ after the textarea is focused for >10s with no input (once per session, per spec §5.1). Cache the result on the batch-item / formData so reopening doesn't re-fetch.
  - Render 3 rows with `+` buttons. Tapping inserts the question as `> {question}\n\n` at the cursor (textarea focused, caret moved to the end). If the array is empty, hide the panel entirely — don't show a loading skeleton (spec §4.2: prompts are an enhancement, never required).
- `tests/services/geminiService.test.ts` — new test: `fetchStoryPrompts` returns `{ prompts: [] }` when the proxy returns 500 / 503 / times out.
- `tests/integration/AppNavigation.test.tsx:109` (or a tighter component test) — interaction test: opening the prompts panel triggers the fetch exactly once; tapping a question inserts text into the textarea.

### Commit D · Item Detail rename, empty state, legacy migration banner

Goal: the visible "Archive Narrative" label is now "Story" everywhere; legacy items show the one-time migration banner; AI observation gets a discreet home.

- `src/App.tsx:1819` — replace `{t('archiveNarrative')}` with `{t('story')}`.
- `src/App.tsx:1822-1828` — wrap the textarea in a state switch (spec §5.2):
  - State A (`item.notes` is non-empty, no migration banner needed): render the existing textarea (already correct).
  - State B (`item.notes` empty, no `_aiDescription`, not legacy): render the inviting empty card with `Write your story` (focuses the textarea) and `Need a prompt?` (calls `fetchStoryPrompts` and reveals suggestions inline, same control as Add Item modal).
  - State D (`item.notes` non-empty AND `data._isLegacyAiNotes === true` — see migration detection below — AND `data._storyMigrationDismissed !== true`): render the migration banner above the existing textarea with the three actions (`Keep AI text` → set `_storyMigrationDismissed=true`; `Edit current` → focus textarea, keep current text; `Start fresh` → move text into `_aiDescription`, blank the textarea, focus it, reveal prompts).
- `src/App.tsx` — add a small "More details → AI observation" disclosure block, only when `item.data._aiDescription` is non-empty. Label: `t('storyAiObservationLabel')`. Style: muted, mono-label per design system. Per spec §5.2 state C, this is the _only_ place the AI observation surfaces.
- `src/App.tsx:1819-1828` — replace the placeholder reference too: `placeholder={t('storyPlaceholder')}`.

**Migration detection — how do we know an item is "legacy"?** The spec leaves this open, so resolve it here:

- Define a one-time backfill at app load: in `services/db.ts` (or the loader called by `useCollections`), after fetching items, mark any item where `notes && !data._aiDescription && !data._storyMigrationDismissed && createdAt < <flag-cutoff>` with `data._isLegacyAiNotes = true`. The cutoff is a constant equal to "first commit timestamp that introduces this feature" — committed to `services/db.ts` as `STORY_FEATURE_LAUNCHED_AT`.
- The flag is a derived hint; if the user dismisses or rewrites, we set `_storyMigrationDismissed = true` and never recompute. Items created _after_ the cutoff are presumed to have correct `notes` (user-authored) and never show the banner.
- This is intentionally a heuristic — see spec §2 Q5 rationale. No backend migration.

Test impact for commit D:

- `tests/components/AddItemModal.test.tsx` — no change here (commit B already covers the verify-step rename).
- New tests under `tests/components/` (or wherever the item-detail screen tests live): empty Story renders the empty-state card; legacy detection sets `_isLegacyAiNotes` correctly; banner dismissal persists `_storyMigrationDismissed`.
- E2E: open a seeded legacy item, dismiss the banner, refresh, banner stays gone.
- `src/services/seedCollections.ts` — the five Vinyl items at lines 34, 54, 74, 94, 114 currently use editorial copy in `notes`. Decide explicitly: these are sample-curator authored, not AI artifacts. Mark each with `data._isLegacyAiNotes: false` in the seed so the migration banner never fires on the public sample. Bump `CURRENT_SEED_VERSION` in the same file.

### Commit E · Drop the `notes` alias from the analyze response + remove deprecated i18n keys

Goal: clean up after one release cycle. Only land this once we have confirmation that no client on `main` reads `result.notes` from `/api/gemini/analyze`.

- `server/geminiProxy.js:330-336` — return `{ title, aiDescription, data }` only.
- `tests/live/geminiProxy.live.test.ts:63-64` — assert _only_ `aiDescription`.
- `src/services/geminiService.ts` — remove the `notes` field from the success shape.
- `src/i18n.ts` — delete `archiveNarrative` and `provenancePlaceholder` aliases.

Hold this commit until commits A–D have been deployed and the AI flow has been exercised in production for ≥ 7 days. Track via a short followup ticket; not part of CUR-13's exit.

---

## 3. Analytics (lands inside commits B and D, not separate)

Per spec §5.1 telemetry:

- Fire `add_item_saved_with_story` (length > 0) or `add_item_saved_without_story` (length === 0) at the save callsite in `AddItemModal.tsx:574,611`.
- Payload includes `story_length_bucket`: one of `0`, `1-50`, `51-200`, `201-500`, `500+` (characters).
- Use whatever analytics shim CUR-8 lands. If CUR-8 hasn't shipped by the time we ship CUR-13, write the events behind a single `trackEvent()` helper in `src/services/analytics.ts` that is a no-op for now — CUR-8 will fill it in. **Do not block CUR-13 on CUR-8.**

Item-detail-side events (`story_started_from_empty`, `story_prompt_inserted`, `legacy_banner_action`) are nice-to-have; keep them behind the same shim and ship if cheap, otherwise defer.

---

## 4. Sync / storage notes

- `data._aiDescription` and `data._storyMigrationDismissed` ride inside the existing `items.data` jsonb column (spec §3.2). No Supabase migration. The merge logic in `services/db.ts:1036,1179` already passes `data` through unchanged.
- Per the spec, these underscore-prefixed keys must be filtered out anywhere we enumerate user-defined custom fields. Audit:
  - `server/geminiProxy.js` `mapFieldTypeToSchemaType` and the schema-build loop (line 286-294) — already only iterates `fields`, doesn't touch existing `data` keys. Safe.
  - `src/components/AddItemModal.tsx:1005` — `currentCollection?.customFields.map(...)` iterates `customFields` not `data`. Safe.
  - Any "show all data" debug helper or export path. Spot-check during commit D.
- Cross-check `services/db.ts:1036` (loading items) and `:1179` (writing) — `data` is shallow-merged. If a sync round-trip would drop unknown keys, that's a sync bug independent of CUR-13. Quick assertion in `tests/services/db.operations.test.ts:168` to lock in: write an item with `data._aiDescription`, round-trip, expect the key to survive.

---

## 5. Risk + open calls

The five things most likely to trip us up:

1. **`cleanAiData` filter behaviour.** If it nukes underscore keys, commit B fails silently. Read it during commit A and fix in the same commit if needed.
2. **Story prompts cost.** Every Add Item flow that opens the panel triggers one Gemini call. Spec §10 Q1 leaves the auto-reveal-after-10s open. **Recommendation: ship without auto-reveal in commit C.** Easier to add later than to roll back. Confirm with owner.
3. **Legacy detection false positives.** Anyone who manually edited their AI-generated text before this change will still see the banner. The spec acknowledges this is unavoidable without server-side ML classification. We just need to make sure `Keep AI text` is the easiest action.
4. **Public sample items.** The Vinyl seed items have editorial prose, not AI text. Without the `_isLegacyAiNotes: false` marker (commit D), every new user would see the migration banner on every sample item — terrible first impression. Don't forget the seed bump.
5. **Aliases in tests.** The live test (`tests/live/geminiProxy.live.test.ts:63-64`) is the contract guard. Make sure it asserts both `notes` and `aiDescription` after commit A, and only `aiDescription` after commit E — never neither.

Open questions to confirm with owner before commit C:

- Auto-reveal of prompts after 10s idle: ship or defer? (Recommend defer.)
- `story_*` analytics shim: stub now and let CUR-8 wire, or block on CUR-8? (Recommend stub.)
- Commit E timing: at +7 days, or hold until the next minor release? (Recommend +7 days.)

---

## 6. Definition of done

The CUR-13 acceptance list (spec §8) plus:

- [ ] Commits A–D landed on `main`; commit E filed as a followup ticket.
- [ ] `npm run format:check && npm test && npm run build && npm run test:e2e` green on each commit.
- [ ] Manual QA: new item — save with story, save without story, prompt panel reveal, prompt insertion.
- [ ] Manual QA: legacy item (created before the cutoff) shows the banner once and dismisses correctly across all three actions.
- [ ] Public sample collection never shows the banner.
- [ ] Story label and placeholder appear in English and Chinese.
- [ ] `data._aiDescription` is present on a freshly created item and never appears in the Item Detail's primary Story slot.
