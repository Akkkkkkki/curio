# Testing Progress - Curio

**Last updated:** 2026-01-05

This checklist tracks test coverage implementation progress against `docs/TESTING_ROADMAP.md`.

## Summary

- **Phase 1-3:** Complete and passing (179 tests)
- **Phase 4-5:** Not started (component and E2E tests)
- **Test Status:** 179 passed, 2 skipped (unimplemented features), 2 todo

## Phase 1: Critical Services — Pure/Isolated

- [x] **1.1 `services/db.ts` — Pure Functions** (`tests/unit/services/db.pure.test.ts`)
  - 57 tests covering: compareTimestamps, normalizePhotoPaths, extractCurioAssetPath

- [x] **1.2 `services/imageProcessor.ts` — Image Processing** (`tests/unit/services/imageProcessor.test.ts`)
  - 50 tests covering: quality preservation, downsampling, format conversion, edge cases

- [x] **1.3 `services/supabase.ts` — Auth Functions (Isolated)** (`tests/unit/services/supabase.test.ts`)
  - 13 tests covering: signUpWithEmail, signInWithEmail, signOutUser, error cases

## Phase 2: Critical Services — Integration

- [x] **2.1 `services/db.ts` — Merge Logic** (`tests/services/db.merge.test.ts`)
  - 13 tests covering: mergeCollections, mergeItems, timestamp conflict resolution
  - Functions now exported for testing: `mergeCollections`, `mergeItems`

- [x] **2.2 `services/db.ts` — Dual-Write Operations** (`tests/services/db.operations.test.ts`)
  - 4 tests + 2 todo covering: saveCollection, saveAsset, cloud sync
  - Todo: saveItem function (not yet implemented)
  - Todo: Upload retry logic (not yet implemented)

- [x] **2.3 `services/db.ts` — Cleanup & Utilities** (`tests/services/db.cleanup.test.ts`)
  - 4 tests covering: cleanupOrphanedAssets, batch cleanup, error handling

## Phase 3: AI & Hooks Integration

- [x] **3.1 `services/geminiService.ts` — AI Analysis** (`tests/services/geminiService.test.ts`)
  - 9 tests covering: analyzeImage, graceful degradation, timeout, AI availability
  - Graceful degradation: Returns null on any failure (network, timeout, disabled) per product requirements

- [x] **3.2 `hooks/useAuthState.ts` — Auth State Management** (`tests/hooks/useAuthState.test.ts`)
  - 4 tests covering: initial state, auth state changes, admin status, rapid sign-in/out

- [x] **3.3 `hooks/useCollections.ts` — Collection Management** (`tests/hooks/useCollections.test.ts`)
  - 6 tests covering: offline fallback, cloud sync, admin seeding, edge cases

## Phase 4: Components (Not Started)

- [ ] **4.1 `components/AddItemModal.tsx` — Item Creation Flow** (`tests/components/AddItemModal.test.tsx`)
- [ ] **4.2 `components/AuthModal.tsx` — Authentication UI** (`tests/components/AuthModal.test.tsx`)
- [ ] **4.3 Other UI Components** (`tests/components/ui/*.test.tsx`)

## Phase 5: End-to-End Tests (Not Started)

- [ ] **5.1 Critical User Flows** (`tests/e2e/critical-flows.spec.ts`)

## Known Issues & Future Work

1. **saveItem function**: Not yet implemented in db.ts (tracked as todo test)
2. **Upload retry logic**: Not yet implemented for saveAsset (tracked as todo test)
3. **Component tests**: Phase 4 not started
4. **E2E tests**: Phase 5 not started
