## Title

Add “Remove Background” and “Fix Blur” actions in photo review (optional, recoverable AI)

## Labels

- type:enhancement
- area:forms
- severity:p2

## Problem

After capture, users often want quick outcomes like isolating an object for a clean catalog look (background removal) or improving a slightly blurry photo. These tools should feel optional and “invisible AI”, and must never block completing an item.

## Steps to Reproduce

N/A (enhancement)

## Expected

In the photo review/verify step, users can optionally run:

- **Remove Background**
- **Fix Blur**

They can preview results and choose which variant to keep, or revert to original.

## Actual

No UI actions exist for these tools.

## Acceptance Criteria

- Add “Remove Background” and “Fix Blur” buttons in `components/AddItemModal.tsx` (verify step).
- Use a universal prompt approach (no prompt engineering UI).
- Show progress state and allow cancel/back without losing the item draft.
- Results are previewable with clear CTAs: “Use Result” / “Keep Original”.
- Failures show a friendly message and return user to manual flow; no hard blockers.
- Ensure variants persist (at least locally) once selected.

## Notes (optional)

- Depends on: `/api/gemini/edit-image` proxy endpoint.
- Source: `docs/DESIGN_REVIEW_image_enhancement_and_theme_strategy.md` (Phase 2).
