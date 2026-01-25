# PWA Cache Strategy (Phase 1–2)

## Goals

- Always deliver the latest version after a refresh.
- Avoid blank screens caused by stale HTML/JS bundles.
- Keep the service worker minimal and focused.

## Service worker behavior

| Request type | Strategy | Rationale |
| --- | --- | --- |
| HTML navigations (`/`, `/index.html`, route refresh) | **Network-first** with cache fallback | Guarantees refreshed HTML points to the latest hashed assets. |
| Static assets (`/assets/*.js`, `/assets/*.css`, fonts) | **Stale-while-revalidate** | Fast loads, with background updates. |
| Shell assets (manifest + icons) | **Cache-first** | Rarely change and safe to cache. |
| API/auth/Supabase requests | **Network-only** | Never cache dynamic data. |

## Cache versioning

- `CACHE_NAME` is bumped on releases (e.g., `curio-shell-v3`) to ensure outdated caches are removed.
- Activation deletes any older caches to keep storage tight.

## HTTP caching headers

To prevent stale SW/HTML, the following headers are required:

- `/sw.js`: `Cache-Control: no-store, no-cache, must-revalidate`
- `/index.html` and `/`: `Cache-Control: no-store, no-cache, must-revalidate`

## Verification checklist

- Hard refresh shows the newest build without clearing browser data.
- Console has no failed requests for missing hashed assets.
- Application loads correctly after two consecutive deploys.
