# IndexedDB Reliability & Data Integrity

This document analyzes the IndexedDB design in Curio, identifies UX gaps that can cause data loss or confusion, and tracks the implementation status of fixes.

## Current Architecture

### Object Stores

| Store         | Purpose                                              | Key Type                  |
| ------------- | ---------------------------------------------------- | ------------------------- |
| `collections` | Cache of user collections + items (denormalized)     | `keyPath: 'id'`           |
| `assets`      | Original high-quality image blobs                    | Out-of-line key (item ID) |
| `display`     | Downsampled display image blobs                      | Out-of-line key (item ID) |
| `settings`    | App preferences (theme, seed version, pending syncs) | Out-of-line key (string)  |

### Data Flow

```
User Action → IndexedDB (immediate) → Supabase (debounced 1500ms)
                                            ↓
App Load ← IndexedDB (cache) ←──────── Supabase (source of truth)
```

- **Supabase is source of truth** for what data exists
- **IndexedDB is a local cache** for offline access and performance
- **Assets use local-first pattern** with cloud backup

---

## Identified Issues & Status

### 1. Silent Data Loss on Recovery (P0) ✅ FIXED

**Location:** `services/db.ts`

**Problem:** When IndexedDB corruption was detected, the entire database was deleted without warning.

**Fix Implemented:**

- Added `RecoveryEvent` type and `setRecoveryCallback()` API in `db.ts`
- `loadLocalCollections()` now calls recovery callbacks before/after deletion
- `initDB()` handles open failures with recovery callbacks
- `useCollections.ts` sets up the callback to show user notifications
- Added translations: `localCacheCorrupted`, `localCacheRecovered`, `localCacheRecoveryFailed`

**User Experience:** Users now see a toast notification when:

- Local cache is corrupted and reset
- Recovery from cloud completes
- Recovery fails

---

### 2. No Sync Status Visibility (P0) ✅ FIXED

**Location:** `services/db.ts`

**Problem:** Sync errors were logged to console but users had no visibility.

**Fix Implemented:**

- Added `SyncStatus` type (`'idle' | 'syncing' | 'synced' | 'error' | 'offline'`)
- Added `setSyncStatusCallback()` API in `db.ts`
- `saveCollection()` now calls `notifySyncStatus()` during sync
- `useCollections.ts` tracks sync status and shows error messages
- Added `syncStatus` to hook return value for UI consumption
- Added translations: `statusSyncing`, `statusSyncError`

**User Experience:** Users see sync status and error messages in real-time.

---

### 3. No Offline Queue / Retry Logic (P1) ✅ FIXED

**Location:** `services/db.ts`

**Problem:** When offline, sync operations failed silently with no retry.

**Fix Implemented:**

- Added `PENDING_SYNC_KEY` in settings store to track pending syncs
- Added `addToPendingSync()`, `removeFromPendingSync()`, `getPendingSyncIds()` helpers
- Added `syncPendingChanges()` exported function
- `saveCollection()` now queues failed syncs for later retry (including when no user session)
- `useCollections.ts` listens for `online` event and calls `syncPendingChanges()`
- Startup sync called at end of `refreshCollections()` to avoid race conditions with initial load
- Added translations: `statusPendingSyncs`, `statusPendingSynced`

**User Experience:** Changes made offline are automatically synced when connection is restored (or on app startup if already online), with a notification showing how many changes were synced.

---

### 4. Race Conditions in `saveAllCollections` (P1) ✅ FIXED

**Location:** `services/db.ts:831`

**Problem:** `clear()` then `add()` was not atomic - if crash occurred between them, all data would be lost.

**Fix Implemented:**

- Changed to use `put()` instead of `clear()` + `add()`
- First gets all existing keys, then deletes only stale entries (those not in new set)
- Then upserts all new collections with `put()`
- All operations happen in a single transaction for atomicity

**User Experience:** No visible change, but data is protected from corruption during saves.

---

## Remaining Issues (P2/P3 - Not Yet Implemented)

### 5. `loadCollections` Ignores Merge Logic (P2)

**Problem:** The function overwrites local with cloud instead of merging.

**Note:** The `mergeCollections` function exists but isn't used in `loadCollections()`.

**Status:** Not implemented in this PR. Could be addressed in a future update.

---

### 6. Asset Sync Failures Leave Orphans (P2)

**Problem:** If cloud upload fails, asset is stuck local-only with no retry mechanism.

**Status:** Not implemented in this PR. Similar queue mechanism could be added for assets.

---

### 7. No Storage Quota Checks (P3)

**Problem:** Large collections could hit IndexedDB quota limits without warning.

**Status:** Not implemented in this PR. Low priority.

---

## Testing Checklist

After implementing fixes, verify:

- [x] Corruption recovery shows user notification (P0 #1)
- [x] Sync errors display in status bar (P0 #2)
- [x] Offline changes sync when back online (P1 #1)
- [x] Concurrent saves don't corrupt data (P1 #2)
- [ ] Local-only items survive cloud fetch (P2 - not implemented)
- [ ] Failed asset uploads retry on reconnection (P2 - not implemented)
- [ ] Large collections warn about storage limits (P3 - not implemented)

---

## Files Modified

- `services/db.ts` - Added recovery/sync callbacks, pending sync queue, atomic saves
- `hooks/useCollections.ts` - Integrated callbacks, online retry, exposed sync status
- `i18n.ts` - Added translations for new status messages (EN + ZH)

---

## API Reference

### Recovery Callbacks

```typescript
import { setRecoveryCallback, type RecoveryEvent } from '@/services/db';

setRecoveryCallback((event: RecoveryEvent) => {
  // event.type: 'corruption_detected' | 'recovery_complete' | 'recovery_failed'
  // event.lostData: boolean
});
```

### Sync Status Callbacks

```typescript
import { setSyncStatusCallback, type SyncStatus } from '@/services/db';

setSyncStatusCallback((status: SyncStatus, error?: string) => {
  // status: 'idle' | 'syncing' | 'synced' | 'error' | 'offline'
});
```

### Pending Sync Management

```typescript
import { syncPendingChanges, hasPendingSyncs, getPendingSyncCount } from '@/services/db';

// Manually trigger pending sync (usually called on 'online' event)
const syncedCount = await syncPendingChanges();

// Check if there are pending syncs
const hasPending = await hasPendingSyncs();
const count = await getPendingSyncCount();
```
