# Curio UI/UX Review — 2026-05-23

## 1. Review summary

- **Reviewer:** Claude (automated UX audit)
- **Date:** 2026-05-23
- **Live URL tested:** https://curio.qiuyue.dev (not directly reachable from this
  sandbox — see "Methodology caveat" below)
- **Browser tested:** N/A (codebase audit)
- **Devices / screen sizes tested:** N/A interactively; mobile/desktop classes
  inspected in source (`sm:`, `lg:`, dvh handling, safe-area insets)
- **Account used:** test@test.com (intended; not exercised due to no browser
  access in this environment)
- **Overall UX health rating:** **7.0 / 10** — the product has a strong design
  system, thoughtful first-run gating, story-first save flow, and good offline
  state handling. The biggest gaps are placeholder copy, a misplaced mobile
  Profile sheet, "Explore" leading to a dead end, and a few trust polish items
  before the next cycle.

### Methodology caveat

This cycle was performed against the source tree at HEAD
(`claude/trusting-edison-4BCk2`, last commit `d399264`) because outbound HTTP
to `curio.qiuyue.dev` is blocked from this environment ("Host not in
allowlist"). Findings come from reading the actual rendered components,
copy keys, and interaction handlers — not from a live click-through. Where
this matters (visual contrast on the deployed theme, real network latency,
real Gemini failures), I have called it out so a human reviewer can confirm
in a browser before filing. Every finding cites the code location it came
from so a follow-up can reproduce.

### Top 3 issues

1. **Mobile bottom-nav Profile button opens a dropdown at the top of the
   screen.** Tapping the Profile icon in the fixed bottom nav opens the
   account sheet anchored to the header's User icon (`src/components/Layout.tsx:316-322`,
   anchor at `:153-167`). On a mid/long page the dropdown opens off-viewport
   relative to the tap, which feels broken on first use.
2. **Two production text inputs ship with placeholder `"..."`.** The
   collection search input (`src/App.tsx:1264`) and the item-detail title
   input (`src/App.tsx:1842`) both use the literal `"..."` as placeholder
   copy. They are visible to every signed-in user on every collection /
   item page.
3. **"Explore" bottom-nav tab leads to a "coming soon" placeholder, not
   the sample gallery.** On a fresh device, the most natural way to "look
   around" is the Compass tab; it currently renders
   `ExplorePlaceholder` ("Community features are coming soon") with a
   secondary link to the sample. The primary first-run discovery surface
   is dead-ended.

### Top 3 recommended improvements

1. On mobile, make the bottom-nav Profile button open a bottom sheet (or
   reuse the existing modal pattern) anchored to where the user tapped —
   not the header dropdown. As a minimum, scroll/focus the dropdown into
   view when triggered from the bottom nav.
2. Replace `"..."` placeholders with actionable copy: "Search this
   collection" for the collection list filter and (since the title is
   required) "Title (required)" for the item detail. Treat the missing
   title as a soft empty state rather than a red border on an unedited
   field.
3. Route the bottom-nav "Explore" tab directly to the sample collection
   when one exists, and only show the "coming soon" surface for
   authenticated users who actively go to `/explore` looking for
   community features. Rename the tab to "Sample" or "Gallery" if it is
   not going to become real community Explore in the next cycle.

---

## 2. Core journey review

### Journey 1: First-time visitor lands on the app

**User goal:** Understand what Curio is and try it without signing up.

**Steps tested (per code):**

1. Visit `/` (HashRouter, `src/App.tsx:2562`).
2. App boots, initializes Supabase, loads sample collections
   (`fallbackSampleCollections`, `src/App.tsx:192-200`).
3. If unauthenticated **and** Supabase is configured, the app renders the
   **access gate** (`renderAccessGate`, `src/App.tsx:2328-2384`) with
   "Add your first item" (primary) and "Explore sample" (secondary).
4. Tapping "Explore sample" sets `allowPublicBrowse=true` and reloads
   collections; user lands on Home with the public sample visible.
5. Tapping "Add your first item" triggers `handleAddAction`, which sees
   the user isn't authenticated and opens AuthModal, queueing the action.

**What worked well:**

- The two-CTA access gate honors the "Delight before auth" constraint
  from `CLAUDE.md`: users can explore before signing up.
- AuthModal correctly captures the deferred intent and replays it after
  sign-in (`authActionQueue`, `src/App.tsx:2318-2326`). Nice touch.
- Hero copy uses serif/title typography, no purple/blue gradients, and
  the bento layout matches the design system in `DESIGN.md`.

**Issues found:**

- The "Add your first item" CTA opens the AuthModal, not an Add flow —
  reasonable, but the gate's headline ("Sign in to continue") and the
  primary CTA's verb don't match. New users may not realize "Add"
  routes through auth.
- When Supabase env is missing, the gate shows "Configure Supabase" as
  a static uppercase label with no action behind it (`src/App.tsx:2375-2378`).
  It looks like a tertiary button but is purely decorative.

**Recommended changes:**

- Either re-label the primary access-gate CTA to "Sign in to add your
  first item", or split it into "Sign in" / "Create account" plus a
  separate "Explore sample" — clearer contract with the user.
- Drop the dead "Configure Supabase" label, or wrap it in an external
  link to setup docs.

---

### Journey 2: Add a first item (the core promise)

**User goal:** Capture an object in under 5 minutes.

**Steps tested (per code, `src/components/AddItemModal.tsx`):**

1. Tap Add → AuthModal if needed → land on `AddItemModal` step
   `select-type` (skipped if only 1 collection, line 201).
2. Choose collection → step `upload`. The screen shows three upload
   affordances: a circular drop area (line 770), `Take Photo` (line
   795), and `Upload Photo` (line 798).
3. Pick a photo → `analyze()` (line 541). `compressImageForAi`
   downsizes; Gemini returns metadata; on success step → `verify`.
4. On `verify`, title (required) is pre-filled, **Story** is intentionally
   blank (`notes: ''`, line 594) — Story is user-authored per CUR-13.
5. Tap "Add to Collection" (or "Save without story" if empty) → save,
   close modal, toast.

**What worked well:**

- AI is recoverable: failures route the user to manual entry with a
  visible retry (`analysisError` block, lines 1048-1052) instead of
  blocking — matches the "Recoverable AI" constraint.
- Story-first save: the primary button label flips between
  "Add to Collection" / "Save without story" depending on whether the
  user wrote anything (lines 1254-1287). Smart, low-pressure.
- Focus trap + Escape close + focus restore are implemented for both
  AddItemModal and AuthModal — meaningful accessibility work.
- Camera vs Gallery vs Batch all clearly labeled; manual-entry escape
  hatch ("Skip and add manually") is one click away.

**Issues found:**

- **Three upload affordances on one screen** (circular tap-zone, Take
  Photo button, Upload Photo button) makes the primary action
  ambiguous; on desktop the circular zone is the same color as the
  page mat.
- **"Take Photo" on desktop browsers** routes through Capacitor's
  `Camera.getPhoto({ source: Camera })` (line 322). On a desktop
  browser without a camera, this throws and surfaces a generic error.
  No client-side capability detection.
- The `lowConfidence` banner (lines 1009-1017) gives good context, but
  the primary save button is still enabled with an empty title — the
  required check fires only on click, then focuses the title input
  (line 666). A missing-title hint upfront would shorten the loop.
- Batch verify renders all batch items in a long vertical scroll, with
  a "Load more" pagination after 8 (line 953). On a 20-photo batch
  this is fine; on a 50-photo batch it could be punishing. There is
  no per-item save — all-or-nothing on `handleBatchSave` (line 692).

**Recommended changes:**

- Collapse the upload area to one primary affordance plus a small
  secondary link ("or take a photo"). Hide "Take Photo" on platforms
  without `navigator.mediaDevices`.
- Show a "Title required" hint under the title input as soon as the
  AI returns an empty title, instead of waiting for the Save click.
- For batches >20, add a per-row "Save & continue" or a sticky
  progress header so partial saves are recoverable.

---

### Journey 3: Browse a collection and open an item

**User goal:** Find a saved object and edit it.

**Steps tested (per code, `CollectionScreen` in `src/App.tsx:982-1450`):**

1. Tap a collection card from Home → `/collection/:id`.
2. Use search input, sort dropdown, filter sheet to narrow items.
3. Tap an item → `/collection/:id/item/:itemId`, edit fields inline.

**What worked well:**

- Active filters render as removable chips with clear labels
  (lines 1283-1310) — nice information design.
- Read-only sample collections show both an inline lock banner
  (lines 1116-1133) and disable add-item / delete affordances
  consistently. Matches "Read-only clarity" constraint.
- Item Detail has undo/redo (20-step history, lines 1471-1622) — an
  unexpectedly thoughtful affordance for a small editor.
- Item Detail saves debounce to Supabase (1500ms) per CLAUDE.md;
  StatusToast confirms.

**Issues found:**

- Search input placeholder is `"..."` (line 1264). No call to
  `t('searchPlaceholder')` or similar — feels unfinished.
- The item-detail **title input** placeholder is `"..."` (line 1842).
  Because the empty title also triggers a red bottom border + error
  text (line 1846), an empty new item briefly looks like a validation
  failure rather than a prompt to type.
- The toolbar in CollectionScreen squeezes Delete, Select, View-mode
  toggle, Sort dropdown, Search, and Filter into one row on
  `lg`+. On a wide tablet/desktop it still wraps; on a narrow phone
  it stacks into two rows of small icons — touch targets are okay
  (44px) but the visual order doesn't put the most-used control
  (search/filter) first.
- "Featured Artifact" stats on the home hero (`stats`, `src/App.tsx:948-963`)
  fall back to **sample collection** counts when the user has no
  private collections. A first-time signed-in user could see "4
  Artifacts / 1 Archive" before they've saved anything — a small
  trust dent.

**Recommended changes:**

- Replace the search input placeholder with `t('searchPlaceholder')`
  (or a collection-specific variant: "Search Vinyl Vault…").
- Item Detail: change the placeholder to "Title (required)", remove
  the red border until the user has actually edited the field, and
  show the error only on attempted save or blur with empty value.
- Show "—" or "No items yet" on the home hero stats when the user
  has only the sample collection, instead of the sample's counts.

---

### Journey 4: Return after closing the tab / refreshing mid-edit

**User goal:** Pick up where I left off without losing work.

**What worked well:**

- IndexedDB cache + 1500ms debounced Supabase sync mean a refresh
  during edit will keep the local change (services/db.ts merge
  strategy, per CLAUDE.md).
- Conflict detection (`detectConflicts`, `src/App.tsx:577-581`) and a
  modal to resolve cloud-vs-local divergence are real.
- Sync status surfaces via `StatusBanner` and `StatusToast` —
  pending uploads, offline, sync error, conflicts all covered.

**Issues found:**

- The mid-edit form state of `AddItemModal` is **not persisted**: a
  refresh while the modal is open loses the in-flight title/Story.
  The CUR-44 fix on `b9619c8` only guards against parent re-renders
  wiping the form, not full-page reload.
- The "On This Day" card's three small buttons (`HomeScreen.tsx:248-265`)
  use `text-xs` (12px). On 360px screens they are still tappable
  but feel cramped next to the larger hero title above them.

**Recommended changes:**

- Persist in-flight `AddItemModal` state to sessionStorage on every
  meaningful change (title, story, rating) and restore on open;
  clear on save/close. This is a real safety net for the 5-minute
  capture goal.
- Bump "On This Day" buttons to `text-sm` and 12px vertical padding;
  the available space allows it.

---

## 3. Detailed issue list

### Issue 1: Mobile bottom-nav Profile button opens dropdown anchored to top header

- **Severity:** High
- **Priority:** P1
- **Category:** Mobile / UX
- **Location:** `src/components/Layout.tsx:316-322` (bottom button),
  anchor at `:153-167` (header User button with `profileRef`),
  dropdown render at `:168-256`
- **Suggested owner:** Engineering + Design
- **Effort estimate:** Medium

**Observation:**
The bottom mobile nav has four equal-weight tabs (Home, Explore, Add,
Profile). Tapping "Profile" calls `setIsProfileOpen(true)`. The
dropdown is rendered inside `<div ref={profileRef}>` in the **top
header**, so it appears at the top-right of the screen — not adjacent
to the bottom tap target.

**Why this matters:**
Mobile users expect the surface they triggered to appear where they
tapped. With the current behavior, the user taps a button at the
bottom of the screen, sees nothing visibly change in their thumb zone,
and may tap again. The dropdown might also be off-screen if they have
scrolled down a collection.

**Recommendation:**
Render a bottom sheet for the mobile profile menu (reuse
`overlaySurfaceClasses` + the safe-area handling already used in
AuthModal). If a full sheet is too much work, at minimum
`scrollIntoView({ block: 'start' })` the dropdown when it opens on
mobile widths.

**Evidence:**
Reproducible at <360px width. The dropdown's `absolute right-0 mt-2`
position (`Layout.tsx:170`) is relative to the desktop header User
button regardless of trigger origin.

---

### Issue 2: `placeholder="..."` on the collection search input

- **Severity:** Medium
- **Priority:** P1
- **Category:** Copy / Polish
- **Location:** `src/App.tsx:1264`
- **Suggested owner:** Content
- **Effort estimate:** Small

**Observation:**
The collection-view search input has a literal `"..."` placeholder
while the rest of the app uses i18n'd strings (e.g.
`t('searchPlaceholder')` on Home). It is visible on every collection
page.

**Recommendation:**
Add a new key (e.g. `searchCollectionPlaceholder: "Search this
collection"`) and use it. The collection name is available, so
`t('searchInCollection', { name: collection.name })` reads even
better.

---

### Issue 3: `placeholder="..."` on the item detail title

- **Severity:** Medium
- **Priority:** P1
- **Category:** Copy / UX
- **Location:** `src/App.tsx:1842`
- **Suggested owner:** Content + Design
- **Effort estimate:** Small

**Observation:**
The Item Detail title input uses `placeholder="..."` and shows a red
underline + "Title is required" the moment the screen renders if the
saved title is empty. The combination looks like an error on a
freshly-opened item rather than a prompt.

**Recommendation:**
Use `placeholder={t('titlePlaceholder')}` ("Untitled artifact" or
"Name this piece"). Only color the border red **after** the user
has touched the field and left it empty, or on save attempt.

---

### Issue 4: "Explore" bottom-nav tab dead-ends at "coming soon"

- **Severity:** High
- **Priority:** P1
- **Category:** UX / Navigation
- **Location:** `src/components/Layout.tsx:298-304` (tab) →
  `src/components/ExplorePlaceholder.tsx`
- **Suggested owner:** Product + Design
- **Effort estimate:** Small

**Observation:**
The Explore tab is one of four equal-weight bottom-nav items. It
routes to `/explore`, which shows `ExplorePlaceholder` with the
copy "Community features are coming soon." The actual sample
collection is reachable only via a secondary "Explore the sample
gallery" CTA at the bottom of the placeholder card.

**Why this matters:**
A new user's most natural action ("look around") leads to a
deferred-feature card. The product strategy explicitly defers
social/community per `docs/PRODUCT_STRATEGY.md`, so this tab is
overcommitting on what it can deliver.

**Recommendation:**
Two reasonable options:

- **A (preferred):** Route `/explore` directly to the sample
  collection when one exists; show the "coming soon" placeholder
  only when the user navigates to a future `/explore/community`
  route. Rename the tab to "Sample" or "Gallery".
- **B:** Keep the placeholder but make the sample link the primary
  CTA at the top of the card, not the secondary at the bottom.

---

### Issue 5: Home hero stats reflect sample data for new accounts

- **Severity:** Medium
- **Priority:** P2
- **Category:** Trust / UX
- **Location:** `src/App.tsx:948-976` (`stats` memo) and
  `src/components/HomeScreen.tsx:202-211`
- **Suggested owner:** Product
- **Effort estimate:** Small

**Observation:**
`stats` falls back to public sample collections when there are no
private collections, so a freshly-signed-in user can see counts like
"4 Artifacts / 1 Archive" on the hero before saving anything.

**Why this matters:**
First-run impressions: the user knows they haven't added anything
yet, so seeing pre-populated counts is mildly distrustful — looks
like the app is conflating "yours" with "ours".

**Recommendation:**
When `editableCollections.length === 0`, render "—" or hide the
stats block on the hero; the "Add your first item" CTA already
covers the empty-state job.

---

### Issue 6: Cloud-not-configured state shows an inert "Configure Supabase" label

- **Severity:** Low
- **Priority:** P2
- **Category:** Copy / Trust
- **Location:** `src/App.tsx:2375-2378`
- **Suggested owner:** Content / Engineering
- **Effort estimate:** Small

**Observation:**
When Supabase env vars are missing, the access gate shows
"Configure Supabase" in uppercase tracking. It is styled like a
tertiary action but has no click behavior.

**Recommendation:**
Either remove the label or wrap it in an external link to the setup
documentation (the README's "Environment Setup" section). Avoid
inert UI that looks interactive.

---

### Issue 7: Three competing upload affordances on the "Add Item → upload" screen

- **Severity:** Medium
- **Priority:** P2
- **Category:** UX / Visual hierarchy
- **Location:** `src/components/AddItemModal.tsx:765-835`
- **Suggested owner:** Design
- **Effort estimate:** Small

**Observation:**
The upload step renders (a) a circular drop area at the top, (b) a
secondary "Take Photo" button, (c) a primary "Upload Photo" button,
and (d) a "Batch mode" button below. The circular zone is also
clickable for the same gallery picker as button (c).

**Why this matters:**
"Single-path first run" is a stated constraint. Two visually
identical CTAs (`Upload Photo` button + circular Upload area) create
hesitation about which to use.

**Recommendation:**
Keep one large primary CTA + one secondary "Take photo" + a
de-emphasized batch link. Replace the circular drop area with a
preview tile that only appears after a photo is picked (the current
preview path is already there).

---

### Issue 8: "Take Photo" can throw on desktop browsers without a camera

- **Severity:** Medium
- **Priority:** P2
- **Category:** Error states / Mobile
- **Location:** `src/components/AddItemModal.tsx:317-338`
- **Suggested owner:** Engineering
- **Effort estimate:** Small

**Observation:**
`Camera.getPhoto({ source: Camera })` (Capacitor) fails on desktop
browsers without a camera; the catch block surfaces a generic
"Could not access camera" message even when the real cause is "no
camera available".

**Recommendation:**
Feature-detect `navigator.mediaDevices?.getUserMedia` and hide the
"Take Photo" button when unavailable, or render it disabled with a
tooltip ("Available on devices with a camera"). Keep the existing
permission-denied copy for the case where there is a camera but
access is denied.

---

### Issue 9: `LayoutProps.user` is typed as the lucide `User` icon, not the Supabase `User`

- **Severity:** Low (runtime is fine; static-typing debt)
- **Priority:** P3
- **Category:** Technical UX / Code health
- **Location:** `src/components/Layout.tsx:28` — `user: User | null` where
  the only `User` in scope is the lucide-react icon import on line 2-13
- **Suggested owner:** Engineering
- **Effort estimate:** Small

**Observation:**
`Layout.tsx` imports `User` from `lucide-react` (an icon) and then uses
`User` as a type for the `user` prop. The actual runtime value is a
Supabase `User`, and the file calls `user?.email` (line 76). Vite's
default build doesn't run `tsc`, so the mismatch never surfaces, but
it disables IDE help and lets a future refactor break silently.

**Recommendation:**
Add `import type { User } from '@supabase/supabase-js';` and
rename one of the two `User` references (e.g.
`import { User as UserIcon } from 'lucide-react'`). Run `tsc
--noEmit` in CI to catch similar drift.

---

### Issue 10: No privacy/terms links surfaced in the AuthModal

- **Severity:** Medium
- **Priority:** P2
- **Category:** Trust
- **Location:** `src/components/AuthModal.tsx` (entire file) +
  `public/privacy-policy.html`, `public/terms-of-service.html` exist
  but are unreferenced from React.
- **Suggested owner:** Content + Design
- **Effort estimate:** Small

**Observation:**
The auth modal asks for email + password and stores items in the
cloud. The repo ships privacy + terms HTML pages, but the modal
doesn't link to them. For a product that positions itself as a
trusted museum/vault, this is a missed trust cue.

**Recommendation:**
Add a small "By creating an account you agree to our
[Terms](/terms-of-service.html) and [Privacy Policy](/privacy-policy.html)"
line under the sign-up form (only on sign-up mode), styled with the
existing `mutedText` class.

---

### Issue 11: AddItemModal in-flight form is lost on full page refresh

- **Severity:** Medium
- **Priority:** P2
- **Category:** UX / Resilience
- **Location:** `src/components/AddItemModal.tsx` form state
  (`formData`, `imagePreview`, `batchItems`) lives only in React state
- **Suggested owner:** Engineering
- **Effort estimate:** Medium

**Observation:**
CUR-44 fixed the "parent re-render wipes the form" case. A full
refresh (or accidental tab close) still loses the in-flight title,
story, and rating. For a flow that promises "in under 5 minutes",
the cost of losing 3-4 minutes of typing is high.

**Recommendation:**
Persist `formData` (without the base64 image — too large) to
`sessionStorage` keyed by `selectedCollectionId` on each change.
On modal open, prompt "Resume previous draft?" if a draft exists.
Clear on save or explicit dismiss.

---

### Issue 12: Item Detail title placeholder + always-on validation creates a false-error look

- **Severity:** Medium
- **Priority:** P1 (cosmetically loud; appears immediately on the
  detail screen of any blank-titled item)
- **Category:** UX / Copy
- **Location:** `src/App.tsx:1833-1846`
- **Suggested owner:** Design + Engineering
- **Effort estimate:** Small

**Observation:**
The title input has `placeholder="..."`, a red bottom border, and the
"Title is required" message rendered the moment the screen opens if
`titleIsEmpty`. Together they look like a save failure on a fresh,
untouched item.

**Recommendation:**
Suppress the red border + helper text until the field has been
blurred empty or until the user attempts to leave the detail screen
without typing a title. Use a friendlier placeholder
("Untitled artifact"). The current logic blends a placeholder, an
error state, and a default state into one visual.

---

## 4. Mobile review

- **Screen sizes inspected (per Tailwind breakpoints in source):**
  base (<640px / mobile), `sm:` (≥640), `md:` (≥768), `lg:` (≥1024)
- **What worked well:**
  - Safe-area insets respected: header pads `env(safe-area-inset-top)`
    (`Layout.tsx:136`), AuthModal pads top + bottom (`AuthModal.tsx:118`)
  - 100dvh used throughout instead of 100vh — handles mobile address-bar
    chrome
  - Touch targets are mostly ≥44×44 (e.g. CollectionScreen view-mode
    toggles use `w-11 h-11 sm:w-9 sm:h-9`)
  - Bottom nav is fixed and keeps the Add CTA always reachable
  - Sheet-style modals on mobile (AddItemModal, AuthModal) with
    rounded-top corners feel native
- **What broke or felt awkward:**
  - Profile sheet appears at top header on mobile (Issue 1) when
    triggered from the bottom nav
  - The collection toolbar wraps to two rows on small screens with
    five+ controls; the search field can end up below the fold
  - Item Detail header buttons (back + enhance + export) crowd the
    photo on a 360px screen; the photo's `bg-stone-950` placeholder
    while the image loads is visually heavy
- **Issues with tap targets:** generally fine; the "Take Photo" /
  "Upload Photo" / circular drop area triplet competes for the
  same thumb zone
- **Issues with readability:** "On This Day" sub-buttons at
  `text-xs` are smaller than the rest of the home screen
- **Issues with navigation:** the bottom-nav Profile tap target
  doesn't show a visible state change on tap because the dropdown
  is far away
- **Recommended fixes:** see Issues 1, 3, 7, 12

---

## 5. Accessibility review

- **Focus states:** `:focus:ring-4 focus:ring-amber-500/5` is used
  on inputs, but the ring opacity is very low (5%). On the amber
  accent it nearly disappears — keyboard users may lose focus.
- **Skip link:** present (`index.html:53`, `Layout.tsx:272-281` with
  `id="main-content"`).
- **Modals:** AuthModal and AddItemModal implement focus trap, Escape
  to close, focus restore.
- **Color contrast:** Vault theme `text-stone-400` / `text-stone-500`
  on `bg-stone-900` borders the WCAG AA threshold for small text —
  worth measuring with a real contrast checker on the deployed app.
  Atelier theme accent `#A86F3C` on cream `#F5EFE4` measures ≈4.4:1
  for normal text (passes AA).
- **Form labels:** All form fields use `<label>` with monospace
  uppercase styling. Labels are visually small (10-11px) but tied
  to inputs.
- **Button/link names:** `aria-label` is used consistently on
  icon-only buttons.
- **Error messages:** Inline + accessible via `aria-describedby` on
  AddItemModal (`dialogDescribedBy`, `AddItemModal.tsx:115-121`).
- **Touch targets:** Mostly ≥44px; star rating buttons in batch view
  are 36px (`w-9 h-9`, line 936) — a hair under recommended.
- **Browser zoom:** Most layout uses relative units; the bento
  hero's `min-h-[280px]` could overflow at 200% zoom.
- **Recommended fixes:**
  1. Increase focus ring opacity to ≥30% on amber for inputs:
     `focus:ring-amber-500/30`.
  2. Bump batch rating buttons to `w-11 h-11`.
  3. Run an actual contrast check on the live Vault theme.
  4. Add `aria-current="page"` to the active bottom-nav item
     (currently relies on color only).

---

## 6. Copy and content review

- **Confusing wording:**
  - "Vocal Guide" (the feature-flagged voice companion) is jargon —
    "Audio tour" would read closer to what users expect.
  - "Registry Quality Score" next to the star rating
    (`ItemDetailScreen`, line 1869) is institutional but ambiguous —
    is it AI's quality or the user's rating? Cleaner: "Your rating".
  - "Restoring the archives…" as a loading message
    (`HomeScreen:77`) is romantic but unclear during a first load
    when there is nothing to restore. Consider context-aware copy
    ("Loading your archive…" / "Setting up your gallery…").
- **Vague button labels:** "Configure Supabase" (inert, see Issue 6),
  "Enter Exhibition" is fine but two-word verbs are hard to fit on
  small screens.
- **Missing guidance:** No copy explains what "Story" is vs the
  inline editable metadata fields. The empty-state hint
  ("Tell the story behind this one.") is good but only shows on
  Item Detail, not on the AddItemModal.
- **Weak empty states:**
  - The Collection screen empty state (`galleryAwaits` + `museumDefinition`)
    is poetic but doesn't say what to do — the "Catalog First Item"
    CTA is below it, but the copy doesn't connect.
- **Error messages that need improvement:**
  - `t('analysisFallback')` ("Analysis failed. Continue with manual
    entry.") is acceptable; could say _why_ ("We couldn't read this
    photo. Try a clearer angle or fill in details manually.")
  - `t('statusSyncPaused')` ("Sync paused") is opaque — pair it with
    a "Why?" affordance or auto-explain the cause (offline / quota /
    auth expired).
- **Suggested replacement copy:**
  - `searchCollectionPlaceholder`: "Search this collection"
  - `titlePlaceholder`: "Untitled artifact"
  - `restoringArchives`: "Loading your gallery…" (or, on first
    load: "Setting up your archive…")
  - `analysisFallback`: "We couldn't read this photo. Try a clearer
    one, or fill in the details by hand."

---

## 7. Design consistency review

- **Typography:** Three-font stack (DM Serif Display / Inter /
  JetBrains Mono) used consistently. Label scale (10-12px mono
  uppercase) appears everywhere it should.
- **Spacing:** Consistent 4px base unit, with comfortable density
  per `DESIGN.md`. The home page's `space-y-10 sm:space-y-12` is
  in the right register for a museum aesthetic.
- **Alignment:** Bento grid + masonry/grid toggle are well executed.
- **Colours:** Warm-only palette respected — no blue accents found.
- **Components:**
  - Button styles are centralized in `src/components/ui/Button.tsx`
    (variants: primary / secondary / outline / ghost) — good
    discipline.
  - Star rating is implemented twice (once in AddItemModal
    batch view as 36px buttons, once in Verify as 48px, plus a
    bigger version on Item Detail). Consider extracting a
    `<RatingPicker size>` component to keep variants in sync.
- **Icons:** Lucide everywhere, sizes consistent (16/18/20/24).
- **Visual hierarchy:** The hero correctly leads with title; the
  "On This Day" card is well differentiated. The CollectionScreen
  hero (collection name + count) competes a bit with the toolbar.
- **Repeated UI patterns:** Read-only banner appears at both
  CollectionScreen and ItemDetail — same visual language, good.
- **Recommended fixes:**
  - Extract `<RatingPicker>` to a single component.
  - Tighten the CollectionScreen toolbar to a 2-column layout on
    `sm:` (primary actions left, filters right) instead of a single
    wrapping flex row.

---

## 8. Performance and feedback states

- **Slow-loading areas:** Image processing for new items runs
  synchronously in the main thread (`processImage`, see
  `App.tsx:712-720`). On low-end Android, a 4MP photo can block
  the UI for ~1s. The user only sees the modal close, not a
  spinner during image processing.
- **Missing loading states:**
  - When the user taps "Add to Collection", the button shows a
    spinner — good.
  - When the page first loads, `HomeScreen` shows two skeleton
    cards — good.
  - When tapping a collection card, the next screen renders without
    any transition skeleton — acceptable because data is local.
- **Missing success states:** `StatusToast` for "Saved" is fine.
  No persistent confirmation that the item synced to cloud (the
  toast disappears after ~2.4s; the chip in the header is only
  "Signed In", not "Synced").
- **Missing error states:** Photo enhancement uses a separate
  modal; image-edit failures from `applyEditedPhoto`
  (`App.tsx:1652-1676`) surface via `showStatus` — works.
- **Sudden layout shifts:** The hero's `min-h-[280px]` and image
  preload prevent most jank; the "On This Day" card uses
  `aspect-square` for its thumbnail — good.
- **Blank screens:** When Supabase fetch fails, `loadError` renders
  a clear "Sync paused" panel with retry — good.
- **Repeated-click / dup-submission risks:** `handleSave` and
  `handleBatchSave` both check `isSaving` early. Good.
- **Recommended fixes:**
  1. Move `processImage` into a Web Worker so the camera
     compress + downsize doesn't block the modal close.
  2. Add a small "Synced" pill near the header User icon when
     `syncStatus === 'synced'` so users have an at-a-glance trust
     signal beyond the transient toast.

---

## 9. Prioritised action plan

| Priority | Issue                                               | User impact                                    | Recommended fix                                     | Owner         | Effort |
| -------- | --------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------- | ------------- | ------ |
| P1       | #1 Mobile Profile dropdown anchored to top header   | Confusing on every mobile session              | Render bottom sheet anchored to bottom nav          | Eng + Design  | Medium |
| P1       | #2 Search placeholder is "..."                      | Looks unfinished on every collection           | Use `t('searchPlaceholder')` or collection-specific | Content       | Small  |
| P1       | #3 Item-detail title placeholder + always-on error  | Looks like a validation failure on fresh items | Better placeholder + lazy error                     | Design + Eng  | Small  |
| P1       | #4 Explore tab dead-ends at "coming soon"           | First-run discovery friction                   | Route to sample directly, rename tab                | Product       | Small  |
| P1       | #12 Title input red-border on detail screen         | Same as #3 (split for tracking)                | See #3 fix                                          | Design + Eng  | Small  |
| P2       | #5 Hero stats show sample counts for empty accounts | Mild trust dent on day one                     | Show "—" until private collections exist            | Product       | Small  |
| P2       | #7 Three competing upload affordances               | Slows first capture                            | Collapse to one primary + one secondary             | Design        | Small  |
| P2       | #8 "Take Photo" throws on desktop without camera    | Generic error confuses desktop users           | Feature-detect; hide or disable                     | Eng           | Small  |
| P2       | #10 No privacy/terms links in AuthModal             | Trust gap on signup                            | Add inline links to existing pages                  | Content       | Small  |
| P2       | #11 AddItemModal loses form on refresh              | Lost work in the 5-min flow                    | Persist to sessionStorage                           | Eng           | Medium |
| P3       | #6 Inert "Configure Supabase" label                 | Looks interactive but isn't                    | Remove or link to setup docs                        | Content / Eng | Small  |
| P3       | #9 Layout `user` prop typed as lucide icon          | Hidden refactor risk                           | Import Supabase `User` type, alias the icon         | Eng           | Small  |
| P3       | Performance: image processing on main thread        | Jank on low-end Android                        | Move to Web Worker                                  | Eng           | Medium |

---

## 10. Product interpretation

- **What does Curio seem to help users do?**
  Build a small, beautiful personal archive of physical objects
  (records, scents, sneakers, etc.) with low effort: AI extracts
  metadata from a photo, the user adds a short story, items live
  in themed collections that can be browsed in exhibition mode and
  exported as cards.

- **What type of user does the current product seem designed for?**
  A taste-driven hobbyist collector who wants something more
  beautiful than CatalogIt or a spreadsheet and who cares about
  the story and presentation of their objects. Power-features
  (museum guide / voice / image enhancement) are deferred or
  flagged off, which matches a "story-first, not utility-first"
  positioning.

- **Where does the current experience feel strongest?**
  - The visual system: typography, spacing, the bento hero, and
    the three-theme palette feel coherent and distinctive.
  - The save flow's recoverability — AI failures never block the
    user — directly serves the stated MVP constraints.
  - Sync state communication (StatusBanner + StatusToast + offline
    detection) is more developed than most early-stage apps.

- **Where does the product feel under-explained?**
  - What "Story" is vs metadata fields vs the hidden AI
    observation. The hierarchy is intentional but unexplained.
  - Why some collections are read-only and what "duplicating" a
    sample would actually do.
  - What the "Vocal Guide" button promises (currently hidden
    behind a flag, but the i18n keys remain visible to anyone
    grepping translations).

- **Biggest mismatch between intent and experience:**
  The product wants to be "delight before auth", but the Explore
  bottom-nav tab — the most obvious "look around" surface — sends
  unauthenticated users to a "coming soon" placeholder rather than
  to the sample gallery the product proudly ships. That breaks the
  first impression for the user the product is most trying to win.

- **One change that would make Curio more useful:**
  Persist the in-flight AddItemModal state (Issue 11). The
  five-minute capture promise is the product, and the current
  flow loses everything to an accidental refresh.

- **One change that would make Curio feel more polished and
  trustworthy:**
  Replace the two `"..."` placeholders and the inert "Configure
  Supabase" label, then add a quiet "Synced" affordance near the
  header User icon. Three small fixes that together remove the
  "this is still being built" feeling from the most-visited
  surfaces.
