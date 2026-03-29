# Design System — Curio

## Product Context

- **What this is:** A personal museum for physical collectors — intimate archival tool, not a marketplace
- **Who it's for:** Collectors who care about provenance, narrative, and museum-grade presentation of their objects
- **Space/industry:** Personal collection management (peers: CatalogIt, Libib, Artwork Archive, Collectorz)
- **Project type:** Mobile-first web app (PWA) with cloud sync
- **Positioning:** The gap between "utility catalog database" and "actual museum experience" — Curio is your private gallery

## Aesthetic Direction

- **Direction:** Luxury/Refined with Editorial touches
- **Decoration level:** Intentional — subtle texture through shadows, card depth, and the mat/frame metaphor. Not minimal (that's CatalogIt territory), not expressive (that's a different product)
- **Mood:** Walking through a private gallery. Intimate, quiet, precious. The objects are the stars; the UI is the frame
- **Reference sites:** Rijksmuseum (dark/cinematic, artwork-as-hero), The Met (clean grid, institutional serif), Artwork Archive (professional but warm)

## Typography

- **Display/Hero:** DM Serif Display — Elegant, editorial, underused in the app/SaaS space. Gives Curio a distinct voice that reads as "museum" not "startup"
- **Body:** Inter — Clean, invisible, excellent readability at all sizes. Doesn't fight the content
- **UI/Labels:** JetBrains Mono (uppercase, wide tracking) — Evokes museum accession plates and archival catalog labels. This is a deliberate design risk: nobody in the collection app space uses monospace as a design element. It makes Curio feel institutional in a premium way
- **Data/Tables:** JetBrains Mono (tabular-nums) — Aligned numeric data, stats, timestamps
- **Code:** JetBrains Mono
- **Loading:** Google Fonts CDN — `DM+Serif+Display:ital@0;1`, `Inter:wght@300;400;500;600;700`, `JetBrains+Mono:wght@400;500;600`
- **Scale:**
  - Display: 48-80px (clamp), tracking -0.03em
  - Title Hero: 30-48px, tracking -0.02em
  - Title Large: 24-30px, tracking -0.02em
  - Title: 18-20px, tracking -0.01em
  - Body Large: 16px, leading 1.6
  - Body: 14px, leading 1.6
  - Label: 11-12px, uppercase, tracking 0.2em, bold
  - Label Small: 10px, uppercase, tracking 0.15em
  - Accession: 10px, uppercase, tracking 0.15em, opacity 0.3

## Color

- **Approach:** Restrained — warm metallics as the primary accent family across all themes. No blue anywhere (deliberate departure from every competitor)

### Gallery (Light)

| Token         | Value                         | Usage                            |
| ------------- | ----------------------------- | -------------------------------- |
| Surface       | `#FFFFFF`                     | Primary background               |
| Surface Muted | `#F5F5F5`                     | Card mats, secondary surfaces    |
| Text          | `#1C1917`                     | Primary text (stone-900)         |
| Text Muted    | `#78716C`                     | Secondary text (stone-500)       |
| Border        | `#E7E5E4`                     | Dividers, card edges (stone-200) |
| Accent        | `#D97706`                     | Interactive elements (amber-600) |
| Accent Hover  | `#B45309`                     | Hover state (amber-700)          |
| Frame Accent  | `#1A1A1A`                     | Charcoal for refined contrast    |
| Shadow        | `0 2px 8px rgba(0,0,0,0.06)`  | Card resting state               |
| Shadow Hover  | `0 4px 16px rgba(0,0,0,0.08)` | Card hover state                 |

### Vault (Dark)

| Token         | Value                        | Usage                          |
| ------------- | ---------------------------- | ------------------------------ |
| Surface       | `#0C0A09`                    | Primary background (stone-950) |
| Surface Muted | `#1C1917`                    | Card mats (stone-900)          |
| Text          | `#FFFFFF`                    | Primary text                   |
| Text Muted    | `#A8A29E`                    | Secondary text (stone-400)     |
| Border        | `rgba(255,255,255,0.1)`      | Subtle dividers                |
| Accent        | `#D4A574`                    | Brass/gold highlight           |
| Accent Hover  | `#E0B585`                    | Lighter brass on hover         |
| Frame Accent  | `#D4A574`                    | Brass for warmth               |
| Shadow        | `0 4px 16px rgba(0,0,0,0.5)` | Card resting state             |
| Shadow Hover  | `0 8px 32px rgba(0,0,0,0.6)` | Card hover state               |

### Atelier (Warm)

| Token         | Value                              | Usage                            |
| ------------- | ---------------------------------- | -------------------------------- |
| Surface       | `#F5EFE4`                          | Warm cream with yellow undertone |
| Surface Muted | `#EDE4D3`                          | Parchment mat                    |
| Text          | `#3D3530`                          | Warm dark brown                  |
| Text Muted    | `#8C7B6B`                          | Sepia-toned muted text           |
| Border        | `#D4C9B8`                          | Warm, visible dividers           |
| Accent        | `#A86F3C`                          | Rich amber-brown (aged leather)  |
| Accent Hover  | `#8B5A2B`                          | Deeper on hover                  |
| Frame Accent  | `#6B5344`                          | Aged wood brown                  |
| Shadow        | `0 2px 12px rgba(168,111,60,0.10)` | Card resting state               |
| Shadow Hover  | `0 4px 20px rgba(168,111,60,0.14)` | Card hover state                 |

### Semantic Colors (shared)

| Token   | Value     | Usage                          |
| ------- | --------- | ------------------------------ |
| Success | `#059669` | Saved, synced confirmations    |
| Warning | `#D97706` | Will sync, pending states      |
| Error   | `#DC2626` | Sync failed, validation errors |
| Info    | `#2563EB` | AI analyzing, informational    |

## Spacing

- **Base unit:** 4px
- **Density:** Comfortable — content should breathe, befitting a museum/gallery context
- **Scale:** 2xs(2px) xs(4px) sm(8px) md(16px) lg(24px) xl(32px) 2xl(48px) 3xl(64px)

## Layout

- **Approach:** Grid-disciplined with masonry for visual variety
- **Grid:** Bento grid on home, responsive card grid (auto-fill, minmax 240px) for collections, masonry/waterfall for item browsing
- **Max content width:** 1120px
- **Border radius:** Hierarchical — sm: 4px (badges, small elements), md: 8px (inputs, buttons), lg: 12px (cards), xl: 14px (featured cards, modals)

## Motion

- **Approach:** Intentional — subtle entrance animations and meaningful state transitions. Not flashy, but alive
- **Easing:** Enter: ease-out, Exit: ease-in, Move: ease-in-out
- **Duration:**
  - Micro: 50-100ms (button press, toggle, focus ring)
  - Short: 150-250ms (card hover, shadow transition, border color)
  - Medium: 250-400ms (modal enter/exit, panel slide, dropdown)
  - Long: 400-700ms (page transition, theme switch, exhibition mode)

## Design Risks (deliberate departures)

These are intentional choices that differentiate Curio from every competitor:

1. **Monospace labels as a design element** — JetBrains Mono uppercase with wide tracking for metadata labels. Evokes museum accession plates. No collection app does this. Cost: slightly less readable at very small sizes
2. **Three distinct theme personalities** — Gallery, Vault, and Atelier aren't color swaps. Each has its own shadow system, accent palette, and emotional register. More maintenance, but a core differentiator
3. **No blue anywhere** — Every competitor (CatalogIt, Libib, Artwork Archive) uses blue. Curio's warm palette (amber, brass, leather brown) reinforces "museum, not database." Cost: initially unfamiliar to some users

## Anti-patterns (never do)

- Purple/violet gradients
- 3-column feature grid with icons in colored circles
- Centered-everything with uniform spacing
- Uniform bubbly border-radius on all elements
- Gradient buttons as the primary CTA
- Generic stock-photo hero sections
- Blue accents or blue-tinted grays

## Decisions Log

| Date       | Decision                                            | Rationale                                                                                                                                                                                                                                                      |
| ---------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-03-24 | Initial design system created                       | Formalized from existing codebase via /design-consultation. Competitive research: CatalogIt, Libib, Artwork Archive, Rijksmuseum, The Met. Key insight: no personal collection app occupies the space between "utility catalog" and "actual museum experience" |
| 2026-03-24 | Kept DM Serif Display / Inter / JetBrains Mono trio | Already well-chosen and distinctive. DM Serif Display is underused in app/SaaS space                                                                                                                                                                           |
| 2026-03-24 | Kept three-theme system (Gallery/Vault/Atelier)     | Core differentiator vs light/dark-only competitors                                                                                                                                                                                                             |
| 2026-03-24 | No blue anywhere in palette                         | Deliberate departure from every competitor to reinforce museum positioning                                                                                                                                                                                     |
