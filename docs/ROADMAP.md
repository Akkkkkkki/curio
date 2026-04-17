# Curio — Execution Roadmap (2026-04-12)

This document owns **execution phases, exit criteria, metrics, and go-to-market**. For product thesis, principles, positioning, and strategic decisions, see `docs/PRODUCT_STRATEGY.md`. For UX and interaction design requirements, see `docs/PRODUCT_DESIGN.md`.

Issue prioritization lives in GitHub Issues/Projects, not here.

## Current Strategic Reality

The main gap is no longer "what could Curio become?" It is "does the current product earn the right to the personal-museum claim?"

Right now the biggest risks are:

- sync and persistence trust gaps
- AI-generated object descriptions being mistaken for human story
- hardcoded templates blocking the broad cross-category vision
- too much speculative scope around native-only expansion, AI image editing, and voice companion ideas

## Execution Phases

### Phase 0 — Foundation And Soul (6 weeks)

Goal: every user who adds 3+ items feels genuine emotional attachment to their museum.

Must ship:

1. Replace AI-generated archive narrative with a real human story flow.
2. Fix sync and persistence trust issues.
3. Fix broken image and edit-path credibility issues.
4. Add item edit flow.
5. Add collection deletion.
6. Theme contrast fixes.
7. Add "quick add" mode (photo → AI auto-categorize → enrich later) alongside the full wizard.
8. "On This Day" polish.
9. Add product and feature tracking instrumentation.

Key work:

- harden sync merge and offline delete handling
- surface pending upload and sync states clearly
- ensure item editing works reliably after creation
- replace the visible narrative with a human-written Story field
- let AI suggest metadata and prompt questions, but not invent the story
- implement quick-add as a low-friction alternative to the full capture wizard
- instrument item creation, story usage, sync failures, share events, and profile visits

Exit criteria:

- a new user can create a collection, add 5 items with personal stories and photos, trust that data syncs, edit any item, and feel something when browsing their museum
- story capture is visibly human-centered
- sync failure rate < 1%

### Phase 1 — Shareability And Identity (12 weeks)

Goal: every museum is shareable. The first "Collection Wrapped" ships. Organic growth begins.

Must ship:

1. Public museum profile page (shareable URL)
2. Shareable item cards (OG image generation)
3. Flexible collection templates (move beyond hardcoded fields)
4. Visual category picker with image-backed cards
5. "Collection Wrapped" / Year in Objects
6. Embeddable collection widget
7. AI identification improvement (expand auto-fill)
8. Bulk import (CSV)
9. Basic stats/analytics (identity-reinforcing data)

Key work:

- lightweight custom template builder
- starter templates backed by data, not hardcoded forever
- stable mixed-schema browsing
- public museum page design and privacy model
- item-card and collection-card share surfaces with OG metadata
- visual category picker using collection cover images as card backgrounds
- Collection Wrapped generation and social sharing optimization
- embeddable widget that links back to Curio

Exit criteria:

- a user can share their museum profile on social media, the link renders a beautiful card
- at least one Collection Wrapped has been generated and shared
- > 30% of users create public profiles
- median items per user > 8

### Phase 1.5 — Android Market Test

Goal: use Google Play as an early market-test channel without broadening native scope.

Must ship:

1. A stable Android distribution path for the existing product
2. Minimal Android polish needed for testing and trust
3. Feature tracking needed to measure activation and retention from that channel

Key work:

- ensure Android packaging is reliable enough for internal / closed / public testing as appropriate
- keep the product logic shared with web
- avoid native-only features unless directly required for the test

Exit criteria:

- Android users can install, onboard, capture, save, and share without platform-specific blockers
- subscription willingness and usage can be measured from Google Play traffic

### Phase 2 — Community And Discovery (12 weeks)

Goal: users discover each other. The Explore page becomes a reason to open the app.

Must ship:

1. Explore feed (editorially curated, not algorithmic)
2. Follow system + activity feed (restrained — no DMs, no notification spam)
3. Collaborative collections with invitation codes
4. Story prompts / challenges ("The oldest thing you own," "Something you'll never sell," "An object that reminds you of someone")
5. Cross-collection discovery ("collectors who love X also collect Y")
6. Comments/reactions on public museums (restrained)

Avoid:

- DMs
- heavy notifications
- algorithmic feeds
- social complexity before repeat usage exists

Exit criteria:

- users are discovering and following other museums
- > 20% of users follow at least one other user
- at least one community prompt has generated 50+ responses
- Explore page DAU/MAU > 15%

### Phase 3 — Monetization And Expansion

Goal: convert emotional attachment into sustainable revenue.

Primary model (see `PRODUCT_STRATEGY.md` § Business Model for pricing):

- Free (limited items and AI scans)
- Pro (unlimited items, full features)
- Patron (premium extras, early access)

Targets:

- free-to-paid conversion > 4%
- annual subscription ratio > 60% of paid users
- net revenue retention > 90%

Later options:

- insurance referrals
- AI scan credits as consumables
- marketplace experiments (Phase 4+ at 50K users)

These are expansions, not the plan.

## Go-To-Market Plan

### Channel strategy

| Phase      | Channel                       | Tactic                                                                                                                                | Target               |
| ---------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Pre-launch | Hand-recruitment              | Recruit 50 passionate collectors from specialty food/drink communities (r/tea, r/coffee, r/chocolate, r/whiskey)                      | 50 founding curators |
| Pre-launch | Waitlist                      | Landing page with "Apply to be a founding curator" framing. Identity-expression language.                                             | 500 waitlist signups |
| Month 1-3  | Invitation-only beta          | Each founding curator gets 5 invite codes.                                                                                            | 1,000 users          |
| Month 3-6  | Content marketing             | Long-tail SEO: "how to organize my tea collection," "best way to catalog wine," "chocolate tasting journal app." Blog posts, not ads. | 5,000 users          |
| Month 6    | Product Hunt launch           | 2+ months preparation. Realistic: 500-2,000 quality signups.                                                                          | 7,000 users          |
| Month 6-9  | Collection Wrapped viral loop | Every user becomes a distribution channel. Optimize for Instagram Stories and Twitter/X.                                              | 10,000 users         |
| Month 9+   | Embeddable widgets            | Collector bloggers embed shelves on personal sites. Each widget links back to Curio.                                                  | Ongoing organic      |

## Metrics To Track

Start tracking baselines now.

### Phase 0 metrics

| Metric                                               | Target            | Why it matters                                                 |
| ---------------------------------------------------- | ----------------- | -------------------------------------------------------------- |
| Items with personal stories (>20 words user-written) | >60% of all items | This IS the moat                                               |
| D7 retention                                         | >25%              | Users who add 3+ items with stories in week 1 should come back |
| Sync failure rate                                    | <1%               | Trust is the foundation                                        |

### Phase 1 metrics

| Metric                  | Target                        | Why it matters                                    |
| ----------------------- | ----------------------------- | ------------------------------------------------- |
| Public profiles created | >30% of users                 | If they won't share, the identity thesis is wrong |
| Shares per Wrapped      | >2 per user who generates one | Viral coefficient of the growth feature           |
| Items per user (median) | >8                            | Enough items for a meaningful collection          |

### Phase 2 metrics

| Metric                  | Target                                       | Why it matters                  |
| ----------------------- | -------------------------------------------- | ------------------------------- |
| Follow rate             | >20% of users follow at least one other user | Social layer has value          |
| Explore page DAU/MAU    | >15%                                         | Discovery is a reason to return |
| Challenge participation | >50 responses per prompt                     | Community is alive              |

### Phase 3 metrics

| Metric                    | Target             | Why it matters               |
| ------------------------- | ------------------ | ---------------------------- |
| Free-to-paid conversion   | >4%                | Above median (2.18%)         |
| Annual subscription ratio | >60% of paid users | Annual billing reduces churn |
| Net revenue retention     | >90%               | Paid users stay              |

### Core events to instrument

- item creation starts
- item saves
- story field usage (length, user-written vs untouched AI)
- item edits after creation
- sync failures
- upload failures
- shares initiated
- public profile visits once profiles exist
- subscription funnel events once billing exists

Implementation note:

- add a feature-tracking integration for these events early
- keep the event taxonomy stable across web and Android
