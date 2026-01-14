## Title

Add a one-tap client-side “Enhance” photo tool in Add Item flow (before/after preview, non-destructive)

## Labels

- type:enhancement
- area:forms
- severity:p2

## Problem

Many capture photos are slightly dull/underexposed. Users want a quick improvement without becoming photo editors. We already have a guided capture flow; adding a single outcome-based enhancement (“Enhance”) can improve perceived quality and delight without adding complexity.

## Steps to Reproduce

N/A (enhancement)

## Expected

Users can tap **Enhance** during photo review to see a before/after comparison and choose which version to keep.

## Actual

No photo enhancement tools exist in the capture/review flow.

## Acceptance Criteria

- Add a new client-side enhancer (e.g. `services/imageEnhancer.ts`) implementing lightweight adjustments (contrast/vibrance/sharpen/WB) with fast performance.
- Add an **Enhance** action in `components/AddItemModal.tsx` during the review/verify step.
- Show a simple before/after preview with clear CTAs: “Use Enhanced” / “Keep Original”.
- Non-destructive: original always remains available.
- Store the chosen variant so it persists across app restarts (local cache at minimum).
- Keep time-to-first-item under 5 minutes; enhancement must be optional and not block save.

## Notes (optional)

- Source: `docs/DESIGN_REVIEW_image_enhancement_and_theme_strategy.md` (Phase 1).
