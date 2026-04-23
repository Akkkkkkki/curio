# Curio - Product Design Document

> This document owns **UX requirements, interaction design, mobile guidelines, and design language**. For product thesis, principles, and strategic decisions, see `docs/PRODUCT_STRATEGY.md`. For execution phases and metrics, see `docs/ROADMAP.md`.

## 1. Vision & Purpose

Curio is a personal museum for meaningful objects. Unlike marketplace-driven apps or generic inventory tools, Curio is an **identity-driven archival product**. It is designed around personal narratives, strong aesthetics, and the emotional value of a curated collection.

## 1.1 MVP North Star: Value in the First 5 Minutes

**Goal:** A brand-new user should experience Curio’s “museum-grade” feel and successfully create **one high-quality item record** within 5 minutes, without confusion or dead-ends.

### The 5-Minute Aha Flow (MVP)

- **Minute 0–1: Immediate delight (no friction)**
  - User lands in a beautiful **Public Sample Gallery** (read-only) or can enter it with one click.
  - One-line positioning explains Curio: _a personal museum, not a marketplace or spreadsheet_.
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
- **Defer distractions:** Museum Guide, AI image enhancement, Vault Lock, and heavy social mechanics should not compete with the first-save experience.

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

- **Default view is minimal but expressive**: photo + title + a few “primary” fields + Story prompt + rating + Save.
- **Progress never blocks**: any AI-assisted work is communicated as “filling in” rather than “step 3/4”.
- **Advanced inputs are secondary**:
  - **Story** is visible by default and should be easy to fill in.
  - Extra notes or technical detail can sit behind a lightweight secondary toggle.
  - Remaining metadata fields are hidden behind a “More details” / “Technical spec” toggle.
  - Batch mode is present but not primary (it’s discoverable as an optional link).
- **AI failures are boring**: show a short “AI unavailable—continue manually” message and keep the user on the same screen.

### Mobile development guidelines (Curio-first, industry-aligned)

- **Mobile-first layout**: design for narrow viewports first, then scale up with responsive breakpoints. If a layout works at 360–430px width, it will scale cleanly. Avoid relying on hover to discover critical actions.
- **Thumb-friendly actions**: primary actions should be near the top or bottom and have comfortable spacing. Treat **44×44px** (iOS) / **48×48dp** (Android) as the minimum interactive target size for tap areas, including filter chips, modal close buttons, header icons, and rating stars.
- **Content density**: prioritize scannability (short headings, two-line clamp where needed). If content is hidden, provide an obvious path to reveal it without navigation churn.
- **Input ergonomics**: use appropriate input types (e.g., numeric keyboards for years, decimal for prices) and avoid wide multi-step forms on small screens—keep flows on one page when possible.
- **Safe-area + fixed UI**: respect safe-area insets for top/bottom fixed elements and ensure floating bars do not cover important content.
- **Performance perception**: keep first screen fast and provide immediate feedback for save/sync actions. Prefer **skeleton placeholders** over spinner-only loading states for content-heavy views (collection grid, item detail, image placeholders). Spinners are acceptable for short in-flight actions only.
- **Motion and timing**: keep all animations behind `motion-safe:` so `prefers-reduced-motion` is always respected. Use a small, consistent timing scale — roughly 100ms for micro-interactions, 150ms for button feedback, 220ms for modal/card entry, 350ms for page-level transitions. Anything longer than ~500ms needs explicit justification.
- **Bottom-sheet modals**: modals that slide from the bottom should support swipe-to-dismiss with a visible drag handle. Backdrop tap and Escape must also dismiss; sheets must respect safe-area insets.
- **Accessibility baseline**: maintain readable contrast and font sizes; avoid tiny labels on mobile. Ensure focus states are visible for keyboard and assistive tech. Every image and exhibition slide must have meaningful alt text.
- **Testing expectation**: validate changes at common mobile sizes (e.g., 360×740, 390×844) and at least one small Android device size. Include screenshots for perceptible UI changes. Verify at 60fps on a real mid-range Android device before claiming an animation is shipped.

### Collection browsing (production baseline)

- **Sorting**: Allow quick ordering by newest, oldest, title, or rating.
- **Bulk actions**: Support a simple selection mode with multi-delete for faster cleanup.
- **Conflict awareness**: If cloud updates overwrite local edits, provide a review prompt.
- **Offline clarity**: Persistent banner explains that edits are saved locally and will sync later.
- **Undo/redo**: Lightweight history for in-session item edits to reduce accidental changes.

## 2.0 Quick-add mode

Alongside the full capture wizard, Curio should offer a "quick add" mode for low-friction capture:

- **Flow:** photo → AI auto-categorizes → item appears in collection → user can enrich later
- **Purpose:** accommodates "capture now, curate later" behavior alongside "tell the full story" behavior
- **The full wizard remains** for users who want to write stories upfront
- Quick-add items should be visually distinguishable (e.g., subtle "enrich me" indicator) to encourage users to return and add their personal story

## 2.1 Active AI stance

Curio’s active AI work should stay **explicitly optional**, **recoverable**, and **cost-aware**.

Current active use:

- **Metadata extraction**: image to structured fields, titles, and prompts

Current non-goals:

- AI image enhancement
- poster generation
- multi-variant image editing workflows

If AI is unavailable or inaccurate, the user must still be able to complete the flow manually without losing progress.

## 2.2 Mobile-first capture simplification (consolidated requirements)

This section consolidates prior standalone design docs into a single durable source of truth.

### Goals

- **Make “Add item” effortless on mobile**: fast time-to-save; avoids “wizard” feel.
- **Recoverable AI**: AI can be slow/fail; saving never blocks; progress never lost.
- **Progressive disclosure**: show only what’s needed to save; reveal advanced fields when desired.

### Default capture surface (single-screen)

- **Primary action**: add photo (camera or upload)
- **Always available**: title, key template fields, Story prompt, rating (optional), Save
- **Secondary / optional**: extra notes, “More details”/technical spec, batch mode (discoverable, not primary)

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

## 2.3 Deferred AI image experiments

Image-to-image enhancement and poster generation are deferred.

Reasons:

- they are expensive relative to current product value
- they do not fix the core trust and story loop
- they risk distracting from capture, editing, and sharing

If reintroduced later, they should be treated as explicit, premium, opt-in creative tools rather than part of the core collecting flow.

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
- **Museum Guide readiness**: if disabled or non-functional, keep it fully hidden or clearly feature-flagged to avoid confusing users.

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

## 2. Active Priorities

See `docs/PRODUCT_STRATEGY.md` for product decisions and `docs/ROADMAP.md` for execution phases. The UX implications of those priorities are reflected throughout this document.

## 3. Design Language

- **Typography**: _DM Serif Display_ for elegance; _Inter_ for precision. Clean sans-serif, consistent English, sentence case throughout.
- **Visual Layout**: "Bento Grid" home screen for a modern museum feel; Masonry grids for item browsing.
- **Theming**: Global theme selection replaces collection-specific accents for a unified aesthetic experience. Light mode (gallery/museum aesthetic) is the default; dark mode is optional.
- **Sharing surfaces**: exported cards and public pages should feel intentional, collectible, and aesthetically credible without becoming gimmicky.
- **Density**: medium-low with generous whitespace — let objects breathe.
- **Photography direction**: objects in natural context (lifestyle photography aesthetic), not objects on dark backgrounds.
- **Color palette**: warm neutrals, earth tones, restrained accent color. Avoid neon, gaming-adjacent, or tech-forward aesthetics.
- **Metaphor consistency**: gallery/museum language throughout (exhibitions, curated collections, stories). Not gaming (levels, equipment), not tech (digital twin, archive entity).

### 3.1 Visual category picker

Collection selection during item creation should use image-backed category cards rather than a text dropdown. Each card shows the collection's cover image (or a representative item photo) as the card background. This reinforces the museum metaphor — you're choosing which gallery to place an item in.

### 3.2 Voice and tone

Curio's voice should feel like a thoughtful friend who appreciates beautiful things — not a tech platform, not a database, not an eco-warrior.

| Instead of           | Use                       |
| -------------------- | ------------------------- |
| "Archive Entity"     | "Add to your museum"      |
| "Target Destination" | "Choose a collection"     |
| "Auto Detect"        | "Let Curio identify this" |
| "Digital Twin"       | "Your story"              |

### 3.3 Empty state design

Empty states must feel inviting, not cold:

- **Pre-populated example museum:** Show the Public Sample Gallery (beautifully curated with rich personal stories and photos) so new users immediately understand the vision.
- **First-item prompt:** After signup, immediately prompt the user to add their first item with guided story questions. Don't drop them on an empty grid.
- **Progressive disclosure:** Focus the UI on adding and enriching items until the user has enough content (3+ items) for the full museum layout to feel meaningful.

## 4. Onboarding & Cloud Access

Curio is cloud-first for user-owned data: signing in is required to **create and save** your own collections/items. Users can still explore the **Public Sample Gallery** without signing in to get value immediately.

### MVP Requirement: Sample-first entry

To ensure fast time-to-value, Curio must support **pre-login access** to the **Public Sample Gallery** (read-only). A user should be prompted to sign in only when they attempt to create or save their own collection/items.

### Manual Local Import

Users with legacy local data can import it into their account from the profile menu.

### Public Sample Gallery

A curated public sample collection is visible to all users as inspiration. It is read-only for everyone except admins, keeping the showcase consistent while allowing staff to update it centrally.

## 5. Future Roadmap

See `docs/ROADMAP.md` for execution phases and `docs/PRODUCT_STRATEGY.md` for platform stance and deferred features.
