# Explore Feed Pipeline And Curation Model

> Linear: CUR-3. Phase 2 community and discovery prerequisite.

## Scope

This spec defines the content pipeline and curation model behind the Phase 2 Explore feed: where
Explore content comes from, how it is reviewed and ranked, what makes a museum or item eligible, and
how the feed is bootstrapped before organic public content exists. It does not ship runtime code,
routes, or schema directly. Schema, API, and tracking needs are listed as implementation
requirements so the later Explore build has a clear contract.

The model assumes the Phase 1 public surfaces already exist: opt-in public profiles, published
collections, and public item pages as defined in `docs/plan/DESIGN_public_privacy_model.md`. Explore
never exposes anything those rules keep private. The Phase 2 goal, per `docs/ROADMAP.md`, is that the
Explore page becomes a reason to open the app, with discovery driven by editorial curation rather
than an algorithmic feed.

## Curation Model Decision

Three models were considered:

1. **Fully manual feed** — an admin hand-places every entry. Highest quality and brand control, but
   does not scale past the first few hundred public museums and stalls the moment the admin is away.
2. **Algorithmic ranking** — engagement signals order the feed automatically. Scales cheaply but
   contradicts the product principle of sharing before social complexity, rewards volume over taste,
   and is explicitly listed as something to avoid in the Phase 2 roadmap.
3. **Semi-automated editorial feed with admin rails** — the system gathers and ranks eligible
   candidates into a review queue using deterministic, taste-aligned rules; an admin approves,
   pins, hides, or reorders within editorial modules. **This is the chosen model.**

The chosen model keeps the editorial voice and quality bar of a manual feed while letting the system
do the gathering, eligibility filtering, and first-pass ordering so curation stays tractable as the
public catalog grows. Ranking is deterministic and inspectable, not a black-box engagement model.

## Product Decisions

### Approved Content Sources

Explore only ever draws from surfaces that are already public under the Phase 1 privacy model. An
entry is eligible to enter the pipeline only if every privacy gate above it is satisfied at read
time, not just when it was queued.

Approved sources:

- Public, profile-listed **collections** owned by a `public_enabled` profile.
- Public **item pages** within those collections, excluding items hidden from public surfaces.
- Public **museum profiles** themselves (as a "collector to follow" unit).
- Admin-owned **sample collections** as evergreen seed content, clearly distinguishable from
  community content.
- Optional **editorial entries** authored by an admin (a themed shelf, a prompt callout) that
  reference only public content.

Never eligible:

- private or unlisted-only collections, hidden items, or any profile that is not public
- stories, photos, or fields that the owner has not made public
- AI-only observations, sync state, notes, or any field the privacy model marks never-public

### Feed Modules

The Explore page is a sequence of editorial modules, not one infinite list. Each module is a typed,
orderable unit so the admin composes a page rather than tuning a global score.

| Module            | Unit shown         | Population             | Purpose                                   |
| ----------------- | ------------------ | ---------------------- | ----------------------------------------- |
| Editor's picks    | collection or item | Admin-pinned           | Sets the quality bar and brand voice      |
| Featured museums  | profile            | Curated + ranked       | Drives the follow system                  |
| Fresh collections | collection         | Ranked, recency-tilt   | Rewards new public publishing             |
| Themed shelf      | collection or item | Admin theme + filter   | Editorial storytelling around a topic     |
| By template       | collection         | Ranked within template | Helps a visitor find their niche          |
| Prompt responses  | item               | Linked to a prompt     | Surfaces Phase 2 story prompts/challenges |

Modules are configuration, not code: adding or reordering a module, or changing its theme, is an
admin action against the schema below, not a deploy.

### Ranking Rules

Within a module, candidate order is a deterministic score the admin can preview and override.
Ranking never reorders across privacy boundaries and never invents reach for private content.

Signals, in rough priority:

1. **Admin placement** — pinned entries always sort first in their module, in admin-defined order.
2. **Editorial quality score** — an admin-assigned 0–100 tier on the entry (or its source), the
   primary taste signal.
3. **Completeness** — public title, primary fields, a public-safe image, and (where relevant) a
   public story present. Incomplete public surfaces rank lower.
4. **Freshness** — `published_at` / `updated_at` recency, weighted per module (high for Fresh
   collections, low for Editor's picks).
5. **Diversity caps** — at most N entries per owner and per template in a single module, so one
   prolific collector cannot dominate a page.
6. **Lightweight engagement** — public view or follow counts, used only as a late tiebreaker and
   deliberately down-weighted to avoid an engagement-led feed.

Score inputs and weights live in config so the editorial balance can be tuned without a schema
change. The computed order is always overridable by admin pin/hide/reorder.

### Eligibility Criteria

An entry must pass every check to enter the review queue:

- Source is one of the approved sources above and is public at evaluation time.
- Owner profile is `public_enabled`; collection `is_public` and profile-listed; item not hidden.
- Minimum completeness: a title, at least one owner-selected public field, and either a public-safe
  image or an explicitly text-only card.
- Not flagged or previously hidden by an admin (a hide is sticky until cleared).
- Passes basic safety screening (no reported/abuse-flagged content); flagged entries route to manual
  review, never straight to the live feed.
- Respects diversity caps at insertion time.

Eligibility is re-checked at publish and at serve time. If a collection is unpublished, a profile is
disabled, or an item is hidden after an entry is queued or approved, the entry must stop resolving
immediately — the same invalidation contract as the privacy model.

### Launch Bootstrapping

Explore must look intentional on day one, before meaningful organic public content exists.

Bootstrapping plan:

1. **Seed with samples** — the admin-owned sample collections (e.g. Vinyl Vault) anchor Editor's
   picks and By-template modules so the page is never empty.
2. **Hand-curate the first cohort** — as early users publish, the admin promotes the strongest
   public museums into Featured museums and Themed shelves manually.
3. **Recruit lighthouse collectors** — invite a small number of high-taste collectors to publish
   before public launch, so Featured museums has real, follow-worthy content.
4. **Lead with prompts** — launch a story prompt/challenge (per the Phase 2 roadmap) and feature its
   responses, generating fresh public items with a built-in editorial frame.
5. **Graduate to semi-automated** — as the eligible candidate pool grows, lean on the ranked review
   queue for Fresh and By-template modules while keeping Editor's picks and Featured museums
   hand-placed.

Until the catalog is healthy, the feed degrades gracefully: empty community modules are hidden rather
than shown empty, and sample/editorial content fills the gap.

## Control Model

| Control                | Admin action                         | Default | Effect                                         |
| ---------------------- | ------------------------------------ | ------- | ---------------------------------------------- |
| Module config          | Add/reorder/retire a module          | Curated | Defines the Explore page composition           |
| Pin entry              | Pin in review queue or module        | Off     | Forces top placement in a module               |
| Hide entry             | Hide in review queue                 | Off     | Removes from all Explore surfaces (sticky)     |
| Editorial quality tier | Set 0–100 on an entry/source         | Unset   | Primary ranking signal within a module         |
| Approve candidate      | Approve from review queue            | Pending | Promotes a queued candidate into the live feed |
| Theme a shelf          | Set theme + filter on a Themed shelf | None    | Populates an editorial module                  |
| Feature museum         | Promote a public profile             | Off     | Adds the profile to Featured museums           |

## UI Mockups

Structural wireframes, not final visual design.

### Explore Page (Visitor)

```text
Explore

[ Editor's picks ]
[ card ] [ card ] [ card ] [ card ]            > see all

[ Featured museums ]
( @qiuyue )  ( @collector )  ( @atelier )      > see all
12 collections   8 collections   5 collections

[ Fresh collections ]
[ card ] [ card ] [ card ] [ card ]            > see all

[ Themed shelf: "Something you'll never sell" ]
[ card ] [ card ] [ card ]                     > see all
```

Required behavior:

- Every card and profile shown resolves only public data through anonymous loaders.
- Empty community modules are omitted, never rendered as empty shells.
- Read-only/sample content is clearly labeled and visually distinct from community content.

### Admin Review Queue

```text
Explore review queue

Filter: [ All ] [ Pending ] [ Approved ] [ Hidden ]    Template: [ Any ]

Candidate                       Owner       Score  Complete  Status
Chocolate wrappers (collection) @qiuyue      87     yes      [ Approve ] [ Pin ] [ Hide ]
1962 Blue Note pressing (item)  @collector    74     yes      [ Approve ] [ Pin ] [ Hide ]
Field notes (collection)        @atelier      41     no       [ Approve ] [ Pin ] [ Hide ]

Selected: set quality tier [ __ ]   assign to module [ Fresh collections v ]
```

Required behavior:

- Score and completeness are shown so the admin can trust or override the ranking.
- Approve/pin/hide write immediately and re-rank the affected module.
- Hidden is sticky and survives re-evaluation until explicitly cleared.

### Admin Module Composer

```text
Explore modules

1. Editor's picks       [ pinned ]      [ edit ] [ reorder ]
2. Featured museums     [ ranked ]      [ edit ] [ reorder ]
3. Fresh collections    [ ranked ]      [ edit ] [ reorder ]
4. Themed shelf         [ theme set ]   [ edit ] [ reorder ]

[ Add module ]
```

Required behavior:

- Reordering and retiring modules is configuration, not a deploy.
- A retired module stops resolving on the public page immediately.

## Supabase And API Requirements

### Schema

1. `explore_entries` — the curated, servable units.
   - `id`
   - `entry_type` (`collection` | `item` | `profile` | `editorial`)
   - `source_collection_id` / `source_item_id` / `source_profile_id` (nullable per type)
   - `module` (module key)
   - `status` (`pending` | `approved` | `hidden`)
   - `is_pinned`, `pin_order`
   - `editorial_quality` (0–100, nullable)
   - `theme` / `editorial_copy` (nullable, for editorial and themed entries)
   - `approved_by`, `approved_at`
   - `created_at`, `updated_at`

2. `explore_review_queue` — candidates gathered for review (may be a table or a materialized view
   over eligible public sources).
   - `id`
   - `candidate_type`, source reference ids
   - `computed_score`
   - `completeness` flags
   - `eligibility_state` and last-evaluated timestamp
   - `surfaced_at`

3. `follows` (optional, shared with the Phase 2 follow system) — included here because Featured
   museums and the activity feed depend on it.
   - `follower_id`, `followed_profile_id`, `created_at`
   - unique on (`follower_id`, `followed_profile_id`)

Module configuration can live in a small `explore_modules` table or in config; either way it must be
admin-editable without a deploy.

### Public Explore Endpoints

- `get_explore_page()` — returns ordered, approved entries grouped by module, projected to
  public-safe fields only. No `select('*')`; explicit projection lists.
- `get_explore_module(module, cursor)` — paginated "see all" for a single module.
- All public Explore reads re-apply privacy gates: profile `public_enabled`, collection `is_public`
  and listed, item not hidden, photo/story visibility respected.

### Admin Endpoints

- list/filter the review queue
- approve / pin / hide / set quality tier on an entry
- create and order editorial and themed entries
- manage module configuration
- all admin endpoints require `profiles.is_admin` and reject non-admin callers

### Tracking Events

Lightweight, privacy-respecting events to measure whether Explore earns its keep (Phase 2 target:
Explore DAU/MAU > 15%):

- `explore_viewed` (page open)
- `explore_module_viewed` (module, position)
- `explore_entry_clicked` (entry id, module, position)
- `explore_profile_followed_from_feed` (entry id)
- `explore_see_all_clicked` (module)

Events record entry/module/position, never private owner data, and feed the ranking engagement
tiebreaker and the roadmap discovery metrics.

## Implementation Notes

- Explore is downstream of the privacy model: every gate in `docs/plan/DESIGN_public_privacy_model.md`
  applies, and Explore must re-check eligibility at serve time, not only when an entry is queued.
- Ranking must stay deterministic and inspectable. Engagement is a down-weighted tiebreaker, not the
  driver — an algorithmic feed is explicitly out of scope per the roadmap.
- Admin placement always overrides computed order; the system gathers and proposes, the admin
  decides.
- Privacy changes must invalidate dependent Explore entries immediately (profile disabled, collection
  unpublished, item hidden, photo/story hidden).
- The follow system, activity feed, comments/reactions, and collaborative collections are separate
  Phase 2 workstreams; this spec only depends on `follows` for Featured museums and the follow CTA.

## Acceptance Checklist

- [x] Curation model chosen and justified (semi-automated editorial with admin rails).
- [x] Approved content sources, feed modules, ranking rules, and eligibility criteria documented.
- [x] Launch bootstrapping plan defined for an empty initial catalog.
- [x] Phase 2 schema, public/admin API, and tracking-event needs identified without mutating
      production config.
- [x] UI mockups included for the visitor feed, admin review queue, and module composer.
