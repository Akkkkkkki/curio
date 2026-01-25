## Mandatory before finishing any change

1. Run: `npm run format:write` (or `npm run format`)
2. Run: `npm run format:check` (must pass)
3. Run: `npm test` (must pass)
4. Run: `npm run build` (must pass)
5. Run: `npm run test:e2e` (must pass; first-time setup may require `npx playwright install chromium`)
6. Ensure: `git diff` and `git status --porcelain` are clean (no formatting leftovers / untracked artifacts)

If you cannot run commands, you MUST:

- keep existing code style consistent
- avoid reflowing long lines manually
- do not change whitespace-only unless necessary
