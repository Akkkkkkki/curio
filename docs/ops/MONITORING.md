# Production monitoring

Curio intentionally keeps monitoring lightweight. The goal is to make failures in the two trust-critical paths — AI requests and client sync — visible without adding a second observability stack.

## AI gateway health

The Vercel API handlers record request count, error count/rate, and p50/p95 latency in `api/_metrics.js`. `GET /api/metrics` exposes the current process summary.

The response also contains a top-level `status` and `alerts` array. An AI route is considered degraded only after at least 5 observed requests, then when either:

- error rate is at least 20%; or
- p95 latency is at least 5 seconds.

Example:

```json
{
  "status": "degraded",
  "alerts": [
    {
      "route": "/api/ai/analyze-item",
      "kind": "error_rate",
      "value": 0.4,
      "threshold": 0.2,
      "requestCount": 5
    }
  ]
}
```

These thresholds are intentionally simple and live next to the metric calculation so they are testable. The minimum sample prevents a single cold-start or provider hiccup from looking like a sustained incident.

### Operator check

Use `/api/metrics` as a diagnostic endpoint when investigating an AI incident. A monitor may poll it and alert when `status` changes to `degraded`. The store is process-local, so do **not** treat it as a durable global time-series database; use Vercel request logs/observability for cross-instance history.

## Client sync visibility

Client sync and asset-upload failures are sent through the existing Vercel Analytics integration:

- `sync_failed` — collection sync or manual retry failed;
- `upload_failed` — an asset upload failed and may require retry.

Filter these events by `platform` (`web`, `android`, `ios`) and the event payload fields when triaging a spike. This gives operators aggregate visibility without sending item titles, stories, photos, or other collection content to analytics.

The in-product sync UI remains the source of truth for the individual user. Monitoring is for detecting patterns across sessions, not replacing local retry/status behavior.

## Incident triage

1. Check `/api/metrics` for AI route alerts and the affected route.
2. Check Vercel request logs for the same time window and route to separate provider failures, auth/rate-limit failures, and slow responses.
3. Check Vercel Analytics for `sync_failed` and `upload_failed` changes, split by platform.
4. If failures are isolated to one user/device, prefer the product's local retry/recovery path. If rates are elevated across users, treat it as an incident and use the rollback steps in `docs/ops/ROLLBACK_RUNBOOK.md`.

No monitoring path should log private item metadata, stories, or photo payloads.
