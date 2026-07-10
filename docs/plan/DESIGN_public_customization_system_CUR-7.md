# Public Customization System

> **Status:** Design (Ready for Implementation Review)
> **Linear:** [CUR-7](https://linear.app/qiuyue/issue/CUR-7)
> **Phase:** Phase 1 -- Shareability And Identity - P1
> **Last Updated:** 2026-07-10

This spec defines the first public-facing customization system for Curio profiles, public
collections, item share surfaces, Open Graph cards, Wrapped outputs, and widgets. It builds on the
public identity, privacy, and share-route decisions in:

- `docs/plan/DESIGN_username_system.md`
- `docs/plan/DESIGN_public_privacy_model.md`
- `docs/plan/DESIGN_shareable_urls_and_og_tags.md`
- `docs/PRODUCT_DESIGN.md` section 3 "Phase 1 -- Shareability And Identity"

The goal is not to turn Curio into a creator tool. The v1 system should let a museum feel personal
and intentional while preserving the product's gallery-like restraint.

---

## 1. Problem

Phase 1 makes Curio public: users can publish a museum profile and share profile, collection, item,
Wrapped, and widget surfaces. Those surfaces need enough customization to feel like the owner's
museum, not a generic app template.

Without boundaries, customization can drift in two bad directions:

- **Too bland:** every public museum looks interchangeable, weakening the reason to share.
- **Too expressive:** filters, stickers, fonts, and arbitrary layout controls turn Curio away from a
  personal museum and into a generic design editor.

V1 needs a narrow, tasteful customization contract that can ship before full public profile
implementation.

---

## 2. Product Principles

1. **Curated, not decorated.** Customization should change presentation emphasis, not add visual
   clutter.
2. **Content leads.** Hero images, object titles, story cues, and curator identity carry the surface.
3. **One identity system.** Profile pages, public cards, OG images, and widgets should share the
   same theme and curator identity instead of each inventing local styling.
4. **Preview before publish.** Owners must see the anonymous public result before making it live.
5. **Privacy gates first.** Customization never makes private collections, hidden items, private
   stories, private photos, or internal fields visible.

---

## 3. V1 Customization Model

V1 exposes a small set of owner-controlled presentation choices. Each choice maps to public read
models and generated share assets.

| Control              | Surface owner can edit      | Default             | Applies to                                      |
| -------------------- | --------------------------- | ------------------- | ----------------------------------------------- |
| Public theme         | Profile setting             | Current app theme   | Profile, collection, item, OG cards, widgets    |
| Profile cover        | Profile setting             | Featured object     | Profile hero, profile OG fallback               |
| Curator statement    | Profile setting             | Empty               | Profile hero, profile OG description            |
| Featured collections | Profile setting             | None selected       | Profile modules, profile OG fallback            |
| Public field set     | Collection publish settings | Primary fields only | Collection cards, item cards, widgets, OG cards |
| Collection cover     | Collection publish settings | Representative item | Collection page, collection card, widget        |
| Share-card emphasis  | Collection publish settings | Image-led           | Collection and item share cards                 |

The public theme is a controlled enum, not arbitrary CSS. V1 should reuse the existing `AppTheme`
family (`gallery`, `vault`, `atelier`) unless implementation discovers a reason to split public
theme names from app theme names.

### 3.1 Profile Surface

The public profile is the museum front door. It can be customized through:

- display name and `@username` from the username/profile system
- short curator statement
- cover image or featured object
- theme
- featured public collections and their order
- optional lightweight public signals, such as public collection count or museum age

V1 does not include custom profile layouts. The layout remains product-owned so public museums stay
recognizable as Curio.

### 3.2 Collection Surface

Public collections inherit the profile theme but allow collection-level emphasis:

- collection cover image or representative item
- ordered public field set, defaulting to primary fields
- featured item order
- story/photo visibility inherited from the privacy model
- share-card emphasis: `image-led` or `story-led`

`story-led` may only be available when story sharing is enabled and the selected story is public.
If not, the system falls back to `image-led`.

### 3.3 Item Surface

Public item pages and item cards inherit profile and collection presentation choices. Owners can
control:

- whether the item is public
- whether the story is public
- whether the photo is public
- which collection-selected fields appear on cards

Item-level arbitrary styling is out of scope. An item should feel like part of a museum, not a
standalone poster editor.

### 3.4 Wrapped Surface

Wrapped uses the same profile identity and theme but has its own generated editorial treatment.
Owners can choose:

- whether a Wrapped output is public
- which public-ready collections/items are included
- a generated cover frame selected from product-owned templates

V1 does not support per-slide design editing.

### 3.5 Widget Surface

Embeds should be compact and brand-consistent:

- inherit the profile theme
- show curator identity
- use the collection cover or representative items
- link back to the canonical profile or collection page

V1 widgets expose only size variants such as `compact` and `standard`; no arbitrary color or layout
controls.

---

## 4. Core vs Later Expansion

### V1 Core

V1 should ship only:

- controlled public themes
- profile cover and curator statement
- featured collections and ordering
- collection cover and featured item ordering
- public field selection for cards/widgets
- image-led vs story-led card emphasis
- preview and publish confirmation for every public surface

These are enough to make public museums feel personal while keeping implementation scoped.

### Explicitly Deferred

Do not include these in v1:

- custom fonts
- stickers, overlays, frames, or decorative badges
- arbitrary color pickers
- drag-and-drop page builders
- per-item visual themes
- public CSS injection or user-authored HTML
- algorithmic "personalization" of visitor views
- marketplace themes
- animated profile effects

These can be reconsidered only after public profiles, cards, and widgets have real usage data.

---

## 5. Data Contract

Exact SQL belongs in implementation PRs, but the public customization system needs these durable
concepts.

### `profiles`

Add or derive public-safe fields:

- `public_profile_theme`
- `public_profile_cover_asset_path`
- `public_profile_statement`
- `public_profile_featured_collection_ids` or an ordered join table

### `collections`

Add or derive public presentation fields:

- `public_cover_asset_path`
- `public_featured_item_ids` or an ordered join table
- `public_field_ids`
- `public_card_emphasis` (`image_led` | `story_led`)

### Generated Assets

Generated OG cards and share images should store enough metadata to invalidate and regenerate when
their public-safe source projection changes. That source fingerprint must include profile theme,
cover and curator identity; selected collection/item IDs and ordering; selected public field IDs and
their visible values; public story text or excerpts; image asset revisions; and the current privacy
state. Any fingerprint change invalidates the dependent generated asset.

Implementation may choose database columns, a public read model, or computed views. The required
contract is that anonymous public routes read only public-safe presentation fields after privacy
checks pass.

---

## 6. UX Contract

### Profile Settings

```text
Public museum

Theme
( Gallery ) ( Vault ) ( Atelier )

Cover
[ Choose image ]  or  [ Use featured object ]

Curator statement
[ A short note about the point of view behind this museum ]

Featured collections
[x] Chocolate wrappers      public
[x] Blue Note records       public
[ ] Field notes             private

[ Preview public museum ]   [ Save public profile ]
```

Required behavior:

- Private collections can appear in the owner settings list but cannot be selected as featured.
- Preview uses an owner-authenticated preview request that is authorized against the draft owner and
  then passed through the same public-safe projection and serializer used by anonymous routes. It
  may bypass only the live profile/collection gate; field, story, photo, and hidden-item privacy
  filters still apply.
- Preview responses are private, non-cacheable, and non-indexable. They do not make canonical public
  URLs resolve and do not generate persistent share assets before publish.
- Saving a draft is allowed; publishing still requires the username/profile gates from CUR-1.

### Collection Publishing

```text
Public presentation

Cover
[ Use collection cover ] [ Pick featured item ]

Card emphasis
( Image-led ) ( Story-led )

Public fields
[x] Maker
[x] Year
[ ] Purchase price
[ ] Condition notes

Featured objects
[ reorder selected public items ]

[ Preview public collection ]   [ Save presentation ]
```

Required behavior:

- Private fields and hidden items are unavailable for public presentation.
- If story-led emphasis is chosen but no public story is available, the UI explains the fallback.
- Public field selection defaults to the existing primary field contract.

---

## 7. Acceptance Criteria Mapping

- **Defines v1 customization surfaces:** profile, collection, item, Wrapped, widget, OG/share cards.
- **Distinguishes core from later expansion:** v1 controls are listed; expressive/editor controls
  are explicitly deferred.
- **Keeps first version narrow enough to ship:** no arbitrary layouts, fonts, stickers, CSS, or
  per-item themes.
- **Aligns with Curio aesthetic direction:** content-led, editorial, gallery-like presentation using
  controlled themes and public-safe previews.

---

## 8. Open Implementation Questions

1. Should `public_profile_theme` store the current `AppTheme` values directly, or should public
   theme names be versioned separately so app themes can evolve without changing public pages?
2. Should featured collection and item order use ordered join tables from the start, or is a JSON
   array acceptable until the first public implementation?
3. Should generated OG cards be regenerated synchronously on save or lazily on first public request?
