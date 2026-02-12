## Title

Remove dead code: unused AppContext and stubbed connectMuseumGuide

## Labels

- type:enhancement
- severity:p3

## Problem

Two pieces of dead code exist in the codebase:

1. **`src/contexts/AppContext.tsx`** (45 lines): Defines `AppProvider` and `useAppContext` but neither is imported or used anywhere. Confirmed via grep - only referenced in its own file.

2. **`src/services/geminiService.ts` lines 193-202**: `connectMuseumGuide()` is a stub that always throws. Parameters are prefixed with `_` to suppress unused warnings. The function signature accepts `_cb: any` (type-unsafe).

```typescript
export const connectMuseumGuide = async (
  _col: UserCollection,
  _cb: any,
  _inst?: string,
): Promise<MuseumGuideSession> => {
  if (!isVoiceGuideEnabled()) throw new Error('Voice guide is disabled');
  throw new Error('Voice guide is not available in this build');
};
```

## Expected

Dead code removed. If AppContext is needed for future refactoring (issue #1), recreate it when needed rather than leaving unused code.

## Actual

Dead code present, creating confusion about intended patterns.

## Acceptance Criteria

- [ ] `src/contexts/AppContext.tsx` deleted
- [ ] `connectMuseumGuide` stub removed from `geminiService.ts`
- [ ] `MuseumGuideSession` interface removed if no longer needed
- [ ] Any imports of removed code cleaned up
- [ ] Build passes
