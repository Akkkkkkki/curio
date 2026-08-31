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
const metrics = new Map();

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
