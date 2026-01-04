# Testing Roadmap - Curio

**Created:** 2026-01-03
**Status:** Planning Phase
**Testing Framework:** Vitest + React Testing Library (recommended)

---

## Strategy Overview

**Principles:**

1. **Risk-First:** Test critical data paths before UI polish
2. **Isolation-First:** Test pure functions before integration
3. **Mock-Minimal:** Start with tests requiring fewest mocks
4. **Build Confidence Incrementally:** Each phase validates dependencies for the next

**Success Metrics:**

- Zero data loss scenarios in sync logic
- Zero image corruption in processing pipeline
- Auth flows prevent unauthorized access
- AI failures gracefully degrade (no blocking errors)

---

## PHASE 1: CRITICAL SERVICES - PURE FUNCTIONS (Week 1)

**Goal:** Validate core logic with minimal mocking, establish testing infrastructure

### 1.1 `services/db.ts` - Pure Functions

**Priority:** CRITICAL
**Complexity:** 2/5
**Dependencies:** None (pure functions)
**Mocks Required:** None

**Functions to Test:**

- `compareTimestamps(local, cloud)`
  - Test cases: local newer, cloud newer, equal, undefined handling
  - Edge cases: malformed timestamps, timezone differences
- `normalizePhotoPaths(item)`
  - Test cases: legacy `photo_path` migration, modern paths, missing paths
  - Edge cases: null/undefined items, partial path data

**Deliverable:** `tests/unit/services/db.pure.test.ts`

---

### 1.2 `services/imageProcessor.ts` - Image Processing

**Priority:** CRITICAL
**Complexity:** 4/5
**Dependencies:** Canvas API, Blob/File APIs
**Mocks Required:** Canvas polyfill (jsdom-worker or node-canvas)

**Functions to Test:**

- `processImage(file, type: 'original' | 'display')`
  - Test original: JPEG quality 95%, preserves resolution
  - Test display: Downsamples to max 2000px, quality 92%
  - Test formats: JPEG passthrough, PNG→JPEG conversion
  - Edge cases: Oversized images, corrupted files, unsupported formats
  - Performance: Memory usage on large images (10MB+)

**Critical Validation:**

- **NO quality degradation:** Compare before/after image hashes
- **NO orientation loss:** Verify EXIF orientation preserved
- **NO memory leaks:** Monitor heap usage in batch processing

**Setup Requirements:**

```bash
npm install --save-dev canvas  # for Node.js Canvas API
```

**Deliverable:** `tests/unit/services/imageProcessor.test.ts`

---

### 1.3 `services/supabase.ts` - Auth Functions (Isolated)

**Priority:** HIGH
**Complexity:** 3/5
**Dependencies:** Supabase SDK
**Mocks Required:** `@supabase/supabase-js` mock

**Functions to Test:**

- `signUpWithEmail(email, password)`
  - Success case: Returns user object
  - Error cases: Duplicate email, weak password, network failure
- `signInWithEmail(email, password)`
  - Success case: Returns user (current implementation)
  - Note: If we later need tokens (access/refresh) for advanced flows, consider returning `session` (or `{ user, session }`)
  - Error cases: Invalid credentials, unconfirmed email
- `signOutUser()`
  - Success case: Clears session
  - Edge case: Already signed out

**Mock Strategy:**

```typescript
// Use vi.mock() to mock Supabase client
// Return controlled responses for auth methods
```

**Deliverable:** `tests/unit/services/supabase.test.ts`

---

## PHASE 2: CRITICAL SERVICES - INTEGRATION (Week 2)

**Goal:** Test complex merge logic and dual-write operations with mocked dependencies

### 2.1 `services/db.ts` - Merge Logic

**Priority:** CRITICAL
**Complexity:** 5/5
**Dependencies:** IndexedDB, Supabase client
**Mocks Required:** `fake-indexeddb`, Supabase SDK mock

**Functions to Test:**

- `mergeCollections(localCollections, cloudCollections, cloudDeletedIds?)`
  - Scenario 1: Cloud newer → cloud wins
  - Scenario 2: Local newer → local wins
  - Scenario 3: Cloud deletion → remove local
  - Scenario 4: Local-only (unsynced) → preserve local
  - Edge cases: Conflicting timestamps, missing updated_at fields

- `mergeItems(localItems, cloudItems, cloudDeletedIds?)`
  - Same scenarios as collections
  - Additional: Photo path normalization during merge
  - Edge case: Orphaned items (collection deleted but items remain)

**Critical Test Cases:**

```typescript
// Test Case: User edits item offline, cloud has newer edit
// Expected: Cloud wins, local changes lost (document this!)

// Test Case: User deletes item, sync fails, item reappears from cloud
// Expected: Cloud deletion respected, item removed locally

// Test Case: Two devices edit same item simultaneously
// Expected: Last updated_at timestamp wins
```

**Setup Requirements:**

```bash
npm install --save-dev fake-indexeddb
```

**Deliverable:** `tests/services/db.merge.test.ts`

---

### 2.2 `services/db.ts` - Dual-Write Operations

**Priority:** CRITICAL
**Complexity:** 4/5
**Dependencies:** IndexedDB, Supabase client, Supabase Storage
**Mocks Required:** `fake-indexeddb`, Supabase SDK mock, Storage mock

**Functions to Test:**

- `saveCollection(collection, session)`
  - Success: Writes to IndexedDB + Supabase
  - Rollback: If cloud fails, local succeeds (document eventual consistency)
  - Edge case: Network timeout, partial save

- `saveItem(item, session)`
  - Success: Writes item + photos to IndexedDB + Supabase + Storage
  - Rollback: Photo upload fails → retry logic
  - Edge case: Storage quota exceeded (IndexedDB)

- `saveAsset(itemId, blob, type)`
  - Success: Writes to IndexedDB `assets` or `display` store
  - Cloud sync: Uploads to Supabase Storage bucket
  - Edge case: Large blob (>10MB), quota exceeded

**Critical Validation:**

- **Atomic writes:** IndexedDB transaction success/failure
- **Upload retries:** Storage upload failure handling
- **Quota handling:** Graceful degradation when storage full

**Deliverable:** `tests/services/db.operations.test.ts`

---

### 2.3 `services/db.ts` - Cleanup & Utilities

**Priority:** MEDIUM
**Complexity:** 3/5
**Dependencies:** IndexedDB
**Mocks Required:** `fake-indexeddb`

**Functions to Test:**

- `cleanupOrphanedAssets()`
  - Scenario: Item deleted but assets remain
  - Expected: Orphaned blobs removed from IndexedDB
  - Edge case: Large cleanup batch (100+ items)

**Deliverable:** `tests/services/db.cleanup.test.ts`

---

## PHASE 3: AI & HOOKS INTEGRATION (Week 3)

**Goal:** Test AI service and React hooks with realistic mocks

### 3.1 `services/geminiService.ts` - AI Analysis

**Priority:** HIGH
**Complexity:** 3/5
**Dependencies:** Fetch API, Gemini proxy server
**Mocks Required:** `vi.mock('fetch')` or MSW (Mock Service Worker)

**Functions to Test:**

- `analyzeImage(base64Image, collectionTemplate)`
  - Success: Returns structured metadata matching schema
  - Timeout: Returns null after 30s (non-blocking)
  - Error: Invalid API key, rate limit, network failure
  - Edge case: Malformed JSON response, schema mismatch

**Mock Strategy:**

```typescript
// Use MSW to mock /api/gemini/analyze endpoint
// Return pre-defined responses for different templates
```

**Critical Validation:**

- **Non-blocking failures:** UI remains functional if AI fails
- **Schema validation:** Response matches FieldDefinition[] structure
- **Timeout handling:** User can proceed without AI

**Deliverable:** `tests/services/geminiService.test.ts`

---

### 3.2 `hooks/useAuthState.ts` - Auth State Management

**Priority:** HIGH
**Complexity:** 3/5
**Dependencies:** React, Supabase client
**Mocks Required:** `@supabase/supabase-js` mock, React Testing Library

**Hook Behavior to Test:**

- Initial state: `loading: true`, `user: null`
- Auth state change: Supabase event → update state
- Sign out: Clears user state
- Edge case: Rapid sign-in/out cycles

**Setup Requirements:**

```bash
npm install --save-dev @testing-library/react @testing-library/react-hooks
```

**Deliverable:** `tests/hooks/useAuthState.test.ts`

---

### 3.3 `hooks/useCollections.ts` - Collection Management

**Priority:** HIGH
**Complexity:** 4/5
**Dependencies:** React, `services/db.ts`, `services/seedCollections.ts`
**Mocks Required:** db.ts mock, seedCollections mock

**Hook Behavior to Test:**

- `fetchCollectionsWithItems(session)`
  - Success: Fetches cloud, merges with local, seeds if needed
  - Offline: Falls back to IndexedDB cache
  - Edge case: Seed version mismatch, first-time user

**Critical Test Cases:**

```typescript
// Test Case: First-time user with auth
// Expected: Seed collections populated, profile created

// Test Case: Returning user with local data
// Expected: Cloud data merged with local, conflicts resolved

// Test Case: Offline mode
// Expected: Returns cached IndexedDB data
```

**Deliverable:** `tests/hooks/useCollections.test.ts`

---

## PHASE 4: COMPONENTS (Week 4)

**Goal:** Test critical UI flows with realistic user interactions

### 4.1 `components/AddItemModal.tsx` - Item Creation Flow

**Priority:** HIGH
**Complexity:** 5/5
**Dependencies:** React, imageProcessor, geminiService, db.ts
**Mocks Required:** All service mocks, React Testing Library

**User Flow to Test:**

1. Upload photo → imageProcessor called
2. AI analysis → geminiService called
3. User verifies/edits metadata
4. Save → db.saveItem called
5. Modal closes, item appears in collection

**Edge Cases:**

- AI timeout → manual entry allowed
- Image processing failure → show error, allow retry
- Save failure → show error, preserve form state
- Cancel mid-flow → cleanup temporary data

**Deliverable:** `tests/components/AddItemModal.test.tsx`

---

### 4.2 `components/AuthModal.tsx` - Authentication UI

**Priority:** MEDIUM
**Complexity:** 3/5
**Dependencies:** React, supabase.ts
**Mocks Required:** supabase.ts mock

**User Flow to Test:**

- Sign up: Email/password → success/error states
- Sign in: Email/password → success/error states
- Toggle between sign up/sign in modes
- Validation: Email format, password strength

**Deliverable:** `tests/components/AuthModal.test.tsx`

---

### 4.3 Other UI Components (Lower Priority)

**Priority:** LOW
**Complexity:** 2/5

**Components:**

- `CollectionCard.tsx` - Rendering, click handlers
- `ItemCard.tsx` - Rendering, rating display
- `FilterModal.tsx` - Filter logic
- `ThemePicker.tsx` - Theme switching

**Approach:** Snapshot tests + basic interaction tests

**Deliverable:** `tests/components/ui/*.test.tsx`

---

## PHASE 5: END-TO-END TESTS (Week 5)

**Goal:** Validate complete user journeys in production-like environment

### 5.1 Critical User Flows

**Priority:** HIGH
**Tool:** Playwright or Cypress
**Complexity:** 4/5

**Flows to Test:**

1. **First-Time User:**
   - Open app → see sample gallery
   - Create account → seed collections appear
   - Add first item → AI analysis → save → verify sync

2. **Returning User:**
   - Sign in → collections load from cloud
   - Edit item → verify sync status
   - Sign out → verify local data cleared

3. **Offline Mode:**
   - Disconnect network → add item
   - Reconnect → verify sync
   - Conflict resolution → cloud wins

4. **PWA Installation:**
   - Install app → works offline
   - Add to home screen → standalone mode

**Setup Requirements:**

```bash
npm install --save-dev @playwright/test
# or
npm install --save-dev cypress
```

**Deliverable:** `e2e/critical-flows.spec.ts`

---

## Infrastructure Setup

### Testing Stack (Recommended)

```json
{
  "devDependencies": {
    "vitest": "^2.0.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.5.0",
    "@testing-library/jest-dom": "^6.5.0",
    "fake-indexeddb": "^6.0.0",
    "canvas": "^2.11.0",
    "@playwright/test": "^1.40.0",
    "msw": "^2.0.0"
  }
}
```

### Configuration Files Needed

1. **`vitest.config.ts`**
   - Extend from `vite.config.ts`
   - Setup `@/` alias resolution
   - Configure `fake-indexeddb` global setup
   - Add Canvas polyfill for Node.js

2. **`tests/setup.ts`**
   - Initialize `@testing-library/jest-dom`
   - Mock `window.matchMedia` (for theme tests)
   - Setup IndexedDB polyfill
   - Mock `navigator.mediaDevices` (for audio guide)

3. **`tests/mocks/supabase.ts`**
   - Mock Supabase client
   - Mock auth methods
   - Mock Storage API

4. **`tests/mocks/gemini.ts`**
   - MSW handlers for `/api/gemini/analyze`
   - Pre-defined response fixtures

---

## Risk Matrix

| Module                        | Data Loss Risk | Security Risk | UX Blocker Risk | Testing Complexity |
| ----------------------------- | -------------- | ------------- | --------------- | ------------------ |
| `services/db.ts` (merge)      | 🔴 CRITICAL    | 🟡 MEDIUM     | 🟡 MEDIUM       | 5/5                |
| `services/imageProcessor.ts`  | 🔴 CRITICAL    | 🟢 LOW        | 🟡 MEDIUM       | 4/5                |
| `services/supabase.ts`        | 🟡 MEDIUM      | 🔴 CRITICAL   | 🔴 CRITICAL     | 3/5                |
| `services/geminiService.ts`   | 🟢 LOW         | 🟢 LOW        | 🟡 MEDIUM       | 3/5                |
| `hooks/useCollections.ts`     | 🟡 MEDIUM      | 🟢 LOW        | 🟡 MEDIUM       | 4/5                |
| `components/AddItemModal.tsx` | 🟢 LOW         | 🟢 LOW        | 🟡 MEDIUM       | 5/5                |

**Legend:**

- 🔴 CRITICAL: Must be tested before production
- 🟡 MEDIUM: Should be tested for confidence
- 🟢 LOW: Nice to have, lower priority

---

## Success Criteria (Definition of Done)

### Phase 1 Complete When:

- [ ] 100% coverage on pure functions (compareTimestamps, normalizePhotoPaths)
- [ ] Image processing validates quality preservation (visual diff tests)
- [ ] Auth functions handle all error states gracefully

### Phase 2 Complete When:

- [ ] Merge logic passes all conflict resolution scenarios
- [ ] Dual-write operations rollback correctly on failure
- [ ] No data loss in 100 randomized sync scenarios

### Phase 3 Complete When:

- [ ] AI service degrades gracefully on all failure modes
- [ ] Hooks maintain correct state through auth lifecycle
- [ ] Collection fetching handles offline/online transitions

### Phase 4 Complete When:

- [ ] AddItemModal completes flow with mocked dependencies
- [ ] Auth UI handles validation and error states
- [ ] Key components render without crashes

### Phase 5 Complete When:

- [ ] E2E tests cover 3 critical user journeys
- [ ] PWA installs and works offline
- [ ] Sync conflicts resolve correctly in real browser

---

## Open Questions

1. **Seed Data in Tests:**
   Should we use real seed collections or mock data? (Real = slower, more realistic)

2. **Image Test Fixtures:**
   Need sample images for processing tests (JPEG, PNG, HEIC, corrupt files)

3. **Supabase Local Testing:**
   Use Supabase local CLI or fully mocked? (Local = more realistic, harder setup)

4. **CI/CD Integration:**
   Run E2E tests on every commit or only pre-deploy? (Cost vs confidence trade-off)

5. **Coverage Targets:**
   What % coverage for each phase? (Recommend: 90% critical services, 70% components)

---

## Timeline Estimate

| Phase     | Duration                 | Blockers                                         |
| --------- | ------------------------ | ------------------------------------------------ |
| Phase 1   | 5 days                   | Canvas polyfill setup, learning Vitest           |
| Phase 2   | 5 days                   | IndexedDB mock complexity, Supabase mock setup   |
| Phase 3   | 4 days                   | MSW learning curve, React Testing Library        |
| Phase 4   | 5 days                   | Component mock complexity, user event simulation |
| Phase 5   | 3 days                   | Playwright setup, CI/CD integration              |
| **Total** | **22 days** (~4.5 weeks) | Assumes 1 developer, no major blockers           |

**Note:** Timeline assumes testing in parallel with feature development. If done serially, add 10% buffer for context switching.

---

## Next Steps

1. **Review this roadmap** - Validate priority order and risk assessment
2. **Setup testing infrastructure** - Install Vitest, configure mocks
3. **Create test fixtures** - Sample images, mock data, Supabase responses
4. **Start Phase 1** - Begin with pure functions (lowest risk, fastest wins)
5. **Document learnings** - Update roadmap as we discover edge cases

**Questions? Concerns?** Please review and approve before I proceed with implementation.
