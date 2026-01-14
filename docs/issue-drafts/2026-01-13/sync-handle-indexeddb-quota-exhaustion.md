## Title

Warn users on IndexedDB quota exhaustion and handle QuotaExceededError gracefully

## Labels

- type:ux
- area:sync
- severity:p3

## Problem

Large collections or large image blobs can hit browser storage limits. Today, quota exhaustion can surface as IndexedDB write failures without clear user guidance, creating confusion and risk of perceived data loss.

## Steps to Reproduce

1. Add many high-resolution photos (or very large blobs) until the browser’s storage quota is reached.
2. Attempt to add another item/photo.

## Expected

The app should detect “low storage” conditions and/or handle quota errors by:

- Showing a clear toast/inline message explaining what happened
- Offering actionable guidance (e.g. delete items/photos, reduce image size, or export/back up)
- Avoiding silent failure states

## Actual

Quota-related failures are not surfaced clearly to users.

## Acceptance Criteria

- Detect storage pressure using `navigator.storage.estimate()` when available.
- Catch quota errors on IndexedDB writes (e.g. QuotaExceededError / DOMException) and surface a user-visible message.
- Add a small “storage health” note in relevant flows (photo save / import) when at risk.
- Add tests for quota exhaustion scenarios (mocked) to ensure UX feedback appears and app remains usable.

## Notes (optional)

- Mentioned as a remaining item in `docs/INDEXEDDB_RELIABILITY.md` (“No Storage Quota Checks”).
