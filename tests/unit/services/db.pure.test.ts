import { describe, it, expect } from 'vitest';
import { compareTimestamps, normalizePhotoPaths } from '@/services/db';

describe('db.ts - Pure Functions', () => {
  describe('compareTimestamps', () => {
    describe('Basic comparison cases', () => {
      it('should return 0 when both timestamps are undefined', () => {
        expect(compareTimestamps(undefined, undefined)).toBe(0);
      });

      it('should return -1 when first timestamp is undefined', () => {
        expect(compareTimestamps(undefined, '2024-01-01T00:00:00Z')).toBe(-1);
      });

      it('should return 1 when second timestamp is undefined', () => {
        expect(compareTimestamps('2024-01-01T00:00:00Z', undefined)).toBe(1);
      });

      it('should return 0 when timestamps are equal', () => {
        const timestamp = '2024-01-01T12:00:00Z';
        expect(compareTimestamps(timestamp, timestamp)).toBe(0);
      });

      it('should return positive when first timestamp is newer', () => {
        const older = '2024-01-01T12:00:00Z';
        const newer = '2024-01-01T13:00:00Z';
        expect(compareTimestamps(newer, older)).toBeGreaterThan(0);
      });

      it('should return negative when first timestamp is older', () => {
        const older = '2024-01-01T12:00:00Z';
        const newer = '2024-01-01T13:00:00Z';
        expect(compareTimestamps(older, newer)).toBeLessThan(0);
      });
    });

    describe('Edge cases - malformed timestamps', () => {
      it('should return 0 when both timestamps are malformed', () => {
        expect(compareTimestamps('invalid', 'also-invalid')).toBe(0);
      });

      it('should return -1 when first timestamp is malformed', () => {
        expect(compareTimestamps('invalid', '2024-01-01T00:00:00Z')).toBe(-1);
      });

      it('should return 1 when second timestamp is malformed', () => {
        expect(compareTimestamps('2024-01-01T00:00:00Z', 'invalid')).toBe(1);
      });

      it('should handle empty strings as malformed', () => {
        expect(compareTimestamps('', '2024-01-01T00:00:00Z')).toBe(-1);
        expect(compareTimestamps('2024-01-01T00:00:00Z', '')).toBe(1);
        expect(compareTimestamps('', '')).toBe(0);
      });

      it('should handle whitespace-only strings as malformed', () => {
        expect(compareTimestamps('   ', '2024-01-01T00:00:00Z')).toBe(-1);
        expect(compareTimestamps('2024-01-01T00:00:00Z', '   ')).toBe(1);
      });

      it('should handle partial date strings (JavaScript Date accepts them)', () => {
        // JavaScript Date constructor accepts partial dates like '2024-01' (Jan 2024)
        // So these are actually valid, not malformed
        const result1 = compareTimestamps('2024-01', '2024-01-01T00:00:00Z');
        expect(result1).toBe(0); // Both represent same moment

        const result2 = compareTimestamps('2024', '2024-01-01T00:00:00Z');
        expect(result2).toBe(0); // '2024' is parsed as Jan 1, 2024
      });
    });

    describe('Edge cases - timezone differences', () => {
      it('should correctly compare timestamps with different timezones representing same moment', () => {
        const utc = '2024-01-01T12:00:00Z';
        const pst = '2024-01-01T04:00:00-08:00';
        // These represent the same moment in time, so difference should be 0
        expect(compareTimestamps(utc, pst)).toBe(0);
      });

      it('should correctly compare timestamps with different timezone offsets', () => {
        const earlier = '2024-01-01T12:00:00+00:00'; // UTC
        const later = '2024-01-01T13:00:00+00:00'; // UTC, 1 hour later
        expect(compareTimestamps(later, earlier)).toBeGreaterThan(0);
        expect(compareTimestamps(earlier, later)).toBeLessThan(0);
      });

      it('should handle ISO 8601 format with different timezone notations', () => {
        const zulu = '2024-01-01T12:00:00Z';
        const plusZero = '2024-01-01T12:00:00+00:00';
        expect(compareTimestamps(zulu, plusZero)).toBe(0);
      });
    });

    describe('Edge cases - various date formats', () => {
      it('should handle timestamps with milliseconds', () => {
        const withMs = '2024-01-01T12:00:00.123Z';
        const withoutMs = '2024-01-01T12:00:00.000Z';
        expect(compareTimestamps(withMs, withoutMs)).toBeGreaterThan(0);
      });

      it('should handle timestamps without timezone indicators', () => {
        const localTime1 = '2024-01-01T12:00:00';
        const localTime2 = '2024-01-01T13:00:00';
        expect(compareTimestamps(localTime2, localTime1)).toBeGreaterThan(0);
      });

      it('should handle date-only strings (no time component)', () => {
        const date1 = '2024-01-01';
        const date2 = '2024-01-02';
        expect(compareTimestamps(date2, date1)).toBeGreaterThan(0);
      });
    });

    describe('Performance and boundary cases', () => {
      it('should handle very old dates', () => {
        const old = '1970-01-01T00:00:00Z';
        const recent = '2024-01-01T00:00:00Z';
        expect(compareTimestamps(recent, old)).toBeGreaterThan(0);
      });

      it('should handle future dates', () => {
        const future = '2099-12-31T23:59:59Z';
        const now = '2024-01-01T00:00:00Z';
        expect(compareTimestamps(future, now)).toBeGreaterThan(0);
      });

      it('should handle timestamps differing by milliseconds', () => {
        const ts1 = '2024-01-01T12:00:00.001Z';
        const ts2 = '2024-01-01T12:00:00.002Z';
        expect(compareTimestamps(ts2, ts1)).toBe(1);
        expect(compareTimestamps(ts1, ts2)).toBe(-1);
      });
    });
  });

  describe('normalizePhotoPaths', () => {
    describe('Empty and null cases', () => {
      it('should return empty paths for empty string', () => {
        expect(normalizePhotoPaths('')).toEqual({
          originalPath: '',
          displayPath: '',
        });
      });

      it('should return empty paths for null-like values', () => {
        // @ts-expect-error Testing runtime behavior with null
        expect(normalizePhotoPaths(null)).toEqual({
          originalPath: '',
          displayPath: '',
        });
      });

      it('should return empty paths for undefined', () => {
        // @ts-expect-error Testing runtime behavior with undefined
        expect(normalizePhotoPaths(undefined)).toEqual({
          originalPath: '',
          displayPath: '',
        });
      });
    });

    describe('Modern path formats (original/display)', () => {
      it('should derive original from display path with slash separator', () => {
        const result = normalizePhotoPaths('user123/collections/col1/item1/display.jpg');
        expect(result).toEqual({
          displayPath: 'user123/collections/col1/item1/display.jpg',
          originalPath: 'user123/collections/col1/item1/original.jpg',
        });
      });

      it('should derive display from original path with slash separator', () => {
        const result = normalizePhotoPaths('user123/collections/col1/item1/original.jpg');
        expect(result).toEqual({
          originalPath: 'user123/collections/col1/item1/original.jpg',
          displayPath: 'user123/collections/col1/item1/display.jpg',
        });
      });

      it('should derive original from display path with underscore separator', () => {
        const result = normalizePhotoPaths('user123/item1_display.jpg');
        expect(result).toEqual({
          displayPath: 'user123/item1_display.jpg',
          originalPath: 'user123/item1_original.jpg',
        });
      });

      it('should derive display from original path with underscore separator', () => {
        const result = normalizePhotoPaths('user123/item1_original.jpg');
        expect(result).toEqual({
          originalPath: 'user123/item1_original.jpg',
          displayPath: 'user123/item1_display.jpg',
        });
      });

      it('should handle different file extensions', () => {
        const pngResult = normalizePhotoPaths('path/to/display.png');
        expect(pngResult).toEqual({
          displayPath: 'path/to/display.png',
          originalPath: 'path/to/original.png',
        });

        const webpResult = normalizePhotoPaths('path/to/original.webp');
        expect(webpResult).toEqual({
          originalPath: 'path/to/original.webp',
          displayPath: 'path/to/display.webp',
        });
      });

      it('should be case-insensitive for detection but preserve original case in paths', () => {
        const upperResult = normalizePhotoPaths('path/DISPLAY.JPG');
        expect(upperResult).toEqual({
          displayPath: 'path/DISPLAY.JPG',
          // Replacement uses lowercase 'original' as defined in the replace pattern
          originalPath: 'path/original.JPG',
        });

        const mixedResult = normalizePhotoPaths('path/Original.PNG');
        expect(mixedResult).toEqual({
          originalPath: 'path/Original.PNG',
          // Replacement uses lowercase 'display' as defined in the replace pattern
          displayPath: 'path/display.PNG',
        });
      });
    });

    describe('Legacy path formats (thumb/master)', () => {
      it('should derive paths from legacy thumb with slash separator', () => {
        const result = normalizePhotoPaths('user123/item1/thumb.jpg');
        expect(result).toEqual({
          originalPath: 'user123/item1/original.jpg',
          displayPath: 'user123/item1/display.jpg',
        });
      });

      it('should derive paths from legacy thumb with underscore separator', () => {
        const result = normalizePhotoPaths('user123/item1_thumb.jpg');
        expect(result).toEqual({
          originalPath: 'user123/item1_original.jpg',
          displayPath: 'user123/item1_display.jpg',
        });
      });

      it('should derive paths from legacy master with slash separator', () => {
        const result = normalizePhotoPaths('user123/item1/master.jpg');
        expect(result).toEqual({
          originalPath: 'user123/item1/original.jpg',
          displayPath: 'user123/item1/display.jpg',
        });
      });

      it('should derive paths from legacy master with underscore separator', () => {
        const result = normalizePhotoPaths('user123/item1_master.jpg');
        expect(result).toEqual({
          originalPath: 'user123/item1_original.jpg',
          displayPath: 'user123/item1_display.jpg',
        });
      });

      it('should be case-insensitive for detection but use lowercase in replacements', () => {
        const thumbResult = normalizePhotoPaths('path/THUMB.JPG');
        expect(thumbResult.displayPath).toBe('path/display.JPG');

        const masterResult = normalizePhotoPaths('path/Master.PNG');
        expect(masterResult.originalPath).toBe('path/original.PNG');
      });
    });

    describe('External URLs and special protocols', () => {
      it('should return same path for HTTP URLs', () => {
        const url = 'http://example.com/photo.jpg';
        const result = normalizePhotoPaths(url);
        expect(result).toEqual({
          originalPath: url,
          displayPath: url,
        });
      });

      it('should return same path for HTTPS URLs', () => {
        const url = 'https://example.com/photo.jpg';
        const result = normalizePhotoPaths(url);
        expect(result).toEqual({
          originalPath: url,
          displayPath: url,
        });
      });

      it('should return same path for data URLs', () => {
        const url = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
        const result = normalizePhotoPaths(url);
        expect(result).toEqual({
          originalPath: url,
          displayPath: url,
        });
      });

      it('should return same path for blob URLs', () => {
        const url = 'blob:http://localhost:3000/abc-123-def';
        const result = normalizePhotoPaths(url);
        expect(result).toEqual({
          originalPath: url,
          displayPath: url,
        });
      });

      it('should return same path for absolute filesystem paths', () => {
        const path = '/absolute/path/to/photo.jpg';
        const result = normalizePhotoPaths(path);
        expect(result).toEqual({
          originalPath: path,
          displayPath: path,
        });
      });
    });

    describe('Supabase URL extraction', () => {
      it('should extract path from Supabase public object URL', () => {
        const url =
          'https://abc123.supabase.co/storage/v1/object/public/curio-assets/user1/item1/display.jpg';
        const result = normalizePhotoPaths(url);
        expect(result).toEqual({
          displayPath: 'user1/item1/display.jpg',
          originalPath: 'user1/item1/original.jpg',
        });
      });

      it('should extract path from Supabase signed URL', () => {
        const url =
          'https://abc123.supabase.co/storage/v1/object/sign/curio-assets/user1/item1/original.jpg?token=xyz';
        const result = normalizePhotoPaths(url);
        expect(result).toEqual({
          originalPath: 'user1/item1/original.jpg',
          displayPath: 'user1/item1/display.jpg',
        });
      });

      it('should extract path from Supabase object URL without public/sign', () => {
        const url =
          'https://abc123.supabase.co/storage/v1/object/curio-assets/user1/collections/col1/item1/display.jpg';
        const result = normalizePhotoPaths(url);
        expect(result).toEqual({
          displayPath: 'user1/collections/col1/item1/display.jpg',
          originalPath: 'user1/collections/col1/item1/original.jpg',
        });
      });

      it('should handle URL-encoded paths in Supabase URLs', () => {
        const url =
          'https://abc123.supabase.co/storage/v1/object/public/curio-assets/user%20name/item%201/display.jpg';
        const result = normalizePhotoPaths(url);
        expect(result.displayPath).toBe('user name/item 1/display.jpg');
        expect(result.originalPath).toBe('user name/item 1/original.jpg');
      });

      it('should fallback gracefully if URL decoding fails', () => {
        // Malformed URL encoding
        const url =
          'https://abc123.supabase.co/storage/v1/object/public/curio-assets/user%/display.jpg';
        const result = normalizePhotoPaths(url);
        // Should use the raw matched path without decoding
        expect(result.displayPath).toBe('user%/display.jpg');
      });
    });

    describe('Unknown/generic paths', () => {
      it('should return same path for unrecognized formats', () => {
        const path = 'some/random/path.jpg';
        const result = normalizePhotoPaths(path);
        expect(result).toEqual({
          originalPath: path,
          displayPath: path,
        });
      });

      it('should return same path for paths without extensions', () => {
        const path = 'some/path/without/extension';
        const result = normalizePhotoPaths(path);
        expect(result).toEqual({
          originalPath: path,
          displayPath: path,
        });
      });

      it('should return same path for single filename', () => {
        const filename = 'photo.jpg';
        const result = normalizePhotoPaths(filename);
        expect(result).toEqual({
          originalPath: filename,
          displayPath: filename,
        });
      });

      it('should not confuse display/original in middle of path', () => {
        // "display" appears in folder name but not at end
        const path = 'display_folder/item1/photo.jpg';
        const result = normalizePhotoPaths(path);
        expect(result).toEqual({
          originalPath: path,
          displayPath: path,
        });
      });

      it('should not confuse display/original when not before extension', () => {
        const path = 'display123/photo.jpg';
        const result = normalizePhotoPaths(path);
        expect(result).toEqual({
          originalPath: path,
          displayPath: path,
        });
      });
    });

    describe('Edge cases - complex paths', () => {
      it('should handle deeply nested paths', () => {
        const path = 'user/very/deeply/nested/folder/structure/item/display.jpg';
        const result = normalizePhotoPaths(path);
        expect(result).toEqual({
          displayPath: path,
          originalPath: 'user/very/deeply/nested/folder/structure/item/original.jpg',
        });
      });

      it('should handle paths with special characters', () => {
        const path = 'user-123/collection_abc/item@456/display.jpg';
        const result = normalizePhotoPaths(path);
        expect(result).toEqual({
          displayPath: path,
          originalPath: 'user-123/collection_abc/item@456/original.jpg',
        });
      });

      it('should handle paths with dots in folder names', () => {
        const path = 'user.name/collection.v2/item.1/display.jpg';
        const result = normalizePhotoPaths(path);
        expect(result).toEqual({
          displayPath: path,
          originalPath: 'user.name/collection.v2/item.1/original.jpg',
        });
      });

      it('should handle multiple extensions - display must be immediately before final extension', () => {
        // The pattern requires /display.ext or _display.ext, not .display.ext
        // So 'file.backup.display.jpg' doesn't match because there's a dot before display
        const path = 'path/to/file.backup.display.jpg';
        const result = normalizePhotoPaths(path);
        expect(result).toEqual({
          displayPath: path,
          originalPath: path, // No transformation - doesn't match the pattern
        });

        // This would match: /display.jpg or _display.jpg
        const validPath = 'path/to/file_display.jpg';
        const validResult = normalizePhotoPaths(validPath);
        expect(validResult).toEqual({
          displayPath: validPath,
          originalPath: 'path/to/file_original.jpg',
        });
      });
    });

    describe('Regression tests - prevent common bugs', () => {
      it('should not replace display/original in query parameters', () => {
        // External URL with display in query param should stay unchanged
        const url = 'https://cdn.example.com/photo.jpg?view=display';
        const result = normalizePhotoPaths(url);
        expect(result).toEqual({
          originalPath: url,
          displayPath: url,
        });
      });

      it('should handle asset keyword correctly', () => {
        // "asset" is a special marker in the app
        const assetMarker = 'asset';
        const result = normalizePhotoPaths(assetMarker);
        expect(result).toEqual({
          originalPath: assetMarker,
          displayPath: assetMarker,
        });
      });

      it('should match based on what comes immediately before extension', () => {
        // The regex matches what's at the END of the filename before the extension
        // 'display_thumb.jpg' ends with '_thumb.jpg', so it matches thumb pattern
        const path = 'path/display_thumb.jpg';
        const result = normalizePhotoPaths(path);
        // Should match _thumb pattern (what's at the end)
        expect(result.displayPath).toBe('path/display_display.jpg');
        expect(result.originalPath).toBe('path/display_original.jpg');

        // To match display, it must be at the end
        const displayPath = 'path/thumb_display.jpg';
        const displayResult = normalizePhotoPaths(displayPath);
        expect(displayResult.displayPath).toBe('path/thumb_display.jpg');
        expect(displayResult.originalPath).toBe('path/thumb_original.jpg');
      });
    });
  });
});
