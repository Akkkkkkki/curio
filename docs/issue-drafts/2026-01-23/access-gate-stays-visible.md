## Title

Access gate should remain visible until users choose Explore Sample or sign in

## Labels

- type:ux
- area:auth
- severity:p1

## Problem

First-time visitors briefly see the access gate and then are dropped into the home view when public samples load. This hides the intended “browse first” choice and creates a confusing flash of state.

## Steps to Reproduce

1. Open the app in a browser with Supabase configured and public samples available.
2. Observe the access gate for ~1s, then the home view appears without user intent.

## Expected

The access gate stays visible until the user explicitly chooses **Explore sample** or completes sign-in.

## Actual

The access gate disappears automatically when public sample collections are loaded.

## Acceptance Criteria

- Access gate remains visible for unauthenticated users until they opt into browsing samples or sign in.
- Clicking **Explore sample** transitions to sample browsing and reveals public collections.
- No access-gate flicker into home view on first load.

## Notes (optional)

This is part of the “delight before auth” requirement.
