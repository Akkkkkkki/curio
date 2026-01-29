# Curio - Product Design Document

## 1. Vision & Purpose

Curio is a digital sanctuary for physical collectors. Unlike marketplace-driven apps, Curio is an **intimate archival tool**. It is designed for the "joy of ownership"—focusing on personal narratives, high-end aesthetics, and the emotional value of a curated collection.

## 1.1 MVP North Star: Value in the First 5 Minutes

**Goal:** A brand-new user should experience Curio’s “museum-grade” feel and successfully create **one high-quality item record** within 5 minutes, without confusion or dead-ends.

### The 5-Minute Aha Flow (MVP)

- **Minute 0–1: Immediate delight (no friction)**
  - User lands in a beautiful **Public Sample Gallery** (read-only) or can enter it with one click.
  - One-line positioning explains Curio: _a personal archival sanctuary, not a marketplace_.
- **Minute 1–3: One clear action**
  - One primary CTA: **Add your first item** (secondary: **Explore sample**).
  - Capture is guided by a single, mobile-first screen (Upload photo → Details) where AI can auto-fill in the background (never blocking Save).
- **Minute 3–5: Trust + completion**
  - AI produces a usable draft (title + key fields). User confirms and saves.
  - Clear feedback: **Saved** and **Synced / Will sync**. User sees the item in the collection grid.

### MVP Onboarding Principles

- **Delight before auth:** Users should be able to see the sample gallery before creating an account. Auth can be requested when they attempt to save their own content.
- **Single-path first-run:** Avoid presenting many choices up front. Default path: Explore sample → Add item → Review → Save.
- **AI must be recoverable:** AI latency/failure must never block the flow. Provide a clear fallback to manual entry and keep the user’s progress.
- **Templates must be self-explanatory:** Template selection should show a short description + field preview so users can pick confidently in seconds.
- **Read-only must be obvious:** Public/sample content must always show a persistent read-only indicator and disabled edit affordances.
- **Defer advanced features:** Museum Guide, Exhibition, deep filtering, etc. should be discoverable _after_ the first successful save.

## 1.3 MVP Behaviors (as implemented)

This section captures **current behavior in the codebase** (so docs stay actionable, not aspirational).

### Home (museum “bento”)

- **Search**
  - Searches across **collection names** and **item titles**.
  - If a collection name doesn’t match but an item title does, the collection card shows an **“Item match”** badge.
  - When search yields no matches, Home shows a themed **empty state** (“No matches found”).
- **Archive Archeology (“On This Day”)**
  - The card only appears when a matching item exists.
  - Matching is **cascading** (highest priority first):
    - Same month/day in a **prior year**
    - Fallback: same day in the **prior month** (days 1–28 only)
    - Fallback: same day in the **prior week**

### Item creation (guided + recoverable)

- **Single-screen capture**: Pick photo → Edit details (collection is a compact dropdown when multiple exist).
- **Non-blocking AI**: AI auto-fill happens in the background and never blocks manual entry or saving.
- **Recoverable AI**: Users can disable/skip AI and proceed with manual entry if AI is unavailable or fails.
- **Title guidance**: Users are nudged to keep titles **concise for cards** and put extra detail in metadata fields (localized EN/ZH).
- **Lightweight photo edits**: Rotate or crop to square before saving without leaving the flow.

### Design notes: Make capture “feel simple” on mobile

- **Default view is minimal**: photo + title + a few “primary” fields + rating + Save.
- **Progress never blocks**: any AI-assisted work is communicated as “filling in” rather than “step 3/4”.
- **Advanced inputs are secondary**:
  - **Notes** is hidden behind a lightweight “Add narrative” toggle.
  - Remaining metadata fields are hidden behind a “More details” / “Technical spec” toggle.
  - Batch mode is present but not primary (it’s discoverable as an optional link).
- **AI failures are boring**: show a short “AI unavailable—continue manually” message and keep the user on the same screen.

### Mobile development guidelines (Curio-first, industry-aligned)

- **Mobile-first layout**: design for narrow viewports first, then scale up with responsive breakpoints. If a layout works at 360–430px width, it will scale cleanly. Avoid relying on hover to discover critical actions.
- **Thumb-friendly actions**: primary actions should be near the top or bottom and have comfortable spacing. Treat **44×44px** as the minimum interactive target size for tap areas.
- **Content density**: prioritize scannability (short headings, two-line clamp where needed). If content is hidden, provide an obvious path to reveal it without navigation churn.
- **Input ergonomics**: use appropriate input types (e.g., numeric keyboards for years, decimal for prices) and avoid wide multi-step forms on small screens—keep flows on one page when possible.
- **Safe-area + fixed UI**: respect safe-area insets for top/bottom fixed elements and ensure floating bars do not cover important content.
- **Performance perception**: keep first screen fast and provide immediate feedback for save/sync actions. If an operation is async, show status and keep the UI usable.
- **Accessibility baseline**: maintain readable contrast and font sizes; avoid tiny labels on mobile. Ensure focus states are visible for keyboard and assistive tech.
- **Testing expectation**: validate changes at common mobile sizes (e.g., 360×740, 390×844) and at least one small Android device size. Include screenshots for perceptible UI changes.

### Collection browsing (production baseline)

- **Sorting**: Allow quick ordering by newest, oldest, title, or rating.
- **Bulk actions**: Support a simple selection mode with multi-delete for faster cleanup.
- **Conflict awareness**: If cloud updates overwrite local edits, provide a review prompt.
- **Offline clarity**: Persistent banner explains that edits are saved locally and will sync later.
- **Undo/redo**: Lightweight history for in-session item edits to reduce accidental changes.

## 2.1 AI image features (design + cost guardrails)

Curio’s AI image work should be **explicitly optional**, **recoverable**, and **cost-aware**:

- **Two capabilities (separately toggleable)**:
  - **Metadata extraction**: “fill in fields from an uploaded photo” (fast, low-risk).
  - **Image-to-image enhancement**: “make this photo look cleaner / more presentable” or “generate a poster/ad version” (newer, higher-cost, higher-risk).
- **Cost guardrail**: never generate multiple variations by default. Defaults:
  - One-tap “Enhance” generates **one** result.
  - “Try again” / “More like this” is an explicit user action (each action == one more generation).
- **Transparency**:
  - Always keep **Original** available.
  - If enhancement fails, the user still has their item saved with original/display images.

### Gemini image editing reference

When using Google’s Gemini image-to-image models (Nano Banana), we should follow and link to the official API guidance: [Gemini image editing](https://ai.google.dev/gemini-api/docs/image-generation#gemini-image-editing).

## 2.2 Mobile-first capture simplification (consolidated requirements)

This section consolidates prior standalone design docs into a single durable source of truth.

### Goals

- **Make “Add item” effortless on mobile**: fast time-to-save; avoids “wizard” feel.
- **Recoverable AI**: AI can be slow/fail; saving never blocks; progress never lost.
- **Progressive disclosure**: show only what’s needed to save; reveal advanced fields when desired.

### Default capture surface (single-screen)

- **Primary action**: add photo (camera or upload)
- **Always available**: title, key template fields, rating (optional), Save
- **Secondary / optional**: notes, “More details”/technical spec, batch mode (discoverable, not primary)

### Non-blocking AI autofill behavior

- Starts automatically after photo selection (when enabled)
- Fills the form **in place** (no additional step required)
- Must **not overwrite** fields the user already edited
- On failure: show a small “AI unavailable — continue manually” message and keep the user on the same screen

### Mobile UX requirements (must-have)

- **Sticky primary action**: Save is always reachable without scrolling to the bottom
- **Sectioned form**: basic info + key fields + additional details + notes
- **Keyboard ergonomics**: sensible Next/Done, correct input types, no jumpy layout when AI updates
- **Clear AI state**: subtle “filling in…” indicator; no blocking spinners as the only signal

## 2.3 AI image-to-image editing (Enhance + Poster) — trust + cost

Curio treats these as separate capabilities from metadata extraction:

- **Metadata extraction**: image → structured fields (core, low-risk)
- **Image-to-image**: image → enhanced image (higher-cost/risk; always explicit)

### Phased rollout

- **Phase 1: Enhance image (clean / presentable)**  
  Outcome-first CTA: “Enhance image”. Generates **one** result, with before/after comparison, Accept/Keep original, and explicit “Try again”.
- **Phase 2: Poster / ad (creative)**  
  CTA: “Create poster”. Generates **one** result, optional style presets, explicit “Try again”. Typography imperfections are an expected V1 risk.

### Two user-facing intents (make it explicit)

- **Catalog / Documentation (default)**: accurate + clean, conservative changes
- **Showcase / Aesthetic (opt-in)**: studio + pretty, more opinionated polish

### Quality rubric (acceptance + QA)

Score output \(0–2\) per dimension (total /12):

1. **Subject prominence**
2. **Legibility (if text exists)**
3. **Exposure & dynamic range**
4. **Color & white balance**
5. **Geometry correctness**
6. **Background cleanliness**

Definition of “enhancement success” (Catalog mode):

- Total score increases by **≥ 3 points**, and
- **Geometry never worsens**, and
- **Color does not materially drift** (human-obvious drift is a failure).

### Trust boundaries (what enhancement may change)

- **Generally safe**: straighten/crop, exposure/contrast, white balance, moderate denoise (text-safe), mild background declutter, bounded perspective correction
- **Risky (opt-in or warn)**: aggressive relighting that changes material feel, heavy “beautify”, reconstruction of obscured text
- **Forbidden by default**: changing/recreating logos/labels/serial numbers, altering colorways/edition markers, reshaping the object, adding new props/elements

### Export / sharing note

Some providers may embed provenance watermarks (e.g., SynthID). If a generated asset is exported/shared, the UI should be explicit that it’s generated and may include a watermark.

### Cost guardrails (must-have)

- **No multi-variant by default**: one generation per explicit user action
- **Cheap-by-default**: default model/quality is routine-friendly; “High quality” is an explicit choice where needed
- **Budget + rate limiting policy**: prevent accidental loops; enforce per-user limits (tracked in GitHub)

### Open questions (track in GitHub)

- Where does “Enhance image” live: during capture vs on item detail?
- Should enhancement be allowed for public/sample collections (or only via “copy to my collection”)?
- Do we need a paid tier or hard limits for image-to-image usage?
- Export UX expectations given potential provenance watermarks.

## 6. UX review findings (2026-01-13) — consolidated summary

This is a short synthesis of the 2026-01-13 external UX review. Action items should be tracked in GitHub Issues (not duplicated in docs).

### Critical reliability issues to protect the MVP

- **Data persistence across language toggles**: switching EN/ZH must not load separate datasets or appear to “erase” items.
- **Add-item save reliability**: successful completion must reliably produce a visible item + consistent counts.

### UX friction points (high-signal)

- **Hidden scrolling in add-item**: avoid narrow internal scrollbars and “missing fields” failure modes.
- **No feedback after key actions**: show clear confirmation after add/save and reliable error states when something fails.
- **Unclear icon meaning**: tooltips/labels for non-obvious actions (some are tracked: [#68](https://github.com/Akkkkkkki/curio/issues/68), [#95](https://github.com/Akkkkkkki/curio/issues/95)).
- **Metadata editing**: users need an edit path on item detail without delete-and-readd.
- **Vocal Guide readiness**: if disabled/non-functional, hide or mark “coming soon” to avoid confusion.

### Card readability

- Long titles are discoverable via **hover/focus tooltips** on collection and item cards (so we keep cards scannable while preserving full text).

### Save / sync feedback

- Saving an item/collection shows explicit feedback:
  - **Saved** immediately after local update
  - **Synced** when cloud sync completes
  - **Will sync / retrying** when offline or when sync errors occur (with a **Retry** action when applicable)

## 1.2 MVP Checklist (tracking)

We avoid keeping long-lived “implementation checklists” in `docs/` because they go stale quickly.

- **Product constraints** (must not regress): see `README.md` and `CLAUDE.md`.
- **Work tracking**: use GitHub Issues/Projects as the source of truth.

If you need a checklist for a short-lived push, keep it inside the relevant GitHub issue/PR description instead of a new doc.

## 2. MVP Goals & Enhancements

1. **Velocity of Capture**:
   - **Rapid-Fire Mode**: Batch upload for serious archivists.
   - **AI Auto-naming**: Gemini suggests high-quality archival names based on visual cues.
2. **Emotional Utility**:
   - **Archive Archeology**: "On This Day" feature to surface past memories.
   - **Museum Guide**: A proactive vocal companion that acts as a sophisticated curator.
3. **Global Aesthetic Curation**:
   - **Dynamic Global Themes**: Users select from _The Gallery_ (Light/Airy), _The Vault_ (Moody/Dark), or _The Atelier_ (Artisanal/Warm).
4. **Security for High-Value Collections**:
   - **Vault Lock**: Optional biometric-style lock for specific collections. (Tracked in [#87](https://github.com/Akkkkkkki/curio/issues/87))

## 3. Design Language

- **Typography**: _DM Serif Display_ for elegance; _Inter_ for precision.
- **Visual Layout**: "Bento Grid" home screen for a modern museum feel; Masonry grids for item browsing.
- **Theming**: Global theme selection replaces collection-specific accents for a unified aesthetic experience.

## 4. Onboarding & Cloud Access

Curio is cloud-first for user-owned data: signing in is required to **create and save** your own collections/items. Users can still explore the **Public Sample Gallery** without signing in to get value immediately.

### MVP Requirement: Sample-first entry

To ensure fast time-to-value, Curio must support **pre-login access** to the **Public Sample Gallery** (read-only). A user should be prompted to sign in only when they attempt to create or save their own collection/items.

### Manual Local Import

Users with legacy local data can import it into their account from the profile menu.

### Public Sample Gallery

A curated public sample collection is visible to all users as inspiration. It is read-only for everyone except admins, keeping the showcase consistent while allowing staff to update it centrally.

## 5. Future Roadmap

- **Social Curation**: Generate cinematic video "portraits" of items for sharing.
- **NFC/QR Tagging**: Print tiny archival stickers that link directly to the Curio record.
