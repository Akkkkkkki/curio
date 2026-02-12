## Title

AddItemModal (1,184 lines) and CreateCollectionModal (872 lines) should be split into step components

## Labels

- type:enhancement
- area:forms
- severity:p2

## Problem

Two modal components are oversized with multiple render functions that should be separate components:

**AddItemModal.tsx (1,184 lines):**

- 15 useState calls for closely-related state (lines 73-95) - should use useReducer
- 6 render functions: `renderStepper`, `renderCollectionSelect`, `renderUpload`, `renderBatchVerify`, `renderAnalyzing`, `renderVerify`
- Duplicate rating button rendering (lines 883-900 and 1098-1116)
- Duplicate error banner rendering (lines 803-809 and 1001-1015)

**CreateCollectionModal.tsx (872 lines):**

- 5 render functions: `renderEntry`, `renderLoading`, `renderFields`, `renderPreview`, `renderSuccess`
- Complex timeout/retry logic for AI suggestions (lines 175-227) mixed with UI

## Expected

- Each render function extracted to a step component (e.g., `AddItemSteps/UploadStep.tsx`)
- AddItemModal state managed via useReducer
- Shared sub-components for rating selector and error banner

## Actual

Monolithic modals with interleaved state, logic, and rendering.

## Acceptance Criteria

- [ ] AddItemModal under 300 lines (orchestration only)
- [ ] CreateCollectionModal under 200 lines (orchestration only)
- [ ] Step components independently testable
- [ ] useReducer for AddItemModal state
- [ ] Shared ErrorBanner and RatingSelector components
- [ ] All existing modal tests pass
