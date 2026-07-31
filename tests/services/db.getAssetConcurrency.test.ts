/**
 * CUR-16: getAsset() cloud downloads are capped so a grid of uncached items
 * doesn't fire dozens of parallel Supabase Storage requests at once.
 *
 * These tests exercise the real getAsset() path (local cache miss → cloud
 * download) with a controllable storage mock that records how many downloads
 * are in flight simultaneously.
 *
 * IMPORTANT: TDD only — do not modify production implementations in these tests.
 */

import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';

// services/db.ts uses a fixed database name; map it to a per-file unique name so
// this suite's IndexedDB never collides with the other db.* suites.
const BASE_DB_NAME = 'CurioDatabase';
const TEST_DB_NAME = `${BASE_DB_NAME}__vitest_${Math.random().toString(16).slice(2)}`;
const originalOpen = indexedDB.open.bind(indexedDB);
const originalDeleteDatabase = indexedDB.deleteDatabase.bind(indexedDB);

Object.defineProperty(indexedDB, 'open', {
  configurable: true,
  value: ((name: string, version?: number) =>
    originalOpen(name === BASE_DB_NAME ? TEST_DB_NAME : name, version)) as any,
});
Object.defineProperty(indexedDB, 'deleteDatabase', {
  configurable: true,
  value: ((name: string) =>
    originalDeleteDatabase(name === BASE_DB_NAME ? TEST_DB_NAME : name)) as any,
});

afterAll(() => {
  Object.defineProperty(indexedDB, 'open', { configurable: true, value: originalOpen as any });
  Object.defineProperty(indexedDB, 'deleteDatabase', {
    configurable: true,
    value: originalDeleteDatabase as any,
  });
});

function createStorageMock(
  download: (path: string) => Promise<{ data: Blob | null; error: unknown }>,
) {
  const downloadFn = vi.fn(download);
  return {
    supabase: {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } }, error: null }),
      },
      from: vi.fn(() => ({
        upsert: vi.fn().mockResolvedValue({ error: null }),
        select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn() })) })),
      })),
      storage: {
        from: vi.fn(() => ({ download: downloadFn })),
      },
    },
    downloadFn,
  };
}

async function importDbFresh(supabaseMock: any) {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY', 'test-key');
  vi.doMock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => supabaseMock),
  }));
  return await import('@/services/db');
}

describe('CUR-16 — getAsset cloud download concurrency', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    vi.resetModules();
  });

  it('never runs more than 3 cloud downloads at once for a burst of uncached items', async () => {
    let inFlight = 0;
    let peak = 0;
    const { supabase, downloadFn } = createStorageMock(async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return { data: new Blob(['x'], { type: 'image/jpeg' }), error: null };
    });

    const dbMod = await importDbFresh(supabase);

    // 12 distinct ids, all missing locally (fresh DB) → all hit the cloud path.
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        dbMod.getAsset(`item-${i}`, 'display', undefined, 'col-1'),
      ),
    );

    expect(downloadFn).toHaveBeenCalledTimes(12);
    // Downloads did run in parallel (the limiter throttles, it does not serialize)...
    expect(peak).toBeGreaterThan(1);
    // ...but never exceeded the cap.
    expect(peak).toBeLessThanOrEqual(3);
    // Every request still resolved to its blob.
    expect(results.every((b) => b instanceof Blob)).toBe(true);
  });

  it('releases the slot when a download throws, so the queue never deadlocks', async () => {
    // Every download rejects. If the limiter leaked slots on failure, the 4th+
    // getAsset call would wait forever and this test would time out.
    const { supabase, downloadFn } = createStorageMock(async () => {
      throw new Error('network down');
    });

    const dbMod = await importDbFresh(supabase);

    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        dbMod.getAsset(`err-${i}`, 'display', undefined, 'col-1'),
      ),
    );

    expect(downloadFn).toHaveBeenCalledTimes(10);
    // getAsset swallows download failures and resolves to null rather than
    // throwing; the point of the test is that all 10 settle at all.
    expect(results.every((b) => b === null)).toBe(true);
  });
});
