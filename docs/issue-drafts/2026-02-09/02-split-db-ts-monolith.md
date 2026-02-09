## Title

services/db.ts is a 1,958-line monolith that should be split into focused modules

## Labels

- type:enhancement
- area:sync
- severity:p1

## Problem

`src/services/db.ts` is 1,958 lines handling IndexedDB initialization, recovery, sync status, merge logic, all CRUD operations, Supabase sync, asset management, and orphan cleanup. This makes it difficult to test individual concerns, understand data flow, or modify sync logic without risking side effects.

Key indicators:

- Lines 1-135: DB init, recovery callbacks, sync status callbacks
- Lines 191-288: Merge logic interleaved with DB operations
- Lines 388-1385: All IndexedDB operations
- Lines 1118-1197: Supabase sync operations
- Lines 1288-1569: Asset management (original, display, enhanced)
- Lines 1903-1958: Orphaned asset cleanup
- Three separate path normalization functions (lines 290, 307, 947) with different strategies

## Expected

Split into focused modules:

- `dbCore.ts` - IndexedDB initialization, recovery, store access
- `syncManager.ts` - Supabase sync, pending changes, retry logic
- `assetManager.ts` - Asset storage, upload, cleanup
- `mergeStrategy.ts` - Collection/item merge logic

## Actual

Single 1,958-line file mixing all database concerns.

## Acceptance Criteria

- [ ] db.ts split into 4+ focused modules
- [ ] Path normalization consolidated into single utility
- [ ] Each module independently testable
- [ ] Public API maintained (or migration path documented)
- [ ] All existing db tests pass
- [ ] Sync operations verified end-to-end
