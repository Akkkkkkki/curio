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
- **Critical missing gap discovered in review**: **offline deletes can resurrect from cloud** (must be fixed for trust).

### Review decisions on the original issue drafts

- **Access gate stays visible**: **Likely already fixed** in current `src/App.tsx` (gate remains until “Explore sample” or sign-in). Keep as a checklist verification item, but the original draft appears stale.
- **All other 2026-01-23 drafts**: **Agreed** and tracked as GitHub issues below.

### Prioritized launch plan (minimal, no overengineering)

**P0 / must-fix before production**

- **AI gateway hardening**: restrict CORS + require auth + rate limit. Tracked in [#129](https://github.com/Akkkkkkki/curio/issues/129).
- **Asset durability**: implement a retry queue for failed storage uploads + user-visible status. Tracked in [#131](https://github.com/Akkkkkkki/curio/issues/131).
- **Delete consistency**: prevent offline deletes resurrecting from cloud (tombstones + queued deletes). Tracked in [#135](https://github.com/Akkkkkkki/curio/issues/135).

**P1 / strongly recommended for first production month**

- **Large collections performance strategy** (start with pagination; add virtualization only if needed). Tracked in [#133](https://github.com/Akkkkkkki/curio/issues/133).

**P2 / operational readiness**

- **Monitoring for AI gateway + sync errors** (start with gateway metrics + a few actionable alerts). Tracked in [#130](https://github.com/Akkkkkkki/curio/issues/130).
- **Rollback/runbook** for gateway + schema changes. Tracked in [#134](https://github.com/Akkkkkkki/curio/issues/134).

**P3 / polish**

- **Quota warning** (single threshold-based warning using `navigator.storage.estimate()`). Tracked in [#132](https://github.com/Akkkkkkki/curio/issues/132).

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
- [ ] Asset upload retry queue exists for failed uploads.
- [ ] Deletes do not resurrect when offline (tombstones + queued delete).
- [ ] Storage quota checks warn users before IndexedDB fills.
- [ ] Timestamp-based conflict resolution is enabled in production (`VITE_SUPABASE_SYNC_TIMESTAMPS=true`).

## Security & Access Control

- [ ] Supabase RLS policies enforce per-user isolation and public sample read-only access.
- [ ] Storage buckets are per-user and enforce access isolation.
- [ ] AI gateway CORS is restricted to known origins (no wildcard in production).
- [ ] AI gateway requires auth or signed requests for image analysis/enhancement.
- [ ] AI gateway rate limiting is enforced.

## Observability & Operations

- [ ] AI gateway metrics (request count, latency, error rate) are exported and monitored.
- [ ] Sync error rates are visible (client + server monitoring) with actionable alerting.
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

## Deployment & Configuration

- [ ] Production env vars are configured (Supabase, AI gateway, feature flags).
- [ ] `/api/*` routes point to the intended gateway (same-origin or proxy) in production.
- [ ] Rollback steps are documented for AI gateway and database schema changes.

## Notes

- Reliability work is tracked in `docs/INDEXEDDB_RELIABILITY.md`.
- Product expectations and system architecture are defined in `docs/TECHNICAL_DESIGN.md`.
