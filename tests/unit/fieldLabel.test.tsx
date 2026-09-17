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
import { translations, getFieldTranslation } from '@/i18n';
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
    for (const id of TEMPLATE_FIELD_IDS) {
      const en = getFieldTranslation(tEn, id);
      const zh = getFieldTranslation(tZh, id);
      // A missing key would fall back to the id, so a resolved label proves the
      // localized string exists for that locale.
      expect(en, `EN label for ${id}`).not.toBe(id);
      expect(zh, `ZH label for ${id}`).not.toBe(id);
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
