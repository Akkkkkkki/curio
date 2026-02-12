## Title

Hardcoded English strings in components bypass i18n system

## Labels

- type:bug
- area:i18n
- severity:p2

## Problem

Several components contain hardcoded English strings that won't be translated when the app is set to Chinese:

**EnhanceImageModal.tsx:**

- Line 180: `'Image Error'`
- Line 193: `'No Photo'`

**ExportModal.tsx:**

- Line 162: `'No Photo'`
- Line 180: `'Image Error'`
- Line 239: `'ARCHIVAL RECORD'`

**ItemImage.tsx:**

- Line 180: `'Image Error'`
- Line 193: `'No Photo'` (twice)

**AuthModal.tsx:**

- Line 234: `'Private'`
- Line 245: `'Fast'`
- Lines 236, 247: Feature descriptions

These are all user-visible strings that should use `t()` for translation.

## Expected

All user-visible strings use the `t()` translation function from `useTranslation()`.

## Actual

~12 hardcoded English strings visible to Chinese-language users.

## Acceptance Criteria

- [ ] All hardcoded strings replaced with `t()` calls
- [ ] Corresponding keys added to both `en` and `zh` translations in `i18n.ts`
- [ ] Visual verification in both language modes
