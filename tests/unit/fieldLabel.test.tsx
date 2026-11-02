/**
 * CUR-29 — custom field labels follow the language toggle.
 *
 * Guards the `getFieldTranslation` lookup that the Add Item verify step (and the
 * Filter modal / Exhibition metadata, CUR-28) use to render field labels: labels
 * resolve per-locale (keyed by field id, like `label_<id>`), fall back to a
 * custom field's own `label` when no localized key exists, and return the raw
 * field id when there is nothing else to show. The completeness check keeps every
 * built-in template field from silently falling back to English under `zh` —
 * the exact mixed EN/ZH drift that breaks trust in localization.
 */

import { describe, it, expect } from 'vitest';
import { translations, getFieldTranslation, getFieldPreviewLabels } from '@/i18n';
import type { Language, TranslationKey } from '@/i18n';
import { TEMPLATES } from '@/constants';

// Minimal stand-in for the provider's `t`: same dict → fallback → key lookup,
// which is all `getFieldTranslation` depends on (it detects "missing" via
// `t(key) === key`). Mirrors the sibling getFieldHint guard.
const makeT =
  (lang: Language) =>
  (key: TranslationKey | (string & {})): string => {
    const dict = translations[lang] as Record<string, string>;
    const fallback = translations.en as Record<string, string>;
    return dict[key] ?? fallback[key] ?? String(key);
  };

const tEn = makeT('en');
const tZh = makeT('zh');

// Every distinct field id declared across the built-in templates. Derived from
// the source of truth so a newly added template field is covered automatically.
const TEMPLATE_FIELD_IDS = [
  ...new Set(TEMPLATES.flatMap((template) => template.fields.map((field) => field.id))),
];

describe('CUR-29 — getFieldTranslation', () => {
  it('resolves the English label for a built-in template field', () => {
    expect(getFieldTranslation(tEn, 'artist')).toBe(translations.en.label_artist);
    expect(getFieldTranslation(tEn, 'artist')).toBe('Artist');
  });

  it('resolves a localized (Chinese) label that differs from English', () => {
    const en = getFieldTranslation(tEn, 'artist');
    const zh = getFieldTranslation(tZh, 'artist');
    expect(zh).toBe(translations.zh.label_artist);
    expect(zh).not.toBe(en);
  });

  it('gives every built-in template field both an EN and a ZH label', () => {
    // Assert the dictionaries directly: a `t`-based check would let ZH silently
    // fall back to the English string (mixed EN/ZH), which is the exact drift
    // this guard exists to catch.
    for (const id of TEMPLATE_FIELD_IDS) {
      const key = `label_${id}`;
      expect(translations.en, `EN label for ${id}`).toHaveProperty(key);
      expect(translations.zh, `ZH label for ${id}`).toHaveProperty(key);
      expect((translations.zh as Record<string, string>)[key], `ZH label for ${id}`).toBeTruthy();
    }
  });

  it('falls back to a custom field label when no localized key exists', () => {
    const custom = 'Provenance';
    expect(getFieldTranslation(tEn, 'made_up_field', custom)).toBe(custom);
    expect(getFieldTranslation(tZh, 'made_up_field', custom)).toBe(custom);
  });

  it('returns the field id when there is no translation and no fallback', () => {
    expect(getFieldTranslation(tEn, 'made_up_field')).toBe('made_up_field');
  });
});

describe('CUR #521 — getFieldPreviewLabels (single-language card preview)', () => {
  it('shows authored labels verbatim in ZH when any field lacks a translation', () => {
    // The reported case: a custom "Antique toys" collection whose fields mix a
    // canonical id (type → 类型, year → 年份) with a user-authored one (Maker,
    // no `label_maker` key). The old per-field lookup produced the broken
    // "类型 • Maker • 年份"; the preview must now stay in one language.
    const fields = [
      { id: 'type', label: 'Type' },
      { id: 'maker', label: 'Maker' },
      { id: 'year', label: 'Year' },
    ];
    expect(getFieldPreviewLabels(tZh, fields)).toEqual(['Type', 'Maker', 'Year']);
    // Sanity check the precondition: `type`/`year` *do* have ZH labels, so the
    // mix is real and the all-or-nothing rule (not a missing dictionary) is what
    // keeps the list in English.
    expect(getFieldTranslation(tZh, 'type')).toBe(translations.zh.label_type);
    expect(getFieldTranslation(tZh, 'year')).toBe(translations.zh.label_year);
  });

  it('localizes every label in ZH when all fields are translatable', () => {
    const fields = [
      { id: 'type', label: 'Type' },
      { id: 'year', label: 'Year' },
    ];
    expect(getFieldPreviewLabels(tZh, fields)).toEqual([
      translations.zh.label_type,
      translations.zh.label_year,
    ]);
  });

  it('is a no-op for English readers (both branches read the same)', () => {
    const fields = [
      { id: 'type', label: 'Type' },
      { id: 'maker', label: 'Maker' },
    ];
    expect(getFieldPreviewLabels(tEn, fields)).toEqual(['Type', 'Maker']);
  });
});
