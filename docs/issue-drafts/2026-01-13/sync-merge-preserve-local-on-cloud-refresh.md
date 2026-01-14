## Title

Prevent cloud refresh from overwriting unsynced local collections (use merge logic in `loadCollections`)

## Labels

- type:bug
- area:sync
- severity:p1

## Problem

`services/db.ts` `loadCollections()` currently fetches cloud collections and then **blindly overwrites** IndexedDB with the cloud result (`saveAllCollections(cloudCollections)`), returning cloud data.

This can effectively **delete or hide local-only / not-yet-synced collections/items** (e.g. created offline or during transient auth/network issues), violating the “local cache as resilience” promise and creating data loss risk.

## Steps to Reproduce

1. Create or modify a collection while offline (or while cloud sync is failing).
2. Ensure local changes exist but are not in Supabase yet.
3. Restore connectivity and trigger a refresh (app load or manual refresh that calls `loadCollections()`).

## Expected

Local-only changes should **survive** a cloud refresh and be merged with cloud state, while still respecting cloud deletions and conflict resolution rules.

## Actual

Cloud refresh overwrites local IndexedDB collections with the cloud snapshot, potentially removing local-only data.

## Acceptance Criteria

- `loadCollections()` uses `mergeCollections(local, cloud)` (and `mergeItems` as needed) instead of overwriting local with cloud.
- Local-only collections/items remain visible after a cloud refresh.
- Cloud deletions are still respected (do not resurrect deleted cloud entities).
- Conflicts are resolved deterministically (timestamps when enabled, otherwise current merge rules).
- Add/update tests covering at least:
  - local-only items survive cloud fetch
  - cloud deletion removes locally cached items
  - timestamp conflict resolution behavior

## Notes (optional)

- Documented as a remaining gap in `docs/INDEXEDDB_RELIABILITY.md` (“`loadCollections` Ignores Merge Logic”).
