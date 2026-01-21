import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { TEMPLATES } from '@/constants';

function getApiBaseUrl() {
  // Prefer a dedicated env var for live tests; fall back to the same var the app uses.
  return (
    process.env.LIVE_API_BASE_URL ||
    process.env.VITE_API_BASE_URL ||
    process.env.API_BASE_URL ||
    'http://localhost:8787'
  );
}

async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const text = await res.text();
  const json = (() => {
    try {
      return text ? JSON.parse(text) : null;
    } catch {
      return null;
    }
  })();
  return { res, json, text } as const;
}

async function loadSampleImageBase64() {
  const filePath = path.resolve(process.cwd(), 'public/assets/sample-vinyl.jpg');
  const buf = await fs.readFile(filePath);
  return buf.toString('base64');
}

describe('live: Gemini proxy smoke', () => {
  it('GET /api/health reports Gemini configured', async () => {
    const base = getApiBaseUrl();
    const { res, json, text } = await fetchJson(`${base}/api/health`);
    expect(res.ok).toBe(true);
    expect(json ?? text).toBeTruthy();
    expect(json).toMatchObject({ geminiConfigured: true });
  });

  it('POST /api/gemini/analyze returns structured metadata', async () => {
    const base = getApiBaseUrl();
    const imageBase64 = await loadSampleImageBase64();
    const vinylFields = TEMPLATES.find((t) => t.id === 'vinyl')!.fields;

    const { res, json, text } = await fetchJson(`${base}/api/gemini/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64, fields: vinylFields }),
    });

    // If this fails, it's an integration/config issue (proxy not running, key missing, model denied, etc.)
    if (!res.ok) {
      const body = json ? JSON.stringify(json) : text;
      throw new Error(`Gemini analyze failed (${res.status} ${res.statusText}): ${body}`);
    }
    expect(json).toHaveProperty('title');
    expect(typeof json.title).toBe('string');
    expect(json.title.length).toBeGreaterThan(0);
    expect(json).toHaveProperty('notes');
    expect(typeof json.notes).toBe('string');
    expect(json).toHaveProperty('data');
    expect(typeof json.data).toBe('object');
  });
});
