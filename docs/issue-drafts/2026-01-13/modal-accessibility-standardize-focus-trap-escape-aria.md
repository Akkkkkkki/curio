## Title

Standardize modal accessibility across remaining modals (Escape, focus trap, aria labels, dialog semantics)

## Labels

- type:ux
- area:forms
- severity:p2

## Problem

Some modals implement good accessibility patterns (Escape-to-close, focus trap, focus restore, `role="dialog"`, `aria-modal`, close button `aria-label`). Others still miss parts of this, causing keyboard navigation issues and inconsistent UX.

## Steps to Reproduce

1. Open a modal that lacks focus trapping.
2. Press Tab repeatedly and observe focus escaping behind the modal.
3. Press Escape and observe inconsistent close behavior.

## Expected

All modals follow a consistent baseline:

- Escape closes (unless explicitly unsafe)
- Focus is trapped within the modal
- Focus restores to the previous element on close
- Dialog semantics are present (`role="dialog"`, `aria-modal`, `aria-labelledby`)
- Icon-only buttons have `aria-label`

## Actual

Accessibility patterns are inconsistently implemented across modal components.

## Acceptance Criteria

- Audit all modal components and bring them to the same baseline behavior.
- At minimum, address gaps in:
  - `components/FilterModal.tsx`
  - `components/ExportModal.tsx`
  - `components/CreateCollectionModal.tsx` (if missing focus trap/escape semantics)
- Add tests (or e2e coverage) verifying Escape closes and focus remains within the dialog.

## Notes (optional)

- Source: `docs/MVP_CHECKLIST.md` (P2 accessibility polish).
