## Title

Add monitoring for AI gateway and sync error rates

## Labels

- type:enhancement
- area:sync
- severity:p2

## Problem

There is no documented or implemented monitoring for AI gateway latency/error rates or client sync failures, making incidents harder to detect and respond to.

## Steps to Reproduce

1. Introduce AI gateway failures or slow responses.
2. Observe that no metrics or alerts are triggered.

## Expected

Operational metrics (request counts, latency, error rate) are tracked with alerting, and sync failure rates are visible to operators.

## Actual

Only console logging exists; there are no metrics or alerts.

## Acceptance Criteria

- Gateway metrics are captured and exported (count, latency, error rate).
- Alerts are configured for elevated error rates or sustained latency.
- Sync failures are visible in monitoring (client telemetry or server logs).
- Documentation describes the monitoring setup and owner.

## Notes (optional)

This is part of production readiness.
