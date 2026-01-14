## Title

Retry failed Supabase Storage asset uploads (queue + online retry) to avoid local-only image orphans

## Labels

- type:bug
- area:sync
- severity:p2

## Problem

`services/db.ts` `saveAsset()` uploads original/display images to Supabase Storage but on failure it only logs a warning and does not retry.

This leaves assets **stuck local-only** (and potentially inconsistent with item metadata in the cloud), which can degrade cross-device usage and undermine trust in sync.

## Steps to Reproduce

1. Add an item with a photo while offline or with flaky connectivity.
2. Ensure the item record is created locally (and may sync later).
3. Trigger `saveAsset()` while the network/storage upload fails.
4. Restore connectivity.

## Expected

Failed asset uploads are **queued** and automatically retried when the app is online (and/or on startup), with user-visible status when appropriate.

## Actual

Asset uploads fail silently (aside from console warnings) and are never retried.

## Acceptance Criteria

- Introduce a persistent pending-asset-upload queue (likely in IndexedDB `settings` store, similar to pending collection sync).
- Queue entries include enough information to retry (collectionId, itemId, variant(s), remote paths if needed).
- On `online` event and on app startup, retry queued uploads until success; remove from queue on success.
- Provide minimal user feedback (e.g. “Will sync photos” / “Photos synced”) aligned with existing sync status patterns.
- Add/update tests that simulate upload failures and verify retry + eventual success.

## Notes (optional)

- Documented as a remaining gap in `docs/INDEXEDDB_RELIABILITY.md` (“Asset Sync Failures Leave Orphans”).
