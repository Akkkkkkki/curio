# Production Readiness Checklist

This checklist tracks the minimum bar for a full production launch. Items are grouped by area and
should be verified (or explicitly waived) before launch. Gaps are tracked in GitHub issues.

## Product & UX

- [ ] First-run access gate stays visible until users explicitly choose **Explore sample** or sign in.
- [ ] Public sample collections are clearly labeled read-only and disable edit actions.
- [ ] Add-item flow shows staged progress (Upload → Analyzing → Review → Save) with manual fallback.
- [ ] Save/sync feedback (“Saved / Synced / Will sync / Sync failed”) is surfaced for all critical flows.

## Data Reliability & Offline

- [ ] IndexedDB corruption recovery notifications are visible.
- [ ] Sync queue retries metadata updates when back online.
- [ ] Asset upload retry queue exists for failed uploads.
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
