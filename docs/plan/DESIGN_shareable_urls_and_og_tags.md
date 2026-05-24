# Shareable URLs and OG Tags - Design Decision

> **Status:** Design (Ready for Implementation)
> **Linear:** [CUR-4](https://linear.app/qiuyue/issue/CUR-4/design-spec-shareable-urls-and-og-tags-hashrouter-migration-decision)
> **Last Updated:** 2026-05-24

This is a forward-looking design spec for Phase 1 sharing work. Durable product rules live in
`docs/PRODUCT_DESIGN.md`; system architecture lives in `docs/TECHNICAL_DESIGN.md`.

---

## 1. Decision

Curio should keep the authenticated app on `HashRouter` for the first Phase 1 sharing release and add a
server-rendered public share route layer for canonical public URLs and Open Graph metadata.

This chooses **Option B: server-side OG route layer** as the first implementation path.

### Why this path

- Social crawlers need complete Open Graph tags in the first HTML response. Changing from `HashRouter` to
  `BrowserRouter` gives clean app URLs, but a static Vite SPA still serves the same `index.html` unless a
  server route injects per-profile, per-collection, or per-item metadata.
- The current Vercel config already rewrites all non-API routes to `index.html`, so direct browser refreshes
  can be supported later without changing hosting providers.
- Keeping `HashRouter` avoids breaking existing owner-facing links while Phase 1 validates public profiles,
  privacy controls, and share-card quality.
- Public share surfaces are anonymous-readable and privacy-sensitive. They should be served from a narrow
  public route layer that checks visibility before emitting metadata.

### Explicit non-decision

This does not permanently ban a `BrowserRouter` migration. It defers the owner-app migration until public
sharing proves value and the team has a clean compatibility plan for old hash links.

---

## 2. Canonical URL Structure

Use `/u/:username` as the public profile root.

| Surface    | Canonical public URL                                      | Notes                                                                  |
| ---------- | --------------------------------------------------------- | ---------------------------------------------------------------------- |
| Profile    | `/u/:username`                                            | Public museum front door.                                              |
| Collection | `/u/:username/collections/:collectionSlug`                | Slug should be stable and human-readable; item IDs stay internal.      |
| Item       | `/u/:username/collections/:collectionSlug/items/:itemSlug` | Keeps item context inside its parent collection.                       |
| Wrapped    | `/u/:username/wrapped/:year`                              | Only resolves after the owner publishes that Wrapped output.           |
| Widget     | `/embed/:username/:collectionSlug`                        | Embeddable shelf route; links back to the canonical collection page.   |

Rejected alternatives:

- `/@username`: compact, but less explicit and easier to confuse with social handles in app copy.
- `/museum/:username`: expressive but longer; weaker for repeat sharing.
- `/item/:id`: short, but loses curator context and exposes internal identifiers.

Owner-facing authenticated routes can remain hash routes for now, for example
`/#/collection/:id/item/:itemId`.

---

## 3. Username Requirement

Public profile URLs require a username system before profile sharing can ship.

Minimum username rules:

- unique, case-insensitive username
- 3-30 characters
- lowercase letters, numbers, and hyphen
- cannot start or end with a hyphen
- reserved words blocked (`api`, `app`, `admin`, `embed`, `login`, `privacy`, `settings`, `u`)
- one owner-controlled change path, with old URLs not guaranteed until redirects are designed

Display names remain separate from usernames. The username is the stable URL handle; display name is the
curator-facing presentation label.

---

## 4. Data Model Changes

Exact SQL belongs in the implementation PR, but the Phase 1 route layer needs these durable concepts.

### `profiles`

Add:

- `username text`
- `username_normalized text`
- `display_name text`
- `public_profile_enabled boolean default false`
- `public_profile_bio text`
- `public_profile_cover_asset_path text`
- `public_profile_theme text`

Constraints:

- unique index on `username_normalized`
- format check for lowercase username rules
- RLS policy allowing anonymous reads only when `public_profile_enabled = true`

### `collections`

Existing `is_public` remains the visibility foundation. Add:

- `public_slug text`
- `public_featured boolean default false`
- `public_sort_order integer`

Constraints:

- unique index on `(user_id, public_slug)`
- anonymous reads only when owner profile is enabled and collection `is_public = true`

### `items`

Item pages inherit visibility from their parent collection. Add:

- `public_slug text`

Constraints:

- unique index on `(collection_id, public_slug)`
- anonymous reads only through a public parent collection

---

## 5. Route Layer Contract

The server-rendered public route layer should return metadata-first HTML for crawlers and normal browsers.

For a public request:

1. Parse and validate the route params.
2. Fetch only anonymous-readable public data from Supabase.
3. If the profile, collection, item, or Wrapped output is private or missing, return a non-indexable 404.
4. Render HTML with Open Graph and Twitter card tags.
5. Include a client entry point or redirect target for interactive viewing.

Required OG fields:

- `og:type`
- `og:title`
- `og:description`
- `og:url`
- `og:image`
- `twitter:card`
- `twitter:title`
- `twitter:description`
- `twitter:image`

Metadata must never include private collections, private items, draft fields, internal IDs, private notes, or
AI-only metadata.

---

## 6. Implementation Plan

### Phase 1A: Public identity foundation

1. Add username/profile fields and RLS policies.
2. Add profile activation UI and username claim flow.
3. Add collection/item public slugs when publishing.
4. Add tests for username validation, slug collisions, and private-content denial.

### Phase 1B: Metadata route layer

1. Add server routes for `/u/:username`, collection, item, Wrapped, and embed surfaces.
2. Place these routes before the SPA catch-all in deployment routing.
3. Fetch public read models from Supabase with anonymous-safe queries.
4. Generate branded fallback OG images when a surface has weak or missing imagery.
5. Add crawler-oriented tests that assert the first HTML response includes the right tags.

### Phase 1C: Interactive public pages

1. Build public profile, public collection, and public item pages against the same read model.
2. Keep owner edit controls out of public views.
3. Add privacy regression tests for toggling a collection from public back to private.
4. Instrument public profile visits and share events.

### Phase 1D: Optional app router migration

Migrate from `HashRouter` to `BrowserRouter` only after the public route layer works.

Steps:

1. Add route aliases so old hash links redirect or deep-link to equivalent clean routes.
2. Convert app navigation to clean paths.
3. Keep Vercel's SPA fallback for authenticated app routes.
4. Update tests that currently assert hash links.
5. Run full navigation, refresh, and e2e coverage for collection and item detail routes.

---

## 7. Acceptance Criteria Mapping

- Decision documented with rationale: Option B first, with BrowserRouter migration deferred.
- URL structure finalized: `/u/:username` profile root and nested collection/item routes.
- Migration plan if Option A chosen: Option A is not chosen for the first release; an optional later
  BrowserRouter migration plan is documented in Phase 1D.