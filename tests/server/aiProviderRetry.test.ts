import { describe, expect, it, vi } from 'vitest';
import { createGeminiProvider } from '../../server/ai/providers/gemini.js';

// CUR/#433: transient upstream 5xx ("503 model overloaded", gateway deadlines)
// on the vision call should be retried a bounded number of times so a brief
// blip doesn't force every capture onto manual entry. Non-transient failures
// (auth, safety, bad request) must surface immediately.

const noSleep = () => Promise.resolve();
const OK_RESPONSE = { text: JSON.stringify({ title: 'Leica M6' }) };
const SCHEMA = { type: 'object', properties: { title: { type: 'string' } } };

const provider = (generateContent: (...args: unknown[]) => unknown) =>
  createGeminiProvider({
    model: 'test-model',
    client: { models: { generateContent } },
    retry: { sleep: noSleep, baseDelayMs: 0 },
  });

const analyze = (generateContent: (...args: unknown[]) => unknown) =>
  provider(generateContent).analyzeImage({ imageBase64: 'abc', prompt: 'p', schema: SCHEMA });

describe('Gemini provider transient-error retry', () => {
  it('retries a transient upstream 503 and then succeeds', async () => {
    const generateContent = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('503 model overloaded'), { status: 503 }))
      .mockResolvedValueOnce(OK_RESPONSE);

    await expect(analyze(generateContent)).resolves.toEqual({ title: 'Leica M6' });
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it('retries a numeric 408 Request Timeout status', async () => {
    // 408 arrives as a numeric status, so it must be in the retryable set to be
    // retried — matching the client classifier in src/services/aiService.ts.
    const generateContent = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('Request Timeout'), { status: 408 }))
      .mockResolvedValueOnce(OK_RESPONSE);

    await expect(analyze(generateContent)).resolves.toEqual({ title: 'Leica M6' });
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it('detects transience from the message when no status code is present', async () => {
    const generateContent = vi
      .fn()
      .mockRejectedValueOnce(new Error('The model is overloaded. Please try again later.'))
      .mockResolvedValueOnce(OK_RESPONSE);

    await expect(
      provider(generateContent).generateStructuredText({ prompt: 'p', schema: SCHEMA }),
    ).resolves.toEqual({ title: 'Leica M6' });
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it('retries the SDK-wrapped "fetch failed" transport error', async () => {
    // @google/genai rethrows a failed underlying fetch as a generic TypeError
    // with no status; a dropped connection must still reach the retry path.
    const generateContent = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('exception TypeError: fetch failed sending request'))
      .mockResolvedValueOnce(OK_RESPONSE);

    await expect(analyze(generateContent)).resolves.toEqual({ title: 'Leica M6' });
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it('retries when the transient code is only on the wrapped cause', async () => {
    const generateContent = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error('fetch failed'), { cause: { code: 'ECONNRESET' } }),
      )
      .mockResolvedValueOnce(OK_RESPONSE);

    await expect(analyze(generateContent)).resolves.toEqual({ title: 'Leica M6' });
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it('does not retry a non-transient error', async () => {
    const generateContent = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('safety blocked'), { status: 400 }));

    await expect(analyze(generateContent)).rejects.toThrow('safety blocked');
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it('honors a definitive non-retryable status even when the message reads transient', async () => {
    // A safety rejection is a 4xx but its message can say "please try again";
    // the numeric status must win so it is not retried.
    const generateContent = vi.fn().mockRejectedValue(
      Object.assign(new Error('Blocked by safety filters. Please try again with a new prompt.'), {
        status: 400,
      }),
    );

    await expect(analyze(generateContent)).rejects.toThrow('safety filters');
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it('gives up after the bounded attempt count and rethrows the last error', async () => {
    const generateContent = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('server unavailable'), { status: 503 }));

    await expect(analyze(generateContent)).rejects.toThrow('server unavailable');
    expect(generateContent).toHaveBeenCalledTimes(3);
  });
});
