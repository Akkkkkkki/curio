import { describe, expect, it } from 'vitest';
import {
  evaluateMetricAlerts,
  recordMetric,
  resetMetrics,
  summarizeMetrics,
} from '../../api/_metrics.js';

describe('api metrics store', () => {
  it('summarizes request counts, errors, and latency percentiles', () => {
    resetMetrics();

    recordMetric('/api/health', 200, 10);
    recordMetric('/api/health', 500, 30);
    recordMetric('/api/health', 200, 20);

    const summary = summarizeMetrics();
    expect(summary['/api/health'].requestCount).toBe(3);
    expect(summary['/api/health'].errorCount).toBe(1);
    expect(summary['/api/health'].errorRate).toBeCloseTo(1 / 3);
    expect(summary['/api/health'].latencyMs.p50).toBeTypeOf('number');
    expect(summary['/api/health'].latencyMs.p95).toBeTypeOf('number');
  });

  it('flags sustained AI error-rate and p95 latency breaches after a minimum sample', () => {
    resetMetrics();

    for (const sample of [
      { status: 200, duration: 120 },
      { status: 200, duration: 180 },
      { status: 200, duration: 220 },
      { status: 500, duration: 6200 },
      { status: 500, duration: 7000 },
    ]) {
      recordMetric('/api/ai/analyze-item', sample.status, sample.duration);
    }

    const alerts = evaluateMetricAlerts(summarizeMetrics());
    expect(alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ route: '/api/ai/analyze-item', kind: 'error_rate' }),
        expect.objectContaining({ route: '/api/ai/analyze-item', kind: 'p95_latency' }),
      ]),
    );
  });

  it('does not alert on sparse samples or the health endpoint', () => {
    resetMetrics();

    recordMetric('/api/ai/analyze-item', 500, 10000);
    for (let index = 0; index < 5; index += 1) {
      recordMetric('/api/health', 500, 10000);
    }

    expect(evaluateMetricAlerts(summarizeMetrics())).toEqual([]);
  });
});
