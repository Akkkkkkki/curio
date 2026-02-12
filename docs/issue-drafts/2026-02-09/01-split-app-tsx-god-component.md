## Title

App.tsx is a 2,289-line god component that should be split into focused modules

## Labels

- type:enhancement
- area:forms
- severity:p1

## Problem

`src/App.tsx` contains 2,289 lines with 30+ useState calls, 15+ useEffect hooks, and two ~490-line screen components (`CollectionScreen`, `ItemDetailScreen`) defined as nested functions. This makes the file nearly impossible to test in isolation, difficult to navigate, and creates a massive closure that prevents code-splitting or lazy-loading of routes.

Key indicators:

- Lines 121-163: 30+ individual useState declarations covering auth, sync, modals, conflicts, and UI state
- Lines 937-1423: `CollectionScreen` as a nested function (487 lines)
- Lines 1425-1913: `ItemDetailScreen` as a nested function (489 lines)
- Lines 748-787: Business logic (field ID building) mixed with UI code
- Lines 1461-1490: Undo/redo history management embedded in component

## Expected

- `CollectionScreen` and `ItemDetailScreen` are standalone files in `src/components/`
- App state is organized into focused custom hooks (`useSyncState`, `useModalState`, `useConflictState`)
- Business logic extracted to utility functions or custom hooks
- App.tsx is under 500 lines, focused on routing and composition

## Actual

Single 2,289-line file that is the root cause of most maintainability issues in the codebase.

## Acceptance Criteria

- [ ] `CollectionScreen` extracted to `src/components/CollectionScreen.tsx`
- [ ] `ItemDetailScreen` extracted to `src/components/ItemDetailScreen.tsx`
- [ ] State grouped into custom hooks (sync state, modal state, conflict state)
- [ ] Business logic (field building, undo/redo) extracted to utils/hooks
- [ ] App.tsx is under 500 lines
- [ ] All existing tests pass
- [ ] No functional regressions

## Notes

The existing `src/contexts/AppContext.tsx` was designed for this purpose but is completely unused (dead code). It could serve as a starting point for the context-based state sharing needed after extraction.
