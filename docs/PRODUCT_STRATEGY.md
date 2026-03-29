# Curio - Product Strategy

**Date:** 2026-03-28
**Status:** Current working strategy
**Related docs:** `docs/ROADMAP.md` (execution phases), `docs/PRODUCT_DESIGN.md` (UX and interaction design), `docs/TECHNICAL_DESIGN.md` (architecture)

## 1. Product Thesis

Curio is a personal museum for meaningful objects.

It is not a marketplace, not a generic inventory utility, and not a category-specific tracker. The core promise is that people can capture, remember, organize, and proudly share the things that define their taste and identity.

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

## 4. Product Principles

1. **Identity before inventory**
2. **Story before schema**
3. **Beauty before bureaucracy**
4. **Acceleration before automation**
5. **Sharing before social complexity**
6. **Trust before growth**

These principles should break ties in product decisions.

## 5. Core Product Decisions

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

Heavy social complexity should wait. No DMs, noisy feeds, or notification-heavy systems until repeat usage exists.

### 5.3 Broad product, flexible structure

Curio should support many collection types, but without turning the product into a complicated database builder on day one.

The right path is:

- starter templates for common use cases
- a lightweight custom template builder
- a stable common card contract across mixed schemas

### 5.4 Trust is the first product job

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

## 7. Business Model

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

Possible future tiers:

- **Free** for basic collecting and limited sharing
- **Pro** for deeper customization, premium sharing, and higher usage limits
- **Patron** for heavier collectors and superfans

## 8. What Curio Must Be Better At

Curio needs to win on the combination of:

- aesthetic quality
- emotional resonance
- flexibility across object types
- AI-assisted acceleration
- sharing output that people are proud to post or send

Curio does **not** need to win by having the most fields, the most enterprise controls, or the most marketplace features.

## 9. What Is Deferred

These are not current execution priorities:

- Museum Guide / voice companion
- AI image enhancement and poster generation
- Vault Lock / biometric security
- marketplace and trading
- heavy social features
- NFC / QR tagging
- cinematic video portraits

Deferred does not mean banned forever. It means they should not crowd out trust, story, sharing, and flexible collections.

## 10. Founder Guidance

When product choices feel ambiguous, choose the option that makes Curio:

- more trustworthy
- more personal
- more beautiful
- more worth sharing

Do not choose the option that only makes it more feature-rich.

Curio wins if users feel proud of what they made and trust it enough to keep coming back.
