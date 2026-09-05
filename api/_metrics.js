const MAX_LATENCY_SAMPLES = 1000;
const METRICS_ROUTES = new Set([
  '/api/health',
  '/api/ai/analyze-item',
  '/api/ai/story-prompts',
  '/api/ai/suggest-fields',
  '/api/gemini/analyze',
  '/api/gemini/enhance',
  '/api/gemini/suggest-fields',
  '/api/gemini/story-prompts',
]);
const AI_ROUTES = new Set([...METRICS_ROUTES].filter((route) => route !== '/api/health'));
const metrics = new Map();

export const DEFAULT_ALERT_THRESHOLDS = Object.freeze({
  minimumRequests: 5,
  errorRate: 0.2,
  p95LatencyMs: 5000,
});

const ensureMetric = (route) => {
  if (!metrics.has(route)) {
    metrics.set(route, {
      count: 0,
      errorCount: 0,
      durations: [],
    });
  }
  return metrics.get(route);
};

export const recordMetric = (route, status, durationMs) => {
  const metric = ensureMetric(route);
  metric.count += 1;
  if (status >= 400) {
    metric.errorCount += 1;
  }
  metric.durations.push(durationMs);
  if (metric.durations.length > MAX_LATENCY_SAMPLES) {
    metric.durations.shift();
  }
};

const percentile = (values, percentileValue) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentileValue / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
};

export const summarizeMetrics = () => {
  const summary = {};
  metrics.forEach((value, route) => {
    summary[route] = {
      requestCount: value.count,
      errorCount: value.errorCount,
      errorRate: value.count ? value.errorCount / value.count : 0,
      latencyMs: {
        p50: percentile(value.durations, 50),
        p95: percentile(value.durations, 95),
      },
    };
  });
  return summary;
};

export const evaluateMetricAlerts = (
  summary,
  thresholds = DEFAULT_ALERT_THRESHOLDS,
) => {
  const alerts = [];
  for (const [route, metric] of Object.entries(summary)) {
    if (!AI_ROUTES.has(route) || metric.requestCount < thresholds.minimumRequests) continue;

    if (metric.errorRate >= thresholds.errorRate) {
      alerts.push({
        route,
        kind: 'error_rate',
        value: metric.errorRate,
        threshold: thresholds.errorRate,
        requestCount: metric.requestCount,
      });
    }

    const p95LatencyMs = metric.latencyMs?.p95;
    if (typeof p95LatencyMs === 'number' && p95LatencyMs >= thresholds.p95LatencyMs) {
      alerts.push({
        route,
        kind: 'p95_latency',
        value: p95LatencyMs,
        threshold: thresholds.p95LatencyMs,
        requestCount: metric.requestCount,
      });
    }
  }
  return alerts;
};

export const resetMetrics = () => {
  metrics.clear();
};

export const attachMetrics = (req, res, route) => {
  if (req.method === 'OPTIONS' || !METRICS_ROUTES.has(route)) {
    return;
  }
  const start = Date.now();
  res.on('finish', () => {
    recordMetric(route, res.statusCode, Date.now() - start);
  });
};
