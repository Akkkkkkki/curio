## Title

Add “Vault Lock” to protect selected collections (lock/unlock UX + gated access)

## Labels

- type:enhancement
- area:auth
- severity:p3

## Problem

Some users maintain high-value collections and want an extra privacy layer. The product doc proposes “Vault Lock” to gate access to specific collections. We currently have an `isLocked` field in the type model but no end-to-end lock UX or enforcement.

## Steps to Reproduce

N/A (enhancement)

## Expected

Users can mark a collection as locked, and unlocking is required before viewing/editing its items.

## Actual

Lock is not fully implemented (no reliable UX or gating).

## Acceptance Criteria

- Add a lock/unlock control for eligible collections (settings/menu).
- Enforce locked state in routing/views (collection screen + item detail) with a clear unlock prompt.
- Define an MVP unlock mechanism (e.g. device-level gate or simple passcode) that works cross-platform.
- Ensure public/sample collections remain read-only and are not lockable.
- Add tests ensuring locked collections cannot be accessed without unlock.

## Notes (optional)

- Source: `docs/PRODUCT_DESIGN.md` (“Vault Lock”).
