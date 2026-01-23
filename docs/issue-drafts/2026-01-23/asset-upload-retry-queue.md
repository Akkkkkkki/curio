## Title

Add retry queue for failed asset uploads

## Labels

- type:enhancement
- area:sync
- severity:p2

## Problem

If a Supabase storage upload fails, the asset is left local-only with no retry mechanism, creating a silent failure risk for long-term access.

## Steps to Reproduce

1. Trigger an asset upload while offline or with Supabase storage failing.
2. Observe that metadata saves but the asset never uploads.

## Expected

Failed asset uploads are queued and retried when back online (or via manual retry).

## Actual

Failed asset uploads are not retried; assets can remain local-only indefinitely.

## Acceptance Criteria

- Failed asset uploads are stored in a retry queue.
- Retries occur automatically on reconnect and can be manually triggered.
- User receives status feedback when assets are queued or synced.

## Notes (optional)

See `docs/INDEXEDDB_RELIABILITY.md` (Issue #85 reference).
