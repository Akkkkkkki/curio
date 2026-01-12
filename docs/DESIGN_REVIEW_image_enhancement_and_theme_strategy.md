# Design Review: Image Enhancement & Theme Strategy

**Date:** 2026-01-09 (Revised: 2026-01-12)
**Scope:** Photo tools, theme refinements, optional visual polish
**Core Principle:** Seamless photo improvement without exposing technical complexity

---

## Executive Summary

**Recommended approach: Invisible Intelligence**

Users should experience "magic" photo improvements without needing to know about AI. The goal is to match the effortless experience of apps like Meitu and Snapseed where one tap produces noticeably better results.

1. **Enhance** - one-tap photo enhancement with automatic corrections
2. **Remove Background** - isolate collection items from messy backgrounds
3. **Fix Blur** - restore quality of blurry or compressed photos
4. **Typography refinements** - subtle hierarchy improvements
5. **Theme polish** - enhance each existing theme's distinct personality

**Key Assumption:** Each photo contains a single primary object/item. The app is designed for collection items, not group photos or complex scenes.

**Why this works for Curio:**

- Preserves "5-minute time-to-value" constraint
- Matches user expectations from consumer photo apps
- Powers features with AI without requiring users to understand AI
- Zero learning curve

---

## Part 1: Typography Refinements

### Label Hierarchy

Using **system fonts only** (no custom font loading):

| Element       | Tailwind Classes                                                   |
| ------------- | ------------------------------------------------------------------ |
| Title         | `font-serif text-lg font-semibold leading-tight tracking-tight`   |
| Metadata      | `font-mono text-xs font-medium uppercase tracking-wide opacity-60` |
| Notes preview | `font-sans text-sm leading-relaxed opacity-80 line-clamp-2`        |

### Metadata Format

Display as dot-separated values:

```
Brand · 2025 · Mint Condition
```

---

## Part 2: Photo Enhancement Tools

### Industry Context

Modern photo apps have set user expectations for effortless enhancement:

| App           | Approach            | Key Features                                                      |
| ------------- | ------------------- | ----------------------------------------------------------------- |
| **Meitu**     | AI-powered, one-tap | Auto-enhance, 3-second background removal, quality restoration   |
| **Snapseed**  | Smart analysis      | "Auto" button analyzes and adjusts brightness/contrast/saturation |
| **VSCO**      | Filter-first        | Auto-suggests filters, intensity slider control                   |
| **Photoroom** | Background focus    | One-click cutouts, instant background replacement                 |

**Key insight:** Users don't care about the technology—they care about results. Meitu doesn't say "AI Background Removal," it just removes backgrounds. Snapseed doesn't explain histogram equalization, it just offers "Auto."

### Design Principles

1. **Present features by outcome, not technology**
   - Say "Enhance" not "AI Enhancement"
   - Say "Remove Background" not "AI Segmentation"
   - Say "Fix Blur" not "Super-resolution"

2. **One-tap first, options second**
   - Primary action should be single tap with good defaults
   - Advanced controls available but not required

3. **Always preserve original**
   - Non-destructive editing
   - User can always revert

4. **Single object assumption**
   - Each photo contains one primary collection item
   - Not designed for group photos or complex multi-subject scenes

### Feature 1: Enhance (One-Tap Enhancement)

**User-facing label:** "Enhance" (with sparkle icon)

**What it does (invisible to user):**

| Adjustment              | Algorithm                                                | Why This Works                                                                                                                                            |
| ----------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Exposure correction** | Contrast-Limited Adaptive Histogram Equalization (CLAHE) | Industry standard for fixing under/overexposed photos without over-saturating. Works on image tiles rather than globally, preserving local detail.       |
| **Color balance**       | Vibrance adjustment (+10-15%)                            | Unlike saturation, vibrance affects muted colors more than already-saturated ones. Prevents skin tones from becoming orange while making dull colors pop. |
| **Sharpness**           | Unsharp mask (radius: 1px, amount: 30%)                  | Mild sharpening that enhances edges without creating halos. Standard technique used in print and web optimization.                                        |
| **White balance**       | Gray-world assumption                                    | Assumes average color should be neutral gray; corrects color casts from indoor lighting.                                                                  |

**Why these defaults:**

- **CLAHE over simple histogram stretch:** Simple stretching can blow out highlights or crush shadows. CLAHE operates on small regions, preventing artifacts while improving local contrast.
- **Vibrance over saturation:** Saturation boosts all colors equally, often making skin tones unnatural. Vibrance is color-aware and produces more natural results.
- **Mild sharpening:** Over-sharpening creates visible halos and noise amplification. 30% amount is conservative and safe for all image types.

**User Flow:**

```
┌─────────────────────────────────────┐
│  [Photo Preview]                    │
│                                     │
│  ┌─────────────┐                    │
│  │ ✨ Enhance  │                    │
│  └─────────────┘                    │
└─────────────────────────────────────┘
         │
         ▼ (tap)
┌─────────────────────────────────────┐
│  [Before] ←───slider───→ [After]   │
│                                     │
│  ┌─────────────┐  ┌──────────────┐  │
│  │ Use Original│  │ Use Enhanced │  │
│  └─────────────┘  └──────────────┘  │
└─────────────────────────────────────┘
```

### Feature 2: Remove Background

**User-facing label:** "Remove Background"

**Technology:** Gemini Vision API (already integrated in Curio)

Uses the existing Gemini integration with a universal prompt designed for any single-object photo. The model analyzes the image and returns a processed image with the background removed.

**Gemini Prompt:**

```
Analyze this image containing a single collection item or object.
Identify the primary object and remove the background completely.
Preserve the object with clean, precise edges including any fine
details like texture, patterns, or semi-transparent elements.
Return the isolated object on a transparent background.
```

**User Flow:**

```
┌─────────────────────────────────────┐
│  [Photo with busy background]       │
│                                     │
│  ┌──────────────────────────────┐   │
│  │ 🧹 Remove Background         │   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
         │
         ▼ (tap, 2-3 seconds)
┌─────────────────────────────────────┐
│  [Isolated item on white/theme bg]  │
│                                     │
│  Background: ○ White ○ Theme ○ None │
│                                     │
│  ┌─────────────┐  ┌──────────────┐  │
│  │ Use Original│  │ Use Cleaned  │  │
│  └─────────────┘  └──────────────┘  │
└─────────────────────────────────────┘
```

### Feature 3: Fix Blur (Quality Restoration)

**User-facing label:** "Fix Blur"

**Technology:** Gemini Vision API

For photos that are slightly blurry or were compressed too aggressively. Uses Gemini to intelligently enhance image quality.

**Gemini Prompt:**

```
This image of a collection item has quality issues such as blur,
compression artifacts, or low resolution. Enhance the image to
improve clarity and sharpness while preserving the natural
appearance of the object. Restore fine details and textures
without introducing artificial artifacts or over-sharpening.
```

**When to offer:** Show this option when the image appears low-quality (small dimensions, visible compression artifacts, detected blur).

### UI Pattern: Non-Destructive Editing

```typescript
interface PhotoState {
  originalBlob: Blob;           // Never modified
  displayBlob: Blob;            // Currently shown version
  enhancedBlob?: Blob;          // Enhance result (cached)
  backgroundRemovedBlob?: Blob; // BG removal result (cached)
  restoredBlob?: Blob;          // Fix Blur result (cached)
  selectedVersion: 'original' | 'enhanced' | 'background_removed' | 'restored';
}
```

User can switch between versions at any time, even after saving.

---

## Part 3: Existing Theme Enhancements

The app has three established themes. Here are targeted refinements for each:

### Gallery (Light)

Current: Clean white backgrounds, subtle shadows

Enhancements to consider:

- **Warmer whites:** Use `stone-50` instead of pure white in card backgrounds to reduce eye strain
- **Minimalist refinement:** Increase whitespace, reduce border prominence for a contemporary gallery aesthetic
- **Shadow depth:** Refine to `shadow-sm` with warm undertones
- **Micro-interactions:** Subtle scale on hover (1.01x) instead of translation

### Vault (Dark)

Current: Dark backgrounds with amber accents

Enhancements to consider:

- **Contrast ratios:** Ensure WCAG AA compliance (4.5:1 for text)
- **Amber consistency:** Use amber-500 for interactive elements, amber-400 for hover states
- **Depth layers:** Subtle gradients (`bg-gradient-to-b from-stone-900 to-stone-950`)
- **Glow effects:** Soft amber glow on focused items

### Atelier (Cream)

Current: Warm cream tones, artisanal feel

Enhancements to consider:

- **Border refinement:** Use `border-[#d4c9b8]` consistently
- **Shadow warmth:** Shadows with sepia undertone `rgba(87, 83, 78, 0.1)`
- **Paper texture:** Optional subtle noise texture for tactile feel
- **Typography:** Slightly heavier font weights for contrast

---

## Part 4: Technical Implementation

### 4.1 Photo Enhancement Service (Feature 1: Enhance)

**File: `services/photoTools.ts`**

```typescript
/**
 * Client-side photo enhancement using canvas operations.
 * Technology is invisible to users—they just see results.
 */

export interface EnhanceResult {
  blob: Blob;
  applied: string[]; // For debugging, not shown to users
}

/**
 * One-tap enhancement using industry-standard algorithms.
 * Combines CLAHE, vibrance, and mild sharpening.
 */
export async function enhance(input: Blob): Promise<EnhanceResult> {
  const applied: string[] = [];
  const img = await loadImage(input);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);

  // 1. CLAHE - Contrast-Limited Adaptive Histogram Equalization
  if (applyCLAHE(ctx, canvas.width, canvas.height)) {
    applied.push('clahe');
  }

  // 2. Vibrance boost - affects muted colors more than saturated ones
  applyVibrance(ctx, canvas.width, canvas.height, 1.12);
  applied.push('vibrance');

  // 3. Mild unsharp mask - enhances edges without visible halos
  applyUnsharpMask(ctx, canvas.width, canvas.height, { radius: 1, amount: 0.3 });
  applied.push('sharpen');

  // 4. Auto white balance using gray-world assumption
  if (applyAutoWhiteBalance(ctx, canvas.width, canvas.height)) {
    applied.push('white_balance');
  }

  const blob = await canvasToBlob(canvas, 'image/jpeg', 0.92);
  return { blob, applied };
}

// Implementation details for CLAHE, vibrance, white balance...
// (See full implementation in existing service)
```

### 4.2 Gemini Photo Tools (Features 2 & 3)

**File: `services/geminiPhotoTools.ts`**

```typescript
/**
 * Photo tools powered by Gemini Vision API.
 * Uses the existing Gemini integration for background removal and quality restoration.
 */

import { callGeminiVision } from './geminiService';

/**
 * Remove background from a single-object photo using Gemini Vision.
 * Assumes the photo contains one primary collection item.
 */
export async function removeBackground(
  imageBlob: Blob,
  backgroundOption: 'white' | 'theme' | 'transparent' = 'white',
  themeColor?: string
): Promise<Blob> {
  const base64 = await blobToBase64(imageBlob);

  const result = await callGeminiVision({
    image: base64,
    prompt: `
      Analyze this image containing a single collection item or object.
      Identify the primary object and remove the background completely.
      Preserve the object with clean, precise edges including any fine
      details like texture, patterns, or semi-transparent elements.
      Return the isolated object on a transparent background.
    `,
    task: 'background_removal',
  });

  // Apply selected background color if needed
  if (backgroundOption !== 'transparent') {
    return applyBackgroundColor(result.imageBlob, backgroundOption, themeColor);
  }

  return result.imageBlob;
}

/**
 * Restore quality of blurry or compressed photos using Gemini Vision.
 * Assumes the photo contains one primary collection item.
 */
export async function fixBlur(imageBlob: Blob): Promise<Blob> {
  const base64 = await blobToBase64(imageBlob);

  const result = await callGeminiVision({
    image: base64,
    prompt: `
      This image of a collection item has quality issues such as blur,
      compression artifacts, or low resolution. Enhance the image to
      improve clarity and sharpness while preserving the natural
      appearance of the object. Restore fine details and textures
      without introducing artificial artifacts or over-sharpening.
    `,
    task: 'quality_restoration',
  });

  return result.imageBlob;
}

// Helper functions
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function applyBackgroundColor(
  foreground: Blob,
  background: 'white' | 'theme',
  themeColor?: string
): Promise<Blob> {
  // Composite foreground onto selected background color
  // ... implementation details
}
```

### 4.3 Data Model Update

**File: `types.ts` - add to CollectionItem:**

```typescript
export interface CollectionItem {
  // ... existing fields ...

  // Photo variants (all optional, original always preserved)
  photoEnhancedPath?: string;     // Enhanced version
  photoBgRemovedPath?: string;    // Background-removed version
  photoRestoredPath?: string;     // Quality-restored version
  photoDisplayVariant?: 'original' | 'enhanced' | 'bg_removed' | 'restored';
}
```

### 4.4 MuseumLabel Component (Typography)

**File: `components/MuseumLabel.tsx`**

```tsx
import React from 'react';
import { Star } from 'lucide-react';
import { useTheme, mutedTextClasses } from '@/theme';

interface MuseumLabelProps {
  title: string;
  metadata?: string[];
  notes?: string;
  rating?: number;
  className?: string;
}

export function MuseumLabel({
  title,
  metadata = [],
  notes,
  rating,
  className = '',
}: MuseumLabelProps) {
  const { theme } = useTheme();
  const mutedText = mutedTextClasses[theme];

  return (
    <div className={`space-y-1.5 ${className}`}>
      <h3 className="font-serif text-lg font-semibold leading-tight tracking-tight line-clamp-2">
        {title}
      </h3>

      {metadata.length > 0 && (
        <p className={`font-mono text-xs uppercase tracking-wide ${mutedText}`}>
          {metadata.filter(Boolean).join(' · ')}
        </p>
      )}

      {notes && (
        <p className="font-sans text-sm leading-relaxed opacity-80 line-clamp-2">{notes}</p>
      )}

      {rating !== undefined && rating > 0 && (
        <div className="flex items-center gap-0.5 pt-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              size={12}
              className={
                i < rating ? 'fill-amber-500 text-amber-500' : 'fill-transparent text-stone-300'
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## Part 5: Implementation Priorities

### Priority Matrix

| Priority | Feature            | Impact | Effort | Notes                                   |
| -------- | ------------------ | ------ | ------ | --------------------------------------- |
| P1       | Enhance            | High   | Medium | Client-side, no API cost                |
| P2       | Remove Background  | High   | Low    | Uses existing Gemini integration        |
| P2       | Fix Blur           | Medium | Low    | Uses existing Gemini integration        |
| P3       | Typography polish  | Low    | Low    | Quick visual refinement                 |
| P3       | Theme refinements  | Low    | Low    | Per-theme subtle tweaks                 |
| Future   | Quick Adjustments  | Low    | Medium | See Appendix B                          |
| Future   | Manual crop/rotate | Medium | High   | See Appendix C                          |
| Future   | Frame system       | Medium | Medium | See Appendix A                          |

### Recommended Implementation Order

1. **Enhance** - Implement CLAHE + vibrance + sharpening pipeline (client-side)
2. **UI Integration** - Add "Enhance" button to AddItemModal verify step
3. **Remove Background** - Add Gemini prompt for background removal
4. **Fix Blur** - Add Gemini prompt for quality restoration
5. **Theme Polish** - Apply refinements to existing themes

---

## Testing Checklist

### Enhance

- [ ] Button appears in verify step with sparkle icon
- [ ] Spinner shows during processing
- [ ] Completes in <1 second for typical photos
- [ ] Before/after comparison slider works
- [ ] "Use Original" / "Use Enhanced" toggle works
- [ ] Enhanced version is visibly improved but natural
- [ ] Works offline (client-side processing)
- [ ] Handles edge cases: very dark, very bright, already-edited photos

### Remove Background

- [ ] Button appears when appropriate
- [ ] Processing indicator during removal (2-3 seconds typical)
- [ ] Clean edges on simple objects
- [ ] Acceptable edges on complex items (jewelry, plants)
- [ ] Background options work (white, theme, transparent)
- [ ] Original always accessible
- [ ] Works with single-object photos (per assumption)

### Fix Blur

- [ ] Button appears for low-quality images
- [ ] Processing indicator during restoration
- [ ] Visible improvement in sharpness
- [ ] No artificial artifacts introduced
- [ ] Original always accessible

### Typography

- [ ] Title: serif font renders
- [ ] Metadata: monospace, uppercase, dot-separated
- [ ] Notes: sans-serif, line-clamp-2
- [ ] Rating stars: amber fill

### Storage

- [ ] All variants save to IndexedDB
- [ ] Sync to Supabase Storage
- [ ] Display preference persists
- [ ] Original always available
- [ ] Variant switching works in item detail

---

## Appendix A: Frame System (Future Consideration)

> **Note:** The frame system was proposed but deferred. It adds visual complexity without clear user value at this stage.

### Visual Structure

```
┌──────────────────────────────────┐
│ ░░░░░░░░░░ MAT ░░░░░░░░░░░░░░░░░ │  ← 12px padding, theme-colored
│ ░ ┌────────────────────────────┐░│
│ ░ │                            │░│  ← 1px border (frame)
│ ░ │       USER PHOTO           │░│
│ ░ │                            │░│
│ ░ └────────────────────────────┘░│
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
└──────────────────────────────────┘
```

### Theme-Specific Tokens

| Theme   | Mat Background | Frame Border          | Shadow                                   |
| ------- | -------------- | --------------------- | ---------------------------------------- |
| Gallery | `bg-stone-100` | `border-stone-300`    | `shadow-[0_2px_8px_rgba(0,0,0,0.06)]`    |
| Vault   | `bg-stone-800` | `border-amber-600/40` | `shadow-[0_4px_20px_rgba(0,0,0,0.5)]`    |
| Atelier | `bg-[#f0ebe0]` | `border-[#c9bfab]`    | `shadow-[0_2px_12px_rgba(87,83,78,0.1)]` |

### Implementation Notes

1. Add `frameClasses` and `frameInnerClasses` to `theme.tsx`
2. Create `components/ExhibitFrame.tsx`
3. Update `ItemCard.tsx` to wrap image in ExhibitFrame
4. Test all three themes on mobile + desktop

---

## Appendix B: Quick Adjustments (Future Consideration)

> **Note:** Manual adjustment controls deferred to keep initial implementation simple.

For users who want more control, offer a collapsed "Adjustments" panel:

| Control    | Range        | Default |
| ---------- | ------------ | ------- |
| Brightness | -100 to +100 | 0       |
| Contrast   | -100 to +100 | 0       |
| Saturation | -100 to +100 | 0       |
| Warmth     | -100 to +100 | 0       |

These are standard controls found in every photo app. Implementation uses CSS filters for real-time preview, then applies to canvas for final output.

---

## Appendix C: Manual Crop & Rotate (Future Consideration)

> **Note:** Deferred due to UI complexity. May implement if users request.

### Crop Tool

- Freeform crop with aspect ratio options (1:1, 4:3, 16:9, original)
- Drag handles to adjust crop area
- Pinch-to-zoom on mobile

### Rotate Tool

- 90° rotation buttons (clockwise/counter-clockwise)
- Fine rotation slider (-45° to +45°)
- Auto-straighten using edge detection (complex, may skip)

### Implementation Considerations

- Requires touch gesture handling for mobile
- Canvas-based preview with real-time updates
- May need dedicated full-screen editing mode

---

## References

Research sources for photo enhancement approaches:

- [Meitu AI Features](https://apps.apple.com/us/app/meitu-ai-photo-video-editor/id416048305) - One-tap enhancement, 3-second background removal
- [Snapseed Auto Enhance](https://umatechnology.org/how-to-automatically-enhance-your-photos-in-snapseed/) - Smart analysis and adjustment
- [AI Background Removal Technology](https://petapixel.com/2025/12/23/one-click-ai-for-precise-photo-background-removal-with-aiarty-image-matting/) - CNN-based segmentation
- [Best AI Image Enhancers 2025](https://letsenhance.io/blog/all/best-ai-image-enhancers/) - Tool comparison and best practices
- [CLAHE Algorithm](https://www.mathworks.com/help/images/contrast-enhancement-techniques.html) - Contrast enhancement techniques
