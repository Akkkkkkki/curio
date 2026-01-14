## Title

Support multiple photo variants per item (enhanced / background-removed) with an active display variant

## Labels

- type:enhancement
- area:sync
- severity:p2

## Problem

To keep photo editing non-destructive and trustworthy, Curio needs to store multiple photo variants and allow choosing which one is displayed/exported, while still backing up variants to cloud storage.

## Steps to Reproduce

N/A (enhancement)

## Expected

Items can store and switch between multiple variants:

- original (existing)
- display (existing)
- enhanced (new)
- no-background (new, PNG)

## Actual

Only original/display variants are supported today; no first-class model/storage for additional variants exists.

## Acceptance Criteria

- Extend the item model to track optional variant paths and an `activePhotoVariant` (or equivalent).
- Add IndexedDB storage support for new variant blobs (new stores or keyed variants).
- Add Supabase Storage paths/policies for new variants (e.g. `_enhanced.jpg`, `_nobg.png`).
- Ensure export/view uses the active variant (fallback to display/original).
- Add migration/backwards compatibility strategy for existing items.

## Notes (optional)

- Source: `docs/DESIGN_REVIEW_image_enhancement_and_theme_strategy.md` (Data model + storage structure section).
