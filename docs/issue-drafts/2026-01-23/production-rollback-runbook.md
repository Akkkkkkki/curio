## Title

Document rollback steps for AI gateway and database schema changes

## Labels

- type:enhancement
- area:sync
- severity:p2

## Problem

Production rollbacks for the AI gateway or schema changes are not documented, increasing recovery time and risk during incidents.

## Steps to Reproduce

1. Attempt to find a documented rollback/runbook for AI gateway configuration changes.
2. Attempt to find a documented rollback procedure for schema changes.

## Expected

Clear rollback/runbook steps exist for AI gateway and database schema changes.

## Actual

No explicit rollback/runbook documentation is present.

## Acceptance Criteria

- Document rollback steps for AI gateway configuration changes (routing, env vars, deployment).
- Document rollback steps for database schema changes (migrations, triggers, feature flags).
- Identify owners and required access for the rollback procedures.

## Notes (optional)

This is required for production readiness.
