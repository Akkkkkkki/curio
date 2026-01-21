# Testing

Curio uses **Vitest** for unit/component tests and **Playwright** for end-to-end tests.

## Test philosophy (recommended)

- **Unit + component tests (`npm test`)**: fast, deterministic, and do **not** call real networks/AI.
- **E2E tests (`npm run test:e2e`)**: run the real app in a browser and validate critical user flows.
- **Live integration smoke tests (`npm run test:live`)**: hit _real_ services (Gemini proxy). These are slower,
  require credentials, and may incur API cost, so they live behind a separate command.

**Smoke test** means “high-signal, small-scope checks” (e.g. health + one real analyze request) that catch
environment/contract issues without being exhaustive.

## Running tests

```bash
# Unit + component tests (Vitest)
npm test
npm run test:watch
npm run test:coverage

# Live integration smoke tests (real network/services)
# Requires the Gemini proxy to be running and configured (see below).
npm run test:live
npm run test:live:watch

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
- **E2E tests**: `tests/e2e/`
- **Live integration smoke tests**: `tests/live/`

## E2E credentials

The authenticated flow test (`tests/e2e/authenticated-user.spec.ts`) is **skipped** unless you provide:

- `E2E_EMAIL`
- `E2E_PASSWORD`

## Live integration smoke tests (Gemini proxy)

These tests call the real Gemini proxy endpoint(s) and will fail if the proxy is not running or if the Gemini
configuration is invalid.

### Prereqs

- Start the proxy server in a separate terminal:

```bash
npm run server
```

- Ensure the proxy has a working Gemini key:
  - `GEMINI_API_KEY` must be set in the proxy environment
  - optional: `GEMINI_ANALYZE_MODEL`, `GEMINI_IMAGE_MODEL`
- Ensure the tests know where the proxy is:
  - set `LIVE_API_BASE_URL=http://localhost:8787` (or rely on the default)

## Notes

- Playwright will start (or reuse) the dev server automatically (see `playwright.config.ts`).
- Unit tests use mocked Supabase; do **not** rely on a local Supabase instance.
