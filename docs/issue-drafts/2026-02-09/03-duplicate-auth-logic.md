## Title

Duplicate auth initialization logic in App.tsx and useAuthState hook

## Labels

- type:bug
- area:auth
- severity:p2

## Problem

Auth initialization and admin status checking logic is duplicated between `src/hooks/useAuthState.ts` and `src/App.tsx`. The hook exists (lines 16-95) but App.tsx reimplements identical logic (lines 331-399) instead of using it. Fixes applied to one location won't be applied to the other.

App.tsx lines 339-357 (auth init):

```typescript
const initAuth = async () => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  setUser(session?.user || null);
  // ...
};
```

useAuthState.ts lines 26-51 (identical logic):

```typescript
const initAuth = async () => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (isActive) {
    setUser(session?.user || null);
  }
  // ...
};
```

The hook version is actually safer (uses `isActive` guard for cleanup).

## Expected

App.tsx uses `useAuthState()` hook for all auth state management.

## Actual

Identical auth logic implemented in two places.

## Acceptance Criteria

- [ ] App.tsx uses `useAuthState()` hook instead of inline auth logic
- [ ] Duplicate useEffect blocks (lines 331-399) removed from App.tsx
- [ ] Auth behavior unchanged (sign-in, sign-out, admin detection)
- [ ] All auth-related tests pass
