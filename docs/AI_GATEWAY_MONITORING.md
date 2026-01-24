# AI Gateway & Sync Monitoring

## Overview

The AI gateway now exposes lightweight request metrics and emits structured sync error logs from
the client. These signals cover the minimum operational visibility required for latency, error
rate, and sync failure tracking.

## Gateway metrics

**Endpoint:** `GET /api/metrics`

The gateway exports an in-memory JSON payload for:

- Request count per route
- p50/p95 latency (milliseconds)
- Error count / error rate (HTTP status >= 400)

**Example**

```json
{
  "generatedAt": "2025-01-01T00:00:00.000Z",
  "routes": {
    "/api/health": {
      "requestCount": 12,
      "errorCount": 0,
      "errorRate": 0,
      "latencyMs": { "p50": 18, "p95": 45 }
    }
  }
}
```

### Suggested alerts

- **Elevated error rate:** errorRate > 5% over 5 minutes on `/api/gemini/analyze` or
  `/api/gemini/enhance`.
- **Sustained latency:** p95 latency > 2s over 5 minutes on `/api/gemini/analyze` or
  `/api/gemini/enhance`.

## Sync failure visibility

The client emits structured logs when sync transitions into an error state, and when it recovers.
Look for:

- `sync_status_error`
- `sync_status_recovered`

These logs include timestamps and the prior state so failures and recoveries can be charted in
log-based dashboards.

## Ownership & on-call

**Owner:** Curio maintainers (engineering).  
**On-call:** Curio on-call rotation (or the engineer on duty for the week).
