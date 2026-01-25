# PWA Strategy Proposal (Phase 3)

## Executive summary

The current PWA approach delivers offline support and installability but risks stale caches that can block users
after redeploys. Phase 1–2 mitigations reduce that risk, yet long-term product goals may prefer a simpler web
app or a platform-native shell. This proposal outlines options, cost, and maintenance tradeoffs.

## Current issues and risks

1. **Stale HTML and asset caching** can result in blank screens after deploys.
2. **Service worker update complexity** increases long-term maintenance risk.
3. **Debugging production PWA issues** is more expensive than traditional web deployments.

## Options

### Option A: Keep PWA, minimal service worker (recommended baseline)

**Description**
- Keep installability.
- Maintain a minimal SW: network-first for HTML, stale-while-revalidate for assets, network-only for data.

**Benefits**
- Lowest engineering effort.
- Preserves current install flow.

**Risks**
- Still needs SW monitoring and periodic cache/version audits.

**Effort estimate**
- Initial: 1–2 days (already covered by Phase 1–2).
- Ongoing: ~0.5–1 day per quarter for maintenance + QA.

**Cost drivers**
- QA time on every deploy.
- SW update regressions.

---

### Option B: Disable PWA (standard web app)

**Description**
- Remove SW registration and serve as a standard SPA.
- No offline support or installability.

**Benefits**
- Simplest deploy model.
- Minimal risk of blank screens due to cache.

**Risks**
- Loss of install prompt and offline experience.

**Effort estimate**
- Initial: 0.5–1 day.
- Ongoing: minimal.

**Cost drivers**
- Product decision on removing PWA features.

---

### Option C: Move to native shell (Capacitor / React Native / Tauri)

**Description**
- Wrap the web app in a native shell for installability and a more predictable update pipeline.

**Benefits**
- Better control over updates and offline.
- Can access native APIs if needed.

**Risks**
- Higher maintenance.
- App store distribution adds overhead.

**Effort estimate**
- Initial: 3–6 weeks depending on scope and platform coverage.
- Ongoing: 1–2 days per release for native builds + store reviews.

**Cost drivers**
- Platform build automation.
- Release management and review cycles.

---

### Option D: PWA with Workbox + comprehensive telemetry

**Description**
- Use Workbox precaching, runtime caching, and robust telemetry (Sentry + SW logs).

**Benefits**
- Strongest PWA reliability for complex apps.
- Clear debugging signals.

**Risks**
- Highest complexity on the web-only path.

**Effort estimate**
- Initial: 4–7 days.
- Ongoing: 1–2 days per quarter for policy updates + QA.

**Cost drivers**
- SW policy drift across deployments.
- Additional monitoring + logging infrastructure.

## Recommendation

- **Short term**: stick with Option A and ship Phase 1–2 fixes (already in progress).
- **Mid term**: evaluate Option B if installability is not a business requirement.
- **Long term**: choose Option C only if native distribution or device APIs are strategic.

## Next steps

1. Align on whether installability is required in the next 6–12 months.
2. If not required, plan a migration to Option B with a simple deprecation notice.
3. If required, budget a small maintenance window every release to validate SW behavior.
