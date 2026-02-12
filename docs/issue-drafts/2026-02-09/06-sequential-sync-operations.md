## Title

Sync and asset upload loops run sequentially instead of batched

## Labels

- type:enhancement
- area:sync
- severity:p2

## Problem

`src/services/db.ts` processes sync operations one at a time in `for` loops, which is slow for users with many pending changes.

**Lines 652-670 - Sequential sync:**

```typescript
for (const entry of dueEntries) {
  await saveCollectionToCloud(collection); // Sequential!
}
```

**Lines 752-772 - Sequential asset upload:**

```typescript
for (const { collectionId, itemId } of dueUploads) {
  // Sequential processing
}
```

With 10+ pending items, this means 10+ sequential HTTP requests instead of batched parallel requests.

## Expected

Operations batched with `Promise.all()` using a concurrency limit (e.g., 3-5 concurrent requests) to avoid overwhelming the server while improving throughput.

## Actual

Sequential processing, one request at a time.

## Acceptance Criteria

- [ ] Sync operations use batched parallel processing with concurrency limit
- [ ] Asset uploads use batched parallel processing with concurrency limit
- [ ] Error in one batch item doesn't abort remaining items
- [ ] Sync status UI reflects batch progress
- [ ] No regression in retry/backoff behavior
