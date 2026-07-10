import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Regression: CUR-141 — public/assets/sample-vinyl.jpg shipped as a binary
// destroyed by a binary-as-UTF-8 round trip (every byte ≥ 0x80 replaced with
// the EF BF BD replacement character), so every Public Sample Gallery card
// rendered "IMAGE ERROR" pre-login. Guard every committed binary image under
// public/ by checking it starts with a real image signature, so a
// text-mangled binary cannot ship again.
//
// Note: the check accepts any known signature rather than the one implied by
// the file extension because the committed icon .webp files are actually
// PNGs (mislabeled but decodable — browsers content-sniff). Corruption, not
// naming, is what this guard is for.

const REPO_ROOT = resolve(__dirname, '../..');
const PUBLIC_DIR = resolve(REPO_ROOT, 'public');
const SAMPLE_IMAGE = resolve(PUBLIC_DIR, 'assets', 'sample-vinyl.jpg');

/** UTF-8 encoding of U+FFFD — the fingerprint of a binary-as-text round trip. */
const REPLACEMENT_CHARACTER = Buffer.from([0xef, 0xbf, 0xbd]);

const IMAGE_SIGNATURES: Record<string, Buffer> = {
  jpeg: Buffer.from([0xff, 0xd8, 0xff]),
  png: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  gif: Buffer.from('GIF8', 'ascii'),
  webp: Buffer.from('RIFF', 'ascii'),
  ico: Buffer.from([0x00, 0x00, 0x01, 0x00]),
};

const BINARY_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.ico']);

const startsWithKnownSignature = (filePath: string) => {
  const head = readFileSync(filePath).subarray(0, 8);
  return Object.values(IMAGE_SIGNATURES).some((signature) =>
    head.subarray(0, signature.length).equals(signature),
  );
};

const listFilesRecursively = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);
    return statSync(fullPath).isDirectory() ? listFilesRecursively(fullPath) : [fullPath];
  });

const binaryImages = listFilesRecursively(PUBLIC_DIR).filter((filePath) =>
  BINARY_IMAGE_EXTENSIONS.has(extname(filePath).toLowerCase()),
);

describe('public/ binary image integrity (CUR-141)', () => {
  it('finds the sample gallery image among the checked assets', () => {
    expect(binaryImages).toContain(SAMPLE_IMAGE);
  });

  it.each(binaryImages.map((filePath) => [relative(REPO_ROOT, filePath), filePath]))(
    '%s starts with a real image signature',
    (_label, filePath) => {
      expect(startsWithKnownSignature(filePath)).toBe(true);
    },
  );

  it.each(binaryImages.map((filePath) => [relative(REPO_ROOT, filePath), filePath]))(
    '%s does not start with a UTF-8 replacement character (binary-as-text corruption)',
    (_label, filePath) => {
      const head = readFileSync(filePath).subarray(0, REPLACEMENT_CHARACTER.length);
      expect(head.equals(REPLACEMENT_CHARACTER)).toBe(false);
    },
  );

  it('keeps the sample gallery image an actual JPEG', () => {
    const head = readFileSync(SAMPLE_IMAGE).subarray(0, IMAGE_SIGNATURES.jpeg.length);
    expect(head.equals(IMAGE_SIGNATURES.jpeg)).toBe(true);
  });

  it('keeps the sample gallery image web-sized (under 500 KB)', () => {
    expect(statSync(SAMPLE_IMAGE).size).toBeLessThan(500 * 1024);
  });
});
