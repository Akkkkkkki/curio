# Production Readiness Checklist

This checklist tracks the minimum bar for a full production launch. Items are grouped by area and
should be verified (or explicitly waived) before launch. Gaps are tracked in GitHub issues.

## 2026-01-23 Review Addendum (single source of truth)

This section consolidates:

- The “Production Readiness Checklist” review notes (prioritization + minimal implementation suggestions)
- The previously drafted issues in `docs/issue-drafts/2026-01-23/`

### Executive summary

- **Closest-to-production areas**: merge strategy + IndexedDB recovery UX + CI coverage are already in good shape.
- **Highest production risk**: AI gateway hardening (cost/security) and asset durability (uploads + deletes).
- **Critical missing gaps discovered in review**:
  - **Offline deletes can resurrect from cloud** (must be fixed for trust)
  - **No Error Boundary** - app shows blank screen on any component crash
  - **P0 UX bugs** - Add Item flow can complete without item appearing (#61), "Enter manually" fallback broken (#62)

### Review decisions on the original issue drafts

- **Access gate stays visible**: **Likely already fixed** in current `src/App.tsx` (gate remains until “Explore sample” or sign-in). Keep as a checklist verification item, but the original draft appears stale.
- **All other 2026-01-23 drafts**: **Agreed** and tracked as GitHub issues below.

### Prioritized launch plan (minimal, no overengineering)

**P0 / must-fix before production**

- ~~**AI gateway hardening**: restrict CORS + require auth + rate limit. Tracked in [#129](https://github.com/Akkkkkkki/curio/issues/129).~~ **DONE** (PR #143)
- ~~**Asset durability**: implement a retry queue for failed storage uploads + user-visible status. Tracked in [#131](https://github.com/Akkkkkkki/curio/issues/131).~~ **DONE** (PR #144)
- ~~**Delete consistency**: prevent offline deletes resurrecting from cloud (tombstones + queued deletes). Tracked in [#135](https://github.com/Akkkkkkki/curio/issues/135).~~ **DONE** (pending delete queue implemented)
- ~~**Error Boundary**: wrap app in error boundary to prevent blank screen on crashes.~~ **DONE** (`ErrorBoundary` component added)
- ~~**Add Item flow reliability**: fix item not appearing after save. [#61](https://github.com/Akkkkkkki/curio/issues/61).~~ **DONE** (`handleSave` now awaits `onSave`)
- ~~**Manual fallback**: fix "Enter manually" link. [#62](https://github.com/Akkkkkkki/curio/issues/62).~~ **VERIFIED WORKING** (tests pass, flow is correct)

**P1 / strongly recommended for first production month**

- **Large collections performance strategy** (start with pagination; add virtualization only if needed). Tracked in [#133](https://github.com/Akkkkkkki/curio/issues/133).
- **Async error handling**: add try-catch to unhandled promises in App.tsx and useCollections.ts. _Not yet tracked._
- **Type safety**: replace critical `any` types and unsafe non-null assertions. _Not yet tracked._
- **"Verify details" scrollbar**: fix hidden fields in Add Item modal. [#66](https://github.com/Akkkkkkki/curio/issues/66).
- **Save/sync feedback**: show confirmation after Add Item. [#64](https://github.com/Akkkkkkki/curio/issues/64).
- **Collection deletion**: allow users to delete collections. [#111](https://github.com/Akkkkkkki/curio/issues/111).

**P2 / operational readiness**

- **Monitoring for AI gateway + sync errors** (start with gateway metrics + a few actionable alerts). Tracked in [#130](https://github.com/Akkkkkkki/curio/issues/130).
- **Rollback/runbook** for gateway + schema changes. Tracked in [#134](https://github.com/Akkkkkkki/curio/issues/134).
- **Image loading performance**: optimize cloud fallback for faster image loads. Tracked in [#147](https://github.com/Akkkkkkki/curio/issues/147).
- **Pending upload visibility**: surface pending asset upload count to users. Tracked in [#149](https://github.com/Akkkkkkki/curio/issues/149).
- **Accessibility basics**: add aria-labels to icon buttons, ensure status indicators have text fallback. _Not yet tracked._
- **Search debouncing**: prevent lag on large collections. _Not yet tracked._
- **Metadata editing**: allow editing item details without delete/re-add. [#70](https://github.com/Akkkkkkki/curio/issues/70).
- **i18n completeness**: translate hardcoded strings, add missing keys. [#69](https://github.com/Akkkkkkki/curio/issues/69), [#104](https://github.com/Akkkkkkki/curio/issues/104), [#105](https://github.com/Akkkkkkki/curio/issues/105).
- **Vercel config**: update placeholder proxy URL in `vercel.json`. _Not yet tracked._
- **Component tests**: complete Phase 4 testing. _Not yet tracked._

**P3 / polish**

- **Quota warning** (single threshold-based warning using `navigator.storage.estimate()`). Tracked in [#132](https://github.com/Akkkkkkki/curio/issues/132).
- **Suppress expected 404/400 errors**: reduce console noise from missing assets. Tracked in [#148](https://github.com/Akkkkkkki/curio/issues/148).
- **Offline fallback page**: show "You're offline" instead of blank screen. _Not yet tracked._
- **Sync queue deduplication**: prevent duplicate syncs across tabs. _Not yet tracked._
- **Circuit breaker for retries**: add exponential backoff and max attempts. _Not yet tracked._

### DB + Storage coverage (current vs recommended)

**Already covered (good)**

- Unit/integration tests heavily cover IndexedDB merge + dual-write behavior via mocks.
- CI runs `format:check`, `npm test`, `npm run build`, and Playwright E2E on PRs.

**Not yet covered with real Supabase (recommended before full launch)**

- Add a **staging Supabase “preflight” smoke** (manual or CI-gated) to validate:
  - RLS isolation across users
  - Storage isolation across user folder prefixes
  - Public sample read behavior (if intended)
  - “Upload then download on new device/session” happy path

### Issue index (production readiness gaps)

- AI gateway hardening (CORS/auth/rate-limit): [#129](https://github.com/Akkkkkkki/curio/issues/129)
- AI gateway + sync monitoring: [#130](https://github.com/Akkkkkkki/curio/issues/130)
- Asset upload retry queue: [#131](https://github.com/Akkkkkkki/curio/issues/131)
- IndexedDB quota warning: [#132](https://github.com/Akkkkkkki/curio/issues/132)
- Image loading performance (cloud fallback): [#147](https://github.com/Akkkkkkki/curio/issues/147)
- Suppress expected 404/400 console errors: [#148](https://github.com/Akkkkkkki/curio/issues/148)
- Pending upload visibility in UI: [#149](https://github.com/Akkkkkkki/curio/issues/149)
- Large collection performance strategy: [#133](https://github.com/Akkkkkkki/curio/issues/133)
- Rollback/runbook (gateway + schema): [#134](https://github.com/Akkkkkkki/curio/issues/134)
- Offline deletes resurrecting: [#135](https://github.com/Akkkkkkki/curio/issues/135)

### Implementation plans (P0/P1)

Canonical implementation plans are maintained directly in the issue threads (to avoid stale duplicated docs):

- P0 AI gateway hardening plan: [#129](https://github.com/Akkkkkkki/curio/issues/129)
- P0 asset upload retry queue plan: [#131](https://github.com/Akkkkkkki/curio/issues/131)
- P1 large-collection performance plan: [#133](https://github.com/Akkkkkkki/curio/issues/133)
- P0 offline delete tombstones plan: [#135](https://github.com/Akkkkkkki/curio/issues/135)

## Product & UX

- [ ] First-run access gate stays visible until users explicitly choose **Explore sample** or sign in.
- [ ] Public sample collections are clearly labeled read-only and disable edit actions.
- [ ] Add-item flow shows staged progress (Upload → Analyzing → Review → Save) with manual fallback.
- [ ] Save/sync feedback (“Saved / Synced / Will sync / Sync failed”) is surfaced for all critical flows.

## Data Reliability & Offline

- [ ] IndexedDB corruption recovery notifications are visible.
- [ ] Sync queue retries metadata updates when back online.
- [x] Asset upload retry queue exists for failed uploads. _Fixed: Exponential backoff retry queue in `db.ts` with user-visible status._
- [ ] **P2** Pending asset upload count is visible to users (not just console). _[#149](https://github.com/Akkkkkkki/curio/issues/149)._
- [x] Deletes do not resurrect when offline (tombstones + queued delete). _Fixed: `pendingDeletes` queue prevents deleted items from resurrecting._
- [ ] Storage quota checks warn users before IndexedDB fills.
- [ ] Timestamp-based conflict resolution is enabled in production (`VITE_SUPABASE_SYNC_TIMESTAMPS=true`).

## Security & Access Control

- [ ] Supabase RLS policies enforce per-user isolation and public sample read-only access.
- [ ] Storage buckets are per-user and enforce access isolation.
- [x] AI gateway CORS is restricted to known origins (no wildcard in production). _Fixed: `CORS_ORIGINS` env var in production._
- [x] AI gateway requires auth or signed requests for image analysis/enhancement. _Fixed: JWT auth middleware in `geminiProxy.js`._
- [x] AI gateway rate limiting is enforced. _Fixed: Per-user and per-IP rate limiting in `geminiProxy.js`._

## Observability & Operations

- [x] AI gateway metrics (request count, latency, error rate) are exported and monitored. See `docs/ops/AI_GATEWAY_MONITORING.md`.
- [x] Sync error rates are visible (client + server monitoring) with actionable alerting. See `docs/ops/AI_GATEWAY_MONITORING.md`.
- [ ] Quota/rate-limit errors have user-facing recovery messaging.

## Testing & CI

- [ ] `npm test` (unit + component) passes in CI.
- [ ] `npm run build` passes in CI.
- [ ] Playwright E2E tests run in CI with a maintained baseline.
- [ ] Documentation reflects actual test coverage status.

## Performance & Resilience

- [ ] Initial load does not flash through unintended states (auth/sync loading handled predictably).
- [ ] Large collections do not degrade core browsing performance (pagination/virtualization if needed).
- [ ] Image processing is time-boxed with fallbacks and failure messaging.
- [ ] **P2** Image loading from cloud fallback is optimized (parallel downloads, progress indication). _Location: `db.ts:1052-1104` - sequential cloud downloads can be slow. [#147](https://github.com/Akkkkkkki/curio/issues/147)._

## Error Handling & Resilience

- [x] **P0** React Error Boundary wraps the app (prevents blank screen on component crashes). _Fixed: `ErrorBoundary` component in `components/ui/ErrorBoundary.tsx` wraps `AppContent`._
- [ ] **P1** All async operations have proper try-catch and user-visible error states. _Locations: `App.tsx:531` (saveCollection not awaited), `App.tsx:654` (deleteCloudItem fire-and-forget)._
- [ ] **P1** Online event handler has error recovery. _Location: `useCollections.ts:120-132` - syncPendingChanges/syncPendingAssetUploads not wrapped in try-catch._
- [ ] **P2** Batch import has partial recovery (one failed file shouldn't fail entire batch). _Location: `AddItemModal.tsx:271` - Promise.all fails completely on single file error._
- [ ] **P2** Image enhancement has user-visible timeout feedback. _Location: `EnhanceImageModal.tsx:122-180` - no timeout UX._
- [ ] **P2** Circuit breaker for sync retries (exponential backoff, max attempts). _Location: `db.ts:385-404` - retries indefinitely if API is down._

## Type Safety & Code Quality

- [ ] **P1** Replace `any` types with proper TypeScript types. _Location: `App.tsx:102` (`user` state is `any`), `MuseumGuide.tsx:22` (`sessionRef` is `any`)._
- [ ] **P1** Remove unsafe non-null assertions or add validation. _Locations: `db.ts:938, 1073` (`user!` without null check)._
- [ ] **P2** Validate array/string operations before indexing. _Locations: `EnhanceImageModal.tsx:141`, `AddItemModal.tsx:323` (`dataUrl.split(',')[1]` without length check)._
- [ ] **P3** Add structured logging system (replace scattered console.warn/error with levels). _53 occurrences across 13 files._
- [ ] **P3** Suppress expected 404/400 errors from Supabase Storage. _Location: `db.ts:1090, 1226` - console noise from missing assets. [#148](https://github.com/Akkkkkkki/curio/issues/148)._

## Accessibility (a11y)

- [ ] **P2** All icon-only buttons have `aria-label`. _Locations: `App.tsx:1183-1189` (filter button), star rating buttons on ItemDetailScreen._
- [ ] **P2** Status indicators don't rely solely on color. _Location: `Layout.tsx:62-72` - signed in/out status only differs by color (red/green/amber)._
- [ ] **P2** Item images have meaningful `alt` text. _Tracked in [#102](https://github.com/Akkkkkkki/curio/issues/102) for Exhibition, also affects ItemCard._
- [ ] **P2** Modal dialogs have complete ARIA attributes (`aria-describedby` for errors). _Location: `AddItemModal.tsx:764-769`._
- [ ] **P3** Focus rings are visible on interactive elements in all themes.

## Mobile & Responsive Design

- [ ] **P2** Search input is debounced (prevents lag on large collections). _Location: `App.tsx:911` - filters on every keystroke._
- [ ] **P2** Batch verify step uses lazy/virtualized rendering. _Location: `AddItemModal.tsx:552-623` - all images render at once._
- [ ] **P2** Large item lists use lazy loading or virtualization. _Location: `App.tsx:1262-1277` - all filteredItems render at once._
- [ ] **P2** Bottom nav doesn't overlap content on small landscape screens. _Location: `Layout.tsx:238` - fixed 7rem may collide._
- [ ] **P3** Grid gaps scale appropriately for ultra-wide screens. _Location: `App.tsx:1257-1259`._

## PWA & Offline

- [ ] **P2** Offline fallback page exists (not blank screen when SW fails). _Currently no "You're offline" message._
- [ ] **P2** Pending sync queue is deduplicated across browser tabs. _Location: `db.ts:18-19` - each tab maintains separate queue._
- [ ] **P2** Theme loading doesn't cause FOUC (flash of unstyled content). _Location: `theme.tsx` - async IndexedDB read during boot._

## Internationalization (i18n)

- [ ] **P2** No hardcoded English strings in UI components. _Locations: `AddItemModal.tsx:629` ("Add More"), `AddItemModal.tsx:639` ("Archive X Artifacts"), `EnhanceImageModal.tsx:284` (error messages)._
- [ ] **P2** All new feature strings have translation keys in `i18n.ts`. _EnhanceImageModal error messages missing._
- [ ] **P2** Custom field labels translate in all contexts. _Tracked in [#104](https://github.com/Akkkkkkki/curio/issues/104) (Add Item) and [#105](https://github.com/Akkkkkkki/curio/issues/105) (Filter/Exhibition)._

## Testing Coverage

- [ ] **P2** Component tests (Phase 4) cover critical user flows. _Status: Not started per tests/README.md._
- [ ] **P2** E2E tests cover authenticated user journey completely. _Status: 3 specs in progress, authenticated-user.spec.ts requires credentials._
- [ ] **P2** Staging Supabase smoke tests validate RLS and storage isolation. _Not yet implemented._
- [ ] **P3** Test coverage meets thresholds (services 90%, hooks 80%, components 70%).

## Deployment & Configuration

- [ ] Production env vars are configured (Supabase, AI gateway, feature flags).
- [ ] `/api/*` routes point to the intended gateway (same-origin or proxy) in production.
- [ ] Rollback steps are documented for AI gateway and database schema changes.
- [ ] **P2** `vercel.json` proxy URL is updated from placeholder. _Current: `https://gemini-proxy-xyz.a.run.app` - needs real URL._
- [ ] **P2** Environment variables are validated on app startup (fail fast if misconfigured).
- [ ] **P2** Feature flags have sensible defaults when env vars are missing.

## Known UX Issues (from external review)

_These are tracked in GitHub issues but listed here for visibility:_

- [x] **P0** Add Item flow can complete without item appearing. _[#61](https://github.com/Akkkkkkki/curio/issues/61)_ **FIXED** - `handleSave` now awaits `onSave` before closing modal.
- [x] **P0** "Enter manually" fallback doesn't work. _[#62](https://github.com/Akkkkkkki/curio/issues/62)_ **VERIFIED WORKING** - tests pass, flow is correct.
- [ ] **P1** "Verify details" step has hidden scrollbar causing missed fields. _[#66](https://github.com/Akkkkkkki/curio/issues/66)_
- [ ] **P1** Missing save/sync feedback after Add Item. _[#64](https://github.com/Akkkkkkki/curio/issues/64)_
- [ ] **P1** Collection deletion not implemented. _[#111](https://github.com/Akkkkkkki/curio/issues/111)_
- [ ] **P2** Item detail lacks metadata editing (must delete/re-add). _[#70](https://github.com/Akkkkkkki/curio/issues/70)_
- [ ] **P2** Tooltips/labels for action icons. _[#68](https://github.com/Akkkkkkki/curio/issues/68)_
- [ ] **P2** Print icon does nothing. _[#95](https://github.com/Akkkkkkki/curio/issues/95)_
- [ ] **P2** Sign-in entry point unclear. _[#71](https://github.com/Akkkkkkki/curio/issues/71)_

## Notes

- Reliability work is tracked in `docs/ops/INDEXEDDB_RELIABILITY.md`.
- Product expectations and system architecture are defined in `docs/TECHNICAL_DESIGN.md`.
- UX review feedback from 2026-01-13 is consolidated in `docs/PRODUCT_DESIGN.md` (Section 6).
