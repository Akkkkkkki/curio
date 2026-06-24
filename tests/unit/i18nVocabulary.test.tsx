/**
 * CUR-122 — warm product vocabulary.
 *
 * Pin the "registrar → thoughtful friend" copy pass in place: no user-facing
 * i18n value should drift back to the archivist words ("artifact", "archive",
 * "archival", "cataloged" in English; 档案 / 编目 in Chinese), and the headline
 * replacements from the review must keep their warmer wording.
 */

import { describe, it, expect } from 'vitest';
import { translations } from '@/i18n';

const COLD_EN = /\b(artifact|archive|archival|cataloged)\b/i;
const COLD_ZH = /(档案|编目)/;

describe('CUR-122 — warm product vocabulary', () => {
  it('English i18n values avoid archivist vocabulary', () => {
    const offenders = Object.entries(translations.en)
      .filter(([, value]) => typeof value === 'string' && COLD_EN.test(value))
      .map(([key, value]) => `${key} → ${value}`);
    expect(offenders).toEqual([]);
  });

  it('Chinese i18n values avoid archivist vocabulary', () => {
    const offenders = Object.entries(translations.zh)
      .filter(([, value]) => typeof value === 'string' && COLD_ZH.test(value))
      .map(([key, value]) => `${key} → ${value}`);
    expect(offenders).toEqual([]);
  });

  it('headline replacements from the UX review are in place (EN)', () => {
    expect(translations.en.artifacts).toBe('Pieces');
    expect(translations.en.archives).toBe('Collections');
    expect(translations.en.featuredArtifact).toBe('In the spotlight');
    expect(translations.en.newArchive).toBe('Start a collection');
    expect(translations.en.restoringArchives).toBe('Opening your museum...');
    expect(translations.en.archivalRecord).toBe('From my museum');
  });

  it('headline replacements from the UX review are in place (ZH)', () => {
    expect(translations.zh.artifacts).toBe('藏品');
    expect(translations.zh.archives).toBe('收藏集');
    expect(translations.zh.newArchive).toBe('开始收藏');
    expect(translations.zh.archivalRecord).toBe('来自我的博物馆');
  });

  // The save-confirmation copy must not claim backup until the cloud write
  // confirms. `statusSaved` fires optimistically at local-save time (App.tsx
  // ~872, ~1015) — that toast stays a plain "Saved". The warmer "Saved &
  // backed up" claim is reserved for `statusSynced`, which only fires on a
  // confirmed cloud sync. Reverses fake certainty for offline / failing-sync
  // sessions (Trust before growth; raised in PR #307 review).
  it('reserves "Saved & backed up" for the confirmed-sync toast', () => {
    expect(translations.en.statusSaved).toBe('Saved');
    expect(translations.en.statusSynced).toBe('Saved & backed up');
    expect(translations.zh.statusSaved).toBe('已保存');
    expect(translations.zh.statusSynced).toBe('已保存并备份');
  });
});
