## Title

73 console.log/warn/error statements in production code need structured logging

## Labels

- type:enhancement
- severity:p3

## Problem

There are 73 `console.log`, `console.warn`, and `console.error` statements across 15 source files. Top offenders:

- `db.ts`: 24 statements
- `App.tsx`: 17 statements
- `AddItemModal.tsx`: 8 statements
- `geminiService.ts`: 4 statements

Additionally, `ExportModal.tsx` lines 97-109 contains an explicit debug `console.log` inside a `setTimeout` that was left in production code:

```typescript
console.log('Modal position check:', {
  x: rect.x,
  y: rect.y,
  width: rect.width,
  height: rect.height,
});
```

## Expected

- Debug `console.log` statements removed entirely
- `console.warn` and `console.error` replaced with a lightweight logger utility that:
  - Can be silenced in production
  - Includes operation context (sync, auth, AI, etc.)
  - Could be connected to error tracking (Sentry, etc.) in the future

## Actual

Raw console statements that pollute browser console in production and leak implementation details.

## Acceptance Criteria

- [ ] Debug `console.log` statements removed (especially ExportModal line 97-109)
- [ ] Remaining warn/error statements use consistent format or a logger utility
- [ ] No user-visible behavior changes
