# Design Requirements: AI Image Features + Simplified Item Capture (NEW — Not Yet Implemented)

**Status:** Draft requirements for design + engineering (no implementation assumed).  
**Owner:** Product/Eng team (Curio)  
**Last updated:** 2026-01-17  
**Related docs (existing context):**

- Product baseline: `docs/PRODUCT_DESIGN.md`
- Architecture baseline: `docs/TECHNICAL_DESIGN.md`
- Prior design review (legacy; merged here): `docs/DESIGN_REVIEW_image_enhancement_and_theme_strategy.md`

---

## Goals (what success looks like)

### Goal A — Make “Add item” feel effortless on mobile

- Users can add an item **without feeling like they entered a wizard**.
- AI helps when available, but the flow **never blocks** and never “punishes” slow networks.
- The default path optimizes for **time-to-save**, not “perfect metadata”.

### Goal B — Introduce image-to-image AI safely (toggleable + cost-aware)

- Add an **optional** “Enhance image” capability (clean product photo) first.
- Add a more creative “Poster / ad” capability later.
- Both must be:
  - **Easy to turn off** (dev + ops)
  - **Explicitly user-triggered** (no surprise spend)
  - **Recoverable** (original always preserved)

---

## Non-goals (explicitly not required for V1)

- Full Photoshop-like editing (layers, brushes, manual masking tools)
- Perfect typography rendering (we may accept AI imperfections in V1)
- Automatic “understand stage” / Vision classification as a prerequisite (V1 can be prompt-only)
- Batch enhancement by default (cost risk; keep explicit)

---

## Constraints we must not violate (product + engineering)

- **Delight before auth**: users can explore the Public Sample Gallery pre-login; auth only when saving user-owned content.
- **Recoverable AI**: AI can fail/slow; user must still finish capture manually without losing progress.
- **Single primary CTA on first run**: avoid multiple competing actions.
- **Cost control**: do not generate multiple variants by default; avoid background generation that surprises users.
- **Clarity**: always show explicit outcomes (Saved / Synced / Will sync).

---

## Scope & relationship to canonical docs

This is a **forward-looking design spec** for:

- Simplifying item capture UX (mobile-first)
- AI metadata extraction behavior (non-blocking)
- AI image-to-image features (cost-aware, phased rollout)
- Photo variant storage requirements

Current behavior and product constraints remain canonical in `docs/PRODUCT_DESIGN.md`.
Legacy content from `docs/DESIGN_REVIEW_image_enhancement_and_theme_strategy.md` has been merged here to avoid duplication.

---

## Observations (current UX pain points to address)

These are design observations that inform the new requirements:

- The current item creation experience feels like a **multi-step wizard** (collection selection → upload → analyzing → verify).
- On mobile, the stepper + state transitions create friction: users often just want to **snap a photo and save**.
- Batch mode is powerful but adds visible complexity; it should not compete with the primary capture path.
- The form can feel “long” because it shows many fields at once; most users only need a few fields at capture time.

Design implication: **progressive disclosure** is the lever—show only what’s needed to save, reveal the rest when desired.

---

## Requirements: Simplified “Add item” UX (mobile-first)

### Requirement 1 — Single-screen capture (default)

Replace the “wizard feel” with a single capture surface:

- **Primary action**: add photo (camera/gallery)
- **Immediate editable fields**:
  - Title
  - Template fields (users can fill in missing info and edit AI output)
  - Rating (optional)
  - Save
- **Secondary / optional**:
  - Notes (optional, but easy to access)
  - Batch mode link for power users (not primary)

### Requirement 2 — Non-blocking AI autofill

AI metadata extraction should behave like a helpful assistant:

- Starts automatically **after photo selection** (if enabled)
- Updates the form **in place**
- Must not overwrite fields the user has already edited
- If it fails, show a small message: “AI unavailable — continue manually”

### Requirement 3 — Keep verification/editing available (do not over-simplify)

We should assume AI will often miss details. Therefore:

- Users must be able to **edit and fill in missing metadata during capture** (current design behavior).
- We should not hide or remove fields based on an assumption of AI completeness until we’ve tested real-world boundaries.

Mobile-friendly design still matters: group fields into clear sections, maintain a sticky Save, and keep input ergonomics strong (see “Mobile UX requirements” below).

---

## Design principle: “Invisible intelligence” (merged from legacy review)

Present features by their **outcome**, not by their underlying technology:

- Good: “Enhance”, “Tidy background”, “Fix blur”
- Avoid leading with: “AI”, “Gemini Vision”, “prompt”, model names (unless in developer/debug surfaces)

### Industry language reference (for naming)

| App       | Approach                   | User-facing language  |
| --------- | -------------------------- | --------------------- |
| Meitu     | Heavy AI, one-tap beautify | “Beautify”, “Enhance” |
| Snapseed  | Manual + selective AI      | “Auto”, “Tune Image”  |
| VSCO      | Presets, minimal AI        | “Recipes”, “Adjust”   |
| Photoroom | AI background removal      | “Remove Background”   |

Curio should combine **Snapseed’s taste** with **Photoroom’s simplicity** (low-friction, outcome-first).

---

## Requirements: AI Image Features (image-to-image) — Phased Rollout

### Capability split (must be explicit)

We treat these as separate products/capabilities:

- **AI metadata extraction**: image → structured fields
- **AI image-to-image editing**: image → enhanced image (and later poster/ad)

These capabilities must be **separately toggleable** at runtime/config time (see “Feature flags”).

---

## Quality definition (trust rubric) — what “good enhancement” means

Because Curio supports “collect anything”, we need a category-agnostic definition of success so users trust outputs and the team can QA objectively.

### Universal criteria (works for whiskey / sneakers / tickets / books / anything)

1. **Identity is unambiguous**
   - The main object is clearly the subject.
   - Key identifiers remain readable where relevant (labels, logos, title text, edition marks).
2. **Geometry looks natural**
   - No warping; straight edges stay straight (boxes, spines, ticket borders, bottle vertical lines).
3. **Lighting is flattering but believable**
   - Preserve detail without “crunchy HDR”.
   - Avoid blown highlights (common on glossy packaging) and harsh color casts.
4. **Color is accurate by default**
   - Color accuracy matters (edition differences, sneaker colorways, label variants).
   - Any stylized color shifts require explicit opt-in (see “Modes”).
5. **Background doesn’t distract**
   - Background is tidy/quiet; no new distracting objects introduced.
6. **Sharp where it counts**
   - Subject and especially label/text areas are sharp.
   - Noise reduction must not turn text into mush or invent micro-details.

### Two user-facing modes (make the difference explicit)

To avoid confusion, enhancement must be presented as two clear intents:

- **Catalog / Documentation (default)** = accurate + clean
  - Goal: truthful representation (personal archive / inventory / listing-like clarity).
  - Default behavior should be conservative.
- **Showcase / Aesthetic (opt-in)** = studio + pretty
  - Goal: a visually beautiful hero image.
  - Allows more aggressive cleanup/polish, but still must not change identity.

These map cleanly to the earlier “strength” choice:

- **Subtle** ≈ Catalog default
- **Beautified** ≈ Showcase opt-in

### Scoring rubric (QA + acceptance tests)

Score output 0–2 per dimension (total /12):

1. **Subject prominence** (0 unclear / 1 clear but small/cluttered / 2 dominant & well framed)
2. **Legibility (if text exists)** (0 unreadable / 1 partially / 2 crisp key text)
3. **Exposure & dynamic range** (0 blown/crushed / 1 ok / 2 balanced)
4. **Color & white balance** (0 obvious cast/wrong / 1 slightly off / 2 accurate or intentionally styled in Showcase)
5. **Geometry correctness** (0 warped / 1 minor issues / 2 straight/natural)
6. **Background cleanliness** (0 messy / 1 improved / 2 minimal distraction)

Definition of “enhancement success” (Catalog mode):

- Total score increases by **>= 3 points**, AND
- **Geometry never worsens**, AND
- **Color does not materially drift** (tolerance to be defined later; start with “human-obvious drift” as failure).

### Phase 1 — Enhance photo (Clean / Presentable)

**User intent:** “Make this look nicer / more presentable.”

- **UX**:
  - Explicit CTA: “Enhance image”
  - Generates **one** result by default
  - Before/after comparison
  - Accept / Keep original
  - “Try again” is explicit (one more generation)
  - User-facing strength option:
    - **Subtle** (default): looks like the same photo, just better
    - **Beautified**: more opinionated “ad-like” polish; can differ more from original
- **Output goals**:
  - Tidier background (reduce/remove distracting clutter; more “ad shoot” feel)
  - Improved lighting/contrast
  - Reduce glare where possible
  - Preserve product identity (no hallucinated labels)

### Phase 2 — Poster / Ad layout (Creative)

**User intent:** “Make a shareable poster for this item.”

- **UX**:
  - Explicit CTA: “Create poster”
  - Generates **one** result by default
  - Optional style presets (minimal/premium/vintage/cinematic)
  - “Try again” explicit
- **Known risk**: typography and brand text can degrade.
  - V1 may accept this (user asked for simplicity-first).
  - We should still measure failures and consider a future deterministic overlay approach.

---

## Cost guardrails (must-have)

### Guardrail 1 — No multi-variant by default

- Default is exactly **one** generation per user action.
- Any extra generations require an explicit user tap (“Try again”, “More like this”).

### Guardrail 2 — Quality ladder (cheap-by-default)

For each AI feature, choose a default model/quality that fits the job:

- Default to cheaper/faster settings for routine enhancements.
- Offer “High quality” as an explicit user choice only when needed (e.g., poster exports).

### Guardrail 3 — Budget + rate limiting (product policy)

Design requirements (policy; implementation later):

- Per-user daily/monthly budgets (soft limit with messaging, or hard limit for free tier).
- Prevent accidental loops (e.g., user rapidly tapping “Try again”).

---

## Background tidying (clarification)

When we say “clean/presentable”, we specifically mean **tidying a messy background** (removing distracting objects / visual noise) in a way that resembles a better product/ad shoot.

We are **not** targeting a “transparent cutout” workflow as a primary concept in this plan.

---

## Data/storage requirements (new asset versions)

Curio should support **three versions** of a user-owned item image:

- **Original**: preserved as the source of truth
- **Display/compressed**: optimized for UI performance
- **Enhanced**: generated output (optional)

### Note on “remove background”

Some systems offer transparent cutouts; however, our current direction is **background tidying** (ad-like cleanup) rather than transparent PNG cutouts. If we ever add cutouts later, we can add a dedicated variant then.

For enhanced outputs, also store:

- Enhancement status: none | processing | ready | failed
- Enhancement recipe metadata: model, prompt template version, timestamp, input image hash

If we add additional enhancement modes later, store analogous “recipe” metadata per variant so we can debug quality + cost by feature.

This ensures:

- Recoverability (original always exists)
- Debuggability (we can reproduce / analyze outcomes)
- Cost tracking (link generations to user actions)

---

## Provider strategy (Google-first, multi-provider-ready)

We want Google Gemini image editing as a primary option, but avoid lock-in:

- Keep a single internal API contract (our gateway) for:
  - analyze metadata
  - enhance image (clean)
  - generate poster (creative)
- Providers can be swapped behind the gateway (Gemini / Imagen / OpenAI / others).

### Reference: Gemini image editing

Google documents seed-image editing (“text-and-image-to-image”) and model selection (speed vs pro quality) here: [Gemini image editing](https://ai.google.dev/gemini-api/docs/image-generation#gemini-image-editing).

Important implications from the doc:

- Gemini “Nano Banana” models support conversational image creation/editing.
- Generated images include a **SynthID watermark** (needs product messaging for exports/sharing).  
  (See: [Gemini image editing](https://ai.google.dev/gemini-api/docs/image-generation#gemini-image-editing))

---

## Historical context: theme + typography work (already implemented)

The legacy design review also included theme/typography improvements that are already implemented (kept here as historical context so the team has one place to review):

- Typography consistency (`typographyClasses`)
- Theme palette/shadows refinements (Gallery/Vault/Atelier)
- Shared UI primitives (theme-aware divider and rating)

These are documented historically in `docs/DESIGN_REVIEW_image_enhancement_and_theme_strategy.md`, but the source of truth for current UI should always be the code + `docs/PRODUCT_DESIGN.md`.

---

## Prompting strategy (requirements, not implementation)

### Principle: templates, not free-form prompting

Users should not have to be prompt engineers. We provide:

- A small set of user-facing intents (Clean / Poster)
- Optional “strength” (Subtle / Strong)
- Optional “background” (Keep / Neutral / Studio)

Behind the scenes we use prompt templates.

### Prompt template requirements (Clean)

The clean enhancement prompt should strongly prefer:

- Preserve the subject identity, angle, proportions
- Do not invent text, do not change logos/labels (best effort)
- Make lighting more even; reduce harsh glare
- Make background less distracting
- Avoid “over-stylization”

#### Prompt refinements (best-practice direction)

We should bake in constraints that improve reliability:

- Explicit “do not alter printed text/logos/barcodes; if unsure, leave unchanged”
- Prefer **decluttering** over “new background invention”
- Use negative constraints like “no new text, no extra labels, no brand changes”

---

### Prompt template requirements (Poster)

The poster prompt should prefer:

- Keep the core subject recognizable
- Add negative space for design
- Apply a cohesive aesthetic style (preset-driven)
- Accept that small text may not be perfect in V1 (track as known risk)

---

## Mobile UX requirements (must-have)

Regardless of how many fields we show, the capture experience must remain mobile-friendly:

- **Sticky primary action**: Save button anchored so it’s always reachable without scrolling to the bottom.
- **Sectioned form**: group fields into small, labeled sections (title, key fields, additional fields, notes).
- **Keyboard ergonomics**:
  - Next/Done behavior works well
  - Inputs are large enough for touch
  - Avoid jumpy layout shifts when AI fills data
- **Clear AI state**: a subtle “filling in…” indicator (non-blocking), plus a clear “continue manually” fallback.

---

## Hard rules: what enhancement is allowed to change vs must not change

To keep trust, we need strict boundaries. This applies to both Catalog and Showcase modes.

### Safe transformations (generally ok)

- Crop, rotate, straighten
- Exposure/contrast and highlight/shadow recovery
- White balance correction
- Moderate de-noise (text-safe)
- Background tidying / mild blur (declutter behind the subject)
- Minor perspective correction (bounded; must not warp geometry)
- Mild glare reduction (careful with glossy labels)

### Risky transformations (require opt-in or warnings)

- Aggressive relighting that changes perceived material/finish
- Heavy “beautify” that changes texture on the object itself
- Any operation that attempts to “reconstruct” obscured label text

### Forbidden by default (trust killers)

- Changing or recreating logos/labels/serial numbers
- Altering colorway / edition markers
- Reshaping the object (even subtly)
- Adding props/elements that weren’t present

---

## Category-specific gotchas (guidance for prompts + QA)

- **Glossy items** (whiskey bottles, foil packaging, shrink wrap)
  - Reduce glare without erasing label texture.
  - Never “guess” text under glare; prefer conservative exposure improvements.
- **Sneakers / apparel**
  - Colorway accuracy is sacred.
  - Don’t reshape silhouette; preserve laces/holes/edges during cleanup.
- **Flat documents** (tickets, cards, book covers)
  - Perspective correction/de-skew helps a lot.
  - Sharpening must not create fake letters.
  - Consider a “Scan-like” variant later (high contrast, straight, minimal shadow) if demand exists.
- **Dark / reflective objects**
  - Lift shadows carefully; avoid “plastic look”.
  - De-noise should keep grain natural.

---

## Output requirements (what the user gets back)

Minimum guarantees for enhanced output:

- **Same object, same identity** (no edits to label content or unique marks)
- Better readability where possible **without invented text**
- Natural edges (no halos / obvious artifacts)
- Consistent lighting (no weird floating shadows)
- Export-ready options: square + 4:5 + original aspect (design requirement; implementation later)

### Trust-building UI detail (recommended)

Show a small “What changed” summary, e.g.:

- Straightened
- Corrected white balance
- Reduced background clutter
- Improved exposure

---

## Capture guidance (reduce AI workload; mobile-friendly)

We can improve input quality with light-touch tips in the capture screen:

- “Use soft natural light (near a window)”
- “Avoid overhead yellow light”
- “Keep the phone parallel to flat items”
- “Tap to focus on the label/text”
- “Move clutter out of frame if possible”
- “Use a plain background (wall/desk/paper) if you can”

Optionally show a tiny 3-tile example: Bad / OK / Great (3D object vs flat document).

---

## UX copy requirements (so it feels safe)

- Avoid “AI words” in the happy path (optional), but be explicit when something is generated:
  - “Enhanced version created”
  - “Original preserved”
  - “Try again” (implies cost/compute)
- When AI fails:
  - “Enhancement failed — your original image is saved.”

---

## Measurement & acceptance criteria (design targets)

### Add-item UX

- **Time-to-save**: median time from “Add item” to “Saved” should drop materially (target to be defined).
- **Completion rate**: fewer abandons inside the modal.
- **Perceived complexity**: qualitative usability test should show users describing it as “simple”.

### AI image feature

- **Cost per successful enhancement**: define budget (e.g., <$X per 100 enhancements).
- **Retry rate**: if too high, defaults are poor or results inconsistent.
- **Failure rate**: enhancement requests should degrade gracefully without blocking.

---

## Open questions (to resolve before implementation)

- **Where does “Enhance image” live?**
  - During add flow (after photo) vs after save (Item Detail).
  - Tradeoff: earlier delight vs extra decisions during capture.
- **Do we allow enhancement for public/sample collections?**
  - Likely no (read-only), but users may want a “copy to my collection then enhance” path.
- **Do we need a paid tier for image-to-image?**
  - Likely yes if usage grows; define pricing policy.
- **Export expectations given SynthID watermark**
  - Should we message this explicitly on export screens?

---

## Implementation notes (intentionally high-level)

This doc defines requirements only. Engineering design/implementation should:

- Add feature flags for metadata vs image editing
- Keep “Enhance” explicitly user-triggered
- Persist original/display/enhanced assets
- Ensure all AI work is recoverable and never blocks saving
