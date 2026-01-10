# Design Review: Image Enhancement & Theme Strategy

**Date:** 2026-01-09 (Revised: 2026-01-10)
**Scope:** Image enhancement, theme evolution, user value optimization
**Core Principle:** Maximum aesthetic improvement with minimum user friction

---

## Executive Summary

**Recommended approach: Museum-First Presentation**

1. **Enhance presentation layer** (frames, labels) rather than transforming photos
2. **Add lightweight one-tap enhancement** integrated into existing upload flow
3. **Evolve themes** toward distinct visual personalities
4. **Keep all AI assistance optional and non-blocking**

**Why this works for Curio:**

- Preserves "5-minute time-to-value" constraint
- Uses existing Gemini integration without new dependencies
- Matches "personal museum" concept
- Zero learning curve for users

---

## Part 1: Frame System - Design Specification

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

### Spacing Specification

| Element      | Mobile | Desktop |
| ------------ | ------ | ------- |
| Mat padding  | 8px    | 12px    |
| Border width | 1px    | 1px     |
| Outer radius | 4px    | 6px     |
| Inner radius | 2px    | 4px     |

### Hover Behavior

- Subtle lift: `transform: translateY(-2px)`
- Shadow intensifies slightly
- Transition: `200ms ease`

---

## Part 2: Typography System - Design Specification

### Label Hierarchy

Using **system fonts only** (no custom font loading):

| Element       | Tailwind Classes                                                   |
| ------------- | ------------------------------------------------------------------ |
| Title         | `font-serif text-lg font-semibold leading-tight tracking-tight`    |
| Metadata      | `font-mono text-xs font-medium uppercase tracking-wide opacity-60` |
| Notes preview | `font-sans text-sm leading-relaxed opacity-80 line-clamp-2`        |

### Metadata Format

Display as dot-separated values:

```
Brand · 2025 · Mint Condition
```

---

## Part 3: Image Enhancement - Design Specification

### User Flow

**In AddItemModal verify step:**

1. Photo preview displays
2. Below preview: "Enhance Photo" button (ghost style, sparkle icon)
3. On click: processing indicator, then side-by-side preview
4. User picks "Use Original" or "Use Enhanced"
5. Selection persists with item

### Enhancement Operations

All client-side, no server calls:

1. **Auto-levels** - Normalize histogram (stretch to 0-255 range)
2. **Saturation boost** - +10% via HSL adjustment
3. **Sharpening** - Mild unsharp mask (amount: 0.3)

**Not included:** Auto-straighten (complex, error-prone, defer to v2)

### Button States

| State    | Appearance                                     |
| -------- | ---------------------------------------------- |
| Default  | Ghost button, `Sparkles` icon, "Enhance Photo" |
| Loading  | Spinner, "Enhancing..."                        |
| Complete | Toggle between "Original" / "Enhanced"         |
| Error    | Toast notification, button resets              |

---

## Part 4: Technical Implementation

### 4.1 Theme Tokens (theme.tsx)

Add to existing `theme.tsx`:

```typescript
export const frameClasses: Record<AppTheme, string> = {
  gallery: 'bg-stone-100 border-stone-300 shadow-[0_2px_8px_rgba(0,0,0,0.06)]',
  vault: 'bg-stone-800 border-amber-600/40 shadow-[0_4px_20px_rgba(0,0,0,0.5)]',
  atelier: 'bg-[#f0ebe0] border-[#c9bfab] shadow-[0_2px_12px_rgba(87,83,78,0.1)]',
};

export const frameInnerClasses: Record<AppTheme, string> = {
  gallery: 'ring-1 ring-stone-200',
  vault: 'ring-1 ring-amber-500/20',
  atelier: 'ring-1 ring-[#d4c9b8]',
};
```

### 4.2 ExhibitFrame Component

**File: `components/ExhibitFrame.tsx`**

```tsx
import React from 'react';
import { useTheme, frameClasses, frameInnerClasses } from '@/theme';

interface ExhibitFrameProps {
  children: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md';
}

export function ExhibitFrame({ children, className = '', size = 'md' }: ExhibitFrameProps) {
  const { theme } = useTheme();
  const padding = size === 'sm' ? 'p-2' : 'p-3';
  const outerRadius = size === 'sm' ? 'rounded' : 'rounded-md';
  const innerRadius = size === 'sm' ? 'rounded-sm' : 'rounded';

  return (
    <div
      className={`
        border transition-all duration-200
        hover:-translate-y-0.5
        ${frameClasses[theme]}
        ${padding}
        ${outerRadius}
        ${className}
      `}
    >
      <div className={`overflow-hidden ${frameInnerClasses[theme]} ${innerRadius}`}>{children}</div>
    </div>
  );
}
```

### 4.3 MuseumLabel Component

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

### 4.4 Image Enhancement Service

**File: `services/imageEnhancer.ts`**

```typescript
/**
 * Client-side image enhancement using canvas operations.
 * No server calls, no API costs.
 */

export interface EnhanceResult {
  blob: Blob;
  adjustments: string[];
}

export async function enhanceImage(input: Blob): Promise<EnhanceResult> {
  const adjustments: string[] = [];

  const img = await loadImage(input);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);

  // 1. Auto-levels
  if (applyAutoLevels(ctx, canvas.width, canvas.height)) {
    adjustments.push('Brightness normalized');
  }

  // 2. Saturation boost (+10%)
  applySaturationBoost(ctx, canvas.width, canvas.height, 1.1);
  adjustments.push('Colors balanced');

  // 3. Mild sharpening
  applyUnsharpMask(ctx, canvas.width, canvas.height, 0.3);
  adjustments.push('Sharpened');

  const blob = await canvasToBlob(canvas, 'image/jpeg', 0.92);
  return { blob, adjustments };
}

// --- Helpers ---

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Load failed'));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), type, quality);
  });
}

function applyAutoLevels(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  let min = 255,
    max = 0;
  for (let i = 0; i < data.length; i += 4) {
    const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
    min = Math.min(min, brightness);
    max = Math.max(max, brightness);
  }

  if (max - min > 230) return false; // Already good range

  const scale = 255 / (max - min || 1);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, Math.max(0, (data[i] - min) * scale));
    data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - min) * scale));
    data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - min) * scale));
  }

  ctx.putImageData(imageData, 0, 0);
  return true;
}

function applySaturationBoost(ctx: CanvasRenderingContext2D, w: number, h: number, factor: number) {
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
    const [r, g, b] = hslToRgb(h, Math.min(1, s * factor), l);
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }

  ctx.putImageData(imageData, 0, 0);
}

function applyUnsharpMask(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number) {
  const temp = document.createElement('canvas');
  temp.width = w;
  temp.height = h;
  const tCtx = temp.getContext('2d')!;
  tCtx.filter = 'blur(1px)';
  tCtx.drawImage(ctx.canvas, 0, 0);

  const original = ctx.getImageData(0, 0, w, h);
  const blurred = tCtx.getImageData(0, 0, w, h);

  for (let i = 0; i < original.data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const diff = original.data[i + c] - blurred.data[i + c];
      original.data[i + c] = Math.min(255, Math.max(0, original.data[i + c] + diff * amount));
    }
  }

  ctx.putImageData(original, 0, 0);
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h = 0,
    s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}
```

### 4.5 Data Model Update

**File: `types.ts` - add to CollectionItem:**

```typescript
export interface CollectionItem {
  // ... existing fields ...

  photoEnhancedPath?: string; // Optional enhanced image path
  useEnhanced?: boolean; // Display preference
}
```

### 4.6 ItemCard Integration

**Changes to `components/ItemCard.tsx`:**

```tsx
// Import ExhibitFrame
import { ExhibitFrame } from './ExhibitFrame';

// Wrap the image container
<ExhibitFrame size="sm">
  <ItemImage
    itemId={item.id}
    photoUrl={item.photoUrl}
    collectionId={item.collectionId}
    alt={item.title}
    className={`w-full group-hover:scale-105 transition-transform duration-500 ${layout === 'grid' ? 'h-full' : 'h-auto'}`}
  />
</ExhibitFrame>;
```

---

## Part 5: Implementation Roadmap

### Priority Matrix

| Phase | Feature               | Impact | Effort | Dependencies |
| ----- | --------------------- | ------ | ------ | ------------ |
| 1     | Frame tokens          | High   | Low    | None         |
| 1     | ExhibitFrame          | High   | Low    | Tokens       |
| 1     | ItemCard integration  | High   | Low    | ExhibitFrame |
| 2     | MuseumLabel           | Medium | Low    | None         |
| 2     | ItemCard typography   | Medium | Low    | MuseumLabel  |
| 3     | Image enhancer        | Medium | Medium | None         |
| 3     | AddItemModal UI       | Medium | Medium | Enhancer     |
| 4     | Enhanced storage/sync | Low    | Medium | Phase 3      |

### Phase 1: Frame System (Start Here)

**Goal:** Visual polish, no behavior changes.

**Tasks:**

1. Add `frameClasses` and `frameInnerClasses` to `theme.tsx`
2. Create `components/ExhibitFrame.tsx`
3. Update `ItemCard.tsx` to wrap image in ExhibitFrame
4. Test all three themes on mobile + desktop

**Files changed:** 3

**Success criteria:**

- Cards show framed photos
- Vault theme has amber accent
- No layout regressions

---

### Phase 2: Typography

**Goal:** Consistent, polished labels.

**Tasks:**

1. Create `components/MuseumLabel.tsx`
2. Refactor `ItemCard.tsx` label section to use MuseumLabel
3. Verify font-serif/font-mono/font-sans render correctly

**Files changed:** 2

**Success criteria:**

- Clear visual hierarchy (title > metadata > notes)
- System fonts render correctly on all platforms

---

### Phase 3: Image Enhancement

**Goal:** Optional one-tap enhancement.

**Tasks:**

1. Create `services/imageEnhancer.ts`
2. Add enhance button to AddItemModal verify step
3. Implement before/after toggle UI
4. Add `photoEnhancedPath` and `useEnhanced` to types

**Files changed:** 3

**Success criteria:**

- Enhancement completes <500ms
- Toggle works correctly
- Original always preserved

---

### Phase 4: Storage Integration

**Goal:** Persist enhanced images.

**Tasks:**

1. Update `services/db.ts` to handle enhanced variant in IndexedDB
2. Upload enhanced to Supabase Storage on sync
3. Update `ItemImage.tsx` to respect `useEnhanced` preference

**Files changed:** 2

**Success criteria:**

- Enhanced images persist across sessions
- Sync works correctly
- Can switch between original/enhanced in item detail

---

### Execution Order

```
Phase 1 (Frame System)
    │
    ├── theme.tsx tokens
    ├── ExhibitFrame.tsx
    └── ItemCard.tsx wrap
           │
           ▼
Phase 2 (Typography) ─────────── Can run parallel ─────────── Phase 3 (Enhancement)
    │                                                              │
    ├── MuseumLabel.tsx                                           ├── imageEnhancer.ts
    └── ItemCard.tsx labels                                       ├── AddItemModal.tsx
                                                                   └── types.ts
                                                                       │
                                                                       ▼
                                                              Phase 4 (Storage)
                                                                   │
                                                                   ├── db.ts
                                                                   └── ItemImage.tsx
```

---

## Part 6: What NOT to Build

| Feature                | Reason                              |
| ---------------------- | ----------------------------------- |
| Accession numbers      | Over-engineered for personal app    |
| Archival stamps/badges | Visual clutter                      |
| Quality check warnings | Interrupts flow, feels judgmental   |
| Background removal     | Scope creep, API costs              |
| Auto-straighten        | Complex edge detection, error-prone |
| Manual crop/rotate     | Save for v2 if users request        |
| Custom fonts           | Bundle size, performance            |

---

## Appendix: Testing Checklist

### Frame System (Phase 1 - COMPLETE)

- [x] Gallery: stone mat, charcoal border, subtle shadow
- [x] Vault: dark mat, amber accent, deep shadow
- [x] Atelier: cream mat, brown border, warm shadow
- [x] Hover lifts card slightly
- [x] Mobile: 8px padding works
- [x] Desktop: 12px padding works
- [x] No layout shift when frames applied

### Typography

- [ ] Title: serif font renders
- [ ] Metadata: monospace, uppercase, dot-separated
- [ ] Notes: sans-serif, line-clamp-2
- [ ] Rating stars: amber fill

### Enhancement

- [ ] Button appears in verify step
- [ ] Spinner shows during processing
- [ ] Completes in <500ms
- [ ] Before/after toggle works
- [ ] Can save with either variant
- [ ] Error shows toast, resets button
- [ ] Works offline

### Storage

- [ ] Enhanced saves to IndexedDB
- [ ] Syncs to Supabase Storage
- [ ] `useEnhanced` preference respected
- [ ] Original always available
