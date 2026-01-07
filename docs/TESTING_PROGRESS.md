# Testing Progress - Curio

**Last updated:** 2026-01-07

This checklist tracks test coverage implementation progress against `docs/TESTING_ROADMAP.md`.

## Summary

- **Phase 1-3:** Complete and passing (179 tests)
- **Phase 4:** Complete and passing (200 tests) - Component tests with multi-theme coverage
- **Phase 5:** Implemented (E2E tests with Playwright)
- **Test Status:** 379 unit/component tests passed, 2 skipped (unimplemented features), 2 todo

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

## Phase 4: Components (Complete)

- [x] **4.1 `components/AddItemModal.tsx` — Item Creation Flow** (`tests/components/AddItemModal.test.tsx`)
  - 31 tests covering:
    - Modal display and close functionality
    - Step navigation (single/multiple collections)
    - Upload step with camera, upload, and batch mode options
    - AI analysis flow with graceful degradation
    - AI failure handling (product requirement: recoverable AI)
    - Verify step with form editing and rating
    - Save flow with validation
    - Batch mode functionality
    - Theme support (gallery, vault, atelier)
    - Modal state reset and accessibility

- [x] **4.2 `components/AuthModal.tsx` — Authentication UI** (`tests/components/AuthModal.test.tsx`)
  - 28 tests covering:
    - Modal display and close functionality
    - Supabase not configured state
    - Sign in mode with form validation
    - Sign up mode with mode toggling
    - Form validation (required fields, types)
    - Loading state during authentication
    - Cloud sync information display
    - Theme support
    - Accessibility (form structure, labels)

- [x] **4.3 Other UI Components** (`tests/components/ui/Button.test.tsx`)
  - 25 tests covering:
    - Basic rendering
    - Variants (primary, secondary, outline, ghost)
    - Sizes (sm, md, lg)
    - Icon support
    - Disabled state
    - Click handling
    - Custom className
    - HTML attributes
    - Base styles (focus, border radius, flexbox)
    - Accessibility (focusable, keyboard activation)

- [x] **4.4 `components/ItemCard.tsx` — Item Display** (`tests/components/ItemCard.test.tsx`)
  - 36 tests covering:
    - Basic rendering (title, data-testid, image)
    - Rating display (0-5 stars)
    - Display fields with labels and values
    - Badge fields rendering
    - Click handling (mouse and keyboard)
    - Accessibility (role, tabIndex, focus)
    - Layout modes (grid, masonry)
    - Multi-theme support (gallery/vault/atelier with describe.each)
    - Edge cases (empty fields, missing data, long titles)

- [x] **4.5 `components/CollectionCard.tsx` — Collection Preview** (`tests/components/CollectionCard.test.tsx`)
  - 35 tests covering:
    - Basic rendering (name, icon, description)
    - Item count display (singular/plural)
    - Sample/public collection read-only indicator
    - Click handling (mouse and keyboard)
    - Accessibility (role, tabIndex, focus)
    - Multi-theme support (gallery/vault/atelier with describe.each)
    - Template accent colors (orange, indigo, stone)
    - Edge cases (long names, missing items, undefined icon)
    - Visual elements (chevron, cursor-pointer)

- [x] **4.6 `components/Layout.tsx` — App Shell** (`tests/components/Layout.test.tsx`)
  - 45 tests covering:
    - Basic rendering (children, title, logo, header extras)
    - Profile dropdown (open/close, ThemePicker)
    - Authentication status (not configured, signed out, signed in)
    - Sign in/out flows (button clicks, dropdown close)
    - Local import feature (display, import action, importing state)
    - Bottom navigation (home link, explore link/button)
    - Multi-theme support (gallery/vault/atelier with describe.each)
    - Accessibility (aria-labels, sticky header)
    - Edge cases (undefined callbacks, null props)

## Phase 5: End-to-End Tests (Implemented)

- [x] **5.1 First-Time User Flow** (`e2e/first-time-user.spec.ts`)
  - Tests covering:
    - Home screen initial load
    - Sample collection exploration (delight before auth)
    - Read-only sample collection experience
    - Authentication prompts when needed
    - Theme and language switching
    - Navigation and routing (hash-based SPA)

- [x] **5.2 Authenticated User Flow** (`e2e/authenticated-user.spec.ts`)
  - Tests covering:
    - Collection management
    - Item management and navigation
    - Add item flow with AI recovery option
    - Sync status visibility
    - Search and filter functionality
    - Exhibition mode

- [x] **5.3 Accessibility** (`e2e/accessibility.spec.ts`)
  - Tests covering:
    - Keyboard navigation
    - Focus trapping in modals
    - Escape key to close modals
    - ARIA and semantic HTML
    - Descriptive button labels
    - Proper form labels
    - Focus indicators
    - Image alt text
    - Mobile viewport usability
    - Touch-friendly tap targets
    - Theme accessibility

## Running Tests

```bash
# Unit and component tests (Vitest)
npm test                    # Run all tests
npm run test:watch          # Watch mode
npm run test:coverage       # Coverage report

# E2E tests (Playwright)
npm run test:e2e            # Run E2E tests
npm run test:e2e:ui         # Run with Playwright UI
npm run test:e2e:headed     # Run with browser visible
npm run test:e2e:debug      # Debug mode
```

## Known Issues & Future Work

1. **saveItem function**: Not yet implemented in db.ts (tracked as todo test)
2. **Upload retry logic**: Not yet implemented for saveAsset (tracked as todo test)
3. **E2E tests require running app**: E2E tests need `npm run dev` server running
4. **Supabase integration**: Authenticated E2E tests require real credentials (`E2E_EMAIL`, `E2E_PASSWORD`) and are skipped if not provided
5. **Theme persistence**: Component tests use a centralized configurable theme mock via `setMockTheme()`/`createThemeMock()` in `tests/utils/test-utils.tsx`; persistence to IndexedDB is not covered by unit/component tests

## Theme Testing Pattern

Components that use the theme hook should use the centralized mock pattern:

```typescript
// In test file
import { setMockTheme, createThemeMock } from '../utils/test-utils';

vi.mock('@/theme', async () => {
  const { createThemeMock } = await import('../utils/test-utils');
  return createThemeMock();
});

// In test suite
describe('Component', () => {
  beforeEach(() => {
    setMockTheme('gallery'); // Reset to default
  });

  describe.each([
    { theme: 'gallery' as const, bgPattern: /bg-white/ },
    { theme: 'vault' as const, bgPattern: /bg-stone-950/ },
    { theme: 'atelier' as const, bgPattern: /bg-\[#f8f6f1\]/ },
  ])('Theme: $theme', ({ theme, bgPattern }) => {
    beforeEach(() => setMockTheme(theme));
    // Theme-specific tests...
  });
});
```
