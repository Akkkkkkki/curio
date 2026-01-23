## Title

Warn users when IndexedDB storage quota is near limits

## Labels

- type:enhancement
- area:sync
- severity:p3

## Problem

Large collections can hit IndexedDB quota limits without warning, risking failed saves and confusion.

## Steps to Reproduce

1. Save a large number of high-resolution assets to IndexedDB.
2. Approach the browser’s storage quota.
3. Observe that no warning appears before failures.

## Expected

Users receive a warning before IndexedDB quota is exhausted, with guidance on cleanup or sync.

## Actual

No warning is shown; failures can appear without context.

## Acceptance Criteria

- The app checks available quota periodically (or during large saves).
- A warning toast/modal appears when remaining quota is below a defined threshold.
- Guidance is provided for resolving the issue (syncing, cleanup, reducing image sizes).

## Notes (optional)

See `docs/INDEXEDDB_RELIABILITY.md` (Issue #83 reference).
