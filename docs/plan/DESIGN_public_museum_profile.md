# Public Museum Profile — Design Spec

> **Status:** Design (Ready for Implementation)
> **Linear:** [CUR-10](https://linear.app/qiuyue/issue/CUR-10/design-spec-public-museum-profile-page)
> **Phase:** Phase 1 — Shareability And Identity · P1
> **Last Updated:** 2026-08-23

This spec closes the remaining public-profile design gap by composing the decisions already made in:

- `docs/PRODUCT_DESIGN.md` §3 — Shareability And Identity
- `docs/plan/DESIGN_username_system.md` (CUR-1)
- `docs/plan/DESIGN_public_privacy_model.md` (CUR-2)
- `docs/plan/DESIGN_shareable_urls_and_og_tags.md` (CUR-4)
- `docs/plan/DESIGN_public_customization_system_CUR-7.md` (CUR-7)

It defines the public museum page itself: its URL and read contract, what an anonymous visitor sees, how an owner publishes it, and the implementation sequence. It does not introduce a second identity, privacy, routing, or customization system.

---

## 1. Decisions

### 1.1 Canonical URL

The public museum lives at:

```text
/u/:username
```

Nested public collection and item URLs continue to follow CUR-4:

```text
/u/:username/collections/:collectionSlug
/u/:username/collections/:collectionSlug/items/:itemSlug
```

`username` is the normalized public handle defined by CUR-1. Internal owner-facing routes keep using IDs.

### 1.2 Routing Strategy

For the first Phase 1 release, **keep the authenticated owner app on `HashRouter`** and serve `/u/:username` through the server-rendered public route layer defined in CUR-4.

This is deliberate:

- social crawlers need profile-specific HTML and Open Graph tags in the first response;
- migrating the SPA to `BrowserRouter` alone would not produce dynamic metadata;
- keeping the owner app unchanged avoids a broad routing migration before public sharing proves value;
- the public route can enforce privacy before returning either page data or metadata.

A later `BrowserRouter` migration remains possible, but it is not required to ship the public museum.

### 1.3 Publishing Model

The museum profile is **opt-in and off by default**.

- Private collecting does not require a username.
- Publishing requires a valid username and display name.
- Enabling the profile does not publish any collection.
- Each user-owned collection remains private until explicitly published.
- Featured collections must already be public.
- Disabling the public profile disables anonymous access to dependent user-owned public collection, item, widget, and generated share surfaces.

Public sample collections remain a separate admin-owned product-demo case.

### 1.4 Product Shape

The public profile is an **editorial museum front door**, not a settings page and not a social feed.

V1 should emphasize:

1. curator identity;
2. one strong hero image or object;
3. a short curator statement;
4. featured public collections;
5. a small selection of public objects;
6. lightweight public-safe signals where they add context.

V1 explicitly does not add follows, likes, comments, activity feeds, arbitrary page builders, or public engagement leaderboards.

---

## 2. Anonymous Profile Experience

### 2.1 Page Structure

A public museum page should read in this order on mobile and desktop:

```text
[ Curio identity / minimal site navigation ]

[ Hero image or featured object ]
Display name
@username
Short curator statement
[ lightweight public signal(s), optional ]

Featured collections
[ collection card ] [ collection card ] ...

Selected objects (optional when there is enough public content)
[ object ] [ object ] ...

[ Share museum ]
```

The layout is product-owned. Theme, cover, statement, and featured content can vary, but the information hierarchy stays stable across museums.

### 2.2 Required Profile Elements

A published profile has:

- `username` — canonical URL handle;
- `displayName` — primary curator identity;
- `publicEnabled = true`;
- a public theme, defaulting to the supported Curio theme chosen by the customization contract.

The page may also show:

- short curator statement/bio;
- avatar;
- cover image or featured hero object;
- ordered featured collections;
- selected objects derived from public collections;
- public collection count;
- museum age, when it can be computed without exposing private activity.

### 2.3 Featured Collections

V1 does not need a new generic content-management system.

Featured collections are an explicit ordered subset of collections that are both:

- owned by the profile owner; and
- currently public under the privacy model.

A collection can be public but unlisted from the profile. Direct public collection URLs can still work while the owner profile is enabled.

If a featured collection becomes private, it must disappear from the public profile immediately.

### 2.4 Selected Objects

The profile may show a small “Selected objects” module once enough public content exists.

For V1, derive these objects from already-public collections rather than introducing another profile-level item publishing model. An implementation can use collection-level featured item ordering when available and fall back to representative public items.

Only items that pass the full public visibility check may appear.

### 2.5 Empty Public Museum

A user may publish their identity before publishing a collection. In that case, `/u/:username` should still render a deliberate public empty state, for example:

> This museum is just getting started.

Do not show private collection counts, private item counts, import status, or language that implies hidden inventory.

### 2.6 Owner Controls

The canonical public page never renders owner-only editing controls. Owners edit and preview the museum from authenticated settings, then view the same anonymous surface that visitors receive.

---

## 3. Public Read Contract

The public route should depend on a narrow public-safe read model, not raw owner tables.

An illustrative application contract is:

```ts
type PublicTheme = 'gallery' | 'vault' | 'atelier';

interface PublicMuseumProfile {
  username: string;
  displayName: string;
  statement?: string;
  avatarUrl?: string;
  coverImageUrl?: string;
  theme: PublicTheme;
  publicCollectionCount: number;
  museumSince?: string;
  featuredCollections: PublicCollectionSummary[];
  selectedObjects: PublicItemSummary[];
}

interface PublicCollectionSummary {
  slug: string;
  title: string;
  icon?: string;
  coverImageUrl?: string;
  publicItemCount?: number;
}

interface PublicItemSummary {
  slug: string;
  collectionSlug: string;
  title: string;
  imageUrl?: string;
  publicFields: Array<{ label: string; value: string }>;
  storyExcerpt?: string;
}
```

Exact TypeScript names can differ. The invariant matters: the route receives a **public projection**, not a private domain object that the UI then tries to redact.

### 3.1 Allowed Data

The public profile can expose:

- public curator identity;
- public theme and cover choices;
- public featured collection summaries;
- public-safe item summaries;
- explicitly public stories or excerpts;
- public-safe derived counts/signals.

### 3.2 Never Expose

The public read model must never contain:

- email address or auth-provider identity;
- `is_admin` or other privileged account state;
- private collection/item names or counts;
- private stories or owner-only notes;
- AI-only observations or hidden model metadata;
- sync state, retry queues, local asset paths, private storage keys, or import metadata;
- internal IDs when a public slug is available.

The server should make these fields impossible to accidentally serialize by selecting only the safe columns needed for the public contract.

---

## 4. Privacy Resolution

A request to `/u/:username` is public only when the profile is enabled.

For nested content, anonymous visibility requires all relevant gates to pass:

```text
profile public
  AND collection public
  AND item not hidden (for item surfaces)
  AND requested story/photo/field permitted by sharing controls
```

If the profile is disabled, missing, or private, return a non-indexable 404-style response. The same rule applies when a previously public collection or item becomes private.

Do not leave stale public HTML or OG metadata resolving after privacy is revoked. Generated public assets should be invalidated when their public-safe source fingerprint or visibility changes, as defined in CUR-7.

---

## 5. Publish And Preview Flow

The owner flow is:

```text
Profile / You
  -> Public museum
    -> Identity
       - display name
       - username
       - curator statement
       - avatar / cover
       - theme
    -> Featured collections
       - choose from public collections only
       - order selected collections
    -> Preview as visitor
    -> Enable public museum
```

### 5.1 Publishing Requirements

Publishing is blocked until:

- username passes CUR-1 validation and availability checks;
- display name is present;
- the owner confirms that publishing creates an anonymous-readable public URL.

Publishing must not require any collection to become public.

### 5.2 Preview

Preview uses the same public projection and rendering components as the anonymous page wherever practical. It should not be a separate approximate mockup that can drift from the real public result.

The preview can include unpublished draft profile identity because the owner is authenticated, but it must still redact private collection/item data according to the visibility choices that would apply after publishing.

### 5.3 Unpublishing

Turning the museum off should:

- disable `/u/:username` immediately;
- disable dependent user-owned public collection/item routes;
- disable widgets that depend on the museum being public;
- prevent generation of new public share assets;
- invalidate or stop serving stale generated metadata/assets where possible.

It should not delete the owner's private collections, draft profile settings, or username reservation.

---

## 6. Open Graph And Share Contract

The server-rendered `/u/:username` response should include profile-specific metadata in the first HTML response.

Minimum tags:

- `og:type`
- `og:title`
- `og:description`
- `og:url`
- `og:image`
- `twitter:card`
- `twitter:title`
- `twitter:description`
- `twitter:image`

Recommended profile composition:

- **title:** `<display name> · Curio`
- **description:** curator statement when present; otherwise a restrained Curio profile fallback
- **image:** explicit profile cover, then featured-object/collection fallback, then a branded generated Curio card
- **URL:** canonical `/u/:username`

Metadata must be built from the same public-safe projection as the page. Private content must never be used as an OG fallback.

---

## 7. Supabase Migration Plan

This issue defines the migration plan; it does not apply schema changes itself. Implementation should reuse the field decisions already made in CUR-1, CUR-2, CUR-4, and CUR-7 instead of creating parallel concepts.

### 7.1 Profile Identity

Extend `profiles` with the CUR-1 identity fields:

- `username`
- `display_name`
- `bio` or the canonical curator-statement field chosen during implementation
- `avatar_url`
- `cover_image_path`
- `public_enabled boolean not null default false`
- `username_changed_at`

Keep username normalization, format/reserved-word validation, uniqueness, and the username-change window enforced server-side as specified in CUR-1.

### 7.2 Profile Presentation

Add or derive the CUR-7 presentation fields:

- `public_profile_theme`
- public cover/statement values if they are not represented by the identity columns above;
- ordered featured collection IDs, preferably through an ordered relation if it keeps referential integrity simpler than an array.

Do not store two independent copies of the same bio/statement or cover unless there is a real private-vs-public product requirement. Prefer one canonical public profile field per concept.

### 7.3 Collection And Item Public Identity

Use the CUR-4/CUR-2 public collection and item concepts:

- collection `public_slug`;
- collection visibility (`is_public` or its eventual canonical replacement);
- collection featured/unlisted presentation state;
- collection public ordering and presentation fields where needed;
- item `public_slug`;
- item public hide/story/photo overrides where needed.

Public slugs need scoped uniqueness constraints so canonical URLs resolve deterministically.

### 7.4 Safe Public Reads

Do **not** grant anonymous users broad direct access to the complete `profiles` row simply because RLS filters rows. RLS is row-level, not column-level.

Expose public profile data through a safe-column RPC/view/read model such as the `get_public_profile(username)` direction in CUR-1, extended or composed to return only public collection/item summaries after all privacy gates pass.

The public read layer should:

- normalize username lookup;
- return nothing when `public_enabled = false`;
- include only explicitly safe columns;
- filter collections/items by public visibility;
- never rely on a model- or client-supplied owner ID for authorization.

### 7.5 Existing Users

Migration is conservative:

- existing users receive no generated public username;
- existing profiles remain `public_enabled = false`;
- existing user-owned collections remain anonymous-inaccessible until explicit publish review;
- existing admin sample content retains its separate product-demo behavior.

No existing user becomes public because this migration ran.

---

## 8. Implementation Sequence

Implement the public museum in small slices rather than one broad rewrite.

### Slice A — Public identity foundation

1. Apply the username/profile migration from CUR-1.
2. Add server-side username validation/availability and safe profile reads.
3. Add owner-facing public museum settings and preview shell.
4. Add privacy tests proving default-private behavior.

### Slice B — Public profile route

1. Add `/u/:username` before the SPA catch-all.
2. Resolve a public-safe profile projection server-side.
3. Return non-indexable 404 behavior for private/missing profiles.
4. Render the responsive anonymous profile page.
5. Add first-response OG metadata.

### Slice C — Featured public content

1. Add/finish public collection slugs and publishing controls.
2. Allow ordering featured public collections.
3. Render featured collections and selected public objects on the profile.
4. Remove content immediately when it becomes private.

### Slice D — Hardening

1. Add crawler tests for canonical URL and OG tags.
2. Add anonymous privacy regression tests for profile on/off, collection publish/unpublish, hidden item, story, and photo rules.
3. Add accessibility coverage for public navigation, headings, images, and focus states.
4. Add profile/share analytics using only public-safe identifiers and events.

A full authenticated-app `BrowserRouter` migration is intentionally not part of these slices.

---

## 9. Validation Strategy

Implementation PRs should cover at least:

- username format, reserved-name, collision, and unpublished-reservation cases;
- anonymous 404 for missing/private profiles;
- profile on with zero public collections;
- private collections never appearing on a public profile;
- public-but-unlisted collections omitted from profile modules;
- featured collection made private disappears immediately;
- hidden items/stories/photos never appearing in page data or metadata;
- OG tags present in the initial HTML without client JavaScript;
- no email/admin/private sync fields in serialized public payloads;
- responsive profile layout and keyboard/screen-reader semantics;
- owner preview matching the anonymous rendering contract.

---

## 10. CUR-10 Acceptance Criteria

- [x] Written profile specification covers URL structure, auth/identity changes, privacy behavior, page contract, and OG strategy.
- [x] Routing decision: keep `HashRouter` for the authenticated app in the first Phase 1 release and use server-rendered canonical public routes.
- [x] Supabase migration plan documented, reusing the existing username/privacy/customization specs rather than creating duplicate models.

This document is the design deliverable. Schema, route, and UI changes should ship in focused implementation issues/PRs rather than being folded into the spec PR.