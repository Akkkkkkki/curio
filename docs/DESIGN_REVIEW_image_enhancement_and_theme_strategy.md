# Design Review: Image Enhancement & Theme Strategy

**Date:** 2026-01-09 (Updated: 2026-01-13)
**Scope:** Photo enhancement tools, existing theme enhancements
**Core Principle:** Invisible intelligence - AI features that serve users without exposing technology

---

## Executive Summary

This design review outlines an **incremental enhancement** approach that:

1. **Enhances all three existing themes** (Gallery, Vault, Atelier) with minor visual refinements
2. **Adds lightweight photo enhancement tools** that use AI invisibly
3. **Keeps implementation simple** and focused on user outcomes

**Key Assumption:** Each photo contains a single primary object (collection item).

**Why this works for Curio:**

- Preserves "delight before auth" and "5-minute time-to-value" constraints
- Leverages existing Gemini integration
- Doesn't require users to become photo editors or prompt engineers
- Presents features by outcome, not technology

---

## Part 1: Typography & Visual Hierarchy (Minor Enhancements) ✅ IMPLEMENTED

> **Status:** Implemented on 2026-01-13 in `feature/typography-and-theme-enhancements` branch.
>
> **Changes made:**
>
> - Added JetBrains Mono font for consistent monospace labels
> - Created `typographyClasses` object in `theme.tsx` with title, label, body, and accession variants
> - Updated App.tsx, CollectionCard.tsx, and ItemCard.tsx to use new typography classes
> - Created `components/ui/Divider.tsx` for theme-aware separators
> - Created `components/ui/Rating.tsx` for theme-aware star ratings

These are optional refinements that can be applied incrementally to any theme.

### Typographic Hierarchy

**Current State:** ~~Serif/mono/sans used inconsistently across the app.~~ Now consistent via `typographyClasses`.

**Recommended Pattern:**

- **Titles:** Serif font (EB Garamond or system serif), 18-20px
- **Metadata/Labels:** Monospace font, 11-12px, muted opacity
- **Body Text:** Sans-serif (Inter or system), 14px
- **Accession Numbers:** Monospace, 10px, very muted

### Visual Motifs (Optional)

Small details that add personality without major redesign:

- **Divider lines:** 1px horizontal rules between sections
- **Muted ratings:** Stars in amber-500 instead of bright yellow
- **Consistent spacing:** 8px/16px grid for padding and margins

---

## Part 2: Existing Theme Enhancements ✅ IMPLEMENTED

> **Status:** Implemented on 2026-01-13 in `feature/typography-and-theme-enhancements` branch.
>
> **Changes made:**
>
> - Added `themeColors` object with enhanced color palettes for all three themes
> - Created theme-specific shadow classes in Tailwind config (`shadow-gallery`, `shadow-vault`, `shadow-atelier`)
> - Added `matSurfaceClasses`, `frameAccentClasses`, `accentColorClasses`, `accentBgClasses` for consistent theming
> - Updated rating star colors to muted amber-500 instead of bright yellow
> - Updated card components to use new theme-specific shadows and accents

Rather than introducing new themes, we enhance the three existing themes with refined color palettes and subtle improvements.

### Gallery (Light) - Enhanced

**Current:** ~~Clean but generic white theme.~~ Now enhanced with refined shadows and typography.

**Enhancements:**

- **Mat Color:** `#F5F5F5` (soft gray) for subtle depth
- **Frame Accent:** `#1A1A1A` (charcoal) for refined contrast
- **Shadow:** `0 2px 8px rgba(0,0,0,0.06)` - softer, more editorial
- **Typography:** Enforce serif titles consistently

**Mood:** Clean, editorial, high-contrast, premium paper feel

### Vault (Dark) - Enhanced

**Current:** Dark theme that could feel more luxurious.

**Enhancements:**

- **Mat Color:** `#1C1917` (stone-900) for layered depth
- **Frame Accent:** `#D4A574` (brass/gold) for warmth
- **Shadow:** `0 4px 16px rgba(0,0,0,0.5)` - more dramatic
- **Highlight:** Subtle amber glow on interactive elements

**Mood:** Cinematic, luxurious, nighttime gallery spotlight

### Atelier (Warm) - Enhanced

**Current:** Cream theme that's underutilized.

**Enhancements:**

- **Mat Color:** `#F5F1E7` (darker cream) for texture
- **Frame Accent:** `#8B7355` (warm brown) for earthiness
- **Shadow:** `0 2px 12px rgba(87,83,78,0.12)` - warm tones
- **Paper texture:** Optional subtle noise overlay

**Mood:** Intimate, tactile, artist's studio, vintage catalog

---

## Part 3: Photo Enhancement Tools

### Design Principle: Invisible Intelligence

Present features by their **outcome**, not their underlying technology. Users should see "Enhance" and "Remove Background" - not "AI-powered" or "Gemini Vision".

**Industry Context:**

| App       | Approach                   | User-Facing Language  |
| --------- | -------------------------- | --------------------- |
| Meitu     | Heavy AI, one-tap beautify | "Beautify", "Enhance" |
| Snapseed  | Manual + selective AI      | "Auto", "Tune Image"  |
| VSCO      | Preset filters, minimal AI | "Recipes", "Adjust"   |
| Photoroom | AI background removal      | "Remove Background"   |

**Our Approach:** Combine Snapseed's quality with Photoroom's simplicity.

---

### Feature 1: Enhance (Client-Side)

**User-Facing:** Single "Enhance" button that improves photo quality.

**What It Does:**

1. **Adaptive contrast** (CLAHE algorithm)
2. **Color vibrance** boost
3. **Mild sharpening** (unsharp mask)
4. **White balance** correction

**Why These Operations:**

| Operation     | Algorithm                                                | Why This Choice                                                                                                                                                                                      |
| ------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contrast      | CLAHE (Contrast-Limited Adaptive Histogram Equalization) | Industry standard. Unlike basic histogram stretch, CLAHE prevents over-saturation and works locally, preserving detail in both shadows and highlights. Used by Snapseed, Lightroom, medical imaging. |
| Color         | Vibrance (selective saturation)                          | Boosts muted colors while protecting already-saturated areas and skin tones. More natural than global saturation. Standard in Lightroom, Capture One.                                                |
| Sharpness     | Unsharp Mask (radius: 1px, amount: 40%)                  | Mild values prevent halos and artifacts. Enhances perceived detail without over-processing. Lower than Snapseed's defaults for subtlety.                                                             |
| White Balance | Gray-world algorithm                                     | Fast, automatic, no user input needed. Assumes average color should be neutral gray. Works well for product/object photography.                                                                      |

**Technical Implementation:**

```typescript
// services/imageEnhancer.ts

interface PhotoState {
  original: Blob;
  enhanced?: Blob;
  backgroundRemoved?: Blob;
}

export async function enhancePhoto(imageBlob: Blob): Promise<Blob> {
  const img = await loadImage(imageBlob);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0);

  let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // 1. Apply CLAHE for adaptive contrast
  imageData = applyCLAHE(imageData, { clipLimit: 2.0, tileSize: 8 });

  // 2. Boost vibrance (selective saturation)
  imageData = applyVibrance(imageData, { amount: 0.15 });

  // 3. Mild unsharp mask
  imageData = applyUnsharpMask(imageData, { radius: 1, amount: 0.4 });

  // 4. Auto white balance (gray-world)
  imageData = applyGrayWorldWB(imageData);

  ctx.putImageData(imageData, 0, 0);

  return canvasToBlob(canvas, 'image/jpeg', 0.92);
}
```

**Processing Time:** <500ms for 2000px image (client-side)

**UI:**

```
┌─────────────────────────────────────┐
│  Before          │       After      │
│  ┌────────┐      │     ┌────────┐   │
│  │ Dull   │      │     │ Vibrant│   │
│  │ Photo  │  →   │     │ Clear  │   │
│  └────────┘      │     └────────┘   │
│                                     │
│  [ Use Enhanced ] [ Keep Original ] │
└─────────────────────────────────────┘
```

---

### Feature 2: Remove Background (Gemini Vision API)

**User-Facing:** "Remove Background" button that isolates the object.

**Implementation:** Uses Gemini Vision API with a universal prompt.

**Gemini Prompt:**

```
Analyze this image containing a single collection item or object.
Identify the primary object and remove the background completely.
Preserve the object with clean, precise edges including any fine
details like texture, patterns, or semi-transparent elements.
Return the isolated object on a transparent background.
```

**Technical Implementation:**

```typescript
// services/geminiService.ts (extend existing)

export async function removeBackground(imageBlob: Blob): Promise<Blob> {
  const base64 = await blobToBase64(imageBlob);

  const response = await fetch('/api/gemini/edit-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image: base64,
      prompt: `Analyze this image containing a single collection item or object.
Identify the primary object and remove the background completely.
Preserve the object with clean, precise edges including any fine
details like texture, patterns, or semi-transparent elements.
Return the isolated object on a transparent background.`,
    }),
  });

  const { resultImage } = await response.json();
  return base64ToBlob(resultImage);
}
```

**Processing Time:** 2-5 seconds (server-side API call)

---

### Feature 3: Fix Blur (Gemini Vision API)

**User-Facing:** "Fix Blur" button that improves image clarity.

**Implementation:** Uses Gemini Vision API with a universal prompt.

**Gemini Prompt:**

```
This image of a collection item has quality issues such as blur,
compression artifacts, or low resolution. Enhance the image to
improve clarity and sharpness while preserving the natural
appearance of the object. Restore fine details and textures
without introducing artificial artifacts or over-sharpening.
```

**Technical Implementation:**

```typescript
// services/geminiService.ts (extend existing)

export async function fixBlur(imageBlob: Blob): Promise<Blob> {
  const base64 = await blobToBase64(imageBlob);

  const response = await fetch('/api/gemini/edit-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image: base64,
      prompt: `This image of a collection item has quality issues such as blur,
compression artifacts, or low resolution. Enhance the image to
improve clarity and sharpness while preserving the natural
appearance of the object. Restore fine details and textures
without introducing artificial artifacts or over-sharpening.`,
    }),
  });

  const { resultImage } = await response.json();
  return base64ToBlob(resultImage);
}
```

**Processing Time:** 2-5 seconds (server-side API call)

---

## Part 4: Technical Implementation

### Data Model Extension

```typescript
interface CollectionItem {
  // ... existing fields ...

  // Photo variants
  photoOriginalPath?: string; // Original upload
  photoDisplayPath?: string; // Optimized for display
  photoEnhancedPath?: string; // After "Enhance"
  photoNoBgPath?: string; // After "Remove Background"

  // Track which variant is currently displayed
  activePhotoVariant?: 'original' | 'display' | 'enhanced' | 'nobg';
}
```

### Storage Structure

**IndexedDB Stores:**

- `assets` (original) - existing
- `display` (optimized) - existing
- `enhanced` (after Enhance) - NEW
- `nobg` (background removed) - NEW

**Supabase Storage Paths:**

- `{user_id}/{item_id}_original.jpg` - existing
- `{user_id}/{item_id}_display.jpg` - existing
- `{user_id}/{item_id}_enhanced.jpg` - NEW
- `{user_id}/{item_id}_nobg.png` - NEW (PNG for transparency)

### Backend Endpoint

```javascript
// server/geminiProxy.js (extend)

app.post('/api/gemini/edit-image', async (req, res) => {
  const { image, prompt } = req.body;

  const result = await geminiClient.generateContent({
    contents: [
      {
        parts: [{ text: prompt }, { inlineData: { mimeType: 'image/jpeg', data: image } }],
      },
    ],
    generationConfig: {
      responseModalities: ['image'],
    },
  });

  res.json({
    resultImage: result.response.candidates[0].content.parts[0].inlineData.data,
  });
});
```

---

## Part 5: Implementation Priority

### Phase 1: Client-Side Enhancement

1. Create `services/imageEnhancer.ts` with CLAHE, vibrance, unsharp mask, white balance
2. Add "Enhance" button to photo review step in AddItemModal
3. Implement before/after preview UI
4. Store enhanced variant alongside original

### Phase 2: Gemini-Based Tools

1. Add `/api/gemini/edit-image` endpoint to proxy server
2. Implement "Remove Background" with universal prompt
3. Implement "Fix Blur" with universal prompt
4. Add these options to verify step as secondary actions

### Phase 3: Theme Refinements

1. Update theme color palettes in `theme.tsx`
2. Apply typographic hierarchy consistently
3. Add subtle visual motifs (dividers, muted ratings)

---

## Part 6: Success Metrics

**Quantitative:**

- Enhancement adoption rate: >40% of uploads
- Time to first item: Still <5 minutes (no regression)
- User keeps enhanced variant: >60%

**Qualitative:**

- Photos look better without user effort
- Enhancement feels instant and reliable
- No confusion about what each button does

---

## References

### Industry Research

- **Meitu:** Leading photo app in Asia. Uses "AI Beautify" branding but presents outcomes simply. Heavy on face enhancement, lighter on object photography.
- **Snapseed (Google):** Professional-grade mobile editor. "Auto" feature uses similar algorithms to our Enhance. Manual controls available but optional.
- **VSCO:** Focuses on preset filters over AI. Minimal text, visual-first UI.
- **Photoroom:** Specialized in background removal for e-commerce. Clean one-tap UX, no technical jargon.

### Algorithm Sources

- CLAHE: Zuiderveld, Karel. "Contrast Limited Adaptive Histogram Equalization." Graphics Gems IV, 1994.
- Unsharp Mask: Standard photographic technique, digital implementation follows Adobe Photoshop conventions.
- Gray-World White Balance: Buchsbaum, Gershon. "A spatial processor model for object colour perception." Journal of the Franklin Institute, 1980.

---

## Appendix A: Frame System (Future Work)

The following frame system concept has been deferred for future implementation. It would add museum-style presentation to item photos.

### Exhibition Frame System Concept

Every item photo would get framed like a museum piece:

```
┌─────────────────────────────┐
│ ▓▓▓▓▓▓ SUBTLE MAT ▓▓▓▓▓▓▓▓ │
│ ▓                         ▓ │
│ ▓   ┌─────────────────┐   ▓ │
│ ▓   │                 │   ▓ │
│ ▓   │   USER PHOTO    │   ▓ │
│ ▓   │                 │   ▓ │
│ ▓   └─────────────────┘   ▓ │
│ ▓                         ▓ │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│                             │
│ Title Here                  │
│ Metadata · Details          │
└─────────────────────────────┘
```

**Theme-Specific Frame Styles:**

- Gallery: Thin charcoal frame, white mat, soft shadow
- Vault: Brass/gold frame, dark mat, dramatic shadow
- Atelier: Wooden frame, cream mat, warm shadow

**Museum Label Component:**

```
┌─────────────────────────────┐
│ TITLE (Serif, 18-20px)      │
│ Field Value · Year          │ ← Mono, 11-12px, muted
│ ─                           │
│ Notes/provenance text...    │ ← Sans, 14px
│                             │
│ ACC.2026.001.042           │ ← Accession number
└─────────────────────────────┘
```

**Accession Number Format:** `ACC.{year}.{collection_index}.{item_index}`

### Component Sketches

```typescript
// components/ExhibitFrame.tsx (future)
interface ExhibitFrameProps {
  photoUrl: string;
  alt: string;
  variant?: 'original' | 'display' | 'enhanced';
  itemId: string;
}

// components/MuseumLabel.tsx (future)
interface MuseumLabelProps {
  title: string;
  metadata: string[];
  notes?: string;
  accessionNo: string;
  rating?: number;
}
```

---

## Appendix B: Quick Adjustments (Future Work)

Manual adjustment controls have been deferred for future implementation. If user demand exists, these could be added as an "Advanced" section.

### Potential Adjustment Sliders

```typescript
interface AdjustmentOptions {
  brightness: number; // -100 to +100, default 0
  contrast: number; // -100 to +100, default 0
  saturation: number; // -100 to +100, default 0
  warmth: number; // -100 to +100, default 0
  sharpness: number; // 0 to +100, default 0
}
```

### UI Concept

```
┌─────────────────────────────────────┐
│  Brightness    ──────●────────      │
│  Contrast      ────────●──────      │
│  Saturation    ──────●────────      │
│  Warmth        ────────●──────      │
│  Sharpness     ────●──────────      │
│                                     │
│  [ Reset All ]  [ Apply Changes ]   │
└─────────────────────────────────────┘
```

### Implementation Notes

- All adjustments would be client-side canvas operations
- Non-destructive editing (original always preserved)
- Real-time preview as sliders move
- Consider adding preset combinations ("Warm", "Cool", "Dramatic")

---

## Appendix C: Manual Crop & Rotate (Future Work)

Manual crop and rotate tools have been deferred due to UI complexity on mobile devices.

### Potential Features

1. **Free Crop:** Drag corners to define crop area
2. **Aspect Ratio Presets:** 1:1, 4:3, 3:4, 16:9
3. **Rotation Slider:** -45° to +45° for straightening
4. **Flip:** Horizontal and vertical flip options

### UI Considerations

- Touch gestures for mobile (pinch to zoom, drag to pan)
- Desktop: Mouse drag with modifier keys
- Grid overlay for composition guidance
- Reset button to restore original framing

### Technical Approach

```typescript
interface CropState {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  flipH: boolean;
  flipV: boolean;
}

export function applyCrop(imageBlob: Blob, crop: CropState): Promise<Blob> {
  // Canvas-based cropping with rotation transform
}
```

---

## Conclusion

This design focuses on three core photo enhancement features:

1. **Enhance** - Client-side improvements using proven algorithms
2. **Remove Background** - Gemini Vision API with universal prompt
3. **Fix Blur** - Gemini Vision API with universal prompt

Combined with minor theme refinements, this delivers meaningful value without overwhelming complexity. Advanced features (frame system, manual adjustments, crop/rotate) are documented in appendices for future consideration based on user demand.
