## Title

Add a “Getting Started” guide card on empty Home screen (create / sample / import)

## Labels

- type:ux
- area:auth
- severity:p2

## Problem

We have a strong first-run access gate CTA set, but once a user gets to Home with no personal collections, we should provide a lightweight “Getting Started” guide card to reduce confusion and offer clear next actions.

## Steps to Reproduce

1. Run Curio with no user-created collections (fresh account or cleared state).
2. Navigate to Home.

## Expected

Home shows a small “Getting Started” card with 2–3 clear actions:

- Create/add first item
- Explore sample
- Import local data (if available)

## Actual

No dedicated “Getting Started” guide card exists on the empty Home state.

## Acceptance Criteria

- When the user has no editable collections, show a compact guide card on Home.
- Keep the “single-path first run” constraint: one primary action, one secondary action, optional tertiary link.
- Copy is short and value-focused; uses existing translations or adds new ones (EN + ZH).
- Add a simple test (unit or e2e) verifying the card appears only in empty state.

## Notes (optional)

- Source: `docs/MVP_CHECKLIST.md` (P2 first-run empty state guide).
