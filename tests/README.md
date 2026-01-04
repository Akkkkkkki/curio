# Curio Testing Infrastructure

This directory contains the complete testing infrastructure for Curio, following the phased approach outlined in `TESTING_ROADMAP.md`.

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
├── unit/                         # Unit-level tests (pure/isolated)
│   └── services/                # Phase 1 - Pure/isolated service tests
├── services/                     # Integration-level service tests (IndexedDB/Supabase/etc.)
├── hooks/                        # Phase 3 - React hooks tests
├── components/                   # Phase 4 - Component tests
└── e2e/                         # Phase 5 - End-to-end tests
```

## Test Phases

### ✅ Infrastructure (Complete)

All testing infrastructure is ready:

- [x] Vitest configuration with coverage thresholds
- [x] Browser API mocks (matchMedia, mediaDevices, IntersectionObserver, etc.)
- [x] IndexedDB mock (fake-indexeddb)
- [x] Canvas utilities (for Phase 1 image tests)
- [x] MSW handlers for API mocking
- [x] Test utilities and fixtures
- [x] Smoke tests passing (19 passed, 2 skipped)

### 📋 Phase 1: Critical Services - Pure Functions (Next)

**Ready to implement:**

- `tests/unit/services/db.pure.test.ts` - compareTimestamps, normalizePhotoPaths
- `tests/unit/services/imageProcessor.test.ts` - Image processing validation
- `tests/unit/services/supabase.test.ts` - Auth function tests

### 📋 Phase 2: Critical Services - Integration

**Dependencies ready:**

- fake-indexeddb configured
- Supabase mocks available
- Storage mocks ready

**Tests to write:**

- `tests/services/db.merge.test.ts` - Merge logic scenarios
- `tests/services/db.operations.test.ts` - Dual-write operations
- `tests/services/db.cleanup.test.ts` - Cleanup utilities

### 📋 Phase 3: AI & Hooks Integration

**Dependencies ready:**

- MSW handlers configured
- React Testing Library installed

**Tests to write:**

- `tests/services/geminiService.test.ts` - AI analysis with mocked responses
- `tests/hooks/useAuthState.test.ts` - Auth state management
- `tests/hooks/useCollections.test.ts` - Collection management

### 📋 Phase 4: Components

**Dependencies ready:**

- Custom render utility with providers
- All service mocks available

**Tests to write:**

- `tests/components/AddItemModal.test.tsx` - Item creation flow
- `tests/components/AuthModal.test.tsx` - Authentication UI
- `tests/components/ui/*.test.tsx` - Other UI components

### 📋 Phase 5: End-to-End Tests

**TODO:** Install Playwright or Cypress for E2E testing

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

### Canvas Testing

```typescript
import { setupCanvasMocks, createMockImageFile } from '@/tests/utils/canvas-mock';

beforeEach(() => {
  setupCanvasMocks();
});

test('image processing', async () => {
  const file = createMockImageFile('test.jpg', 'image/jpeg', 1024 * 100);
  // Test your image processing logic
});
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

happy-dom doesn't fully support Canvas 2D context. For image processing tests in Phase 1:

1. Import the real `canvas` package for Node.js
2. Use canvas-specific test utilities in `tests/utils/canvas-mock.ts`
3. Tests that need real Canvas rendering should use the canvas package directly

### MSW with Supabase

MSW handlers are stubs. Expand them in Phase 2/3 as needed:

- Add realistic error responses
- Implement RLS policy simulation
- Add request validation

### IndexedDB + Parallel Test Execution

`services/db.ts` uses a fixed IndexedDB database name (`CurioDatabase`). Running IndexedDB-heavy integration suites in parallel can cause open/delete blocking.
For determinism, the test runner is configured to run with a single worker.

## Next Steps

1. ✅ Complete infrastructure setup
2. 🔄 Implement Phase 1 tests (pure functions)
3. ⏭️ Implement Phase 2 tests (integration)
4. ⏭️ Implement Phase 3 tests (AI & hooks)
5. ⏭️ Implement Phase 4 tests (components)
6. ⏭️ Implement Phase 5 tests (E2E with Playwright)

See `TESTING_ROADMAP.md` for detailed test specifications and success criteria.
