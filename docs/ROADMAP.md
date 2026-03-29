# Curio — Execution Roadmap (2026-03-28)

This document owns **execution phases, exit criteria, and metrics**. For product thesis, principles, positioning, and strategic decisions, see `docs/PRODUCT_STRATEGY.md`. For UX and interaction design requirements, see `docs/PRODUCT_DESIGN.md`.

Issue prioritization lives in GitHub Issues/Projects, not here.

## Current Strategic Reality

The main gap is no longer "what could Curio become?" It is "does the current product earn the right to the personal-museum claim?"

Right now the biggest risks are:

- sync and persistence trust gaps
- AI-generated object descriptions being mistaken for human story
- hardcoded templates blocking the broad cross-category vision
- too much speculative scope around native-only expansion, AI image editing, and voice companion ideas

## Execution Phases

### Phase 0 — Trust And Soul

Goal: make the current product trustworthy and emotionally coherent.

Must ship:

1. Fix sync and persistence trust issues.
2. Replace AI-generated archive narrative with a real human story flow.
3. Keep AI-generated object descriptions as hidden metadata, visible on demand but not the primary narrative.
4. Fix broken image and edit-path credibility issues.
5. Define the foundations for public sharing surfaces.
6. Add product and feature tracking instrumentation.

Key work:

- harden sync merge and offline delete handling
- surface pending upload and sync states clearly
- ensure item editing works reliably after creation
- replace the visible narrative with a human-written Story field
- let AI suggest metadata and prompt questions, but not invent the story
- instrument item creation, story usage, sync failures, share events, and profile visits

Exit criteria:

- users trust that data and photos are safe
- story capture is visibly human-centered
- item editing and save paths feel solid
- the product is ready for public-facing sharing surfaces

### Phase 1 — Flexible Collections And Sharing

Goal: let people shape their museum and proudly share it.

Must ship:

1. Flexible collection templates
2. Public museum profile pages
3. Shareable item and collection cards
4. Public-facing customization system for profiles and shared artifacts
5. Routing approach for clean public URLs and preview metadata

Key work:

- lightweight custom template builder
- starter templates backed by data, not hardcoded forever
- stable mixed-schema browsing
- public museum page design and privacy model
- item-card and collection-card share surfaces
- profile and sharing customization that stays tasteful rather than turning into a generic filter/sticker app

Exit criteria:

- users can create non-food and mixed collections without confusion
- at least some users share their museum or item cards
- shared artifacts look good enough to send without apology

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

### Phase 2 — Discovery And Light Community

Goal: make Curio feel alive without turning it into a noisy social app.

Must ship:

1. Curated discovery surface
2. Lightweight follow model or discovery graph
3. "Year in Objects" / "Collection Wrapped" once users have enough content

Avoid:

- DMs
- heavy notifications
- algorithmic feeds
- social complexity before repeat usage exists

### Phase 3 — Monetization And Expansion

Goal: convert emotional attachment into sustainable revenue.

Primary model:

- Free
- Pro
- Patron

Later options:

- insurance referrals
- affiliate commerce
- marketplace experiments

These are expansions, not the plan.

## Metrics To Track

Start tracking baselines now.

Core events:

- item creation starts
- item saves
- story field usage
- item edits after creation
- sync failures
- upload failures
- shares initiated
- public profile visits once profiles exist
- subscription funnel events once billing exists

Product metrics:

- item completion rate
- 3-item first-week retention
- sync failure rate
- share rate
- profile visit rate
- conversion to paid

Implementation note:

- add a feature-tracking integration for these events early
- keep the event taxonomy stable across web and Android
