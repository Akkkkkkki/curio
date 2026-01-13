import { describe, it, expect } from 'vitest';
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
  frameAccentClasses,
  cardHoverClasses,
  inputClasses,
} from '@/theme';

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
      expect(typographyClasses.labelMuted).toContain('opacity-50');
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
      expect(themeColors.atelier.mat).toBe('#F5F1E7');
      expect(themeColors.atelier.frameAccent).toBe('#8B7355');
      expect(themeColors.atelier.accent).toBe('#8B7355');
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
      expect(labelColorClasses.atelier).toContain('text-stone');
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

    it('atelier theme uses cream background', () => {
      expect(cardSurfaceClasses.atelier).toContain('bg-[#f8f6f1]');
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
      expect(matSurfaceClasses.atelier).toContain('#F5F1E7');
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
      expect(ratingColorClasses.atelier).toContain('amber');
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

  describe('frameAccentClasses', () => {
    it('has all three themes', () => {
      expect(frameAccentClasses.gallery).toBeDefined();
      expect(frameAccentClasses.vault).toBeDefined();
      expect(frameAccentClasses.atelier).toBeDefined();
    });

    it('uses correct accent colors', () => {
      expect(frameAccentClasses.gallery).toContain('#1A1A1A');
      expect(frameAccentClasses.vault).toContain('#D4A574');
      expect(frameAccentClasses.atelier).toContain('#8B7355');
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
  });
});
