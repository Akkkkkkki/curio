/**
 * Phase 1: Field validation utilities
 *
 * Tests label normalization, reserved/duplicate detection, and selection rules.
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeFieldLabel,
  isReservedFieldLabel,
  findDuplicateLabel,
  validateFieldLabel,
  validateFieldSelection,
  FIELD_LABEL_MAX_LENGTH,
  FIELD_MAX_COUNT,
  FIELD_MIN_COUNT,
  PINNED_MAX_COUNT,
  PINNED_MIN_COUNT,
} from '@/utils/fieldValidation';

describe('fieldValidation utilities', () => {
  describe('normalizeFieldLabel', () => {
    it('trims and collapses whitespace', () => {
      expect(normalizeFieldLabel('  Release   Year  ')).toBe('Release Year');
    });
  });

  describe('isReservedFieldLabel', () => {
    it('detects reserved labels (case insensitive)', () => {
      expect(isReservedFieldLabel('Title')).toBe(true);
      expect(isReservedFieldLabel('  NOTES ')).toBe(true);
    });

    it('returns false for non-reserved labels', () => {
      expect(isReservedFieldLabel('Artist')).toBe(false);
    });
  });

  describe('findDuplicateLabel', () => {
    it('detects duplicates after normalization', () => {
      const existing = ['Release Year', 'Artist'];
      expect(findDuplicateLabel('release   year', existing)).toBe(true);
    });

    it('returns false for unique labels', () => {
      expect(findDuplicateLabel('Condition', ['Artist', 'Album'])).toBe(false);
    });
  });

  describe('validateFieldLabel', () => {
    it('rejects empty labels', () => {
      expect(validateFieldLabel('   ', [])).toEqual({
        ok: false,
        reason: 'empty',
        label: '',
      });
    });

    it('rejects labels longer than max length', () => {
      const longLabel = 'a'.repeat(FIELD_LABEL_MAX_LENGTH + 1);
      expect(validateFieldLabel(longLabel, [])).toEqual({
        ok: false,
        reason: 'too-long',
        label: longLabel,
      });
    });

    it('rejects reserved labels', () => {
      expect(validateFieldLabel('Title', [])).toEqual({
        ok: false,
        reason: 'reserved',
        label: 'Title',
      });
    });

    it('rejects duplicate labels', () => {
      expect(validateFieldLabel('Artist', ['artist'])).toEqual({
        ok: false,
        reason: 'duplicate',
        label: 'Artist',
      });
    });

    it('returns normalized label when valid', () => {
      expect(validateFieldLabel('  Release   Year ', ['Artist'])).toEqual({
        ok: true,
        reason: null,
        label: 'Release Year',
      });
    });
  });

  describe('validateFieldSelection', () => {
    it('enforces minimum field count', () => {
      const result = validateFieldSelection(Array(FIELD_MIN_COUNT - 1).fill('field'), ['a']);
      expect(result).toEqual({ ok: false, reason: 'min' });
    });

    it('enforces maximum field count', () => {
      const result = validateFieldSelection(Array(FIELD_MAX_COUNT + 1).fill('field'), ['a']);
      expect(result).toEqual({ ok: false, reason: 'max' });
    });

    it('enforces minimum pinned count', () => {
      const result = validateFieldSelection(Array(FIELD_MIN_COUNT).fill('field'), []);
      expect(result).toEqual({ ok: false, reason: 'pin-min' });
    });

    it('enforces maximum pinned count', () => {
      const result = validateFieldSelection(
        Array(FIELD_MIN_COUNT).fill('field'),
        Array(PINNED_MAX_COUNT + 1).fill('pinned'),
      );
      expect(result).toEqual({ ok: false, reason: 'pin-max' });
    });

    it('returns ok when counts are within limits', () => {
      const result = validateFieldSelection(
        Array(FIELD_MIN_COUNT).fill('field'),
        Array(PINNED_MIN_COUNT).fill('pinned'),
      );
      expect(result).toEqual({ ok: true, reason: null });
    });
  });
});
