# Testing

Curio uses **Vitest** for unit/component tests and **Playwright** for end-to-end tests.

## Running tests

```bash
# Unit + component tests (Vitest)
npm test
npm run test:watch
npm run test:coverage

# E2E tests (Playwright)
npm run test:e2e
npm run test:e2e:ui
npm run test:e2e:headed
npm run test:e2e:debug
```

## Test suites

- **Unit/component tests**: `tests/`
  - Mocks: `tests/mocks/`
  - Utilities/fixtures: `tests/utils/`
- **E2E tests**: `e2e/`

## E2E credentials

The authenticated flow test (`e2e/authenticated-user.spec.ts`) is **skipped** unless you provide:

- `E2E_EMAIL`
- `E2E_PASSWORD`

## Notes

- Playwright will start (or reuse) the dev server automatically (see `playwright.config.ts`).
- Unit tests use mocked Supabase; do **not** rely on a local Supabase instance.
