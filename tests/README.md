# Curio Testing Directory

The canonical testing guide lives in [`docs/TESTING.md`](../docs/TESTING.md).

Use this file only for details that are specific to the `tests/` directory layout or helpers.

## Local layout

- `setup.ts`: global test setup and browser API mocks
- `smoke.test.ts`: infrastructure sanity check
- `mocks/`: Supabase, Gemini, and request handlers
- `utils/`: shared render helpers, fixtures, and canvas helpers
- `unit/`, `services/`, `hooks/`, `components/`, `e2e/`, `live/`: test suites by scope

## Notes

- Keep status counts and phase-complete checklists out of this file. They drift quickly.
- If you add a new major test command or environment prerequisite, update `docs/TESTING.md`.
