# Curio Testing Infrastructure

This directory contains the complete testing infrastructure for Curio, following the phased approach outlined in `docs/TESTING_ROADMAP.md`.

## Quick Start

```bash
# Run tests once
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

## Current Status

**Phase 1-3 Complete:** 179 tests passing, 2 skipped, 2 todo

| Phase                   | Status         | Tests     |
| ----------------------- | -------------- | --------- |
| Phase 1: Pure Functions | ✅ Complete    | 120 tests |
| Phase 2: Integration    | ✅ Complete    | 21 tests  |
| Phase 3: AI & Hooks     | ✅ Complete    | 19 tests  |
| Phase 4: Components     | 📋 Not Started | -         |
| Phase 5: E2E            | 📋 Not Started | -         |

## Infrastructure Setup ✅

### Dependencies Installed

- **Vitest 4.x** - Fast unit test framework
- **@testing-library/react 16.x** - React component testing utilities
- **@testing-library/user-event 14.x** - User interaction simulation
- **@testing-library/jest-dom 6.x** - Custom matchers for DOM testing
- **fake-indexeddb 6.x** - IndexedDB mock for database tests
- **canvas 3.x** - Canvas API for image processing tests
- **msw 2.x** - Mock Service Worker for API mocking
- **happy-dom 20.x** - Lightweight DOM implementation

### Configuration

- **vitest.config.ts** - Vitest configuration with coverage thresholds
  - Services: 90% coverage target
  - Hooks: 80% coverage target
  - Components: 70% coverage target

### Directory Structure

```
tests/
├── setup.ts                      # Global test setup and browser API mocks
├── smoke.test.ts                 # Infrastructure validation tests
├── mocks/
│   ├── handlers.ts              # MSW request handlers (Gemini + Supabase)
│   ├── supabase.ts              # Supabase client mocks
│   └── gemini.ts                # Gemini AI response fixtures
├── utils/
│   ├── test-utils.tsx           # Custom render with providers
│   ├── canvas-mock.ts           # Canvas API utilities
│   └── fixtures/
│       └── collections.ts       # Mock collections and items
├── unit/                         # Phase 1 - Pure function tests
│   └── services/
│       ├── db.pure.test.ts      # compareTimestamps, normalizePhotoPaths
│       ├── imageProcessor.test.ts # Image processing
│       └── supabase.test.ts     # Auth functions
├── services/                     # Phase 2 - Integration tests
│   ├── db.merge.test.ts         # Merge logic
│   ├── db.operations.test.ts    # Dual-write operations
│   ├── db.cleanup.test.ts       # Cleanup utilities
│   └── geminiService.test.ts    # AI analysis
├── hooks/                        # Phase 3 - React hooks tests
│   ├── useAuthState.test.ts     # Auth state management
│   └── useCollections.test.ts   # Collection management
├── components/                   # Phase 4 - Component tests (not started)
└── e2e/                         # Phase 5 - E2E tests (not started)
```

## Test Phases

### ✅ Phase 1: Critical Services - Pure Functions (Complete)

- `tests/unit/services/db.pure.test.ts` - 57 tests
  - compareTimestamps, normalizePhotoPaths, extractCurioAssetPath
- `tests/unit/services/imageProcessor.test.ts` - 50 tests
  - Quality preservation, downsampling, format conversion
- `tests/unit/services/supabase.test.ts` - 13 tests
  - signUpWithEmail, signInWithEmail, signOutUser

### ✅ Phase 2: Critical Services - Integration (Complete)

- `tests/services/db.merge.test.ts` - 13 tests
  - mergeCollections, mergeItems, conflict resolution
- `tests/services/db.operations.test.ts` - 4 tests + 2 todo
  - saveCollection, saveAsset, dual-write operations
- `tests/services/db.cleanup.test.ts` - 4 tests
  - cleanupOrphanedAssets, batch cleanup

### ✅ Phase 3: AI & Hooks Integration (Complete)

- `tests/services/geminiService.test.ts` - 9 tests
  - analyzeImage, error handling, timeout
- `tests/hooks/useAuthState.test.ts` - 4 tests
  - Initial state, auth state changes, admin status
- `tests/hooks/useCollections.test.ts` - 6 tests
  - Offline fallback, cloud sync, admin seeding

### 📋 Phase 4: Components (Not Started)

- `tests/components/AddItemModal.test.tsx` - Item creation flow
- `tests/components/AuthModal.test.tsx` - Authentication UI
- `tests/components/ui/*.test.tsx` - Other UI components

### 📋 Phase 5: End-to-End Tests (Not Started)

- Install Playwright or Cypress
- `tests/e2e/critical-flows.spec.ts` - Critical user flows

## Writing Tests

### Using Test Utilities

```typescript
import { render, screen } from '@/tests/utils/test-utils';
import { createMockCollection, createMockItem } from '@/tests/utils/fixtures/collections';

test('example component test', () => {
  const collection = createMockCollection({ name: 'My Collection' });
  render(<MyComponent collection={collection} />);
  expect(screen.getByText('My Collection')).toBeInTheDocument();
});
```

### Using Mocks

```typescript
import { mockSupabaseClient, resetSupabaseMocks } from '@/tests/mocks/supabase';
import { setupServer } from 'msw/node';
import { handlers } from '@/tests/mocks/handlers';

const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  resetSupabaseMocks();
});
afterAll(() => server.close());
```

## Environment Variables

Test environment variables are configured in `tests/setup.ts`:

```typescript
process.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY = 'test-key';
process.env.VITE_AI_ENABLED = 'true';
process.env.VITE_API_BASE_URL = 'http://localhost:8787';
```

## Coverage Thresholds

| Area        | Lines | Functions | Branches | Statements |
| ----------- | ----- | --------- | -------- | ---------- |
| services/   | 90%   | 90%       | 90%      | 90%        |
| hooks/      | 80%   | 80%       | 80%      | 80%        |
| components/ | 70%   | 70%       | 70%      | 70%        |

## Known Limitations

### Canvas API

happy-dom doesn't fully support Canvas 2D context. For image processing tests:

- Tests use mocked processImage behavior
- Logic tests validate dimension calculation and quality settings directly

### IndexedDB + Parallel Test Execution

`services/db.ts` uses a fixed IndexedDB database name (`CurioDatabase`). Integration tests use per-file unique DB names to avoid blocking.

## Future Work

1. **saveItem function**: Not yet implemented in db.ts (tracked as todo test)
2. **Upload retry logic**: Not yet implemented for saveAsset (tracked as todo test)
3. **Graceful AI degradation**: geminiService throws errors instead of returning null on failure
4. **Component tests**: Phase 4 not started
5. **E2E tests**: Phase 5 not started

See `docs/TESTING_PROGRESS.md` for detailed progress tracking.
