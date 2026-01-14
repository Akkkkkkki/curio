## Title

Document and surface an admin-only guide for updating the public sample gallery

## Labels

- type:enhancement
- area:auth
- severity:p3

## Problem

Admins need a lightweight, repeatable way to update the curated public sample gallery without guessing the workflow. Right now, the “how to update sample content” process isn’t clearly documented or discoverable in-product.

## Steps to Reproduce

N/A (enhancement)

## Expected

- A short admin guide exists in the repo (e.g. `ADMIN_NOTES.md` or `README.md` section) describing how to update sample collections/items safely.
- If the user is an admin, the app provides a small link/entry point to that guide (or inline checklist) near the access gate/sample entry.

## Actual

No clear admin-facing sample update guide is documented/discoverable.

## Acceptance Criteria

- Add a concise admin guide documenting:
  - where sample data is defined/seeded
  - how to update images/metadata
  - how to validate read-only behavior for non-admins
  - how to ship updates safely
- Add an admin-only UI link to the guide (or a minimal in-app note) when `isAdmin` is true.

## Notes (optional)

- Source: `docs/MVP_CHECKLIST.md` (P2 “public sample update guide for admins”).
