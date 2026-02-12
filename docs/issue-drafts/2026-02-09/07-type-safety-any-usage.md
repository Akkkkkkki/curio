## Title

20 occurrences of `as any` in production code weaken type safety

## Labels

- type:enhancement
- severity:p2

## Problem

There are 20 `as any` casts across 10 source files that bypass TypeScript's type checking. Key offenders:

1. **`src/services/db.ts` line 1016:** `mapCloudCollections(cols: any[], items: any[])` - Entire cloud data mapping is untyped
2. **`src/services/db.ts` line 545:** `(navigator as any)?.locks` - Web Locks API not typed
3. **`src/services/geminiService.ts` line 194:** `_cb: any` - Museum guide callback untyped
4. **`src/types.ts` line 38:** `CollectionItem.data: Record<string, any>` - Core data model untyped
5. **`src/i18n.ts` line 769:** `(translations[language] as any)[key]` - Translation lookup untyped
6. **`src/components/ThemePicker.tsx`:** 6 occurrences of `as any`

The `Record<string, any>` on `CollectionItem.data` is especially impactful since it's the core data type flowing through the entire app.

## Expected

- Cloud response types defined based on Supabase schema
- Web Locks API properly typed (or use `@types/web-locks`)
- `CollectionItem.data` uses a stricter type (e.g., `Record<string, string | number | string[] | null>`)
- Translation lookup typed with keyof

## Actual

Type safety bypassed in 20 places across production code.

## Acceptance Criteria

- [ ] `mapCloudCollections` parameters properly typed
- [ ] `CollectionItem.data` uses a stricter type than `Record<string, any>`
- [ ] `as any` count reduced to 5 or fewer (some edge cases may remain)
- [ ] No new runtime errors introduced
- [ ] Build passes with strict checks
