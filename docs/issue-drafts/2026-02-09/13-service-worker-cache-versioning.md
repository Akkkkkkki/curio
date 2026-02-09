## Title

Service worker cache version is manually managed and stale caches are not cleaned up reliably

## Labels

- type:bug
- severity:p2

## Problem

`public/sw.js` uses a hardcoded cache name `'curio-shell-v4'` (line 1) that must be manually incremented on every release. There's no automatic versioning from the build process, meaning:

1. Developers can forget to bump the version, serving stale assets
2. Old caches from previous versions (`v1`, `v2`, `v3`) remain on disk indefinitely
3. The `install` event's `addAll()` (lines 45-51) doesn't handle partial failures - if one asset fails to cache, the entire install fails silently
4. No fetch timeout - requests can hang indefinitely on slow networks
5. `NEVER_CACHE_PATTERNS` regexes (lines 4-12) are broad and untested

## Expected

- Cache version derived from build hash or timestamp
- Old caches cleaned up in `activate` event
- Partial cache failure handled gracefully
- Fetch timeout for network requests

## Actual

Manual cache versioning with no cleanup of stale caches.

## Acceptance Criteria

- [ ] Cache name includes build hash or auto-incrementing version
- [ ] `activate` event cleans up old cache versions
- [ ] Partial cache failure doesn't prevent SW installation
- [ ] Network fetch has a timeout (e.g., 5 seconds) with cache fallback
- [ ] NEVER_CACHE_PATTERNS validated by unit test
