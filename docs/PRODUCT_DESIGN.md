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

### Design notes: Make capture “feel simple” on mobile

- **Default view is minimal**: photo + title + a few “primary” fields + rating + Save.
- **Progress never blocks**: any AI-assisted work is communicated as “filling in” rather than “step 3/4”.
- **Advanced inputs are secondary**:
  - **Notes** is hidden behind a lightweight “Add narrative” toggle.
  - Remaining metadata fields are hidden behind a “More details” / “Technical spec” toggle.
  - Batch mode is present but not primary (it’s discoverable as an optional link).
- **AI failures are boring**: show a short “AI unavailable—continue manually” message and keep the user on the same screen.

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
