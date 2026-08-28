import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  typographyClasses,
  themeColors,
  labelColorClasses,
  cardSurfaceClasses,
  matSurfaceClasses,
  dividerClasses,
  ratingColorClasses,
  ratingEmptyClasses,
  accentColorClasses,
  accentLabelColorClasses,
  frameAccentClasses,
  cardHoverClasses,
  inputClasses,
} from '@/theme';

const relativeLuminance = (hex: string) => {
  const channels = hex
    .replace('#', '')
    .match(/.{2}/g)!
    .map((channel) => parseInt(channel, 16) / 255)
    .map((value) => (value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4)));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

const contrastRatio = (foreground: string, background: string) => {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
};

describe('Theme Utilities', () => {
  describe('typographyClasses', () => {
    it('has title classes', () => {
      expect(typographyClasses.title).toContain('font-serif');
      expect(typographyClasses.title).toContain('font-bold');
    });

    it('has titleLarge classes', () => {
      expect(typographyClasses.titleLarge).toContain('font-serif');
      expect(typographyClasses.titleLarge).toContain('text-2xl');
    });

    it('has titleHero classes', () => {
      expect(typographyClasses.titleHero).toContain('font-serif');
      expect(typographyClasses.titleHero).toContain('text-3xl');
    });

    it('has label classes with mono font', () => {
      expect(typographyClasses.label).toContain('font-mono');
      expect(typographyClasses.label).toContain('uppercase');
    });

    it('has labelMuted classes', () => {
      expect(typographyClasses.labelMuted).toContain('font-mono');
      expect(typographyClasses.labelMuted).toContain('font-medium');
    });

    it('has body classes with sans font', () => {
      expect(typographyClasses.body).toContain('font-sans');
      expect(typographyClasses.body).toContain('leading-relaxed');
    });

    it('has accession classes', () => {
      expect(typographyClasses.accession).toContain('font-mono');
      expect(typographyClasses.accession).toContain('opacity-30');
    });

    it('has quote classes', () => {
      expect(typographyClasses.quote).toContain('font-serif');
      expect(typographyClasses.quote).toContain('italic');
    });
  });

  describe('themeColors', () => {
    it('has gallery theme colors', () => {
      expect(themeColors.gallery.mat).toBe('#F5F5F5');
      expect(themeColors.gallery.frameAccent).toBe('#1A1A1A');
      expect(themeColors.gallery.accent).toBe('#D97706');
    });

    it('has vault theme colors', () => {
      expect(themeColors.vault.mat).toBe('#1C1917');
      expect(themeColors.vault.frameAccent).toBe('#D4A574');
      expect(themeColors.vault.accent).toBe('#D4A574');
    });

    it('has atelier theme colors', () => {
      expect(themeColors.atelier.mat).toBe('#EDE4D3');
      expect(themeColors.atelier.frameAccent).toBe('#6B5344');
      expect(themeColors.atelier.accent).toBe('#8B5A2B');
      expect(themeColors.atelier.accentHover).toBe('#73481F');
      expect(themeColors.atelier.textMuted).toBe('#6F6257');
    });

    it('keeps Atelier text and accent combinations at WCAG AA contrast', () => {
      expect(contrastRatio('#FFFFFF', themeColors.atelier.accent)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio('#FFFFFF', themeColors.atelier.accentHover)).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(themeColors.atelier.textMuted, themeColors.atelier.surface),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(themeColors.atelier.textMuted, themeColors.atelier.surfaceMuted),
      ).toBeGreaterThanOrEqual(4.5);
    });
  });

  describe('labelColorClasses', () => {
    it('has all three themes', () => {
      expect(labelColorClasses.gallery).toBeDefined();
      expect(labelColorClasses.vault).toBeDefined();
      expect(labelColorClasses.atelier).toBeDefined();
    });

    it('uses appropriate colors per theme', () => {
      expect(labelColorClasses.gallery).toContain('text-stone');
      expect(labelColorClasses.vault).toContain('text-stone');
      expect(labelColorClasses.atelier).toContain('text-[#6F6257]');
    });

    // stone-500 (#78716c) fails WCAG AA on the Vault stone-900 surface
    // (~3.77:1); DESIGN.md sets Vault textMuted to stone-400 (#A8A29E).
    it('keeps Vault labels at or above stone-400 contrast', () => {
      expect(labelColorClasses.vault).toBe('text-stone-400');
    });

    // stone-400 (#A8A29E) only reaches ~2.4:1 on the Gallery light surface and
    // fails WCAG AA; DESIGN.md's Gallery "Text Muted" token is stone-500
    // (#78716C, ~4.8:1). Regression guard for #423.
    it('uses AA-compliant stone-500 for Gallery labels', () => {
      expect(labelColorClasses.gallery).toBe('text-stone-500');
    });
  });

  describe('cardSurfaceClasses', () => {
    it('has all three themes', () => {
      expect(cardSurfaceClasses.gallery).toBeDefined();
      expect(cardSurfaceClasses.vault).toBeDefined();
      expect(cardSurfaceClasses.atelier).toBeDefined();
    });

    it('gallery theme uses white background', () => {
      expect(cardSurfaceClasses.gallery).toContain('bg-white');
    });

    it('vault theme uses dark background', () => {
      expect(cardSurfaceClasses.vault).toContain('bg-stone-950');
    });

    it('atelier theme uses warm cream background', () => {
      expect(cardSurfaceClasses.atelier).toContain('bg-[#F5EFE4]');
    });
  });

  describe('matSurfaceClasses', () => {
    it('has all three themes', () => {
      expect(matSurfaceClasses.gallery).toBeDefined();
      expect(matSurfaceClasses.vault).toBeDefined();
      expect(matSurfaceClasses.atelier).toBeDefined();
    });

    it('uses correct mat colors', () => {
      expect(matSurfaceClasses.gallery).toContain('#F5F5F5');
      expect(matSurfaceClasses.vault).toContain('#1C1917');
      expect(matSurfaceClasses.atelier).toContain('#EDE4D3');
    });
  });

  describe('dividerClasses', () => {
    it('has all three themes', () => {
      expect(dividerClasses.gallery).toBeDefined();
      expect(dividerClasses.vault).toBeDefined();
      expect(dividerClasses.atelier).toBeDefined();
    });

    it('uses border styles', () => {
      expect(dividerClasses.gallery).toContain('border');
      expect(dividerClasses.vault).toContain('border');
      expect(dividerClasses.atelier).toContain('border');
    });
  });

  describe('ratingColorClasses', () => {
    it('has all three themes', () => {
      expect(ratingColorClasses.gallery).toBeDefined();
      expect(ratingColorClasses.vault).toBeDefined();
      expect(ratingColorClasses.atelier).toBeDefined();
    });

    it('uses amber/brass colors', () => {
      expect(ratingColorClasses.gallery).toContain('amber');
      expect(ratingColorClasses.vault).toContain('#D4A574');
      expect(ratingColorClasses.atelier).toContain('#8B5A2B');
    });
  });

  describe('ratingEmptyClasses', () => {
    it('has all three themes', () => {
      expect(ratingEmptyClasses.gallery).toBeDefined();
      expect(ratingEmptyClasses.vault).toBeDefined();
      expect(ratingEmptyClasses.atelier).toBeDefined();
    });

    it('uses muted/transparent versions', () => {
      expect(ratingEmptyClasses.gallery).toContain('/30');
      expect(ratingEmptyClasses.vault).toContain('/30');
      expect(ratingEmptyClasses.atelier).toContain('/30');
    });
  });

  describe('accentColorClasses', () => {
    it('has all three themes', () => {
      expect(accentColorClasses.gallery).toBeDefined();
      expect(accentColorClasses.vault).toBeDefined();
      expect(accentColorClasses.atelier).toBeDefined();
    });

    it('includes hover states', () => {
      expect(accentColorClasses.gallery).toContain('hover:');
      expect(accentColorClasses.vault).toContain('hover:');
      expect(accentColorClasses.atelier).toContain('hover:');
    });
  });

  describe('accentLabelColorClasses', () => {
    it('has all three themes', () => {
      expect(accentLabelColorClasses.gallery).toBeDefined();
      expect(accentLabelColorClasses.vault).toBeDefined();
      expect(accentLabelColorClasses.atelier).toBeDefined();
    });

    // The interactive accent amber-600 (~3.05:1 on white) fails WCAG AA as
    // static label text; eyebrow labels use amber-700 (#B45309, ~4.6:1), which
    // DESIGN.md already defines as "Accent Hover". Regression guard for #423.
    it('uses the AA-compliant darker accent for Gallery label text', () => {
      expect(accentLabelColorClasses.gallery).toBe('text-amber-700');
      expect(accentLabelColorClasses.gallery).not.toContain('amber-600');
    });

    // Label text is static, so no hover state is needed (unlike the
    // interactive accentColorClasses).
    it('does not carry a hover state', () => {
      expect(accentLabelColorClasses.gallery).not.toContain('hover:');
      expect(accentLabelColorClasses.vault).not.toContain('hover:');
      expect(accentLabelColorClasses.atelier).not.toContain('hover:');
    });
  });

  describe('frameAccentClasses', () => {
    it('has all three themes', () => {
      expect(frameAccentClasses.gallery).toBeDefined();
      expect(frameAccentClasses.vault).toBeDefined();
      expect(frameAccentClasses.atelier).toBeDefined();
    });

    it('uses correct accent colors', () => {
      expect(frameAccentClasses.gallery).toContain('#1A1A1A');
      expect(frameAccentClasses.vault).toContain('#D4A574');
      expect(frameAccentClasses.atelier).toContain('#6B5344');
    });
  });

  describe('cardHoverClasses', () => {
    it('has all three themes', () => {
      expect(cardHoverClasses.gallery).toBeDefined();
      expect(cardHoverClasses.vault).toBeDefined();
      expect(cardHoverClasses.atelier).toBeDefined();
    });

    it('includes transition and hover effects', () => {
      expect(cardHoverClasses.gallery).toContain('transition');
      expect(cardHoverClasses.gallery).toContain('hover:');
    });
  });

  describe('inputClasses', () => {
    it('has all three themes', () => {
      expect(inputClasses.gallery).toBeDefined();
      expect(inputClasses.vault).toBeDefined();
      expect(inputClasses.atelier).toBeDefined();
    });

    it('includes focus states', () => {
      expect(inputClasses.gallery).toContain('focus:');
      expect(inputClasses.vault).toContain('focus:');
      expect(inputClasses.atelier).toContain('focus:');
    });

    it('includes placeholder styles', () => {
      expect(inputClasses.gallery).toContain('placeholder:');
      expect(inputClasses.vault).toContain('placeholder:');
      expect(inputClasses.atelier).toContain('placeholder:');
    });

    // Mirrors labelColorClasses contrast guarantee — see comment above.
    it('uses stone-400 placeholders on Vault for WCAG AA contrast', () => {
      expect(inputClasses.vault).toContain('placeholder:text-stone-400');
    });

    it('uses the AA-compliant Atelier muted token for placeholders', () => {
      expect(inputClasses.atelier).toContain('placeholder:text-[#6F6257]');
    });
  });

  // CUR-111: retiring the Atelier tokens in this module is only half the fix —
  // production components hard-code the same hex values in their own per-theme
  // class maps, so the old palette has to be gone from the whole source tree or
  // the common flows keep rendering the sub-AA colors.
  describe('retired Atelier palette', () => {
    const RETIRED = ['#8C7B6B', '#A86F3C'];

    const sourceFiles = () => {
      const roots = [resolve(__dirname, '../../src')];
      const files: string[] = [];
      while (roots.length) {
        const dir = roots.pop()!;
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          const full = join(dir, entry.name);
          if (entry.isDirectory()) roots.push(full);
          else if (/\.(ts|tsx|css)$/.test(entry.name)) files.push(full);
        }
      }
      return files;
    };

    it('no longer appears anywhere in src/', () => {
      const offenders = sourceFiles().filter((file) => {
        const contents = readFileSync(file, 'utf8');
        return RETIRED.some((hex) => contents.includes(hex));
      });
      expect(offenders).toEqual([]);
    });
  });

  // CUR-111: `opacity-50` composited even the AA-compliant #6F6257 down to
  // ~2:1 against the Atelier surface, so muted labels stayed unreadable while
  // token-only tests reported compliance. The muting is a color token now.
  describe('labelMuted', () => {
    it('does not dim readable labels with opacity', () => {
      expect(typographyClasses.labelMuted).not.toContain('opacity-');
    });

    it('still reads as muted through weight rather than transparency', () => {
      expect(typographyClasses.labelMuted).toContain('font-medium');
      expect(typographyClasses.label).toContain('font-bold');
    });
  });
});
