# Curio: Android Production Readiness Review

> **Date:** 2026-03-15
> **Scope:** Technical and product review for Android commercial launch
> **Reviewer:** Automated deep review of full codebase, architecture, and existing docs

---

## Executive Summary

Curio is a well-architected personal collection management app with a Capacitor-based Android shell, Supabase cloud backend, and Gemini AI integration. The existing codebase has a solid foundation—well-defined theme system, reasonable test coverage, CI pipeline, and a production readiness checklist already in progress.

However, **the app is not yet ready for a commercial Android launch.** There are critical gaps across security, Android-specific readiness, performance, and commercial product requirements that must be addressed first.

This review consolidates findings from a full code audit along with the project's existing `PRODUCTION_READINESS_CHECKLIST.md` and `TECHNICAL_DEBT_ANALYSIS.md`, and adds Android-specific and commercial-readiness concerns that those documents don't cover.

---

## Priority Tiers

| Tier                         | Definition                             | Timeline   |
| ---------------------------- | -------------------------------------- | ---------- |
| **P0 – Launch Blockers**     | Must fix before any commercial release | 1-2 weeks  |
| **P1 – Pre-Launch Critical** | Must fix before Play Store submission  | 2-4 weeks  |
| **P2 – Early Production**    | Fix within first production month      | 1-2 months |
| **P3 – Polish**              | Address when convenient                | Ongoing    |

---

## P0 — Launch Blockers

### 1. Tailwind CSS loaded via CDN in production

**Risk: HIGH — Performance, reliability, offline failure**

The app loads Tailwind from `https://cdn.tailwindcss.com` via a `<script>` tag in `index.html`. This is the Tailwind Play CDN meant for prototyping only.

**Problems for Android commercial launch:**

- **No offline styling:** When the WebView has no internet (common on mobile), the entire app renders unstyled
- **Performance:** The CDN JIT-compiles Tailwind on every page load — adds 200-500ms to startup
- **Bundle size:** Downloads the full Tailwind runtime (~300KB) instead of only used classes (~10-30KB with purge)
- **Reliability:** CDN outage = broken app for all users
- **Console suppression hack:** `index.html` lines 9-29 suppress Tailwind CDN warnings, confirming this is a known concern

**Fix:** Install Tailwind as a build dependency, configure PostCSS, and purge unused styles at build time. This is the standard production setup.

**Effort:** 1-2 days

### 2. PWA manifest icon paths are broken

**Risk: HIGH — Android install and PWA experience broken**

`manifest.webmanifest` references icons at `assets/icons/icon-48.webp`, `icon-72.webp`, etc., but these files don't exist. Only `icon-192.svg` and `icon-512.svg` exist in `public/`. The manifest also declares `"type": "image/png"` for `.webp` files.

**Problems:**

- Android "Add to Home Screen" will show a generic icon or fail
- PWA installability check fails (Lighthouse reports this as an error)
- Capacitor's Android shell inherits these issues for splash/shortcut

**Fix:** Generate the required icon sizes in `.webp` format and place them in `public/assets/icons/`, or update the manifest to reference the existing SVGs. The `scripts/generate-icon.mjs` exists but the output isn't committed.

**Effort:** 2-4 hours

### 3. Capacitor config is minimal — no server URL or deep linking

**Risk: HIGH — Android app can't reach backend**

`capacitor.config.ts` is bare-bones:

```typescript
const config: CapacitorConfig = {
  appId: 'com.curio.app',
  appName: 'Curio',
  webDir: 'dist',
};
```

**Missing for production Android:**

- `server.url` or `server.hostname` for the WebView to reach the correct API base URL
- No `plugins` configuration (Camera permissions, status bar, splash screen)
- No `android.allowMixedContent` setting (may be needed for development)
- No deep link / app link configuration
- No splash screen configuration (users see a white screen on launch)

**Fix:** Add proper Capacitor configuration for Android including server settings, plugin config, and splash screen.

**Effort:** 1 day

### 4. Android release build is not signed

**Risk: HIGH — Cannot upload to Play Store**

`android/app/build.gradle` has `minifyEnabled false` and no signing configuration for the release build type. The Google Play Submission Guide documents what to do, but the actual `build.gradle` hasn't been updated to match.

**Fix:** Add signing config to `build.gradle` (environment-variable-based, not hardcoded). Enable ProGuard/R8 minification for release builds.

**Effort:** 2-4 hours

### 5. No Content Security Policy

**Risk: HIGH — Security vulnerability for commercial app**

No CSP headers or meta tags exist. The app loads scripts from `cdn.tailwindcss.com` and fonts from `fonts.googleapis.com` without restriction. A WebView-based Android app without CSP is especially vulnerable to injection attacks.

**Fix:** After migrating Tailwind to build-time (P0 #1), add a strict CSP meta tag that allows only known origins for fonts and API calls.

**Effort:** 4-8 hours (after Tailwind migration)

---

## P1 — Pre-Launch Critical

### 6. Gemini proxy security hardening (partially done)

**Status:** CORS + JWT auth + rate limiting are implemented. Remaining gaps:

- **No startup validation:** Server starts without `GEMINI_API_KEY` and only fails when proxying requests. Should fail fast at startup in production.
- **Custom .env parser:** Lines 14-33 of `geminiProxy.js` implement a fragile env parser. Should use `dotenv` package.
- **No request body schema validation:** `imageBase64`, `fields`, etc. are destructured without type/size checks.
- **Error responses leak model names:** Error messages reference internal Gemini model names and config.
- **Metrics endpoint is unauthenticated:** `/api/metrics` exposes internal latency data publicly.

**Effort:** 2-3 days

### 7. Android-specific camera and permissions

**Current state:** `@capacitor/camera` is installed but:

- No runtime permission handling code visible in the app
- No fallback when camera permission is denied
- No guidance for users on why camera access is needed (required by Play Store)
- `AndroidManifest.xml` only declares `INTERNET` — missing `CAMERA` and `READ_MEDIA_IMAGES`

**Fix:** Add proper Android permission declarations, runtime permission requests, and denial handling UI.

**Effort:** 2-3 days

### 8. Image processing blocks the main thread

`imageProcessor.ts` uses `canvas.toBlob()` / `canvas.toDataURL()` on the main thread. On mid-range Android devices, processing a 12MP photo will freeze the UI for 2-5 seconds.

**Fix:** Move image processing to a Web Worker. Add a maximum dimension cap (e.g., 4096px) and file size limit (e.g., 20MB) to prevent OOM crashes on Android.

**Effort:** 3-5 days

### 9. No Android back button handling

The app uses HashRouter for SPA routing, but there's no handling of the Android hardware/gesture back button. Users pressing back will exit the app instead of navigating within the app.

**Fix:** Add Capacitor `App` plugin listener for `backButton` event and integrate with React Router navigation.

**Effort:** 1 day

### 10. App.tsx is a 2,290-line god component

This blocks testability, performance (no code splitting), and maintainability. Two full screen components (`CollectionScreen` and `ItemDetailScreen`) are defined as nested functions with closure-based state.

**Fix:** Extract screens into standalone route components, consolidate state into custom hooks. (Already tracked in Technical Debt Analysis as Draft #1.)

**Effort:** 1-2 weeks

### 11. Silent error swallowing masks sync failures

Multiple patterns across `db.ts`, `geminiService.ts`, and `App.tsx` where errors are caught and silently discarded. Users can lose data without knowing:

- `syncPendingDeletes` has an empty catch block
- `saveCollection` called without await in some paths (fire-and-forget)
- `deleteCloudItem` fire-and-forget
- `analyzeImage` returns `null` for both errors and disabled state

**Fix:** Establish consistent error handling strategy with user-visible failure states. (Already tracked as Draft #5.)

**Effort:** 2-3 days

### 12. Privacy policy and data safety declarations

Required for Google Play Store submission:

- Privacy policy URL must be live and accessible
- Data Safety form must accurately declare: email collection, photo collection, cloud sync, Gemini AI image processing
- Must disclose that photos are sent to Google Gemini for analysis (third-party data sharing)

**Fix:** Create and host a privacy policy (template provided in `GOOGLE_PLAY_SUBMISSION_GUIDE.md`), complete Data Safety form. Pay special attention to the Gemini disclosure.

**Effort:** 1-2 days

---

## P2 — Early Production

### 13. No crash reporting or analytics

For a commercial Android app, you need visibility into crashes and usage:

- No Sentry, Crashlytics, or equivalent
- No user analytics beyond Vercel Analytics (web only, doesn't work in Capacitor)
- 73 console.log statements pollute production but provide no actionable data

**Fix:** Add Firebase Crashlytics (free, works with Capacitor) or Sentry. Add basic event tracking.

**Effort:** 2-3 days

### 14. No Android-specific E2E testing

Playwright tests only cover Chromium desktop. No testing for:

- Android WebView rendering differences
- Capacitor plugin behavior (camera, filesystem)
- Touch interactions, mobile viewport sizes
- Android back button behavior

**Fix:** Add Playwright mobile viewport tests at minimum. Consider Appium or Detox for native integration tests before scale-up.

**Effort:** 3-5 days

### 15. Performance gaps for mobile devices

- **No list virtualization:** Large collections render all items, causing jank on Android
- **No lazy loading:** All images in a collection load simultaneously
- **No code splitting:** Entire app loads as one bundle (no route-based splitting possible while App.tsx is monolithic)
- **Sequential sync:** 10+ pending items sync sequentially instead of in parallel batches
- Search filters on every keystroke on home screen (debounced only in CollectionScreen)

**Fix:** Add pagination (partially implemented), virtualization for large lists, lazy image loading, and parallel sync with concurrency limits.

**Effort:** 1-2 weeks (incremental)

### 16. Incomplete i18n

~12 hardcoded English strings visible to Chinese-language users:

- `EnhanceImageModal.tsx`: "Image Error", "No Photo"
- `ExportModal.tsx`: "No Photo", "Image Error", "ARCHIVAL RECORD"
- `ItemImage.tsx`: "Image Error", "No Photo"
- `ErrorBoundary.tsx`: "Something went wrong", "Reload App"
- `AuthModal.tsx`: Feature descriptions

**Fix:** Replace with `t()` calls and add translation keys.

**Effort:** 1 day

### 17. `index.html` accessibility gaps

- `lang="en"` is hardcoded — doesn't update when user switches to Chinese
- `theme-color` meta tag doesn't reflect the active theme
- No `<meta name="description">` or Open Graph tags
- No skip-to-content link for keyboard navigation
- No `<noscript>` fallback

**Fix:** Dynamic `lang` attribute via LanguageProvider, dynamic theme-color, add meta tags.

**Effort:** 1 day

### 18. Service worker cache versioning is manual

`sw.js` uses hardcoded `curio-shell-v4`. There's no automated version generation from build hash. Old caches aren't cleaned up reliably. Users can get stale assets.

**Fix:** Generate SW cache name from build hash (Vite plugin or Workbox). Automate old cache cleanup.

**Effort:** 2 days

### 19. Supabase schema has no migration strategy

Four SQL files in `supabase/` are applied manually. No migration versioning, no rollback scripts, no CI validation of schema changes. `0_reset.sql` drops tables that may not exist. `3_profiles.sql` duplicates profile creation from `1_schema.sql`.

**Fix:** Adopt Supabase CLI migrations (`supabase migration new/up/down`). Clean up duplicate definitions.

**Effort:** 2-3 days

### 20. Missing test coverage for critical paths

11 components have zero tests (ConflictResolutionModal, CreateCollectionModal, EnhanceImageModal, ExhibitionView, ExportModal, FilterModal, ImageEditModal, ItemImage, etc.). Server endpoints have zero tests. No offline-to-online sync recovery tests.

**Fix:** Prioritize tests for AddItemModal flow, sync recovery, and server endpoints.

**Effort:** 2 weeks (incremental)

---

## P3 — Polish

### 21. Mobile UX enhancements

Per the existing `mobile-ui-design-review.md`:

- No swipe-to-dismiss for bottom sheet modals
- No haptic feedback on actions
- No skeleton loading screens (spinner-only)
- No page transition animations (instant route changes)
- Touch targets may be undersized (< 44px) on some elements
- No pull-to-refresh pattern

### 22. Collection deletion not implemented (#111)

Users cannot delete collections — a basic CRUD gap.

### 23. db.ts monolith (1,958 lines)

Mixes IndexedDB CRUD, Supabase sync, asset management, and merge logic. Should be split into focused modules for testability and maintainability.

### 24. Dead code

- `AppContext.tsx` is exported but never imported
- `connectMuseumGuide` in `geminiService.ts` always throws
- `MuseumGuide.tsx` is effectively dead code (the connection function is stubbed)

### 25. Type safety

20 `as any` casts across 10 files. Core data model uses `Record<string, any>`. Translation lookup is untyped.

---

## Android-Specific Concerns Summary

| Area               | Status                  | Action Required                        |
| ------------------ | ----------------------- | -------------------------------------- |
| Capacitor shell    | Minimal config          | P0: Add server, plugin, splash config  |
| Release signing    | Not configured          | P0: Add signing config to build.gradle |
| Camera permissions | Missing from manifest   | P1: Add permissions + runtime handling |
| Back button        | Not handled             | P1: Add Capacitor backButton listener  |
| Deep linking       | Not configured          | P2: Add app links if needed            |
| Push notifications | Not implemented         | P3: Consider for engagement            |
| App icon           | SVG only, missing sizes | P0: Generate required WebP/PNG sizes   |
| Splash screen      | Not configured          | P1: Configure Capacitor splash         |
| ProGuard           | Disabled                | P1: Enable for release builds          |
| Min SDK 24         | Android 7.0+            | OK — covers 97%+ of devices            |
| Target SDK 36      | Current                 | OK — meets Play Store requirements     |
| WebView compat     | Not tested              | P2: Test on older Android WebViews     |
| Play Store listing | Template ready          | P1: Prepare assets and submit          |
| Data safety        | Template ready          | P1: Complete accurately                |
| In-app updates     | Not implemented         | P2: Consider for update distribution   |

---

## Commercial Readiness Concerns

| Area                       | Gap                                                                           | Priority                        |
| -------------------------- | ----------------------------------------------------------------------------- | ------------------------------- |
| **Monetization**           | No pricing model, in-app purchase, or subscription infrastructure             | Must decide before launch       |
| **Terms of Service**       | No ToS exists                                                                 | P1: Required for commercial app |
| **GDPR compliance**        | No data export/deletion flow in app                                           | P1: Required for EU users       |
| **Account deletion**       | Privacy policy says users can delete accounts, but no in-app mechanism exists | P1: Play Store requirement      |
| **Abuse prevention**       | No content moderation for user-uploaded images                                | P2: Consider ToS + reporting    |
| **Rate limiting UX**       | No user-facing messaging when rate-limited by Gemini proxy                    | P1: Users see silent failures   |
| **Onboarding**             | First-run experience exists but needs Android-specific polish                 | P2                              |
| **App Store Optimization** | Store listing template ready but screenshots and feature graphic not created  | P1                              |
| **Customer support**       | No in-app support channel or feedback mechanism                               | P2                              |
| **Version management**     | versionCode=1, no automated versioning                                        | P1: Need CI/CD for releases     |

---

## Recommended Launch Sequence

### Phase 1: Foundation (Weeks 1-2)

1. Migrate Tailwind to build-time (P0 #1)
2. Fix manifest icons (P0 #2)
3. Configure Capacitor properly (P0 #3)
4. Set up Android signing (P0 #4)
5. Add CSP (P0 #5)

### Phase 2: Android Polish (Weeks 3-4)

6. Camera permissions and handling (P1 #7)
7. Android back button (P1 #9)
8. Proxy security hardening (P1 #6)
9. Image processing in Web Worker (P1 #8)
10. Privacy policy + ToS + data safety (P1 #12)

### Phase 3: Internal Testing (Week 5)

11. Build signed release AAB
12. Deploy to Google Play Internal Testing track
13. Test on 3+ real Android devices (low, mid, high-end)
14. Fix critical bugs found in testing

### Phase 4: Pre-Launch (Week 6)

15. Add crash reporting (P2 #13)
16. Fix i18n gaps (P2 #16)
17. Prepare store listing with screenshots
18. Submit to Google Play review

### Phase 5: Post-Launch (Ongoing)

19. Monitor crash reports and reviews
20. Address performance issues (P2 #15)
21. Expand test coverage (P2 #20)
22. Mobile UX polish (P3 #21)

**Estimated total time to Play Store submission: 6-8 weeks** with one dedicated developer. The first 2 weeks (Phase 1) are the most critical and unblock everything else.

---

## What's Already in Good Shape

Credit where due — these areas are solid:

- **Theme system:** Three cohesive themes with consistent design tokens
- **Sync architecture:** Cloud-first with IndexedDB cache, merge strategies, pending queues
- **AI integration:** Clean proxy pattern keeping API keys server-side
- **CI pipeline:** Format, test, build, E2E on every PR
- **Testing foundation:** Vitest + Playwright with good coverage for services and hooks
- **Supabase RLS:** Per-user isolation with public read for sample data
- **PWA offline strategy:** Sensible service worker caching patterns
- **Documentation:** Thorough CLAUDE.md, testing docs, existing readiness checklist
- **Error boundary:** Prevents blank screen on component crashes
- **Existing analysis:** Technical debt and production readiness already well-documented

The app's core functionality and architecture are sound. The gaps are primarily in Android-native integration, build configuration, and commercial operational readiness — all addressable with focused effort.
