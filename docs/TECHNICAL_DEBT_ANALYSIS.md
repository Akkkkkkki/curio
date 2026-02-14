# Curio Technical Debt Analysis

> Comprehensive prioritization, dependency mapping, and implementation plan for all open technical debt issues.
>
> **Generated:** 2026-02-12 | **Source:** PR #172 analysis + existing GitHub issues
> **Scope:** 15 issue drafts from PR #172 + 29 existing open GitHub issues

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Validation of All 15 Issue Drafts](#validation-of-all-15-issue-drafts)
3. [Priority Framework](#priority-framework)
4. [Consolidated Issue List (Merged Duplicates)](#consolidated-issue-list-merged-duplicates)
5. [4-Phase Implementation Plan](#4-phase-implementation-plan)
6. [Dependency Mapping](#dependency-mapping)
7. [Risk Assessment](#risk-assessment)
8. [Quick Wins vs. Deep Refactors](#quick-wins-vs-deep-refactors)
9. [Existing GitHub Issues Integration](#existing-github-issues-integration)
10. [Next Steps](#next-steps)

---

## Executive Summary

All 15 issue drafts from PR #172 represent **legitimate technical debt** that should be addressed. None should be dismissed. The question is not "if" but "when" and "in what order."

### Priority Distribution

| Priority        | Count | Timeline              | Description                                                        |
| --------------- | ----- | --------------------- | ------------------------------------------------------------------ |
| **P1 (High)**   | 4     | Fix within 1-2 weeks  | Security vulnerabilities, reliability blockers, architectural debt |
| **P2 (Medium)** | 8     | Fix within 1-3 months | Code quality, performance, testing, maintainability                |
| **P3 (Low)**    | 3     | Fix when convenient   | Cleanup, polish, non-blocking improvements                         |

### Key Findings

- **Two god components** (App.tsx at 2,289 lines and db.ts at 1,958 lines) block multiple downstream improvements
- **Security gap** in Gemini proxy server needs immediate remediation
- **Silent error swallowing** masks production failures and blocks debugging
- **20 `as any` casts** weaken TypeScript's value across the codebase
- **52% component test coverage** with 0% server endpoint coverage
- **73 console statements** pollute production browser console

---

## Validation of All 15 Issue Drafts

### Draft #1: App.tsx God Component (2,289 lines)

- **Valid:** YES
- **Severity:** P1 (Architecture)
- **Impact:** Blocks testing, prevents code-splitting, prevents route-based lazy loading
- **Details:** 30+ useState calls, two large screen components (CollectionScreen: lines 937-1423, ItemDetailScreen: lines 1425-1913) defined as nested functions creating problematic closures. Business logic (field ID building, undo/redo history) intermingled with UI rendering.
- **Target:** Reduce App.tsx to under 500 lines by extracting screens to standalone files and consolidating state into custom hooks (useSyncState, useModalState, useConflictState). Existing unused AppContext.tsx could serve as foundation.

### Draft #2: db.ts Monolith (1,958 lines)

- **Valid:** YES
- **Severity:** P1 (Architecture)
- **Impact:** Cannot test sync independently, blocks performance improvements, path normalization duplicated 3 times with different strategies
- **Details:** Mixes initialization/recovery (lines 1-135), data merge operations (lines 191-288), IndexedDB CRUD (lines 388-1385), Supabase sync (lines 1118-1197), asset management across 3 variants (lines 1288-1569), and orphan cleanup (lines 1903-1958).
- **Target:** Split into 4+ focused modules: dbCore.ts (init, recovery, store access), syncManager.ts (Supabase operations, pending changes, retry), assetManager.ts (storage, uploads, cleanup), mergeStrategy.ts (collection and item merge logic). Maintain public API, pass existing tests.

### Draft #3: Duplicate Auth Logic

- **Valid:** YES
- **Severity:** P2 (Bug)
- **Impact:** Fixes applied to one location won't be applied to the other; the hook version is actually safer (uses isActive guard for cleanup)
- **Details:** Auth initialization and admin status checking logic duplicated between `src/hooks/useAuthState.ts` (lines 26-51) and `src/App.tsx` (lines 331-399). Both implement identical `initAuth` async functions.
- **Target:** App.tsx uses useAuthState() hook; duplicate useEffect blocks removed. Auth behavior unchanged.

### Draft #4: Dead Code Cleanup

- **Valid:** YES
- **Severity:** P3 (Cleanup)
- **Impact:** Low; unused code adds cognitive load but no runtime issues
- **Details:** AppContext.tsx (45 lines) exports AppProvider and useAppContext but neither is imported anywhere. connectMuseumGuide in geminiService.ts (lines 193-202) is a non-functional stub that immediately throws errors, with underscore-prefixed params and type-unsafe `any` callback.
- **Target:** Delete AppContext.tsx entirely, remove stubbed function and MuseumGuideSession interface if unused. If AppContext becomes necessary for #1 refactoring, reconstruct fresh.

### Draft #5: Silent Error Swallowing

- **Valid:** YES
- **Severity:** P1 (Reliability)
- **Impact:** Impossible to diagnose production sync failures; empty catch blocks mask issues
- **Details:** Three patterns: (1) Empty catch blocks in db.ts catching exceptions without logging (comment "Continue with next delete, will retry later" provides false reassurance without actual retry visibility), (2) geminiService.ts returning `false` for network errors, server errors, and disabled state alike, (3) inconsistent patterns within single service (some return null, others re-throw).
- **Target:** Eliminate bare catch blocks, establish uniform error handling per service, implement user-facing failure indicators, replace mixed null/exception patterns with structured error type.

### Draft #6: Sequential Sync Operations

- **Valid:** YES
- **Severity:** P2 (Performance)
- **Impact:** With 10+ pending items, means 10+ sequential HTTP requests instead of batched parallel
- **Details:** db.ts uses `for` loops that await each operation individually for both sync and asset uploads.
- **Target:** Implement parallel processing with concurrency limits (3-5 concurrent operations) using Promise.all(). Individual failures should not halt the batch. UI should track batch completion status.

### Draft #7: Type Safety (20x `as any`)

- **Valid:** YES
- **Severity:** P2 (Code Quality)
- **Impact:** Core data model (`CollectionItem.data: Record<string, any>`) flows through entire app untyped
- **Details:** 20 `as any` casts across 10 files. Key offenders: mapCloudCollections params untyped (db.ts:1016), Web Locks API not typed (db.ts:545), museum guide callback untyped (geminiService.ts:194), core data model untyped (types.ts:38), translation lookup untyped (i18n.ts:769), 6 occurrences in ThemePicker.tsx.
- **Target:** Reduce `as any` count to 5 or fewer. Properly type cloud response based on Supabase schema, use stricter type for CollectionItem.data (e.g., `Record<string, string | number | string[] | null>`), type translation lookup with keyof.

### Draft #8: Duplicate Utility Logic

- **Valid:** YES
- **Severity:** P2 (Maintainability)
- **Impact:** Changes to shared behavior require updating 3-5 locations; divergence risk
- **Details:** Four areas of duplication: (1) getFieldLabel() copied in AddItemModal, ItemCard, CollectionCard, App.tsx (CollectionScreen), (2) Focus trap keyboard logic duplicated in AddItemModal and AuthModal, (3) Theme class setup boilerplate in 5+ components, (4) getValue/field display extraction in ItemCard, ExportModal, App.tsx (ItemDetailScreen).
- **Target:** Extract to shared modules: fieldUtils.ts, useFocusTrap.ts hook, consolidated in theme.tsx, itemUtils.ts. All consuming components updated.

### Draft #9: Hardcoded i18n Strings

- **Valid:** YES
- **Severity:** P2 (Bug)
- **Impact:** ~12 English strings visible to Chinese-language users
- **Details:** Hardcoded strings in: EnhanceImageModal.tsx ('Image Error', 'No Photo'), ExportModal.tsx ('No Photo', 'Image Error', 'ARCHIVAL RECORD'), ItemImage.tsx ('Image Error', 'No Photo' twice), AuthModal.tsx ('Private', 'Fast', feature descriptions).
- **Target:** All strings replaced with t() calls, corresponding keys added to both en and zh translations. Visual verification in both languages.
- **Note:** Overlaps with existing GitHub issue #106 (Localize ItemImage placeholder strings).

### Draft #10: Debug Console Statements

- **Valid:** YES
- **Severity:** P3 (Cleanup)
- **Impact:** Pollutes browser console in production, leaks implementation details
- **Details:** 73 console.log/warn/error statements across 15 files. Top offenders: db.ts (24), App.tsx (17), AddItemModal.tsx (8), geminiService.ts (4). ExportModal.tsx lines 97-109 contains explicit debug console.log inside setTimeout left in production.
- **Target:** Remove debug console.log statements (especially ExportModal), replace warn/error with lightweight logger utility that can be silenced in production and includes operation context (sync, auth, AI).

### Draft #11: Oversized Modal Components

- **Valid:** YES
- **Severity:** P2 (Maintainability)
- **Impact:** AddItemModal (1,184 lines, 15 useState hooks, 6 render functions) and CreateCollectionModal (872 lines, 5 render functions) are difficult to test and maintain
- **Details:** Internal render functions should be extracted to step components. Repeated UI patterns (rating buttons, error banners) duplicated. Complex logic intermingled with UI rendering. State management would benefit from useReducer.
- **Target:** Reduce AddItemModal to under 300 lines, CreateCollectionModal to under 200 lines. Step components independently testable.

### Draft #12: Missing Component Tests

- **Valid:** YES
- **Severity:** P2 (Quality)
- **Impact:** 52% component coverage, 0% server endpoint coverage, 1 authenticated E2E test vs. 12 for first-time users
- **Details:** 11 untested components: ConflictResolutionModal, CreateCollectionModal, DeleteItemsModal, EnhanceImageModal, ExhibitionView, ExportModal, FilterModal, ImageEditModal, ItemImage, StatusBanner, StatusToast. Server endpoints (/api/gemini/analyze, /enhance, /suggest-fields, rate limiting, JWT validation, malformed request handling) completely untested. seedCollections.ts has zero tests. No offline-to-online sync recovery tests.
- **Target:** Test files for all 11 components, server endpoint tests, 5+ additional authenticated E2E tests, seedCollections.ts structural tests.

### Draft #13: Service Worker Cache Versioning

- **Valid:** YES
- **Severity:** P2 (Reliability)
- **Impact:** Manual cache version ('curio-shell-v4') requires developer intervention; stale caches accumulate on user devices
- **Details:** No automated version generation from build artifacts. Previous cache versions persist indefinitely. If any single asset fails to cache, entire installation fails. No network timeout mechanism for unreliable connections. Cache exclusion patterns lack test coverage.
- **Target:** Automate version generation, implement cleanup in activation phase, handle partial cache failures gracefully, add network timeouts with cache fallback, test exclusion patterns.

### Draft #14: Gemini Proxy Security

- **Valid:** YES
- **Severity:** P1 (Security)
- **Impact:** Server accepts requests without valid API key, failing only when proxying to Gemini; custom env parser is fragile; no request body validation
- **Details:** Multiple vulnerabilities: (1) No startup validation -- server starts without API key, (2) Custom .env parser lacks support for quoted values with equals, multiline entries, escaped characters -- standard dotenv solves all, (3) Empty CORS_ORIGINS produces silent failures, (4) Hard-coded JWT algorithm prevents HS256-to-RS256 migration, (5) Error responses reference model names and API config (information disclosure), (6) Request bodies destructured without schema validation, (7) Asset uploads have no size checks (DoS risk).
- **Target:** Startup validation, dotenv adoption, schema validation for requests, error message sanitization, CORS warnings, file size limits.

### Draft #15: index.html Accessibility and Meta

- **Valid:** YES
- **Severity:** P2 (Accessibility/SEO)
- **Impact:** Hardcoded lang="en" causes screen reader misbehavior with Chinese language selection; missing SEO and social meta tags
- **Details:** Five issues: (1) Static lang="en" conflicts with LanguageProvider dynamic language switching, (2) theme-color meta tag doesn't reflect theme selection (Gallery/Vault/Atelier), (3) Missing description meta tag and Open Graph tags, (4) No skip-to-content link for keyboard navigation, (5) No noscript fallback, (6) No Content Security Policy headers.
- **Target:** Update document.documentElement.lang on language switch, modify theme-color on theme change, add meta/OG tags, implement skip link, add noscript fallback.

---

## Priority Framework

### P1 -- Fix This Sprint (4 issues)

These represent security vulnerabilities, reliability risks, and architectural blockers that impede all other work.

| #   | Issue                               | Category     | Risk if Delayed                                                         | Est. Effort |
| --- | ----------------------------------- | ------------ | ----------------------------------------------------------------------- | ----------- |
| 14  | Gemini Proxy Security               | SECURITY     | API key exposure, DoS via unbounded uploads, info disclosure            | 2-3 days    |
| 5   | Silent Error Swallowing             | RELIABILITY  | Production failures invisible, impossible to diagnose                   | 2-3 days    |
| 1   | App.tsx God Component (2,289 lines) | ARCHITECTURE | Blocks testing (#12), code-splitting, modal extraction (#11)            | 1-2 weeks   |
| 2   | db.ts Monolith (1,958 lines)        | ARCHITECTURE | Blocks sync testing, performance improvements (#6), error handling (#5) | 1-2 weeks   |

**Why P1:**

- #14 is a security issue that should never ship as-is. The server accepts requests without API key validation.
- #5 means production bugs are invisible -- you cannot fix what you cannot see.
- #1 and #2 are the root cause of many other issues. Splitting them unblocks #3, #6, #8, #11, and #12.

### P2 -- Fix This Quarter (8 issues)

Important for code quality, performance, and maintainability but not blocking daily development.

| #   | Issue                      | Category        | Risk if Delayed                                              | Est. Effort |
| --- | -------------------------- | --------------- | ------------------------------------------------------------ | ----------- |
| 3   | Duplicate Auth Logic       | BUG             | Auth fixes may only be applied to one location               | 1 day       |
| 6   | Sequential Sync Operations | PERFORMANCE     | Slow sync with 10+ items                                     | 2-3 days    |
| 7   | Type Safety (20x `as any`) | CODE QUALITY    | Type errors go undetected, refactoring is risky              | 3-4 days    |
| 8   | Duplicate Utility Logic    | MAINTAINABILITY | Diverging behavior across components                         | 2-3 days    |
| 9   | Hardcoded i18n Strings     | BUG (i18n)      | Chinese users see English text in ~12 locations              | 1 day       |
| 11  | Oversized Modals           | MAINTAINABILITY | Hard to test, hard to modify, high merge conflict risk       | 1 week      |
| 12  | Missing Tests              | QUALITY         | Regressions go undetected; 52% component, 0% server coverage | 2 weeks     |
| 13  | Service Worker Versioning  | RELIABILITY     | Users may get stale assets; no cache cleanup                 | 2 days      |
| 15  | index.html Accessibility   | ACCESSIBILITY   | Screen readers misbehave; no SEO; no keyboard skip link      | 1 day       |

**Why P2:**

- These issues cause friction and risk but don't block core functionality today.
- #9 and #15 are quick wins that could be promoted to Phase 1.
- #12 (missing tests) should ideally be addressed alongside the architecture work in #1 and #2.

### P3 -- Fix When Convenient (3 issues)

Low-impact cleanup that improves code hygiene but has minimal user-facing effect.

| #   | Issue                    | Category | Risk if Delayed                                  | Est. Effort |
| --- | ------------------------ | -------- | ------------------------------------------------ | ----------- |
| 4   | Dead Code Cleanup        | CLEANUP  | Minimal; unused code adds cognitive load only    | 1 hour      |
| 10  | Debug Console Statements | CLEANUP  | Console pollution in production, minor info leak | 2 days      |

**Why P3:**

- #4 is literally 1 hour of work -- delete two unused exports.
- #10 is housekeeping; the 73 statements are noisy but not harmful.

---

## Consolidated Issue List (Merged Duplicates)

Several draft issues overlap with existing GitHub issues. Here are the recommended merges:

### Merge: Draft #9 + GitHub #106

- **Draft #9:** Hardcoded i18n Strings (~12 strings bypass translation)
- **GitHub #106:** Localize ItemImage placeholder strings (No Photo / Image Error)
- **Recommendation:** #106 is a subset of #9. Close #106 in favor of a broader #9 issue that covers all hardcoded strings including ItemImage.

### Merge: Draft #5 + GitHub #148

- **Draft #5:** Silent Error Swallowing in sync operations
- **GitHub #148:** Suppress expected 404/400 errors from Supabase Storage in console
- **Recommendation:** Both deal with error handling in sync. #148 is about suppressing expected errors; #5 is about surfacing unexpected ones. Address together as a unified "error handling strategy" effort.

### Merge: Draft #12 (E2E gaps) + GitHub #102

- **Draft #12:** Missing component tests (includes E2E gaps for exhibition mode)
- **GitHub #102:** Exhibition images should include meaningful alt text
- **Recommendation:** When writing ExhibitionView tests per #12, include #102's alt text requirement as an acceptance criterion.

### Related Clusters

The following issues form natural work clusters:

**Sync Reliability Cluster:**

- Draft #2 (db.ts monolith) + Draft #5 (error swallowing) + Draft #6 (sequential sync) + GitHub #135 (offline deletes resurrecting) + GitHub #149 (pending upload status)

**i18n Completeness Cluster:**

- Draft #9 (hardcoded strings) + GitHub #104 (field labels in Add Item) + GitHub #105 (field labels in Filter/Exhibition) + GitHub #106 (ItemImage placeholders)

**Architecture Cluster:**

- Draft #1 (App.tsx) + Draft #3 (duplicate auth) + Draft #8 (duplicate utilities) + Draft #11 (oversized modals)

---

## 4-Phase Implementation Plan

### Phase 1: Security and Reliability (Weeks 1-2)

**Goal:** Harden security, make errors visible, deliver quick wins for momentum.

| Week | Issue | Task                                                    | Effort   | Dependencies      |
| ---- | ----- | ------------------------------------------------------- | -------- | ----------------- |
| 1    | #14   | Gemini Proxy Security hardening                         | 2-3 days | None -- fix first |
| 1    | #5    | Replace silent error swallowing with structured logging | 2-3 days | None              |
| 2    | #9    | Replace hardcoded i18n strings with t() calls           | 1 day    | None (quick win)  |
| 2    | #15   | Fix index.html accessibility and meta tags              | 1 day    | None (quick win)  |
| 2    | #4    | Delete dead code (AppContext, connectMuseumGuide stub)  | 1 hour   | None (quick win)  |

**Deliverables:**

- Secure proxy server with startup validation and request schema checking
- Visible error reporting for sync failures
- All user-facing strings translated
- Accessible HTML document with dynamic lang/theme-color
- Dead code removed

**Risk:** Low. These are isolated fixes with no cross-cutting dependencies.

### Phase 2: Architecture Cleanup (Weeks 3-10)

**Goal:** Make the codebase maintainable by splitting god components and eliminating duplication.

| Week | Issue | Task                                                                      | Effort    | Dependencies                                                             |
| ---- | ----- | ------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------ |
| 3-4  | #1    | Split App.tsx into standalone screens + custom hooks                      | 1-2 weeks | #4 completed (dead AppContext removed)                                   |
| 4    | #3    | Consolidate auth logic into useAuthState hook                             | 1 day     | #1 in progress (App.tsx being refactored)                                |
| 5-6  | #2    | Split db.ts into dbCore, syncManager, assetManager, mergeStrategy         | 1-2 weeks | #5 completed (error handling established)                                |
| 7    | #8    | Extract duplicate utilities (fieldUtils, useFocusTrap, theme helpers)     | 2-3 days  | #1 completed (utilities clear)                                           |
| 8-10 | #11   | Extract modal step components from AddItemModal and CreateCollectionModal | 1 week    | #1 completed (App.tsx split done), #8 completed (shared utils available) |

**Deliverables:**

- App.tsx under 500 lines with extracted screen components
- db.ts split into 4+ independently testable modules
- Single source of truth for auth logic
- Shared utility modules for field labels, focus traps, theme setup
- Modal components under 300/200 lines respectively

**Risk:** Medium. Large refactors carry merge conflict risk. Mitigate with:

- Small, focused PRs (one extraction per PR)
- Feature flags for gradual rollout
- Comprehensive smoke tests before and after

### Phase 3: Performance and Quality (Weeks 11-16)

**Goal:** Optimize sync performance, improve type safety, achieve comprehensive test coverage.

| Week  | Issue | Task                                                                    | Effort   | Dependencies                                |
| ----- | ----- | ----------------------------------------------------------------------- | -------- | ------------------------------------------- |
| 11    | #6    | Implement batched sync with concurrency limits (3-5 parallel)           | 2-3 days | #2 completed (syncManager extracted)        |
| 12    | #7    | Reduce `as any` to 5 or fewer; type cloud responses and core data model | 3-4 days | #2 completed (types clearer after split)    |
| 13    | #13   | Automate service worker versioning and cache cleanup                    | 2 days   | None                                        |
| 14-16 | #12   | Add tests for 11 components, server endpoints, authenticated E2E flows  | 2 weeks  | #1, #2, #11 completed (components testable) |

**Deliverables:**

- Parallel sync reducing 10-item sync time by 3-5x
- Strong TypeScript types across the codebase
- Automated service worker cache management
- 80%+ component coverage, server endpoint tests, 5+ authenticated E2E tests

**Risk:** Medium. Type safety changes (#7) may surface hidden bugs -- this is a feature, not a risk.

### Phase 4: Polish (Ongoing)

**Goal:** Clean up remaining noise and improve developer experience.

| When    | Issue   | Task                                                 | Effort | Dependencies                            |
| ------- | ------- | ---------------------------------------------------- | ------ | --------------------------------------- |
| Anytime | #10     | Replace 73 console statements with structured logger | 2 days | #5 completed (logging strategy defined) |
| Anytime | Cleanup | Address remaining P3 GitHub issues as convenient     | Varies | None                                    |

**Deliverables:**

- Clean production console
- Structured logging with operation context
- Logger ready for future error tracking integration (Sentry, etc.)

---

## Dependency Mapping

```
#14 (Gemini Proxy Security)
  └── [No dependencies - fix first]

#5 (Silent Error Swallowing)
  ├── Blocks #6 (Batched Sync - need error handling before parallel errors)
  └── Blocks #10 (Console Statements - define logging strategy first)

#4 (Dead Code)
  └── Blocks #1 (App.tsx - remove dead AppContext before restructuring)

#1 (App.tsx God Component)
  ├── Blocks #3 (Duplicate Auth - auth consolidation happens during App.tsx refactor)
  ├── Makes #11 easier (Modal extraction cleaner after App.tsx is split)
  ├── Makes #8 easier (Duplicate utilities visible once screens are extracted)
  └── Makes #12 easier (Extracted components are independently testable)

#2 (db.ts Monolith)
  ├── Makes #6 easier (syncManager module enables clean parallel sync)
  ├── Makes #7 easier (types clearer after split)
  └── Makes #12 easier (modules are independently testable)

#9 (Hardcoded i18n)
  └── [No dependencies - quick win]

#15 (Accessibility)
  └── [No dependencies - quick win]

#8 (Duplicate Utilities)
  └── Depends on #1 (utilities clearer after App.tsx extraction)

#11 (Oversized Modals)
  ├── Depends on #1 (App.tsx split first)
  └── Benefits from #8 (shared utilities available)

#6 (Sequential Sync)
  ├── Depends on #2 (db.ts split provides clean syncManager)
  └── Depends on #5 (error handling defined before parallel errors)

#7 (Type Safety)
  └── Benefits from #2 (types clearer after db.ts split)

#12 (Missing Tests)
  ├── Depends on #1 (extracted screens testable)
  ├── Depends on #2 (extracted modules testable)
  └── Depends on #11 (extracted modal steps testable)

#13 (Service Worker)
  └── [No dependencies - can be done anytime]

#10 (Console Statements)
  └── Depends on #5 (logging strategy defined first)

#3 (Duplicate Auth)
  └── Best done during #1 (App.tsx refactor)
```

### Critical Path

The longest dependency chain is:

```
#4 (1hr) → #1 (2wk) → #11 (1wk) → #12 (2wk) = ~5 weeks
#5 (3d) → #2 (2wk) → #6 (3d) → #12 (2wk) = ~5 weeks
```

Both paths converge at #12 (missing tests), which should be the final phase before polish.

---

## Risk Assessment

| Issue                 | Technical Risk                           | User Impact if Unfixed                | Effort Confidence         |
| --------------------- | ---------------------------------------- | ------------------------------------- | ------------------------- |
| #14 Proxy Security    | HIGH - security vulnerability            | API key exposure, DoS attacks         | High (well-scoped)        |
| #5 Error Swallowing   | MEDIUM - debugging blind spots           | Silent data loss during sync          | High (well-scoped)        |
| #1 App.tsx Split      | MEDIUM - large refactor, merge conflicts | None immediate (developer pain)       | Medium (scope may grow)   |
| #2 db.ts Split        | MEDIUM - complex module boundaries       | None immediate (developer pain)       | Medium (sync edge cases)  |
| #3 Auth Duplicate     | LOW - straightforward hook adoption      | Possible auth fix inconsistency       | High (1 day)              |
| #6 Parallel Sync      | LOW - well-understood pattern            | Slow sync for power users (10+ items) | High (well-scoped)        |
| #7 Type Safety        | MEDIUM - may surface hidden bugs         | None immediate (developer pain)       | Medium (unknown unknowns) |
| #8 Utility Extraction | LOW - mechanical refactoring             | None immediate                        | High (well-scoped)        |
| #9 i18n Strings       | LOW - straightforward replacement        | Chinese users see English             | High (1 day)              |
| #10 Console Cleanup   | LOW - mechanical cleanup                 | Console noise in production           | High (2 days)             |
| #11 Modal Split       | MEDIUM - complex state flow              | None immediate (developer pain)       | Medium (state management) |
| #12 Missing Tests     | LOW - additive, no refactoring           | Regressions go undetected             | Medium (test design)      |
| #13 SW Versioning     | LOW - well-understood pattern            | Stale cached assets                   | High (well-scoped)        |
| #14 Proxy Security    | HIGH - security vulnerability            | Data exposure                         | High (well-scoped)        |
| #15 Accessibility     | LOW - straightforward changes            | Screen reader/SEO issues              | High (1 day)              |

---

## Quick Wins vs. Deep Refactors

### Quick Wins (do first for momentum)

| Issue                        | Effort | Impact                      |
| ---------------------------- | ------ | --------------------------- |
| #4 Dead Code Cleanup         | 1 hour | Remove confusion            |
| #9 Hardcoded i18n Strings    | 1 day  | Fix Chinese user experience |
| #15 index.html Accessibility | 1 day  | Fix screen readers, add SEO |
| #3 Duplicate Auth Logic      | 1 day  | Eliminate bug class         |

### Deep Refactors (plan carefully)

| Issue             | Effort    | Impact                   | Unlocks                        |
| ----------------- | --------- | ------------------------ | ------------------------------ |
| #1 App.tsx Split  | 1-2 weeks | Architectural foundation | #3, #8, #11, #12               |
| #2 db.ts Split    | 1-2 weeks | Testable sync layer      | #6, #7, #12                    |
| #12 Missing Tests | 2 weeks   | Regression safety net    | Confidence for all future work |

### Alternative "Quick Wins First" Approach

If the team prefers momentum over dependency ordering:

**Week 1:** #4 + #9 + #15 + #3 (4 quick wins, visible improvement)
**Week 2:** #14 + #5 (security and reliability)
**Weeks 3-6:** #1 + #2 (architecture)
**Weeks 7-10:** Everything else

This front-loads visible progress while still addressing critical security in week 2.

---

## Existing GitHub Issues Integration

The 15 new drafts should be cross-referenced with these existing open issues:

### Already Tracked (Related to Drafts)

| GitHub Issue                                | Related Draft | Relationship                             |
| ------------------------------------------- | ------------- | ---------------------------------------- |
| #106 Localize ItemImage placeholders        | Draft #9      | Subset -- merge into #9                  |
| #148 Suppress expected 404/400 errors       | Draft #5      | Related -- address together              |
| #102 Exhibition alt text                    | Draft #12     | Include in E2E test criteria             |
| #135 Offline deletes resurrecting           | Draft #2      | Addressed by db.ts refactor              |
| #149 Pending upload status                  | Draft #5, #6  | Addressed by error handling + batch sync |
| #104 Field labels in Add Item i18n          | Draft #9      | i18n cluster                             |
| #105 Field labels in Filter/Exhibition i18n | Draft #9      | i18n cluster                             |

### Independent (Not Covered by Drafts)

These existing issues are valid and not addressed by the 15 drafts:

| GitHub Issue                      | Priority | Notes                                          |
| --------------------------------- | -------- | ---------------------------------------------- |
| #111 Delete collection            | P1       | Feature gap -- users cannot delete collections |
| #95 Print icon does nothing       | P2       | Broken UI affordance                           |
| #110 Vault theme contrast         | P2       | UX polish                                      |
| #133 Large collection performance | P2       | Pagination/virtualization needed               |
| #134 Rollback documentation       | P2       | Operational safety                             |
| #130 AI gateway monitoring        | P2       | Observability                                  |
| #147 Image loading fallback perf  | P2       | Performance                                    |
| #132 IndexedDB quota warnings     | P3       | Edge case                                      |
| #109 Toast duration on mobile     | P3       | UX polish                                      |
| #108 Timeline browsing            | P3       | Feature request                                |
| #107 Show created date            | P3       | Feature request                                |
| #103 Stats drilldown              | P3       | Feature request                                |
| #101 Auto-advance slideshow       | P3       | Feature request                                |
| #100 Truncated titles             | P3       | UX polish                                      |
| #87 Vault Lock                    | P3       | Feature request                                |
| #86 Admin guide docs              | P3       | Documentation                                  |

---

## Next Steps

1. **Create GitHub issues** from the 15 validated drafts (apply labels and priority per this analysis)
2. **Close duplicates** (#106 merged into broader i18n issue)
3. **Start Phase 1** with #14 (Gemini Proxy Security) -- this is the most critical fix
4. **Plan Phase 2 sprints** around #1 and #2 as the architectural foundation
5. **Delete draft files** from `docs/issue-drafts/2026-02-09/` once GitHub issues are created (per project documentation rules)
6. **Track progress** using GitHub project board or milestone

### Estimated Total Effort

| Phase                             | Duration      | Issues                        |
| --------------------------------- | ------------- | ----------------------------- |
| Phase 1: Security and Reliability | 2 weeks       | #14, #5, #9, #15, #4          |
| Phase 2: Architecture Cleanup     | 8 weeks       | #1, #3, #2, #8, #11           |
| Phase 3: Performance and Quality  | 6 weeks       | #6, #7, #13, #12              |
| Phase 4: Polish                   | Ongoing       | #10 + remaining GitHub issues |
| **Total focused work**            | **~16 weeks** | **15 issues**                 |

This timeline assumes one developer working on technical debt alongside feature work. With dedicated focus or multiple contributors, phases can overlap and compress significantly.
