## Mandatory before finishing any change

1. Run: `npm run format:write` (or `npm run format`)
2. Run: `npm run format:check` (must pass)
3. Ensure: `git diff` is clean (no formatting leftovers)

If you cannot run commands, you MUST:

- keep existing code style consistent
- avoid reflowing long lines manually
- do not change whitespace-only unless necessary
