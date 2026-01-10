# Design Review: Image Enhancement & Theme Strategy

**Date:** 2026-01-09
**Scope:** Image model integration, app aesthetic evolution, user value optimization
**Core Principle:** Maximum aesthetic pleasure without overwhelming users

---

## Executive Summary

After reviewing Curio's current implementation and the ChatGPT conversation, I recommend a **museum-first, AI-optional** approach that:

1. **Enhances presentation layer** (frames, labels, lighting) rather than transforming user photos
2. **Adds lightweight, progressive image enhancement** integrated into existing upload flow
3. **Evolves theme system** toward a signature "Contemporary Gallery + Archive Catalog" hybrid
4. **Keeps AI assistance non-blocking** and template-driven (not prompt-heavy)

**Why this works for Curio:**
- Preserves your "delight before auth" and "5-minute time-to-value" constraints
- Leverages existing Gemini integration without adding new model dependencies
- Matches the "personal museum" concept better than heavy photo manipulation
- Doesn't require users to become photo editors or prompt engineers

---

## Part 1: Recommended Art Direction (Theme Evolution)

### Current State Analysis

**Existing Themes:**
- `gallery` (light) - Clean but generic
- `vault` (dark) - Moody but lacks personality
- `atelier` (cream) - Warmest option but underutilized

**Theme System Strengths:**
- Well-structured with comprehensive class maps (`theme.tsx`)
- Covers all surface types (panel, card, soft, overlay)
- Persists to IndexedDB
- Easy to extend

**Theme System Gaps:**
- **No signature visual motifs** - Feels like "color palette swap" rather than distinct visual languages
- **No frame system** - Photos sit directly in cards without exhibition-style presentation
- **No typographic hierarchy** - Serif/mono/sans used inconsistently
- **Missing museum affordances** - No accession numbers, exhibit labels, catalog stamps

### Proposed Direction: "Contemporary Gallery + Archival Catalog" Hybrid

**Core Concept:**
Combine the **clean minimalism of a modern gallery** with the **tactile details of an archival catalog**.

**Why this hybrid:**
1. **Gallery aesthetics** = premium feel, editorial quality, respects user photos
2. **Archive details** = personality, warmth, "personal museum" authenticity
3. **Hybrid balance** = sophisticated but not sterile, detailed but not cluttered

**Three Signature Components to Add:**

#### 1. Exhibition Frame System

Every item photo gets framed like a museum piece:

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

**Implementation:**
- Thin inner frame (1-2px, high contrast)
- Optional mat padding (8-16px, theme-colored)
- Subtle drop shadow (not floating cards)
- Theme-specific frame styles:
  - Gallery: thin charcoal frame, white mat, soft shadow
  - Vault: brass/gold frame, dark mat, dramatic shadow
  - Atelier: wooden frame, cream mat, warm shadow

**CSS Pattern:**
```css
.exhibit-frame {
  padding: 16px; /* mat */
  background: var(--mat-color);
  border: 1px solid var(--frame-color);
  box-shadow: var(--frame-shadow);
}
```

#### 2. Museum Label Component

Replace generic "title + metadata" with structured exhibit labels:

```
┌─────────────────────────────┐
│ TITLE (Serif, 18-20px)      │
│ Field Value · Year          │ ← Mono, 11-12px, muted
│ ─                           │
│ Notes/provenance text...    │ ← Sans, 14px
│                             │
│ ACC.2026.001.042           │ ← Mono, 10px, very muted
└─────────────────────────────┘
```

**Key Details:**
- Accession number = `ACC.{year}.{collection_index}.{item_index}`
- Horizontal rule separator (1px, subtle)
- Clear typographic hierarchy (serif title, mono metadata, sans body)
- Compact but readable

**React Component:**
```tsx
<MuseumLabel
  title={item.title}
  metadata={['Brand Name', '2025', 'Condition: Mint']}
  notes={item.notes}
  accessionNo={generateAccessionNo(item)}
/>
```

#### 3. Archival Stamps & Badges

Add subtle visual markers that feel like catalog stamps:

- **Status stamps:** "NEW ARRIVAL", "VERIFIED", "FAVORITE" (not stickers, more like ink stamps)
- **Category badges:** Small rectangular tags with collection icon
- **Date badges:** "Added MM.DD.YYYY" in monospace
- **Rating badge:** ★★★★★ in muted gold/amber (not bright yellow)

**Visual Style:**
- Uppercase, small monospace text (10px)
- Low opacity borders (20-30%)
- Subtle texture overlay (optional)
- Never bright/loud colors (keep muted)

**Placement:**
- Top-right corner of card
- Bottom metadata area
- Header of detail view

---

### Revised Theme Palette & Guidelines

#### Gallery (Light) - "Contemporary MoMA"
- **Primary Surface:** `#FFFFFF` (pure white)
- **Mat Color:** `#F5F5F5` (soft gray)
- **Frame:** `#1A1A1A` (charcoal, 1px)
- **Shadow:** `0 2px 8px rgba(0,0,0,0.06)`
- **Text Primary:** `#0A0A0A`
- **Text Muted:** `#737373` (stone-500)
- **Accents:** Amber-600 for interactive elements
- **Typography:**
  - Titles: Serif (EB Garamond or similar)
  - Labels: Mono (JetBrains Mono or SF Mono)
  - Body: Sans (Inter or system)

**Mood:** Clean, editorial, high-contrast, premium paper feel

#### Vault (Dark) - "Museum Night + Archive"
- **Primary Surface:** `#0C0A09` (stone-950)
- **Mat Color:** `#1C1917` (stone-900)
- **Frame:** `#D4A574` (brass/gold, 1px)
- **Shadow:** `0 4px 16px rgba(0,0,0,0.5)`
- **Text Primary:** `#FAFAF9` (stone-50)
- **Text Muted:** `#A8A29E` (stone-400)
- **Accents:** Amber-500 for warmth
- **Typography:** Same as Gallery

**Mood:** Cinematic, luxurious, nighttime gallery spotlight

#### Atelier (Warm) - "Paper Archive + Natural Light"
- **Primary Surface:** `#FAF9F6` (warm cream)
- **Mat Color:** `#F5F1E7` (darker cream)
- **Frame:** `#8B7355` (warm brown, 1px)
- **Shadow:** `0 2px 12px rgba(87,83,78,0.12)` (warm shadow)
- **Text Primary:** `#292524` (stone-800)
- **Text Muted:** `#78716C` (stone-500)
- **Accents:** Amber-700 for richness
- **Typography:** Same as Gallery

**Mood:** Intimate, tactile, artist's studio, vintage catalog

---

### Implementation Priority

**Phase 1: Foundation (Week 1-2)**
1. Create `MuseumLabel` component
2. Add accession number generation utility
3. Implement basic frame system (CSS-only)
4. Update `ItemImage` to use frames

**Phase 2: Polish (Week 3-4)**
1. Add archival stamps/badges
2. Refine typography hierarchy
3. Theme-specific frame variations
4. Update all item cards + detail views

**Phase 3: Optional Enhancements**
- Subtle paper texture overlays (SVG noise)
- Theme-specific transitions
- Custom cursor on hover (magnifying glass icon?)

---

## Part 2: Image Enhancement Strategy

### Current Pipeline Analysis

**Strengths:**
- Two-variant system already exists (original + display)
- High-quality processing (imageSmoothingQuality: 'high')
- Gemini integration working well for metadata
- Non-blocking AI (never blocks user)

**Gaps:**
- No editing capabilities (crop, rotate, adjust)
- No quality checks or auto-fixes
- No composition analysis
- No background removal
- No style normalization

### Recommended Approach: "Museum-Ready" Auto-Enhancement

**Core Philosophy:**
Help users make photos **exhibition-worthy** without requiring photo editing skills or prompt engineering.

**NOT Recommended:**
- ❌ Full AI image generation (too slow, unpredictable, expensive)
- ❌ Heavy style transfer (loses authenticity of user's object)
- ❌ Open-ended prompt interface (overwhelming for non-experts)
- ❌ Multiple competing tools (crop vs AI vs filters = decision paralysis)

**Recommended:**
- ✅ One-tap "Museum Mode" enhancement
- ✅ Template-based fixes (not custom prompts)
- ✅ Preview before committing
- ✅ Always preserve original
- ✅ Optional, never required

---

### Three-Tier Enhancement System

#### Tier 1: Automatic Quality Checks (Silent)

Run immediately after upload, before AI analysis:

**Check for:**
1. **Exposure:** Histogram analysis (too dark/bright?)
2. **Blur:** Variance of Laplacian (motion blur?)
3. **Composition:** Object detection (subject off-center?)
4. **Resolution:** Below 800px on any side?
5. **Horizon tilt:** >3° rotation needed?

**Action:**
- If ALL checks pass → proceed normally
- If ANY check fails → show enhancement chip

**UI:**
```
┌─────────────────────────────────────┐
│  📸 Photo uploaded                  │
│                                     │
│  ⚠️ We noticed:                     │
│  • Photo is a bit dark              │
│  • Object is slightly tilted        │
│                                     │
│  [ Auto-Enhance ] [ Keep As Is ]    │
└─────────────────────────────────────┘
```

**Implementation:**
- Client-side canvas analysis (fast)
- Simple algorithms (brightness average, edge detection)
- No server calls needed
- <100ms processing time

#### Tier 2: "Museum Mode" Enhancement (One-Tap)

When user clicks "Auto-Enhance", apply a **fixed recipe** (not AI):

**Recipe Steps:**
1. **Auto-levels:** Normalize exposure (histogram stretch)
2. **Smart crop:** Center the detected object, 4:3 or square aspect
3. **Straighten:** Auto-rotate to level horizon/vertical lines
4. **Sharpen:** Mild unsharp mask (radius: 1px, amount: 50%)
5. **Color boost:** +10% saturation (keep realistic)
6. **Vignette:** Subtle darkening at edges (optional, theme-dependent)

**Technical Implementation:**
- Pure canvas operations (no AI/server calls)
- Uses existing `imageProcessor.ts` infrastructure
- Generate third variant: `enhanced` (alongside original + display)
- Processing time: <500ms for 2000px image

**Preview UI:**
```
┌─────────────────────────────────────┐
│  Before          │       After      │
│  ┌────────┐      │     ┌────────┐   │
│  │ Dark   │      │     │ Bright │   │
│  │ Tilted │ →    │     │ Level  │   │
│  │ Photo  │      │     │ Sharp  │   │
│  └────────┘      │     └────────┘   │
│                                     │
│  [ Use Enhanced ] [ Keep Original ] │
└─────────────────────────────────────┘
```

#### Tier 3: AI Background Removal (Optional)

For users who want **studio product look**:

**Model Options:**
1. **Gemini Imagen Edit API** (if available)
   - Prompt: "Remove background, keep object centered on clean white"
   - Server-side via `/api/gemini/edit-image`

2. **Remove.bg API** (alternative)
   - Specialized background removal
   - Higher quality than Gemini for this task
   - $0.02/image at scale

3. **Client-side ONNX** (free but slower)
   - U²-Net model in browser
   - No API costs
   - 2-5 seconds processing

**Recommendation:** Start with **Gemini Imagen Edit** if available, fallback to Remove.bg

**UI Placement:**
- "Advanced" section in review step
- Clear "Background Removal" button
- Shows before/after preview
- Optional watermark: "AI Enhanced"

**Prompt Template:**
```
Remove the background from this photo.
Keep the {object_type} completely unchanged.
Replace background with clean white.
Maintain realistic lighting and shadows.
Keep image centered and well-composed.
```

Where `{object_type}` comes from existing Gemini analysis metadata.

---

### Revised Upload Flow

**New Step Order:**

1. **Select Collection** (existing)
2. **Upload Photo** (existing)
3. **🆕 Quick Check** (new)
   - Auto-analyze quality
   - Show enhancement options if needed
   - User chooses: Auto-Enhance / Keep As Is / Manual Tools
4. **Analyzing** (existing)
   - Run Gemini metadata extraction
   - Process enhancement if selected
5. **Verify** (existing)
   - Show enhanced vs original toggle
   - Option to try background removal
   - Metadata form with AI pre-fill

**Total Added Time:**
- Quality check: <100ms
- Museum Mode enhancement: <500ms
- Background removal: 2-5 seconds (optional)

**Doesn't Break Existing Constraints:**
- ✅ Still "5 minutes to first value"
- ✅ Still works without AI
- ✅ Still recoverable if enhancement fails
- ✅ Still progressive disclosure

---

### Data Model Changes

**Extend Item Type:**

```typescript
interface CollectionItem {
  // ... existing fields ...

  // New fields:
  photoOriginalPath?: string;     // Existing original
  photoDisplayPath?: string;      // Existing display
  photoEnhancedPath?: string;     // NEW: museum-mode enhanced
  photoVariant?: 'original' | 'display' | 'enhanced'; // Which to show

  enhancementMetadata?: {
    applied: boolean;
    recipe: 'museum-mode' | 'bg-removal' | 'none';
    timestamp: number;
    model?: string;  // If AI-based
    params?: Record<string, any>;
  };
}
```

**IndexedDB Stores:**
- `assets` (original) - existing
- `display` (optimized) - existing
- `enhanced` (museum-mode) - NEW
- `enhanced-nobg` (background removed) - NEW

**Supabase Storage Paths:**
- `{user_id}/{item_id}_original.jpg` - existing
- `{user_id}/{item_id}_display.jpg` - existing
- `{user_id}/{item_id}_enhanced.jpg` - NEW
- `{user_id}/{item_id}_enhanced_nobg.jpg` - NEW

---

### Technical Implementation Details

#### Museum Mode Enhancement Algorithm

```typescript
// services/imageEnhancer.ts (NEW FILE)

export async function applyMuseumMode(
  imageBlob: Blob,
  options: MuseumModeOptions = {}
): Promise<Blob> {

  const defaults = {
    autoLevel: true,
    straighten: true,
    sharpen: true,
    saturation: 1.1,  // +10%
    vignette: false,  // theme-dependent
  };

  const config = { ...defaults, ...options };

  // 1. Load image
  const img = await loadImage(imageBlob);

  // 2. Auto-straighten (detect tilt angle)
  const tiltAngle = detectTilt(img);
  const straightened = rotateImage(img, -tiltAngle);

  // 3. Auto-levels (histogram stretch)
  const leveled = applyAutoLevels(straightened);

  // 4. Sharpen (unsharp mask)
  const sharpened = applyUnsharpMask(leveled, {
    radius: 1,
    amount: 0.5,
  });

  // 5. Color boost
  const boosted = adjustSaturation(sharpened, config.saturation);

  // 6. Optional vignette
  const final = config.vignette
    ? applyVignette(boosted, { strength: 0.2 })
    : boosted;

  // 7. Export as JPEG
  return canvasToBlob(final, 'image/jpeg', 0.92);
}
```

**Helper Functions Needed:**
- `detectTilt()` - Hough line transform or edge detection
- `rotateImage()` - Canvas rotate + crop
- `applyAutoLevels()` - Histogram normalization
- `applyUnsharpMask()` - Gaussian blur + subtract
- `adjustSaturation()` - HSL color space manipulation
- `applyVignette()` - Radial gradient overlay

**Libraries to Consider:**
- **CamanJS** (image processing) - Unmaintained, avoid
- **Canvas filters** (native) - Best option, write custom
- **Sharp** (server-side) - If moving enhancement to backend
- **Pica** (high-quality resize) - Already using similar approach

**Recommendation:** Write custom canvas filters for maximum control and performance.

#### AI Background Removal Integration

```typescript
// services/geminiService.ts (EXTEND EXISTING)

export async function removeBackground(
  imageBlob: Blob,
  objectType: string
): Promise<{ success: boolean; resultBlob?: Blob; error?: string }> {

  try {
    const base64 = await blobToBase64(imageBlob);

    const response = await fetch('/api/gemini/edit-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: base64,
        prompt: `Remove the background from this photo. Keep the ${objectType} completely unchanged. Replace background with clean white. Maintain realistic lighting and shadows.`,
        model: 'imagen-edit-v1',  // Or whatever Gemini offers
      }),
    });

    if (!response.ok) {
      throw new Error('Background removal failed');
    }

    const { imageUrl } = await response.json();
    const resultBlob = await fetch(imageUrl).then(r => r.blob());

    return { success: true, resultBlob };

  } catch (error) {
    console.error('Background removal error:', error);
    return { success: false, error: error.message };
  }
}
```

**Backend Endpoint (NEW):**

```javascript
// server/geminiProxy.js (EXTEND)

app.post('/api/gemini/edit-image', async (req, res) => {
  const { image, prompt, model } = req.body;

  // Option 1: Gemini Imagen API (if available)
  const result = await geminiClient.editImage({
    image: Buffer.from(image, 'base64'),
    prompt,
    model: model || 'imagen-edit-v1',
  });

  // Option 2: Fallback to Remove.bg
  if (!result) {
    const rbgResult = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: { 'X-Api-Key': process.env.REMOVEBG_API_KEY },
      body: formDataWithImage(image),
    });
    return res.json({ imageUrl: rbgResult.url });
  }

  res.json({ imageUrl: result.url });
});
```

---

### UX Considerations & Edge Cases

#### When Enhancement Should Be Suggested

**Auto-suggest if:**
- Brightness stddev > 70 (very dark/bright)
- Blur metric < 100 (Laplacian variance)
- Tilt angle > 3 degrees
- Object bounding box < 40% of frame (too much bg)
- Resolution < 1200px shortest side

**Don't suggest if:**
- User uploaded from batch mode (assume intentional)
- Image already square + centered (likely pre-edited)
- Brightness in good range (110-145 average)
- Sharp edges detected

#### Handling Enhancement Failures

**If Museum Mode fails:**
- Show error toast
- Fall back to original image
- Log error for debugging
- Still allow manual save

**If Background Removal fails:**
- Show "Enhancement unavailable" message
- Offer manual crop as alternative
- Don't block item creation

#### User Control & Transparency

**Always show:**
- Toggle between variants (Original / Enhanced / No BG)
- "Enhanced by AI" badge on enhanced images
- Revert button in item detail view
- Original always preserved in storage

**Settings Option:**
- "Auto-enhance uploads" toggle (default: suggest but don't auto-apply)
- "Background removal" toggle (default: available on demand)
- "Enhanced quality" slider (92% default, 85-98% range)

---

### API Cost Considerations

**Free Tier Operations:**
- Quality checks: Client-side (free)
- Museum Mode: Client-side (free)
- Metadata extraction: Gemini API (existing cost)

**Paid Operations:**
- Background removal: ~$0.01-0.05 per image (depending on provider)

**Cost Mitigation:**
- Cache enhancement results (don't re-process same image)
- Rate limit: 10 enhancements per user per day (free tier)
- Paid users: Unlimited enhancements
- Clear pricing: "5 free AI enhancements/month, then $0.02/image"

**Monthly Cost Estimate (1000 active users):**
- 1000 users × 10 items/month × 20% use enhancement = 2000 enhancements
- 2000 × $0.02 = $40/month (very manageable)

---

## Part 3: Integration Strategy (How to Build This)

### Phase 1: Foundation (Week 1-2)

**Goal:** Get frame system + museum labels working

**Tasks:**
1. Create `MuseumLabel.tsx` component
2. Create `ExhibitFrame.tsx` wrapper component
3. Update `ItemImage` to use frames
4. Add accession number generator utility
5. Update theme palette constants
6. Test on HomeScreen + CollectionScreen

**Files to Modify:**
- `components/MuseumLabel.tsx` (new)
- `components/ExhibitFrame.tsx` (new)
- `components/ItemImage.tsx` (extend)
- `utils/accessionNumber.ts` (new)
- `theme.tsx` (extend palette)
- `App.tsx` (use new components)

**Success Criteria:**
- All item cards show museum-style frames
- Labels have proper typography hierarchy
- Accession numbers display correctly
- Themes have distinct visual personalities

### Phase 2: Image Enhancement (Week 3-4)

**Goal:** Museum Mode one-tap enhancement working

**Tasks:**
1. Create `services/imageEnhancer.ts`
2. Implement quality check algorithms
3. Add enhancement step to AddItemModal flow
4. Create enhancement preview UI
5. Update data model for variants
6. Test enhancement pipeline

**Files to Modify:**
- `services/imageEnhancer.ts` (new)
- `components/AddItemModal.tsx` (extend flow)
- `components/EnhancementPreview.tsx` (new)
- `types.ts` (extend CollectionItem)
- `services/db.ts` (handle new variants)

**Success Criteria:**
- Quality checks run in <100ms
- Museum Mode processes in <500ms
- Preview shows before/after comparison
- Enhanced variant saves to IndexedDB + Supabase

### Phase 3: AI Background Removal (Week 5-6)

**Goal:** Optional background removal working

**Tasks:**
1. Extend `geminiService.ts` with `removeBackground()`
2. Add `/api/gemini/edit-image` endpoint to proxy
3. Create background removal UI in verify step
4. Handle API errors gracefully
5. Add cost tracking/rate limiting

**Files to Modify:**
- `services/geminiService.ts` (extend)
- `server/geminiProxy.js` (new endpoint)
- `components/AddItemModal.tsx` (add BG removal option)
- `components/BackgroundRemovalPreview.tsx` (new)

**Success Criteria:**
- Background removal works for common objects
- Errors show helpful messages
- Rate limits prevent cost overruns
- Original always preserved

### Phase 4: Polish & Settings (Week 7-8)

**Goal:** User preferences + refinement

**Tasks:**
1. Add enhancement settings panel
2. Create variant switcher in ItemDetailScreen
3. Add archival stamps/badges
4. Performance optimization
5. Mobile testing + refinement

**Files to Modify:**
- `components/SettingsModal.tsx` (extend)
- `screens/ItemDetailScreen.tsx` (variant switcher)
- `components/ArchivalBadge.tsx` (new)
- `services/imageEnhancer.ts` (optimize)

**Success Criteria:**
- Users can control enhancement preferences
- Variant switching is instant
- Mobile performance is smooth
- All edge cases handled

---

### Technical Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Enhancement too slow on mobile | High | Move to Web Worker, show progress |
| AI background removal costs too much | Medium | Rate limit, cache results, require auth |
| Enhancement degrades image quality | High | Extensive testing, adjustable parameters |
| Frame system breaks existing layouts | Medium | Gradual rollout, feature flag |
| Users prefer original photos | Low | Always show toggle, make enhancement optional |

---

### Alternative Approaches Considered (& Why Not Recommended)

#### ❌ Full AI Style Transfer (Midjourney/DALL-E style)
**Pros:** Very dramatic results, "wow factor"
**Cons:**
- Extremely slow (10-30 seconds)
- Expensive ($0.10-0.50 per image)
- Unpredictable results (may alter object identity)
- Requires prompt engineering skills
- Breaks "authentic collection" concept

**Verdict:** Too heavy for a personal collection app. Better for creative tools.

#### ❌ Manual Crop/Rotate/Adjust Tools (like Instagram editor)
**Pros:** Full user control, familiar pattern
**Cons:**
- High friction (requires user effort)
- Breaks "5-minute time-to-value"
- Mobile UI complexity (sliders, crop handles)
- Not everyone wants to be a photo editor

**Verdict:** Save for v2.0 "Advanced Mode" if users request it.

#### ❌ Multiple AI Model Options (Gemini vs DALL-E vs Stable Diffusion)
**Pros:** Flexibility, best tool for each job
**Cons:**
- Decision paralysis ("which model should I use?")
- Inconsistent results across models
- Higher maintenance burden
- More API keys to manage

**Verdict:** Stick with Gemini ecosystem for simplicity.

---

## Part 4: Recommended Implementation Roadmap

### Immediate Actions (This Week)

**1. Create Design System Update** ✅
- Document frame system specs
- Define museum label component
- Update theme palette with new colors
- Create Figma/design mockups (if applicable)

**2. Prototype Frame System** ✅
- Build `MuseumLabel` + `ExhibitFrame` components
- Apply to one screen (e.g., HomeScreen) as proof-of-concept
- Get user feedback on visual direction

**3. Research AI Image Edit API** 🔍
- Check if Gemini offers image editing capabilities (not just generation)
- Test Remove.bg API (get API key, test with sample images)
- Benchmark performance + cost

### Short-Term (Month 1)

**Week 1-2: Theme Evolution**
- Implement full frame system across all views
- Add museum labels to all item cards
- Update typography hierarchy
- Test on mobile devices

**Week 3-4: Basic Enhancement**
- Build quality check algorithms
- Implement Museum Mode enhancement (no AI)
- Add preview UI to upload flow
- Test with real user photos

### Medium-Term (Month 2-3)

**Week 5-6: AI Background Removal**
- Integrate chosen API (Gemini or Remove.bg)
- Add to verify step as optional
- Implement rate limiting
- Monitor costs

**Week 7-8: Polish & Settings**
- User preference controls
- Variant switcher in detail view
- Performance optimization
- Beta testing with real users

### Long-Term (Month 4+)

**Optional Advanced Features** (only if user demand exists):
- Manual crop/rotate tools
- Filter presets (B&W, vintage, etc.)
- Batch enhancement for existing collections
- Custom frame styles per collection
- Export with frame + label for printing

---

## Part 5: Success Metrics

### How to Measure if This Design Works

**Quantitative Metrics:**
1. **Enhancement Adoption Rate**
   - Target: >40% of uploads use auto-enhance
   - Measure: Track `enhancementMetadata.applied` field

2. **Time to First Item**
   - Target: Still <5 minutes (don't regress)
   - Measure: Upload timestamp → first save timestamp

3. **Enhanced Image Preference**
   - Target: >60% keep enhanced variant
   - Measure: Track `photoVariant` field over time

4. **Background Removal Usage**
   - Target: 10-15% of items (niche feature)
   - Measure: Count items with `enhanced-nobg` variant

5. **API Cost per User**
   - Target: <$0.50/user/month
   - Measure: Background removal API calls × cost

**Qualitative Metrics:**
1. **User Feedback**
   - "Does the app feel more premium than before?"
   - "Do your collections look better with the new design?"
   - "Is the enhancement feature helpful or annoying?"

2. **Visual Consistency**
   - Do item cards feel cohesive across different user uploads?
   - Does the theme have a distinct personality now?

3. **Accessibility**
   - Can users easily revert to original?
   - Is enhancement optional and non-blocking?
   - Are frame contrast ratios WCAG compliant?

---

## Part 6: Final Recommendations

### For Maximum User Value WITHOUT Overwhelming

**Do This:**
1. ✅ **Frame system + museum labels** = Instant aesthetic upgrade, zero user effort
2. ✅ **One-tap Museum Mode** = Simple, predictable, fast (no prompts needed)
3. ✅ **Optional BG removal** = Power feature for those who want it, ignorable for others
4. ✅ **Always preserve original** = Safe experimentation, reversible choices
5. ✅ **Template-driven** = No prompt engineering required

**Don't Do This:**
1. ❌ **Open-ended AI prompting** = Requires expertise, unpredictable, overwhelming
2. ❌ **Multiple editing modes** = Decision paralysis (crop vs filter vs AI vs...)
3. ❌ **Forced enhancements** = Respect user's original photos
4. ❌ **Heavy style transfer** = Too slow, too expensive, loses authenticity
5. ❌ **Complex settings** = Keep preferences minimal (on/off toggle is enough)

### Why This Approach Wins

**Aligns with Curio's Core Values:**
- ✅ "Delight before auth" → Frames work on sample collections too
- ✅ "5-minute time-to-value" → Enhancement adds <1 minute
- ✅ "Recoverable AI" → Original always preserved, variants toggleable
- ✅ "Explicit outcomes" → Clear before/after preview

**Respects User Psychology:**
- Defaults are smart but override is easy
- Progressive disclosure (basic → advanced)
- Aesthetic improvement is passive (frames) + active (enhancement)
- No learning curve for basic use

**Technically Feasible:**
- Builds on existing Gemini integration
- Reuses image processing infrastructure
- No new complex dependencies
- Can ship incrementally

---

## Appendix A: Visual Mockup Descriptions

### Before (Current State)
```
┌─────────────────────┐
│                     │
│   ┌─────────────┐   │
│   │             │   │  ← Photo sits directly in card
│   │  USER PHOTO │   │     No frame, no context
│   │             │   │
│   └─────────────┘   │
│                     │
│ Item Title          │  ← Generic text layout
│ Field: Value        │
└─────────────────────┘
```

### After (Recommended Design)
```
┌─────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │ ← Mat (theme-colored)
│ ▓ ┌───────────────┐ ▓ │
│ ▓ │               │ ▓ │ ← Thin frame
│ ▓ │  USER PHOTO   │ ▓ │    (gallery: charcoal)
│ ▓ │  (Enhanced)   │ ▓ │    (vault: brass)
│ ▓ └───────────────┘ ▓ │    (atelier: wood)
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│                         │
│ ITEM TITLE              │ ← Serif, 18px
│ Brand · 2025 · Mint     │ ← Mono, 12px, muted
│ ─                       │ ← Divider
│ Provenance notes...     │ ← Sans, 14px
│                         │
│ ACC.2026.001.042  ★★★★☆ │ ← Accession + rating
│                 [BADGE] │ ← "NEW" stamp
└─────────────────────────┘
```

---

## Appendix B: Code Snippets

### MuseumLabel Component

```typescript
// components/MuseumLabel.tsx

import React from 'react';
import { useTheme } from '@/theme';

interface MuseumLabelProps {
  title: string;
  metadata: string[];  // ['Brand', '2025', 'Condition: Mint']
  notes?: string;
  accessionNo: string;
  rating?: number;
}

export function MuseumLabel({
  title,
  metadata,
  notes,
  accessionNo,
  rating,
}: MuseumLabelProps) {
  const { theme } = useTheme();

  const titleClass = 'font-serif text-lg leading-tight';
  const metadataClass = 'font-mono text-xs uppercase tracking-wide opacity-60 mt-1';
  const notesClass = 'font-sans text-sm leading-relaxed mt-2';
  const accessionClass = 'font-mono text-[10px] uppercase tracking-wider opacity-40 mt-3';

  return (
    <div className="museum-label">
      <h3 className={titleClass}>{title}</h3>

      <div className={metadataClass}>
        {metadata.filter(Boolean).join(' · ')}
      </div>

      {notes && (
        <>
          <div className="h-px bg-current opacity-10 my-3" />
          <p className={notesClass}>{notes}</p>
        </>
      )}

      <div className="flex items-center justify-between">
        <span className={accessionClass}>{accessionNo}</span>
        {rating !== undefined && rating > 0 && (
          <div className="flex gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <span key={i} className={i < rating ? 'text-amber-500' : 'opacity-20'}>
                ★
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

### ExhibitFrame Component

```typescript
// components/ExhibitFrame.tsx

import React from 'react';
import { useTheme } from '@/theme';
import { ItemImage } from './ItemImage';

interface ExhibitFrameProps {
  photoUrl: string;
  alt: string;
  variant?: 'original' | 'display' | 'enhanced';
  itemId: string;
}

export function ExhibitFrame({
  photoUrl,
  alt,
  variant = 'display',
  itemId,
}: ExhibitFrameProps) {
  const { theme } = useTheme();

  const frameStyles = {
    gallery: {
      mat: 'bg-stone-50',
      frame: 'border border-stone-900',
      shadow: 'shadow-md',
    },
    vault: {
      mat: 'bg-stone-900',
      frame: 'border border-amber-600/60',
      shadow: 'shadow-2xl shadow-black/50',
    },
    atelier: {
      mat: 'bg-[#f5f1e7]',
      frame: 'border border-[#8B7355]',
      shadow: 'shadow-lg shadow-stone-900/10',
    },
  };

  const style = frameStyles[theme];

  return (
    <div className={`exhibit-frame ${style.mat} ${style.shadow} p-4 rounded-sm`}>
      <div className={`${style.frame} overflow-hidden rounded-sm`}>
        <ItemImage
          photoUrl={photoUrl}
          alt={alt}
          itemId={itemId}
          variant={variant}
          className="w-full h-full object-cover"
        />
      </div>
    </div>
  );
}
```

### Accession Number Generator

```typescript
// utils/accessionNumber.ts

export function generateAccessionNo(
  item: CollectionItem,
  collection: UserCollection,
  allCollections: UserCollection[]
): string {
  // Format: ACC.YYYY.CCC.III
  // ACC = Prefix
  // YYYY = Year added
  // CCC = Collection index (001-999)
  // III = Item index within collection (001-999)

  const year = new Date(item.createdAt).getFullYear();

  const collectionIndex = allCollections
    .sort((a, b) => a.createdAt - b.createdAt)
    .findIndex(c => c.id === collection.id) + 1;

  const itemsInCollection = allCollections
    .find(c => c.id === collection.id)
    ?.items.sort((a, b) => a.createdAt - b.createdAt) || [];

  const itemIndex = itemsInCollection.findIndex(i => i.id === item.id) + 1;

  const ccc = String(collectionIndex).padStart(3, '0');
  const iii = String(itemIndex).padStart(3, '0');

  return `ACC.${year}.${ccc}.${iii}`;
}
```

---

## Conclusion

The ideal design for Curio combines:

1. **Presentation-first enhancement** (frames + labels) that works for all photos
2. **Lightweight, template-driven AI** (Museum Mode) that's fast and predictable
3. **Optional power features** (background removal) for advanced users
4. **Always-preserve-original** safety net for experimentation

This approach maximizes aesthetic pleasure without overwhelming users, aligns with the "personal museum" concept, and respects the existing "5-minute time-to-value" constraint.

**Next Steps:**
1. Review and approve this design direction
2. Prototype frame system first (lowest risk, highest visual impact)
3. Build Museum Mode enhancement (medium complexity, high value)
4. Add background removal last (highest complexity, niche usage)

**Total estimated effort:** 6-8 weeks for full implementation, but can ship frame system in 2 weeks for immediate aesthetic upgrade.
