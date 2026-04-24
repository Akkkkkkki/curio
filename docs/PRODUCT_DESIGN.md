# Curio - Product Design Document

> This document owns **UX requirements, interaction design, mobile guidance, and design language**. For product thesis, positioning, and deferred scope, see `docs/PRODUCT_STRATEGY.md`. For execution phases, metrics, and go-to-market sequencing, see `docs/ROADMAP.md`. For architecture, sync behavior, and runtime constraints, see `docs/TECHNICAL_DESIGN.md`.

## 1. Product Design North Star

Curio is a personal museum for meaningful objects. It is not a generic inventory utility, a resale marketplace, or a database builder with prettier styling. The product should help people capture objects, write the human story behind them, organize them in a flexible way, and share them proudly when they are ready.

The design bar for every major flow is:

- **Story-first:** visible narrative should feel human-authored, not machine-invented
- **Trust-first:** save, edit, sync, and upload states must feel reliable before growth mechanics matter
- **Shareable identity:** museums should feel worth showing, not merely useful to maintain
- **Broad product, narrow beachhead:** the product remains category-agnostic, while examples and early polish can lean on specialty food/drink collectors where it clarifies the experience

This document is intentionally split into two layers:

- **Phase 0 baseline:** current shipped behavior and constraints that must not regress
- **Phase 1 target design:** the canonical UX specification for **Shareability And Identity**

## 2. Phase 0 Baseline — Foundation And Soul

Phase 0 is the trust-and-story baseline that Phase 1 builds on. The product should not add public identity features on top of flows that still feel unreliable or impersonal.

### 2.1 First 5-minute value

**Goal:** a brand-new user should understand Curio's taste and successfully create one meaningful item within five minutes.

#### The 5-minute aha flow

- **Minute 0-1: immediate delight**
  - The user can enter a **Public Sample Gallery** without signing in.
  - The product clearly frames itself as a personal museum, not a spreadsheet.
- **Minute 1-3: one clear action**
  - The primary CTA is **Add your first item**.
  - Capture stays on a single mobile-first screen whenever possible.
  - AI may help in the background, but never becomes a blocking step.
- **Minute 3-5: trust and completion**
  - The user can confirm a draft, save, and immediately see the result in the collection grid.
  - Save feedback is explicit: **Saved**, then **Synced** or **Will sync / retrying**.

#### Onboarding principles

- **Delight before auth:** read-only sample content should be available before sign-in.
- **Single-path first run:** avoid presenting many branching choices up front.
- **Recoverable AI:** manual completion must remain available and preserve progress.
- **Read-only must be obvious:** sample and public content should show persistent non-editable cues.
- **Defer distractions:** Museum Guide, heavy social features, and creative AI output should not compete with the first-save experience.

### 2.2 Current production baseline

This section captures the durable baseline behavior that the product design assumes today.

#### Home

- Search matches **collection names** and **item titles**.
- If a collection name does not match but an item title does, the collection card shows an **item match** indicator.
- When search yields no matches, Home shows a themed empty state rather than a blank list.
- **On This Day** appears only when a matching historical item exists.
- Historical matching cascades in this order:
  1. Same month/day in a prior year
  2. Same day in the prior month for days 1-28
  3. Same day in the prior week

#### Item creation

- Capture is single-screen and recoverable.
- AI autofill is non-blocking and must not prevent manual completion.
- AI should never overwrite fields the user has already edited.
- Story capture should remain prominent and easy to reach.
- Lightweight photo edits such as crop and rotate can happen inside the flow.

#### Collection browsing

- Users can sort by newest, oldest, title, or rating.
- Multi-select cleanup should remain lightweight and understandable.
- Offline and conflict states need explicit feedback, not silent failure.
- In-session editing should feel reversible and forgiving.

### 2.3 Quick-add mode

Curio supports both **capture now, curate later** and **write the story up front**.

- Quick add flow: **photo -> AI identifies object -> item appears in collection -> user enriches later**
- The full guided flow remains available for users who want to write stories immediately.
- Quick-add items should carry a subtle cue that they still need enrichment, especially story completion.

### 2.4 Active AI stance

Curio's active AI work should remain:

- **optional**
- **recoverable**
- **cost-aware**

Current active use:

- metadata extraction from item photos
- prompting or structuring help for story capture

Current non-goals:

- AI-generated visible stories
- AI image enhancement as part of the core collecting flow
- novelty creative outputs that do not deepen the museum

If AI is unavailable or inaccurate, the user must still be able to finish the task without losing progress.

### 2.5 Capture simplification requirements

The add-item flow should continue to feel simple on mobile even as Phase 1 adds more collection flexibility.

- Default capture surface should prioritize:
  - photo
  - title
  - key `primary` fields
  - story prompt
  - rating
  - save
- Story should remain visible by default rather than hidden behind advanced settings
- Extra notes or technical detail can sit behind a lightweight **More details** affordance
- Save should stay easy to reach on small screens, including sticky-action treatment when needed
- AI autofill should begin after photo selection, fill the form in place, and never force a separate step
- AI failure should be communicated with a short continue-manually message while keeping the user on the same screen
- Keyboard behavior, input types, and layout stability should be tuned for narrow screens so the form does not feel jumpy while AI updates arrive

## 3. Phase 1 — Shareability And Identity

Phase 1 turns a trusted private archive into something worth showing. The product should make public identity legible without collapsing into generic social features or compromising privacy.

### 3.1 Core loop

The Phase 1 core loop is:

1. Create or refine collections so the museum feels coherent
2. Publish a museum identity and select which collections belong in public
3. Share a profile, collection, item, Wrapped, or widget
4. Visitors land on a beautiful public museum surface
5. The owner gets reinforcing signals, such as profile visits, collection engagement, and story depth cues
6. The owner returns to add more stories, improve metadata, and refine presentation

The product should make that loop feel identity-led, not growth-hacky. The point is not "share because apps want growth." The point is "share because this looks like you."

### 3.2 Product-facing contracts

Phase 1 UX assumes the following public-facing objects, regardless of whether technical implementation uses tables, derived views, or computed routes.

```ts
interface MuseumProfile {
  slug: string;
  displayName: string;
  shortBio?: string;
  coverImage?: string;
  theme?: AppTheme;
  publicEnabled: boolean;
  featuredCollectionIds: string[];
}

type CollectionVisibility = 'private' | 'public';

type ShareSurface = 'profile' | 'collection' | 'item' | 'wrapped' | 'widget';

interface BulkImportMapping {
  sourceColumn: string;
  target: 'title' | 'story' | 'rating' | 'photo' | 'field';
  fieldId?: string;
}
```

Additional Phase 1 assumptions:

- `FieldDefinition.displayMode` remains the common display contract
- Only `primary` fields are shown by default on public cards
- Public sharing is intended to be anonymous-readable for canonical share URLs
- The current collection-level `is_public` model in technical design is a foundation, not the complete public museum experience

### 3.3 Public Museum Profile

The museum profile is the owner's public front door. It should feel like a curated exhibition page, not a settings screen and not a social feed.

#### Profile activation model

- Public museum profiles are **opt-in**
- The public profile is **off by default**
- Turning the profile on creates a canonical public URL and previewable share surface
- A public profile can exist while most collections remain private

#### Required profile elements

- display name
- stable public slug / share URL
- short curator bio
- cover image or hero object
- profile theme
- featured public collections
- lightweight identity signals such as total public collections or museum age

#### Presentation rules

- The profile should read editorially: hero image, curator statement, featured collections, and selected objects
- The layout should privilege imagery, titles, and story cues over counts and controls
- Public profiles should feel welcoming to anonymous visitors who know nothing about Curio
- The owner-facing edit controls should never appear on the public-facing view

### 3.4 Publishing And Privacy

Phase 1 uses a **hybrid opt-in** model: the museum profile is opt-in, and collections remain private until individually published.

#### Visibility rules

- All user collections start **private**
- Enabling the museum profile does **not** automatically publish any collection
- Each collection requires an explicit publish decision
- Item pages inherit visibility from their parent collection
- Widgets, OG cards, and share links can only be generated from public surfaces

#### Leak-prevention rules

- Private collections must never appear on profile pages
- Private items must never generate public item pages
- Private data must never be included in OG metadata, widgets, or share cards
- Shared Wrapped outputs must exclude private collections unless the user explicitly includes only public-ready content
- If a public collection is later made private, all dependent public surfaces should stop resolving cleanly rather than exposing stale content

#### UX requirements

- Visibility state should be understandable at a glance
- Publish actions should explain their consequence in plain language
- Public previews should be available before final publishing
- The product should distinguish clearly between:
  - profile visibility
  - collection visibility
  - private owner-only analytics or previews

### 3.5 Share surfaces

Phase 1 should treat every outward-facing surface as part of one coherent share system. Export images, OG cards, and embeds should all resolve back to a canonical public page rather than acting as disconnected artifacts.

| Surface | Purpose | Required content | Primary destination |
| ------- | ------- | ---------------- | ------------------- |
| Profile | Share the whole museum identity | cover image, curator identity, featured collections, theme | public museum page |
| Collection | Share a specific gallery | collection hero, title, icon, 1-2 pinned fields, representative items | public collection page |
| Item | Share one meaningful object | hero image, item title, curator identity, parent collection, pinned fields | public item page |
| Wrapped | Share a time-based story of the museum | year title, strongest themes, selected objects, story-led highlights | public Wrapped page |
| Widget | Embed a shelf on another site | compact item shelf, collection identity, link back | public collection or profile page |

#### Shared visual system

- Public cards and public pages should use the same visual language
- Hero imagery matters more than data density
- Curator identity should always be visible, even on item-level share surfaces
- Share surfaces should feel collectible and intentional, not like generic preview cards

#### OG and share-card rules

- Default structure: **hero image + title + curator identity + up to 1-2 pinned fields**
- Story excerpt may appear only when it is clearly user-authored and strong enough to stand alone
- Never expose:
  - AI-only metadata
  - private notes
  - draft or partial fields
  - internal system language
- If a collection or item has weak imagery, the system should fall back to a tasteful branded composition rather than a broken or cluttered card

### 3.6 Flexible Collections And Category Picking

Phase 1 must move beyond hardcoded category templates without turning Curio into a heavy schema-building tool.

#### Collection creation flow

The primary entry question is:

- **What do you collect?**

The flow should support two paths:

- **Custom path:** the user describes what they collect in natural language, then Curio suggests useful fields
- **Preset path:** the user chooses a starter template when they want a fast, familiar setup

Durable rules for the flexible path:

- users select **3-6 fields**
- **1-2 fields** are pinned as `primary`
- remaining fields default to `detail` unless the template or UI deliberately promotes them
- field terminology stays **fields**, not tags
- reserved built-in concepts such as title, story, and rating are not duplicated as custom fields

#### Stable mixed-schema browsing

Mixed-schema browsing should still feel coherent across the product.

- Every collection must support a common card contract
- `displayMode` remains the stable mechanism for deciding what surfaces on cards versus detail views
- Public cards should show only the most legible identity fields, not a dump of every schema attribute
- Item detail views remain the place where the full schema becomes visible

#### Visual category picker

Collection choice during add-item should become more visual and museum-like.

- Use image-backed cards rather than a plain dropdown when the number of collections is manageable
- Each card should show:
  - cover image or representative item image
  - collection icon
  - collection name
  - item count
- Order by recent use so the likely destination is easiest to reach
- When the user has many collections, fall back to a simpler searchable text list or compact sheet rather than forcing a dense card wall

### 3.7 Collection Wrapped

Wrapped is the first intentionally viral feature in Curio, but it must still feel like Curio.

#### What Wrapped should celebrate

- story depth
- taste and identity
- recurring themes, makers, origins, or moods
- the emotional shape of a year in objects

#### What Wrapped should avoid

- quantity-first trophies
- speed or streak mechanics
- generic gamification language
- charts that feel like work dashboards

#### Baseline Wrapped modules

- museum title and year framing
- standout objects
- strongest stories
- recurring categories or themes
- a small number of elegant identity stats
- a final shareable summary card

Baseline Wrapped is free. Premium Wrapped treatments, expanded themes, and enhanced personalization can sit in paid tiers later per `docs/PRODUCT_STRATEGY.md`.

### 3.8 Basic Stats And Analytics

Phase 1 stats should reinforce identity, not turn the app into an analytics product.

#### Good basic stats

- items with stories
- public collections count
- museum age
- top categories or themes
- origins, makers, or places when relevant
- profile visits and share taps

#### Poor stats for Phase 1

- leaderboard-style comparisons
- productivity framing
- novelty metrics with no identity value

#### Product tracking requirements

The event taxonomy should stay aligned with `docs/ROADMAP.md` and remain stable across web and Android. Phase 1 design assumes tracking for:

- profile public-enabled / disabled
- collection published / unpublished
- share initiated by surface
- public profile visit
- Wrapped generated
- Wrapped shared
- field suggestion accepted
- bulk import started / completed / failed

### 3.9 Bulk Import

CSV import is a supporting utility, not the star of the product.

#### Positioning

- Bulk import should live in collection setup, collection management, or profile/settings utilities
- It should never displace the main storytelling capture flow for new users

#### Supported paths

- create a new collection from CSV
- import rows into an existing collection

#### Mapping requirements

- Required mapping support:
  - title
  - story
  - rating
  - photo
  - custom field IDs
- Users should be able to preview mappings before final import
- Validation errors should be specific and recoverable
- The import flow should preserve user-authored story text exactly as provided

Bulk import should feel like a practical accelerant for serious collectors, not a signal that Curio's primary value is data migration.

### 3.10 AI Assist In Phase 1

AI in Phase 1 should expand useful autofill without taking over the visible narrative layer.

#### Good Phase 1 AI

- suggest fields from a collection description
- identify objects and fill metadata using collection context
- suggest story prompts or follow-up questions
- assist with draft cleanup after the user has written something

#### Bad Phase 1 AI

- auto-writing the visible story
- inventing sentimental memory copy
- generating public captions without review
- replacing public identity with synthetic polish

#### Guardrails

- AI output should always be visibly optional
- User edits always win
- AI should never overwrite a field the user has already touched
- Public-facing story surfaces must prefer human-authored text
- Machine-generated metadata should remain distinguishable from human story

## 4. Design Language

Curio should feel warm, editorial, and museum-like without becoming precious or theatrical.

### 4.1 Visual direction

- **Typography:** DM Serif Display for elegance, Inter for precision and utility
- **Layout:** bento-like composition on home; gallery-minded collection and public profile layouts
- **Density:** medium-low density with generous whitespace
- **Palette:** warm neutrals and restrained accents, not neon or gaming-adjacent
- **Photography:** objects in lived-in or natural context when possible, not sterile catalog cutouts only

### 4.2 Shareability-specific direction

- Public pages should feel like a collector's exhibition, not a social profile template
- OG cards and widgets should inherit the same design system as in-product public pages
- Stats should appear as quiet context, not dominant dashboard chrome
- The visual hierarchy should consistently privilege:
  1. object imagery
  2. object or collection title
  3. curator identity
  4. a small number of meaningful fields

### 4.3 Voice and tone

Curio should sound like a thoughtful friend who appreciates meaningful objects.

| Avoid | Prefer |
| ----- | ------ |
| Archive entity | Item in your museum |
| Target destination | Choose a collection |
| Auto detect | Let Curio identify this |
| Digital twin | Your story |

### 4.4 Empty states

Empty states should invite curation rather than punish incompleteness.

- show sample content when the user has no museum yet
- prompt the first item or first public collection clearly
- after publishing is enabled, nudge the user toward featuring one collection rather than exposing a barren public profile

## 5. Mobile And Responsive Guidance

Phase 1 sharing features must still feel strong on mobile, because the product's most important actions begin and end on a phone-sized screen.

- Design mobile-first, then scale up
- Keep primary actions within thumb reach
- Use tap targets at or above platform comfort minimums
- Prefer sectioned single-page flows over multi-step wizards on small screens
- Respect safe areas for fixed controls and bottom sheets
- Use skeletons for content loading and reserve spinners for short in-flight actions
- Keep motion restrained and `prefers-reduced-motion` safe
- Ensure public share pages, Wrapped, and widgets remain readable on narrow screens

Bottom-sheet and modal rules remain important:

- bottom sheets should support swipe-to-dismiss, backdrop tap, and Escape
- drag handles and safe-area padding should be explicit
- important share actions should not be hidden behind hover-only affordances

## 6. Onboarding And Cloud Access

Curio remains cloud-first for user-owned museums, but the product should continue to offer a sample-first path.

### 6.1 Sample-first entry

- Users can browse a public sample museum without signing in
- Sign-in is requested when they try to save their own content or enable their own public museum

### 6.2 Manual local import

- Legacy local users can import their data from the profile area
- This remains a migration utility, not a primary acquisition flow

### 6.3 Public sample gallery

- The sample gallery should model the standard for public museum presentation
- It should demonstrate strong story writing, thoughtful imagery, and tasteful collection identity
- It should remain read-only for non-admin users

## 7. Future Roadmap

`docs/PRODUCT_DESIGN.md` should fully own the UX requirements for Phase 0 and Phase 1. For later execution phases such as community, discovery, monetization expansion, and Android distribution strategy, see:

- `docs/ROADMAP.md`
- `docs/PRODUCT_STRATEGY.md`
- `docs/TECHNICAL_DESIGN.md`
