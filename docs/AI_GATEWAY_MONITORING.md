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

### How to use it

1. **Pull metrics on an interval** (e.g., cron job, uptime check, or platform scheduler).
2. **Store them in your monitoring system** (Datadog, Grafana, CloudWatch, etc.).
3. **Alert on the thresholds below** to catch outages and slowdowns.

Example pull:

```bash
curl https://<your-host>/api/metrics
```

> **Note:** Metrics are stored in memory, so they reset on deploys/restarts. Use periodic
> scraping if you want historical trend data.

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

### How to use it

- **Create a log-based metric** that counts `sync_status_error` and `sync_status_recovered`.
- **Alert on error spikes** (e.g., `sync_status_error` > 5/minute).
- **Dashboard recovery rate** by comparing recoveries to errors.

## Testing

- `tests/server/gatewayMetrics.test.ts` verifies that `/api/metrics` captures request counts and
  latency percentiles for `/api/health`.

## Ownership & on-call

**Owner:** Curio maintainers (engineering).  
**On-call:** Curio on-call rotation (or the engineer on duty for the week).
