# Curio MVP Prioritized Checklist (Product and Technical)

Purpose: Turn the MVP UX and aesthetic goals into an ordered, buildable plan with concrete technical touchpoints.

## MVP North Star: Value in the First 5 Minutes (Acceptance Criteria)
- [ ] New user can **see value without signing in**:
  - Can enter **Public Sample Gallery** pre-login
  - Sample content is clearly marked **Read-only**
- [ ] New user can complete a **first successful capture** in under 5 minutes:
  - One primary CTA: **Add your first item** (secondary: **Explore sample**)
  - Capture flow has visible stages (Upload → Analyzing → Review → Save) with progress copy
  - If AI fails/slow, user can **finish manually** without losing progress
- [ ] New user receives unambiguous outcomes:
  - On save: **Saved** feedback
  - On network/sync: **Synced / Will sync** feedback

## P0 - Must Ship for MVP UX
- [ ] Enable pre-login sample gallery access so users can explore before auth; Tech design: relax access gate in `App.tsx` to allow viewing public `collections` when `is_public = true`, add an "Explore Sample" CTA in the access gate and header, and ensure unauth Supabase reads are supported by anon key and RLS (public read already allowed).
- [ ] Make the first action unmissable (single-path first run); Tech design: on empty state and/or access gate, present one primary CTA ("Add your first item") and one secondary CTA ("Explore Sample") with short promise copy.
- [ ] Make capture flow self-explanatory with visible stages and recoverable AI failures; Tech design: add a simple stepper and progress copy in `components/AddItemModal.tsx`, keep a deterministic step enum, and add explicit manual fallback button that preserves user input and allows skipping `analyzeImage` if AI fails.
- [ ] Show active filters in the collection view to prevent "hidden state"; Tech design: add filter chips below the search input in `App.tsx` CollectionScreen, render from `activeFilters`, and add a one-click clear action that syncs with `FilterModal`.
- [ ] Clarify read-only state for public/sample collections and items; Tech design: surface a persistent "Read-only" banner or badge in `App.tsx` CollectionScreen and ItemDetailScreen, and disable edit affordances with clear labels when `isReadOnly` is true.
- [ ] Improve collection template selection clarity; Tech design: add a minimal template preview (field list + short description) inside `components/CreateCollectionModal.tsx`, using `TEMPLATES` data and localized labels from `i18n.ts`.
- [ ] Add consistent feedback for important actions; Tech design: introduce a lightweight toast or inline status row in `App.tsx` for save, sync, and import outcomes, and reuse a single component for success/error states.

## P1 - High-Impact Aesthetic and UX Polish
- [ ] Unify theme styling across modals and cards; Tech design: expose `ThemeContext` or a shared theme hook, then apply theme-specific surface classes to `components/AddItemModal.tsx`, `components/AuthModal.tsx`, `components/CreateCollectionModal.tsx`, and `components/FilterModal.tsx`.
- [ ] Improve typography hierarchy and legibility for microcopy; Tech design: adjust Tailwind classes in `components/Layout.tsx`, `components/CollectionCard.tsx`, and `components/ItemCard.tsx` to increase 8-10px labels to 11-12px and reduce excessive tracking where it hurts readability.
- [ ] Make theme choice feel curated rather than hidden; Tech design: replace cyclic toggle in `App.tsx` header with a small three-option theme picker (swatches + labels) and persist to IndexedDB as today.
- [ ] Align motion language across the app; Tech design: add a small set of shared animation utility classes in `index.html` or a new CSS file, and apply to modal open/close, filter apply, and gallery transitions.

## P2 - Nice-to-Have MVP Extensions
- [ ] Add inline field hints for custom templates; Tech design: display a short helper text per field in `ItemDetailScreen` and Add Item verify flow, using optional metadata in `TEMPLATES`.
- [ ] Create a first-run empty state guide; Tech design: add a small "Getting Started" card on Home when `collections.length === 0` with 2-3 actions (create, sample, import) in `App.tsx`.
- [ ] Provide lightweight accessibility polish; Tech design: add focus trap and ESC handling in modal components, plus `aria-label` on icon-only buttons in `components/Layout.tsx` and `components/ItemCard.tsx`.
- [ ] Add a compact public sample update guide for admins; Tech design: document steps in `README.md` or a new `ADMIN_NOTES.md` and link from the access gate when `isAdmin` is true.
