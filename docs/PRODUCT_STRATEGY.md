# Curio - Product Strategy

**Date:** 2026-04-12
**Status:** Current working strategy
**Related docs:** `docs/ROADMAP.md` (execution phases), `docs/PRODUCT_DESIGN.md` (UX and interaction design), `docs/TECHNICAL_DESIGN.md` (architecture)

## 1. Product Thesis

Curio is the **Letterboxd for physical objects** — a personal museum where the things you collect become an expression of who you are.

It is not a marketplace, not a generic inventory utility, and not a category-specific tracker. The core promise is that people can capture, remember, organize, and proudly share the things that define their taste and identity. The moat is emotional data gravity: irreplaceable personal narratives that create switching costs no feature can replicate.

Everything the product does should pass this test: **Does this make users' stories richer, or their museums more beautiful, or their identity more shareable?** If not, it doesn't ship.

The broad product vision stays broad. The go-to-market does not. Curio should narrow by user type, not by item category.

## 2. Who Curio Is For

Curio is for identity-driven collectors and memory keepers:

- people who keep meaningful objects, not just expensive ones
- people who care about the story behind an object, not only its metadata
- people who want a beautiful archive, not a spreadsheet
- people who want to share their collections in a way that feels expressive

The product should work across mixed collections:

- dark chocolate packaging
- tea tins
- flight tickets
- posters
- vinyl
- sneakers
- family heirlooms

The point is not "collect everything." The point is "make meaningful objects feel alive."

## 3. Positioning

Curio should position itself as:

- the most beautiful way to remember, organize, and share the things that define your taste

Curio should not position itself as:

- a generic database
- a home inventory tracker
- a resale marketplace
- a museum CMS
- a sustainability or upcycling platform

### 3.1 Competitive Landscape

The "personal museum for identity-driven collectors" positioning remains **unoccupied** in English-speaking markets. Existing players cluster in adjacent quadrants:

| Quadrant                                                                | Players                        | Curio's distance                                  |
| ----------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------- |
| **Utility/Inventory** (high function, low emotion)                      | iCollect, Sortly, CLZ, Kolekto | Maximum — Curio is the opposite                   |
| **Institutional Story** (high story, low consumer appeal)               | CatalogIt                      | Medium — same concept, wrong packaging            |
| **Social/Gamified** (high social, low story depth)                      | Collectibles.com, REMUSE       | Medium — similar social ambitions, different soul |
| **Vertical Trackers** (deep in one category)                            | Vivino, Untappd, Discogs       | Medium — Curio is cross-category                  |
| **Identity/Story Museum** (high story + high identity + consumer-grade) | _Nobody_                       | **This is Curio's target quadrant**               |

REMUSE (再生博物馆, Chinese market only) uses similar "museum" language and AI photo analysis but serves a fundamentally different motivation: sustainability and upcycling of old objects, not identity-driven collecting. It validates the broad concept (people want to digitize and appreciate physical objects) without competing on Curio's specific value proposition.

## 4. Product Principles

1. **Identity before inventory**
2. **Story before schema**
3. **Beauty before bureaucracy**
4. **Acceleration before automation**
5. **Sharing before social complexity**
6. **Trust before growth**

These principles should break ties in product decisions.

## 5. Core Product Decisions

### 5.0 The one thing that must be true

Before any feature work, any social features, any growth mechanics: **users must be writing personal stories about their objects.** If the Archive Narrative field is still AI-generated image descriptions, nothing else matters. The personal story is the moat. A competitor can copy the UI but not users' stories.

### 5.1 Story is human-authored

The visible narrative layer should be written or shaped by the user.

AI-generated object descriptions should not appear as the main story. They can remain as hidden metadata that the user can inspect when useful.

AI can help by:

- extracting metadata
- suggesting prompt questions
- helping refine user-written text

AI should not invent the memory.

### 5.2 Sharing is central from the start

Curio is not only for private journaling. It should help users proudly show what they have collected.

Early sharing should focus on:

- public museum or profile pages
- shareable item cards
- shareable collection cards
- tasteful customization of shared outputs

Referral framing should be identity-first: "Come see my museum" or "I've been curating my tea collection — here's my museum." Not "Try this collection app" or "Organize your stuff with Curio."

Heavy social complexity should wait. No DMs, noisy feeds, or notification-heavy systems until repeat usage exists.

### 5.3 Broad product, flexible structure

Curio should support many collection types, but without turning the product into a complicated database builder on day one.

The right path is:

- starter templates for common use cases
- a lightweight custom template builder
- a stable common card contract across mixed schemas

### 5.4 AI budget discipline

Every AI feature should make the personal narrative richer, not generate disposable content. Curio's AI investment should focus on:

1. Better object identification and auto-fill
2. Story prompting assistance (suggesting questions, not generating answers)
3. Collection Wrapped generation

Do not build: AI sticker generation, emoji pack creation, craft pattern generation, poster modes, or any AI feature that produces disposable creative output rather than enriching the user's story.

### 5.5 Trust is the first product job

The product cannot claim to be a personal museum if users do not trust their data, photos, and edits.

That means the first execution priority is:

- sync reliability
- clear save and upload states
- reliable add and edit flows
- safe handling of offline and conflict cases

## 6. Platform And Distribution Stance

Curio should remain web-first in product architecture.

That does **not** mean avoiding Android or Google Play. It means:

- keep the core product logic shared with web
- use Android / Google Play as an early distribution and payment test channel
- ship native packaging when it helps market validation
- avoid broad native-only feature work until demand is proven

The strategic distinction matters:

- **keep Android on the roadmap**
- **do not let native expansion displace the core product loop**

## 7. Beachhead Market

**Specialty food/drink collectors** in UK/US — tea, coffee, chocolate, wine, spirits. These collectors are:

- underserved by existing vertical trackers
- willing to pay ($50-70/year for CellarTracker)
- care about tasting notes and provenance (natural story prompts)
- overlap with the aesthetic/taste curator persona

If this beachhead doesn't convert, expand to vinyl, sneakers, and vintage. The product architecture should remain category-agnostic from day one.

## 8. Business Model

The primary business model is consumer subscription.

The hypothesis is that users will pay for:

- a trustworthy home for meaningful collections
- beautiful presentation and sharing
- premium customization
- long-term archive value

Current stance:

- subscription is the intended business model
- willingness to pay is still a hypothesis to validate
- ads are not the primary plan
- marketplace or affiliate models are possible later, not the first business

Planned tiers:

- **Free** — basic collecting, limited items (50), limited AI scans (10/month)
- **Pro** ($29.99/yr or $4.99/mo) — unlimited items, unlimited AI scans, advanced stats, custom profile themes, export/insurance reports, ad-free
- **Patron** ($49.99/yr or $9.99/mo) — Pro + premium Wrapped, early access, founding supporter badge

Later revenue options:

- insurance referral partnerships (referral fees per policy)
- AI scan credits as consumables for heavy users

## 9. What Curio Must Be Better At

Curio needs to win on the combination of:

- aesthetic quality
- emotional resonance
- flexibility across object types
- AI-assisted acceleration
- sharing output that people are proud to post or send

Curio does **not** need to win by having the most fields, the most enterprise controls, or the most marketplace features.

## 10. What Is Deferred

These are not current execution priorities:

- Museum Guide / voice companion
- AI image enhancement and poster generation
- Vault Lock / biometric security
- marketplace and trading (requires trust infrastructure, payments, dispute resolution — Phase 4+ at 50K users)
- heavy social features
- NFC / QR tagging
- cinematic video portraits
- sustainability metrics / carbon tracking / donation facilitation (not Curio's positioning)
- AI creative output generation (stickers, emoji packs, craft patterns)
- eco-gamification (points, levels, environmental badges — conflicts with "reflection, not obligation" positioning)
- AR object viewing / 3D capture
- tax deduction tracking

If Curio ever adds badges, make them about depth, not volume: "Storyteller" (items with rich narratives), "Archivist" (complete collection with provenance), "Curator" (public museum with themed collections). Never reward speed or quantity.

Deferred does not mean banned forever. It means they should not crowd out trust, story, sharing, and flexible collections. Every feature request should pass the test: does this make stories richer, museums more beautiful, or identity more shareable?

## 11. Risk Register

| Risk                                                                  | Likelihood | Impact                       | Mitigation                                                                                                       |
| --------------------------------------------------------------------- | ---------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Users don't write personal stories (just use AI auto-fill)            | High       | Critical — destroys the moat | Make story prompts engaging, not obligatory. Show beautiful examples. Reward depth in Wrapped.                   |
| A competitor enters English-speaking markets with similar positioning | Low-Medium | Medium                       | Speed to market with personal narratives. The moat is emotional data, not features.                              |
| Beachhead market (specialty food/drink) is too niche                  | Medium     | High                         | Expand to vinyl/sneakers/vintage. Keep architecture category-agnostic.                                           |
| Feature pressure from users ("add a marketplace," "add insurance")    | High       | Medium                       | Maintain the deferred list. Apply the feature test consistently.                                                 |
| AI auto-fill quality degrades or API costs spike                      | Medium     | Medium                       | Maintain ability to swap providers. Keep AI as acceleration, not requirement — the product must work without AI. |

## 12. Founder Guidance

When product choices feel ambiguous, choose the option that makes Curio:

- more trustworthy
- more personal
- more beautiful
- more worth sharing

Do not choose the option that only makes it more feature-rich.

Curio wins if users feel proud of what they made and trust it enough to keep coming back.
