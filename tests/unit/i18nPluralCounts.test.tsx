/**
 * CUR-146 — singular piece counts.
 *
 * "Save 1 pieces" / "1 pieces" read as sloppiness on the highest-polish
 * surfaces (first-run Home subtitle, the batch save CTA, the collection
 * header). Pin the singular/plural key pairs so count=1 renders
 * "piece"/"collection", and pin ZH output byte-identical across each pair
 * (Chinese has no plural inflection).
 */

import { describe, it, expect } from 'vitest';
import { translations } from '@/i18n';

describe('CUR-146 — singular piece counts', () => {
  it('EN singular/plural pairs differ only in number', () => {
    expect(translations.en.artifactCataloged).toBe('{n} piece');
    expect(translations.en.artifactsCataloged).toBe('{n} pieces');
    expect(translations.en.archiveArtifact).toBe('Save {count} piece');
    expect(translations.en.archiveArtifacts).toBe('Save {count} pieces');
    expect(translations.en.collectionCount).toBe('{n} collection');
    expect(translations.en.collectionsCount).toBe('{n} collections');
  });

  it('ZH pairs stay identical (no plural inflection)', () => {
    expect(translations.zh.artifactCataloged).toBe(translations.zh.artifactsCataloged);
    expect(translations.zh.archiveArtifact).toBe(translations.zh.archiveArtifacts);
    expect(translations.zh.collectionCount).toBe(translations.zh.collectionsCount);
  });

  it('home subtitle composes pre-pluralized parts and keeps prior ZH output', () => {
    expect(translations.en.homeMuseumSubtitle).toBe('{collections} · {items}');
    const zhSubtitle = translations.zh.homeMuseumSubtitle
      .replace('{collections}', translations.zh.collectionsCount.replace('{n}', '3'))
      .replace('{items}', translations.zh.artifactsCataloged.replace('{n}', '7'));
    expect(zhSubtitle).toBe('3 个收藏集 · 7 件藏品');
  });
});
