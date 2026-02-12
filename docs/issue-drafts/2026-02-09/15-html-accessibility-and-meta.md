## Title

index.html has hardcoded lang attribute and missing meta tags for SEO and accessibility

## Labels

- type:bug
- area:i18n
- severity:p2

## Problem

`index.html` has several accessibility and SEO issues:

1. **Line 2: `lang="en"` hardcoded** - Conflicts with the in-app LanguageProvider. When users switch to Chinese, screen readers still announce content as English. The `lang` attribute should update dynamically.

2. **Line 6: `theme-color` hardcoded** - Doesn't update when user switches between Gallery (light), Vault (dark), and Atelier (warm) themes.

3. **Missing meta tags:**
   - No `<meta name="description">` for SEO
   - No Open Graph tags for social sharing previews
   - No `<noscript>` fallback message

4. **No skip-to-content link** for keyboard navigation accessibility.

5. **No CSP (Content Security Policy)** headers - allows inline scripts and external resources without integrity checks.

## Expected

- `lang` attribute updated dynamically when language changes
- `theme-color` updated when theme changes
- Basic meta tags for SEO and social sharing
- Skip-to-content link for keyboard users

## Actual

Static HTML attributes conflict with dynamic app state.

## Acceptance Criteria

- [ ] `document.documentElement.lang` updated on language change
- [ ] `<meta name="theme-color">` updated on theme change
- [ ] `<meta name="description">` added
- [ ] Skip-to-content link added
- [ ] `<noscript>` fallback message added
