# Personal Story Prompt — Design Document

> **Status:** Design (Ready for Implementation Review)
> **Linear:** [CUR-5](https://linear.app/qiuyue/issue/CUR-5) (spec) · blocks [CUR-13](https://linear.app/qiuyue/issue/CUR-13) (implementation)
> **Phase:** Phase 0 · Sprint 2 (Core Loop) · P0
> **Last Updated:** 2026-05-15

This spec defines the UX and data model for replacing Curio's AI-generated "Archive Narrative" with a user-written Story field. It is the single most important Phase 0 product change — the strategy doc names it as the moat ("emotional data gravity"). For the strategy context, see `docs/PRODUCT_STRATEGY.md` §5.1 ("Story is human-authored") and `docs/PRODUCT_DESIGN.md` §2.5 ("Capture simplification requirements").

---

## 1. Problem

Today, the item's most prominent long-form field — labelled "Archive Narrative" — is auto-filled by Gemini with a literal visual description of the photo (e.g. _"A white rectangular wrapper featuring a blue header…"_). Users cannot feel identity attachment to a machine-generated wrapper description, and the strategy explicitly identifies this as the single highest-priority risk to the product thesis (`docs/PRODUCT_STRATEGY.md` §risks: _"Users don't write personal stories (just use AI auto-fill) → destroys the moat"_).

The current behaviour lives in three places:

- `server/geminiProxy.js:275-284` — the analyze schema asks Gemini for `notes` ("A brief summary of visual observations about the item").
- `services/geminiService.ts:117-143` — the client receives `{ title, data, notes }` and treats `notes` as a regular field.
- `components/AddItemModal.tsx:487-497, 980-992` — `result.notes` is written straight into `formData.notes`, which the verify step exposes as the "Archive Narrative" textarea, then persisted to `CollectionItem.notes` (`types.ts:41`).

This spec resolves all four open questions raised in CUR-5 and CUR-13, plus the migration question for items already in the DB.

---

## 2. Decisions

The four open questions, with chosen options and rationale tied back to the strategy/design docs.

### Q1 · What happens to the AI-generated description?

**Decision:** **Option C — separate fields.** AI fills a new hidden `aiDescription` field; the visible Story field is user-only.

| Why                                                                                                                                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Strategy §5.1: _"AI-generated object descriptions should not appear as the main story. They can remain as hidden metadata that the user can inspect when useful."_ — explicitly endorses C. |
| Keeping the AI text as hidden metadata preserves its utility for future search/discovery (Phase 2) without polluting the story layer.                                                        |
| Cleanly separates ownership: `story` is human, `aiDescription` is machine. Resolves the long-running question of "is this text mine or the AI's?"                                            |

### Q2 · What's the prompt UX?

**Decision:** **Option C — both modes, free text as default.** The verify step shows a single Story textarea with an inviting placeholder. A subtle `✨ Need a prompt?` button reveals 3 AI-suggested questions tailored to the object. Users can tap a question to seed the textarea with it as a starting line (their cursor lands at the end), or close the prompts and keep writing freely.

| Why                                                                                                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Strategy §5.1: _"Story prompting assistance (suggesting questions, not generating answers)."_                                                                                      |
| Design §2.5: capture flow should prioritise simple defaults — a free textarea matches "easy over comprehensive" from §1 principles in `DESIGN_flexible_collection_creation.md`.    |
| Guided questions help first-timers and writer's-block moments, but forcing them every time would feel bureaucratic — violating "beauty before bureaucracy" (`PRODUCT_STRATEGY.md`). |
| Tapping a question seeds the textarea but does **not** auto-generate the answer — preserves the "AI suggests, user writes" boundary.                                               |

### Q3 · When does the story prompt appear?

**Decision:** **Option C — quick optional prompt in Add Item, with a persistent nudge in Item Detail.** The Story field is part of the verify step (visible, but skippable). Saving without a story is allowed; the item is then tagged with a soft "needs story" cue (already implied by `docs/PRODUCT_DESIGN.md` §2.5: _"Quick-add items should carry a subtle cue that they still need enrichment, especially story completion"_) and surfaced both in the item detail view and via a future homepage nudge ("3 items still need a story").

| Why                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Design §2.5 lists "story prompt" in the default capture surface — it belongs in Add Item.                                                                                 |
| Design §2.4: _"Curio supports both capture now, curate later and write the story up front."_ — making it optional respects both modes.                                    |
| Strategy: _"Make story prompts engaging, not obligatory. Show beautiful examples."_ — forcing it would create drop-off; nudging later creates a return-visit hook.        |
| The "needs story" cue creates a healthy backlog of low-friction enrichment tasks, which drive Phase 0's retention metric (`ROADMAP.md` §metrics: _story field usage_).    |

### Q4 · Can AI still assist with stories?

**Decision:** **Option A — AI suggests questions only, never generates story text.** Hard rule, enforced in the prompt template, the UI copy, and the QA checklist.

| Why                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Strategy §5.1 and §6: _"AI helps extract metadata and suggest prompts, but does not invent the user's story."_                                                                   |
| Design §4.1 (Phase 1 AI stance): _"AI should NOT auto-write the visible story."_                                                                                                 |
| Tying our hands here is intentional — the moment we ship "AI write my story" we eliminate the moat. This must be a documented constraint, not an implementation detail.         |

### Q5 (new) · Migration of existing items

**Decision:** **In-place soft migration.** No data is moved. Existing items keep their AI-generated text in `notes`. On first view after the update, the item detail shows a one-time inline banner:

> _This narrative was written by AI when you first saved this item. Curio is now story-first — would you like to rewrite it in your own words?_
> **[ Keep AI text ]** **[ Start fresh ]** **[ Edit current ]**

- **Start fresh** clears `notes`, copies the old text into `aiDescription`, and focuses the empty textarea with prompts revealed.
- **Edit current** drops the user into the textarea with the AI text as a starting draft.
- **Keep AI text** dismisses the banner permanently for that item (stored in `item.data._storyMigrationDismissed = true` to avoid schema churn).

Why not a backend migration? It would require classifying which `notes` strings are AI-generated vs. user-edited, which is impossible after the fact. Letting the user decide per-item is honest and preserves their existing content.

---

## 3. Data Model

### 3.1 Type changes (`types.ts`)

```diff
 export interface CollectionItem {
   id: string;
   collectionId: string;
   title: string;
-  notes: string;
+  // The visible, human-authored Story. May be empty if the user hasn't written one yet.
+  notes: string;
+  // Hidden metadata: Gemini's visual observation of the item. Never shown as Story.
+  // Optional — older items predate this field; some new items may also skip it.
+  aiDescription?: string;
   data: Record<string, any>;
   ...
 }

 export interface AIAnalysisResult {
   title?: string;
   data: Record<string, any>;
-  notes?: string;
+  /** @deprecated kept for backwards compatibility during rollout — read aiDescription */
+  notes?: string;
+  aiDescription?: string;
 }
```

**Why keep the field name `notes` for the human story?** Renaming the storage key would force a Supabase migration and a sync-merge edge case for every existing user. The cost-to-value ratio is bad. We rename in UI only (i18n labels), and clearly document that `CollectionItem.notes` is the canonical Story field going forward. A future cleanup PR can rename to `story` when we have a quieter sprint.

### 3.2 Supabase

No schema migration required. `aiDescription` is stored inside the existing `items.data` jsonb column as `data._aiDescription` until a follow-up migration adds a dedicated column. The underscore prefix marks it as system-managed (already a convention used informally in the codebase).

Reserved keys in `data` (must not be exposed as user-defined custom fields — `PRODUCT_DESIGN.md` §3.3 already lists "title, story, and rating"):

```
_aiDescription
_storyMigrationDismissed
```

These keys are filtered out by `mapFieldTypeToSchemaType` and any "list custom fields" helper.

---

## 4. AI / Server Changes

### 4.1 Analyze endpoint (`server/geminiProxy.js`)

The schema sent to Gemini changes in two ways:

1. **Rename `notes` → `aiDescription`** in the schema, and tighten the description so it's clearly an observation, not a narrative:

```js
properties: {
  title: { type: Type.STRING, description: 'A short, descriptive title for the item.' },
  aiDescription: {
    type: Type.STRING,
    description:
      'A factual, neutral visual observation of the item (1-2 sentences). This is hidden metadata; it must NOT attempt to tell a story, infer emotional meaning, or speculate about the owner. Describe what is visible.',
  },
},
```

2. **Add a new endpoint** `POST /api/gemini/story-prompts` that returns 3 short, open-ended questions tailored to the item:

```ts
// Request
{
  title: string;
  collectionContext: { name: string; description?: string };
  // Optional: the AI's own description, to help it ask specific questions
  aiDescription?: string;
  // Optional: any already-known custom field values, e.g. { Brand: 'Hermès', Year: 1987 }
  knownFields?: Record<string, string | number>;
  locale: 'en' | 'zh';
}

// Response
{
  prompts: [string, string, string]; // exactly 3
}
```

System prompt (sketch):

> _You are a thoughtful curator helping a collector reflect on an object. Given the object's title and known facts, produce 3 short open-ended questions (max 12 words each) that would help the owner write a personal story about it. Questions must be specific to the object (mention details from the title/fields), never generic. Never include the answer. Never narrate. Return only the questions as a JSON array of strings. Respect the user's locale._

Quality bar: questions like "Who introduced you to vinyl?" or "What were you doing the first time you opened this bar?" — not "What's the story?"

### 4.2 Client (`services/geminiService.ts`)

- `analyzeImage()` returns `{ title, data, aiDescription }` (drop the public `notes` shape; the proxy keeps a `notes` alias for one release for backward compat).
- New `fetchStoryPrompts({ ... }): Promise<{ prompts: string[] }>`. Failures return `{ prompts: [] }` and the UI silently hides the "Need a prompt?" button — story capture is never blocked by AI availability (`PRODUCT_DESIGN.md` §2.4: _"AI must never be a hard blocker"_).

---

## 5. UX

### 5.1 Add Item flow — Verify step

The verify step is reorganised so Story sits **above** custom fields, reflecting its priority (`PRODUCT_DESIGN.md` §2.5: story is in the default capture surface ahead of "more details").

```
┌─────────────────────────────────────────────────────────────────┐
│  Verify details                                       step 3/3  │
│                                                                 │
│  ┌───────────┐   Title                                          │
│  │           │   ┌─────────────────────────────────────────┐    │
│  │   photo   │   │ Maison du Chocolat · Truffe Noire       │    │
│  │           │   └─────────────────────────────────────────┘    │
│  └───────────┘                                                  │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  YOUR STORY                                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ What's the story behind this piece?                     │    │
│  │                                                         │    │
│  │                                                         │    │
│  │                                                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│  ✨ Need a prompt?                                              │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  MORE DETAILS                                                   │
│  Brand        [ Maison du Chocolat                     ]        │
│  Cocoa %      [ 70                                     ]        │
│  Condition    [ Unopened                               ]        │
│                                                                 │
│  RATING       ★ ★ ★ ★ ☆                                         │
│                                                                 │
│  [ Save without story ]                          [ Save item ]  │
└─────────────────────────────────────────────────────────────────┘
```

When the user taps **✨ Need a prompt?** (or focuses the textarea for >10s with nothing typed, which auto-reveals once per session):

```
│  YOUR STORY                                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ What's the story behind this piece?                     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  💡 Try one of these to get started:                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Where were you when you first tried this?         [ + ] │    │
│  │ Who introduced you to Maison du Chocolat?         [ + ] │    │
│  │ Why this one — out of all the bars you've had?    [ + ] │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                  Hide prompts ✕ │
```

Tapping `+` next to a prompt inserts the question into the textarea as plain text (formatted as `> Where were you when you first tried this?\n\n`) and focuses the textarea with the cursor at the end. Users can then write under it or delete it.

**CTA copy:**

- Primary: `Save item` — always enabled.
- Secondary: When story is empty, the primary button changes label to `Save without story` (still primary visual weight, no warning) and a subtle hint appears: _"You can add a story later."_

**Drop-off telemetry:** instrument both `add_item_saved_with_story` and `add_item_saved_without_story` events with story length buckets. These feed the Phase 0 metric "% of items saved with story" (target tracked in `ROADMAP.md`).

### 5.2 Item Detail — read mode

The "Archive Narrative" label is renamed to **"Story"** everywhere.

**State A — Story written:**

```
STORY                                                             ✎
" I bought this on a rainy afternoon in Paris after the bakery
  on rue de Sèvres was closed. The shopkeeper let me taste three
  truffles and laughed when I asked which she would pick. "
```

**State B — Empty, never had AI text:**

```
STORY                                                             ✎
  ┌───────────────────────────────────────────────────────────┐
  │                                                           │
  │   Tell the story behind this one.                         │
  │                                                           │
  │              [ Write your story ]   [ Need a prompt? ]   │
  │                                                           │
  └───────────────────────────────────────────────────────────┘
```

**State C — Empty, but item has hidden AI description (advanced toggle):**

The AI observation is never shown alongside the empty Story slot. It lives under **More details → Show technical metadata** as a small, muted block labelled _"AI observation (hidden from public view)"_. This is the only place it appears, and it's never used in public/share surfaces (enforced separately in Phase 1 share components).

**State D — Legacy item: `notes` has pre-update content (the migration banner):**

```
STORY
  ┌───────────────────────────────────────────────────────────┐
  │ ℹ️ This narrative was written by AI when you first saved │
  │   this item. Curio is now story-first — would you like   │
  │   to rewrite it?                                          │
  │                                                           │
  │   [ Start fresh ]  [ Edit current ]  [ Keep AI text ]   │
  └───────────────────────────────────────────────────────────┘
  " A white rectangular wrapper featuring a blue header… "
```

Banner appears once per item; dismissed state stored in `item.data._storyMigrationDismissed`.

### 5.3 Mobile

The verify step on mobile keeps Story above custom fields, with the textarea sized to 4 lines minimum (enough room to feel like a writing space, not a comment box). The prompt suggestions appear as a vertical stack; tapping `+` works the same as on desktop. The sticky save bar at the bottom shows `Save item` or `Save without story` per §5.1.

---

## 6. i18n

New / renamed keys (`i18n.ts`):

| Key                            | English                                             | Chinese                                       | Notes                                              |
| ------------------------------ | --------------------------------------------------- | --------------------------------------------- | -------------------------------------------------- |
| `story` (rename `archiveNarrative`) | Story                                          | 故事                                          | Used as label in verify and detail.                |
| `storyPlaceholder` (rename `provenancePlaceholder`) | What's the story behind this piece?       | 这件物品背后有什么故事？                       | Textarea placeholder.                              |
| `storyPromptCta`               | Need a prompt?                                     | 需要灵感？                                    | Reveals AI questions.                              |
| `storyPromptHelp`              | Try one of these to get started:                  | 试试这些灵感：                                | Above suggested questions.                         |
| `storyPromptInsert`            | Insert                                            | 插入                                          | Tooltip for the `+` action.                        |
| `storyPromptHide`              | Hide prompts                                       | 隐藏灵感                                      | Dismisses the suggestion stack.                    |
| `storySaveWithout`             | Save without story                                | 暂不写故事                                    | Primary CTA when textarea is empty.                |
| `storySaveWithoutHint`         | You can add a story later.                        | 可以稍后补上故事。                            | Hint under the button when empty.                  |
| `storyEmptyDetailHint`         | Tell the story behind this one.                   | 讲讲这件物品背后的故事。                      | Empty-state copy on item detail.                   |
| `storyEmptyDetailCta`          | Write your story                                  | 写下你的故事                                  | Empty-state primary action.                        |
| `storyMigrationBanner`         | This narrative was written by AI when you first saved this item. Curio is now story-first — would you like to rewrite it? | 这段描述是 Curio 最初保存时由 AI 生成的。Curio 现在以故事为核心，你想重新写吗？ | Legacy banner body.       |
| `storyMigrationKeep`           | Keep AI text                                      | 保留 AI 文本                                  | Banner action.                                     |
| `storyMigrationStart`          | Start fresh                                       | 重新开始                                      | Banner action.                                     |
| `storyMigrationEdit`           | Edit current                                      | 在现有基础上修改                              | Banner action.                                     |
| `storyAiObservationLabel`      | AI observation (hidden from public view)          | AI 观察（不会公开显示）                       | Label for `aiDescription` under technical metadata. |

Keys to retire after one release: `archiveNarrative`, `provenancePlaceholder` (keep aliases for one minor version to avoid breaking external translations, then remove).

`onboardingStepTwo` ("Review metadata and add a short narrative.") is updated to: _"Review the details and tell its story — even one sentence is enough."_

---

## 7. File-level change list

For the implementer (CUR-13). Read this list together with §3, §4, §5.

| File                                       | Change                                                                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `types.ts`                                 | Add `aiDescription?: string` and `_storyMigrationDismissed` convention; deprecate `AIAnalysisResult.notes` in favour of `aiDescription`. |
| `server/geminiProxy.js`                    | Rename `notes` → `aiDescription` in the analyze schema; tighten description copy; add `POST /api/gemini/story-prompts` endpoint. |
| `services/geminiService.ts`                | Update `analyzeImage` response handling; add `fetchStoryPrompts()` with graceful empty fallback.                                |
| `components/AddItemModal.tsx`              | Verify step: stop auto-filling `formData.notes` from analyze; show empty Story textarea above custom fields; add prompt reveal; add "Save without story" CTA branch; route `aiDescription` into `data._aiDescription`. |
| `App.tsx` (item detail screen)             | Rename label "Archive Narrative" → "Story"; render empty-state block when `notes` is empty; render legacy migration banner once per item; move `aiDescription` display under "More details → technical metadata". |
| `i18n.ts`                                  | Add keys per §6; deprecate `archiveNarrative` and `provenancePlaceholder` (alias for one release).                              |
| `docs/PRODUCT_DESIGN.md`                   | No change — already aligned. Cross-reference this spec from §2.5.                                                              |
| `tests/`                                   | Add unit test: analyze response with `aiDescription` does not fill `formData.notes`. E2E: user can complete add-item without writing a story; legacy migration banner appears and dismisses correctly. |

---

## 8. Acceptance criteria

Mirrors CUR-13's acceptance + adds the migration cases.

- [ ] AI analysis no longer auto-fills the Story field for new items.
- [ ] User sees an inviting placeholder and can save with or without a story.
- [ ] `✨ Need a prompt?` reveals exactly 3 AI-suggested questions tailored to the item.
- [ ] Tapping a question inserts it as a starter line; the AI never produces the answer.
- [ ] Server endpoint `/api/gemini/story-prompts` returns within 3s p95 or the UI hides the affordance silently.
- [ ] Item detail shows the "Story" label (renamed from "Archive Narrative") in both EN and ZH.
- [ ] Empty Story renders an inviting empty state with `Write your story` and `Need a prompt?` actions.
- [ ] Legacy items (created before this change) whose `notes` is non-empty show the migration banner exactly once.
- [ ] `aiDescription` is stored in `data._aiDescription` and is only visible under technical metadata.
- [ ] `aiDescription` never appears in any public/share surface (verified in Phase 1 share components when built).
- [ ] Analytics events `add_item_saved_with_story` and `add_item_saved_without_story` fire with `story_length_bucket`.
- [ ] `npm run format:check`, `npm test`, `npm run build`, `npm run test:e2e` all pass.

---

## 9. Out of scope

These are intentionally **not** in CUR-13. Each warrants a separate ticket.

- **Story enrichment nudges on the homepage** (e.g. "3 items still need a story"). Belongs to the homepage redesign track in Phase 0 Sprint 3.
- **"Storyteller" badge / story-depth metric on profile.** Phase 1.
- **Story import from CSV / legacy.** Already covered by `BulkImportMapping.target = 'story'` contract in `PRODUCT_DESIGN.md` §3.2.
- **AI re-write / polish of a user's draft.** Explicitly out — violates Q4.
- **Voice-to-text story dictation.** Phase 1 candidate.

---

## 10. Open questions for owner

1. **Prompt budget / cost:** `fetchStoryPrompts` adds one Gemini call per add-item flow when the user opens the prompts panel. Acceptable, or should it be on-demand only (no auto-reveal after 10s idle)?
2. **Migration banner trigger:** show it on the first item-detail visit only, or also as a one-time global banner on the home screen listing all affected items? Recommend per-item only; defer batch tooling.
3. **Renaming `notes` → `story` in storage:** include in this PR (with sync-merge handling) or punt to a dedicated cleanup PR? Recommend punt — keeps this PR focused on UX, and lets us ship the moat-defining change faster.
