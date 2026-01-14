## Title

Add optional field-level hints for templates (show inline help in Add Item and Item Detail)

## Labels

- type:ux
- area:forms
- severity:p3

## Problem

Some template fields are not self-explanatory (especially for new collectors). We currently have template-level descriptions, but no per-field helper text. Inline hints can improve completion quality without adding clutter if implemented subtly.

## Steps to Reproduce

1. Create a collection using any template.
2. Add an item and review the extracted fields.
3. Notice there is no inline guidance for what to enter in each field.

## Expected

Templates can optionally provide short field hints (1 line), and the UI can display them under the label (or as a subtle “?” tooltip) in:

- Add Item verify flow
- Item Detail edit view

## Actual

`FieldDefinition` has no hint/help metadata, so the UI can’t display per-field guidance.

## Acceptance Criteria

- Extend `FieldDefinition` with an optional `hint` (or `helpText`) field.
- Update templates to include a few high-value hints (keep it minimal).
- Render hints in Add Item and Item Detail in a subtle, theme-aware way.
- Ensure i18n works (either translate hints, or constrain to short English-only hints with a clear plan).

## Notes (optional)

- Source: `docs/MVP_CHECKLIST.md` (P2 inline field hints).
