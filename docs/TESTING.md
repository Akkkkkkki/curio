# Testing

This document is the source of truth for how Curio is tested. Keep it high-signal and current. Avoid putting point-in-time pass counts here because they go stale quickly.

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
npm run test:ui

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
  - PWA cache strategy checks: `tests/unit/pwaCaching.test.ts`
- **E2E tests**: `tests/e2e/`
- **Live integration smoke tests**: `tests/live/`

## Test infrastructure

- Global setup: `tests/setup.ts`
- Shared render helpers: `tests/utils/test-utils.tsx`
- Supabase and Gemini mocks: `tests/mocks/`
- Browser/API fakes: `fake-indexeddb`, `msw`, `happy-dom`, `canvas`

## Writing tests

- Prefer unit and component tests for deterministic behavior.
- Use E2E tests for critical user flows and regressions that depend on routing, browser behavior, or multiple layers working together.
- Keep live integration tests narrow and explicit about external cost.
- When behavior depends on sync or offline recovery, test both the immediate local result and the later cloud outcome.

## E2E credentials

The authenticated flow test (`tests/e2e/authenticated-user.spec.ts`) is **skipped** unless you provide:

- `E2E_EMAIL`
- `E2E_PASSWORD`

> **Note:** These should be credentials for a test account in the target environment. Do not commit real credentials to the repository.

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

- CI includes a **Prettier format check** (`npm run format:check`). Before pushing a PR, run:
  - `npm run format` (fixes formatting)
  - `npm run format:check` (verifies formatting)

- Playwright will start (or reuse) the dev server automatically (see `playwright.config.ts`).
- Unit tests use mocked Supabase; do **not** rely on a local Supabase instance.
- `tests/README.md` is intentionally short and points back here to avoid duplicate guidance.
