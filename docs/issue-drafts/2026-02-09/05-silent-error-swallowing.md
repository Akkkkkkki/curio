## Title

Silent error swallowing in sync operations masks failures and makes debugging difficult

## Labels

- type:bug
- area:sync
- severity:p1

## Problem

Multiple catch blocks across the sync layer silently swallow errors, making it impossible to diagnose sync failures in production.

**Empty catch block - `db.ts` line 892-894:**

```typescript
} catch {
  // Continue with next delete, will retry later
}
```

No logging, no metric, no way to know deletes are failing.

**Silent false return - `geminiService.ts` line 60:**

```typescript
} catch {
  return false; // Any error = disabled
}
```

Network errors, server errors, and actual "disabled" state all return the same value.

**Null swallow - `supabase.ts` line 35-37:**

```typescript
} catch (e) {
  console.warn('Auth check error:', e);
  return null;
}
```

**Inconsistent throw/return patterns - `geminiService.ts`:**

- `analyzeImage()` (line 132): catches and returns `null`
- `enhanceImage()` (line 185): catches and re-throws
- Callers can't rely on a consistent contract

## Expected

- All catch blocks log actionable error info
- Error contracts are consistent per service (always throw or always return error type)
- Sync failures are surfaced to users via status indicators
- A structured error type replaces mixed null/throw patterns

## Actual

Errors silently disappear, sync can fail indefinitely without user awareness.

## Acceptance Criteria

- [ ] No empty catch blocks in sync code
- [ ] Consistent error handling pattern per service (documented)
- [ ] Sync failures increment a visible counter or trigger user notification
- [ ] `geminiService.ts` uses consistent return type for errors
- [ ] Error logging includes enough context to diagnose (operation, IDs, error type)
