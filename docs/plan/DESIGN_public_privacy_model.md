# Public Privacy Model

> Linear: CUR-2. Phase 1 shareability prerequisite.

## Scope

This spec defines the privacy model for public museum profiles, public collections, public item
pages, Open Graph previews, and share widgets. It does not ship schema or RLS changes directly.
Those are listed as implementation requirements so the later public-profile work has a clear
contract.

The model extends the existing Phase 1 direction in `docs/PRODUCT_DESIGN.md`: profiles are opt-in,
collections are private by default, and public surfaces must be anonymous-readable only after an
explicit owner action.

## Product Decisions

### Default Visibility

- New user collections are private by default.
- Existing user collections remain private unless the owner explicitly publishes them.
- Enabling a public museum profile does not publish any collection.
- Publishing a collection is separate from featuring that collection on the public profile.
- Item pages inherit the visibility of their parent collection, unless the item is explicitly hidden
  from public surfaces.
- Generated share surfaces, OG previews, and widgets can only be created from public-ready surfaces.

### Profile Visibility

Public museum profiles are opt-in and off by default. A username or slug reservation is not enough
to make the profile public.

A public profile may show:

- display name
- public slug / share URL
- short curator bio
- avatar or cover image chosen by the owner
- profile theme
- featured public collections
- lightweight public signals such as public collection count or museum age

A public profile must not show:

- email address
- auth provider identity
- admin status
- private collection names or counts
- private item counts that would imply hidden inventory size
- private analytics, drafts, sync state, or import status

Users can hide a public collection from their profile without making the collection private. This
supports direct collection links that are public but not promoted on the museum front door.

### Collection Visibility

Each collection has one owner-controlled visibility state:

| State   | Meaning                                                   | Anonymous access |
| ------- | --------------------------------------------------------- | ---------------- |
| Private | Owner-only archive content. Default for user collections. | No               |
| Public  | Public collection page, item pages, cards, and widgets.   | Yes              |

A public collection can also be:

- `featured`: appears on the public profile.
- `unlisted`: reachable by direct URL but omitted from profile modules and discovery surfaces.

Public sample collections remain a special admin-owned case. They can continue using
`is_public = true`, but user-owned publishing should require a review/confirm step before public
profile listing.

### Item Visibility

Items inherit the parent collection visibility. Within a public collection, the owner can hide an
individual item from public surfaces. Hidden public items should not appear in collection grids,
profile modules, widgets, OG data, or public search/discovery indexes.

Direct item URLs for hidden or newly private items should return a clear not-found or private state,
not stale cached content.

### Data Exposure

Public item pages and cards show a curated subset, not the complete private record.

Always public when parent collection and item are public:

- item title
- parent collection title and icon
- curator display identity
- owner-selected primary fields
- public-safe image if photo visibility is enabled

Never public:

- AI-only observations or hidden model metadata
- sync status and retry queue state
- local asset paths or private storage object keys
- raw import metadata
- private owner notes
- fields marked internal, hidden, or owner-only

Owner-controlled:

- story text
- secondary metadata fields
- item photo visibility
- collection-level featured item order

### Story Visibility

Stories are personal enough to require an explicit sharing choice.

Default behavior:

- Private collections: stories are private.
- Newly published collections: stories are not shown on share cards or OG previews until the owner
  enables story sharing for the collection.
- Public item detail pages may show stories only when collection story sharing is enabled or the
  individual item is explicitly marked story-public.

Override behavior:

- The owner can hide a specific item story even when collection-level story sharing is on.
- The owner can make a specific item story public even when collection-level story sharing is off,
  but the UI should ask for confirmation.
- AI observation text remains hidden from public views in every mode.

Share-card behavior:

- Story excerpts can appear only when the story is public, user-authored, and short enough to stand
  alone.
- If no public story excerpt is available, cards should use image, title, curator identity, and
  primary fields instead.

### Photo Visibility

Photos are visible by default for public collections because Curio's public surfaces are visual, but
owners need a text-only escape hatch.

Controls:

- Collection default: `show photos publicly` on by default when publishing.
- Item override: `hide photo publicly` for sensitive items.
- Public cards and OG previews must fall back to collection cover, profile cover, or a branded text
  card when item photos are hidden.

Private storage keys must never be exposed directly. Public image delivery should use either a
public-safe derived asset, a signed proxy with public authorization checks, or generated card images
that do not reveal private object paths.

### Existing Data And Migration

Existing data should be treated conservatively.

- Existing user collections must not be added to a public profile automatically.
- Existing `collections.is_public = false` remains private.
- Existing admin/sample collections with `is_public = true` remain public samples.
- If any user-owned collection already has `is_public = true`, keep the database read behavior for
  backwards compatibility but mark it as `review required` in the future publishing UI before it can
  appear on a profile, widgets, discovery, or new share cards.
- Public profile enablement should require a final confirmation that lists the public profile URL and
  any collections selected for profile display.

## Control Model

| Control                  | Owner action                         | Default | Public effect                                      |
| ------------------------ | ------------------------------------ | ------- | -------------------------------------------------- |
| Profile public           | Toggle in profile settings           | Off     | Enables `/u/:slug` profile page                    |
| Collection visibility    | Publish/unpublish in collection menu | Private | Enables collection and inherited item public pages |
| Feature on profile       | Checkbox in collection settings      | Off     | Adds collection to public profile modules          |
| Collection story sharing | Toggle while publishing              | Off     | Allows stories on public item pages/cards          |
| Collection photo sharing | Toggle while publishing              | On      | Allows item photos on public surfaces              |
| Item hidden from public  | Toggle in item detail                | Off     | Removes item from all public surfaces              |
| Item story override      | Toggle in item detail                | Inherit | Shows/hides story independently                    |
| Item photo override      | Toggle in item detail                | Inherit | Shows/hides photo independently                    |
| Public field selection   | Field picker in collection settings  | Primary | Controls metadata shown publicly                   |

## UI Mockups

These are structural wireframes, not final visual design.

### Profile Settings: Public Museum

```text
Profile settings

[ Public museum ] [off/on]
Your museum is private until you turn this on.

Public URL
curio.app/u/[ username ]               [check availability]

Public identity
Display name      [ Qiuyue ]
Short bio         [ A few lines about the collection point of view ]
Profile theme     [ Gallery | Vault | Atelier ]
Cover             [ Choose image or hero object ]

Featured collections
[ ] Vintage records          private
[x] Chocolate wrappers       public, featured
[ ] Field notes              public, unlisted

[ Preview public museum ]        [ Save public profile ]
```

Required behavior:

- The save action is disabled until username/slug rules pass.
- Turning the profile on shows a confirmation summary before publishing.
- Private collections are visible in the settings list but cannot be selected as featured until
  published.
- Preview renders exactly what anonymous visitors can see.

### Collection Settings: Privacy

```text
Collection settings

Visibility
( Private ) ( Public )

Public publishing
[ ] Feature this collection on my public museum
[x] Show item photos publicly
[ ] Show item stories publicly

Public fields
[x] Maker        primary
[x] Year         primary
[ ] Purchase price    private
[ ] Condition notes   private

Public readiness
- 12 items will be visible
- 2 items have hidden photos
- 7 stories will remain private

[ Preview public collection ]     [ Publish collection ]
```

Required behavior:

- Switching from Private to Public opens a confirmation step before saving.
- The preview should use anonymous/public data loaders, not owner state, so leaks are caught before
  publish.
- Unpublishing a collection immediately removes dependent item URLs, widgets, and OG data.

### Item Detail: Public Overrides

```text
Item detail > Public settings

Public status: Inherits from public collection
[x] Show this item publicly
[ ] Show this story publicly
[x] Show this photo publicly

Public preview
[ item card preview ]

[ Save public settings ]
```

Required behavior:

- The public settings section is hidden for private collections unless the owner opens publishing
  setup.
- Hiding an item should explain that direct public item links will stop resolving.
- Story/photo overrides must clearly show whether they inherit the collection default.

## Supabase And RLS Requirements

Current foundation:

- `collections.is_public` exists and defaults to `false`.
- `collections` and `items` select policies allow reads when the parent collection is public.
- `profiles.is_admin` exists for public sample administration.
- `profiles` are currently readable only by the authenticated owner.

Required Phase 1 changes:

1. Add safe public profile fields to `profiles` or a separate `public_profiles` table:
   - `username` or `slug`
   - `display_name`
   - `short_bio`
   - `avatar_path` or `cover_image_path`
   - `theme`
   - `public_enabled`
   - `published_at`

2. Expose public profile data through a safe read model:
   - Prefer an RPC such as `get_public_profile(slug)` or a view/table that omits internal columns.
   - Do not grant anonymous reads on raw `profiles` rows that include `is_admin`, email-derived
     fields, seed state, or future billing/entitlement columns.

3. Extend collection publication metadata:
   - `is_public` remains the hard anonymous-read gate.
   - Add `listed_on_profile` or equivalent profile placement metadata.
   - Add story/photo defaults for public presentation.
   - Add a reviewed/confirmed timestamp for user-owned collections before they appear on profile or
     discovery surfaces.

4. Add item-level public overrides:
   - hide item from public surfaces
   - story visibility override
   - photo visibility override

5. Enforce anonymous public reads with RLS:
   - Anonymous users can select only profile-safe fields for `public_enabled` profiles.
   - Anonymous users can select public collections where `is_public = true`.
   - Anonymous users can select public items only when the parent collection is public and the item
     is not hidden.
   - Anonymous users can select public item images only when the parent item is public and photo
     visibility allows it.

6. Preserve owner/admin writes:
   - Owners can publish and unpublish their own collections.
   - Admins can continue managing public sample collections.
   - Non-admin users cannot mutate public sample content.

7. Invalidate dependent public surfaces on privacy changes:
   - collection unpublished -> item pages, widgets, OG cards, and profile modules stop resolving
   - item hidden -> item page and item cards stop resolving
   - story/photo hidden -> public payloads omit that content immediately

## Implementation Notes

- CUR-1 defines the username system required for stable profile URLs; this spec assumes that slug
  contract exists before `/u/:slug` ships.
- Public profile and collection queries should use explicit projection lists. Avoid `select('*')` on
  public routes.
- Public preview UI should call the same public loaders as anonymous visitors.
- Public image URLs should be generated from a public-safe delivery layer rather than private
  storage paths.
- The initial implementation can use collection-level visibility plus item hide/story/photo
  overrides. Discovery ranking, comments, reactions, and follower feeds are out of scope.

## Acceptance Checklist

- [x] Privacy model documented: defaults, public/private states, and owner controls.
- [x] UI mockups included for profile settings, collection settings, and item overrides.
- [x] RLS and Supabase schema changes identified without mutating production config.
