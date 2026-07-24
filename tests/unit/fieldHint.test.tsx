/**
 * CUR-52 — optional field-level hints.
 *
 * Guards the `getFieldHint` lookup and the built-in hint copy: hints resolve
 * per-locale (keyed by field id, like `label_<id>`), fall back to a custom
 * field's own `hint`, and return '' when there is nothing to show so callers
 * can render conditionally.
 */

import { describe, it, expect } from 'vitest';
import { translations, getFieldHint } from '@/i18n';
import type { Language, TranslationKey } from '@/i18n';

// Minimal stand-in for the provider's `t`: same dict → fallback → key lookup,
// which is all `getFieldHint` depends on (it detects "missing" via `t(key) === key`).
const makeT =
  (lang: Language) =>
  (key: TranslationKey | (string & {})): string => {
    const dict = translations[lang] as Record<string, string>;
    const fallback = translations.en as Record<string, string>;
    return dict[key] ?? fallback[key] ?? String(key);
  };

const tEn = makeT('en');
const tZh = makeT('zh');

// Fields that carry hint copy in i18n. Kept in sync with the `hint_*` keys.
const HINTED_FIELDS = [
  'cocoa_percent',
  'origin',
  'batch',
  'concentration',
  'notes_top',
  'notes_heart',
  'notes_base',
  'style_code',
  'colorway',
  'deadstock',
  'speed',
  'condition',
  'abv',
  'age',
  'region',
];

describe('CUR-52 — getFieldHint', () => {
  it('resolves the English hint for a built-in jargon field', () => {
    expect(getFieldHint(tEn, 'cocoa_percent')).toBe(translations.en.hint_cocoa_percent);
    expect(getFieldHint(tEn, 'cocoa_percent')).toMatch(/cocoa/i);
  });

  it('resolves a localized (Chinese) hint that differs from English', () => {
    const en = getFieldHint(tEn, 'abv');
    const zh = getFieldHint(tZh, 'abv');
    expect(zh).toBe(translations.zh.hint_abv);
    expect(zh).not.toBe(en);
  });

  it('every hinted field has both an EN and a ZH hint', () => {
    for (const id of HINTED_FIELDS) {
      expect(getFieldHint(tEn, id), `EN hint for ${id}`).not.toBe('');
      expect(getFieldHint(tZh, id), `ZH hint for ${id}`).not.toBe('');
    }
  });

  it('falls back to a custom field hint when no localized key exists', () => {
    const custom = 'The maker printed this on the sleeve.';
    expect(getFieldHint(tEn, 'made_up_field', custom)).toBe(custom);
  });

  it('returns an empty string when there is no hint and no fallback', () => {
    expect(getFieldHint(tEn, 'made_up_field')).toBe('');
    // A plain label field with no hint copy stays hintless.
    expect(getFieldHint(tEn, 'category')).toBe('');
  });
});
