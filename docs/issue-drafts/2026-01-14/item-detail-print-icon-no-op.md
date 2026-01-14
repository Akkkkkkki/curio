## Title

Item detail “Print” (printer icon) does nothing (Export/Preview modal never opens)

## Labels

- type:bug
- area:forms
- severity:p2

## Problem

On the item detail page, clicking the **printer icon** (top-right) is expected to open the export/preview experience (“Export Card”), where the user can preview, configure, and print/share/export.

Instead, the click appears to be a **no-op**: no modal opens, no navigation happens, and no error is surfaced to the user.

This breaks a visible affordance on every item detail page and reduces trust (“is the app responding?”).

## Steps to Reproduce

1. Open any collection.
2. Click into an item to open the item detail page.
3. Click the **printer icon** in the top-right of the hero image.

## Expected

An export/preview modal opens (Export Card) allowing:

- preview of the card
- configuration (style/aspect ratio/image fit)
- print/share/export actions

## Actual

Nothing happens (no modal, no UI change, no message).

## Acceptance Criteria

- Clicking the printer icon reliably opens the Export modal on desktop and mobile.
- Add a stable selector + accessibility label for the button (e.g. `aria-label={t('exportCard')}` and/or `data-testid="item-export"`).
- Add E2E coverage that:
  - opens an item detail
  - clicks the printer icon
  - asserts the export modal title “Export Card” is visible
- If the export feature is intentionally disabled in some environments, show clear UX (disabled state + tooltip/message).

## Notes (optional)

- Code location: `App.tsx` item detail export button (`setIsExportOpen(true)`) and `components/ExportModal.tsx`.
- Investigation notes (2026-01-14):
  - Verified that export modal opens correctly in local dev and in `curio-bay.vercel.app` for sample item `seed-vinyl-1`.
  - `curio-app.vercel.app` returned “500: INTERNAL_SERVER_ERROR” at time of testing, so production behavior couldn’t be confirmed from that endpoint.
