/**
 * CUR-48 — template presets must localize in ZH mode.
 *
 * The collection preset shelf (CreateCollectionModal) and the CollectionCard
 * description fallback used to render the English `template.name` /
 * `template.description` from constants.ts even in Chinese mode, leaving a
 * visibly mixed EN/ZH UI. `getTemplateName` / `getTemplateDescription` now look
 * up a per-locale override and fall back to the English source of truth.
 */

import { describe, it, expect } from 'vitest';
import { translations, getTemplateName, getTemplateDescription } from '@/i18n';
import { TEMPLATES } from '@/constants';

type Lang = keyof typeof translations;

// Mirror the LanguageProvider's lookup (locale dict → English fallback → key)
// without standing up the React context, so we can exercise both locales.
const makeT =
  (lang: Lang) =>
  (key: string): string => {
    const dict = translations[lang] as Record<string, string>;
    const fallback = translations.en as Record<string, string>;
    return dict[key] || fallback[key] || key;
  };

describe('CUR-48 — collection template localization', () => {
  it('every template preset has a Chinese name and description override', () => {
    const missing: string[] = [];
    for (const template of TEMPLATES) {
      const zh = translations.zh as Record<string, string>;
      if (!zh[`template_${template.id}_name`]) missing.push(`template_${template.id}_name`);
      if (!zh[`template_${template.id}_desc`]) missing.push(`template_${template.id}_desc`);
    }
    expect(missing).toEqual([]);
  });

  it('resolves the Chinese override in ZH mode', () => {
    const t = makeT('zh');
    expect(getTemplateName(t, 'vinyl', 'Vinyl Archives')).toBe('黑胶收藏');
    expect(getTemplateDescription(t, 'chocolate', 'ignored')).toBe(
      '记录产地风土、可可含量与细腻的风味层次。',
    );
  });

  it('falls back to the English source of truth when no override exists', () => {
    const t = makeT('en');
    const vinyl = TEMPLATES.find((tpl) => tpl.id === 'vinyl')!;
    expect(getTemplateName(t, vinyl.id, vinyl.name)).toBe(vinyl.name);
    expect(getTemplateDescription(t, vinyl.id, vinyl.description)).toBe(vinyl.description);
    // Unknown / future custom templates also fall through to the fallback.
    expect(getTemplateName(t, 'not-a-template', 'My Collection')).toBe('My Collection');
  });

  it('Chinese template overrides contain no leftover English text', () => {
    const zh = translations.zh as Record<string, string>;
    const offenders = Object.entries(zh)
      .filter(([key]) => key.startsWith('template_'))
      .filter(([, value]) => /[A-Za-z]/.test(value))
      .map(([key, value]) => `${key} → ${value}`);
    expect(offenders).toEqual([]);
  });
});
