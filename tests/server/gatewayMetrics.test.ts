import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import app, { resetMetrics } from '../../server/geminiProxy.js';

describe('gateway metrics', () => {
  let server: ReturnType<typeof app.listen>;
  let baseUrl: string;

  beforeAll(async () => {
    server = app.listen(0);
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Expected server to bind to a TCP port');
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(() => {
    resetMetrics();
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((err?: Error) => (err ? reject(err) : resolve())),
    );
  });

  it('records request counts and latency percentiles for tracked routes', async () => {
    const healthResponse = await fetch(`${baseUrl}/api/health`);
    expect(healthResponse.ok).toBe(true);

    const metricsResponse = await fetch(`${baseUrl}/api/metrics`);
    expect(metricsResponse.ok).toBe(true);
    const body = await metricsResponse.json();

    const healthMetrics = body.routes['/api/health'];
    expect(healthMetrics.requestCount).toBe(1);
    expect(healthMetrics.errorCount).toBe(0);
    expect(healthMetrics.errorRate).toBe(0);
    expect(healthMetrics.latencyMs.p50).toBeTypeOf('number');
    expect(healthMetrics.latencyMs.p95).toBeTypeOf('number');
  });
});
