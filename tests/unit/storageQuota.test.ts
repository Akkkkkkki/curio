import { describe, it, expect } from 'vitest';
import {
  isStorageNearLimit,
  STORAGE_QUOTA_WARNING_THRESHOLD_BYTES,
  STORAGE_QUOTA_WARNING_THRESHOLD_RATIO,
} from '@/config';

const MB = 1024 * 1024;
const GB = 1024 * MB;

// CUR-20: the near-quota warning is the only signal a user gets before writes
// start failing silently on a full device, so this decision is trust-critical.
// It had no coverage; these lock in both directions (warn / stay quiet) and the
// guard against false alarms from an unreliable `navigator.storage.estimate()`.
describe('isStorageNearLimit', () => {
  it('stays quiet when there is ample headroom', () => {
    expect(isStorageNearLimit({ quota: 1 * GB, usage: 100 * MB })).toBe(false);
  });

  it('warns once free space drops below the byte threshold', () => {
    // 40MB remaining, under the default 50MB floor (ratio alone would not fire).
    expect(isStorageNearLimit({ quota: 200 * MB, usage: 160 * MB })).toBe(true);
  });

  it('warns once free space drops below the ratio threshold on a large disk', () => {
    // ~0.5GB remaining is comfortably above the byte floor, but only ~5% of a
    // 10GB quota — the ratio guard is what catches near-full large disks.
    expect(isStorageNearLimit({ quota: 10 * GB, usage: 9.5 * GB })).toBe(true);
  });

  it('treats the byte threshold as inclusive', () => {
    expect(isStorageNearLimit({ quota: 150 * MB, usage: 100 * MB })).toBe(true);
  });

  it('stays quiet when just above both thresholds', () => {
    // 101MB free (> 50MB) and ~10.1% remaining (> 10%): neither guard fires.
    expect(isStorageNearLimit({ quota: 1000 * MB, usage: 899 * MB })).toBe(false);
  });

  it('never warns on an unusable estimate', () => {
    expect(isStorageNearLimit({})).toBe(false);
    expect(isStorageNearLimit({ quota: 1 * GB })).toBe(false);
    expect(isStorageNearLimit({ usage: 100 * MB })).toBe(false);
    expect(isStorageNearLimit({ quota: 0, usage: 0 })).toBe(false);
    expect(isStorageNearLimit({ quota: -1, usage: 0 })).toBe(false);
    expect(isStorageNearLimit({ quota: Number.NaN, usage: 100 })).toBe(false);
    expect(isStorageNearLimit({ quota: 100, usage: Number.NaN })).toBe(false);
    expect(isStorageNearLimit({ quota: Number.POSITIVE_INFINITY, usage: 100 })).toBe(false);
  });

  it('honors explicit thresholds over the defaults', () => {
    // Byte + ratio floors of 0 mean "only warn at literal exhaustion".
    expect(isStorageNearLimit({ quota: 1 * GB, usage: 100 * MB }, 0, 0)).toBe(false);
    // A caller can widen the ratio floor to warn earlier.
    expect(isStorageNearLimit({ quota: 100, usage: 50 }, 0, 0.6)).toBe(true);
  });

  it('exposes sane defaults for the warning thresholds', () => {
    expect(STORAGE_QUOTA_WARNING_THRESHOLD_BYTES).toBeGreaterThan(0);
    expect(STORAGE_QUOTA_WARNING_THRESHOLD_RATIO).toBeGreaterThan(0);
    expect(STORAGE_QUOTA_WARNING_THRESHOLD_RATIO).toBeLessThan(1);
  });
});
