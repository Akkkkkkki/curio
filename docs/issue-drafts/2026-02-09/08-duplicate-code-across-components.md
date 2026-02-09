## Title

Duplicate utility logic across components should be extracted to shared modules

## Labels

- type:enhancement
- severity:p2

## Problem

Several pieces of logic are copy-pasted across multiple components:

### 1. Field label translation (3 copies)

Identical `getFieldLabel()` function in:

- `AddItemModal.tsx` lines 113-117
- `ItemCard.tsx` lines 75-83
- `CollectionCard.tsx` lines 50-54
- `App.tsx` (CollectionScreen) lines 1011-1018

### 2. Focus trap logic (2 copies)

Identical keyboard trap implementation in:

- `AddItemModal.tsx` lines 166-228
- `AuthModal.tsx` lines 42-103

### 3. Theme class setup (5+ copies)

Identical theme-to-class mapping boilerplate in:

- `AddItemModal.tsx` lines 97-104
- `CreateCollectionModal.tsx` lines 103-110
- `AuthModal.tsx` lines 26-33
- `Layout.tsx` lines 96-112
- `EnhanceImageModal.tsx` lines 250-284

### 4. getValue / field display (3 copies)

Similar field value extraction in:

- `ItemCard.tsx` lines 65-73
- `ExportModal.tsx` lines 113-116
- `App.tsx` (ItemDetailScreen)

## Expected

- `getFieldLabel()` extracted to `src/utils/fieldUtils.ts`
- Focus trap extracted to `src/hooks/useFocusTrap.ts`
- Theme class setup extracted to `src/hooks/useComponentStyles.ts` or consolidated in `theme.tsx`
- Field value formatting extracted to `src/utils/itemUtils.ts`

## Actual

Copy-pasted logic that must be updated in multiple places when behavior changes.

## Acceptance Criteria

- [ ] Each duplicated pattern consolidated to a single shared module
- [ ] All consuming components updated to use shared module
- [ ] No behavioral changes
- [ ] Tests added for extracted utilities
