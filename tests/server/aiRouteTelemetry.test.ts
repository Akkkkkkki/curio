import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireAiAccessMock } = vi.hoisted(() => ({
  requireAiAccessMock: vi.fn(),
}));

vi.mock('../../api/_aiSecurity.js', () => ({
  requireAiAccess: requireAiAccessMock,
}));

import { resetMetrics, summarizeMetrics } from '../../api/_metrics.js';
import analyzeItemHandler from '../../api/ai/analyze-item.js';
import storyPromptsHandler from '../../api/ai/story-prompts.js';
import suggestFieldsHandler from '../../api/ai/suggest-fields.js';

const createRequest = () => ({ headers: {}, method: 'POST' });

const createResponse = () => {
  const emitter = new EventEmitter();
  return {
    locals: {} as Record<string, unknown>,
    statusCode: 200,
    json() {
      emitter.emit('finish');
      return this;
    },
    on(eventName: string, listener: () => void) {
      emitter.on(eventName, listener);
      return this;
    },
    setHeader() {
      return this;
    },
    status(statusCode: number) {
      this.statusCode = statusCode;
      return this;
    },
  };
};

describe('provider-neutral serverless route telemetry', () => {
  beforeEach(() => {
    resetMetrics();
    vi.restoreAllMocks();
    requireAiAccessMock.mockReset();
    requireAiAccessMock.mockResolvedValue(null);
  });

  it.each([
    ['/api/ai/analyze-item', '/api/gemini/analyze', analyzeItemHandler],
    ['/api/ai/story-prompts', '/api/gemini/story-prompts', storyPromptsHandler],
    ['/api/ai/suggest-fields', '/api/gemini/suggest-fields', suggestFieldsHandler],
  ])(
    'attributes %s telemetry without changing its rate-limit key',
    async (route, rateLimitRoute, handler) => {
      const log = vi.spyOn(console, 'log').mockImplementation(() => {});
      const response = createResponse();

      await handler(createRequest(), response);

      expect(response.statusCode).toBe(503);
      expect(requireAiAccessMock).toHaveBeenCalledWith(expect.anything(), response, rateLimitRoute);
      expect(JSON.parse(String(log.mock.calls[0][0]))).toMatchObject({ route, status: 503 });
      expect(summarizeMetrics()[route]).toMatchObject({
        requestCount: 1,
        errorCount: 1,
        errorRate: 1,
      });
    },
  );
});
