import { describe, expect, it } from 'vitest';
import { recordMetric, resetMetrics, summarizeMetrics } from '../../api/_metrics.js';

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
});
