# Exhibition View Mobile Layout Issues

## Issue Summary

The Exhibition View component has critical mobile layout issues causing poor UX:
1. **Excessive black background** above and below item content
2. **Overlapping elements** - content overlaps with header/collection title
3. **Unnecessary scrolling** required to view full item details

## Visual Evidence

### Problem Screenshots
- User has to scroll extensively to see content
- Image appears too small and not centered properly
- Massive black empty space above and below the actual content
- Header/title area overlaps with content background

### Expected Behavior
- Content should fill viewport efficiently without excessive empty space
- No scrolling required to view a single item
- Clean separation between header and content
- Image should be properly sized and centered

## Root Cause Analysis

### Technical Details

**File:** `src/components/ExhibitionView.tsx`

**Core Problem:** Misalignment between container height and content height

#### Before Fix:

```tsx
// Line 48: Content area
<div className="flex-1 min-h-0 ... justify-center ...">
  // Line 56: Grid container
  <div className="... gap-8 ...">
    // Line 57: Image container
    <div className="... max-h-[40vh] ...">
```

**What was happening:**

1. **Container Height:** Content area uses `flex-1`, taking ~70-80% of viewport height
2. **Image Height:** Image constrained to `max-h-[40vh]`, only 40% of viewport
3. **Centering:** Content centered with `justify-center` within the tall container
4. **Result:** ~30-40vh of empty black space above and below the centered content

### Visual Diagram

```
┌─────────────────────────────────┐
│ Header (~10-15vh)               │
├─────────────────────────────────┤
│                                 │ ← Empty black space
│   ┌─────────────────────┐       │
│   │ Image (40vh)        │       │ ← Actual content centered
│   │ Text (~15vh)        │       │
│   └─────────────────────┘       │
│                                 │ ← Empty black space
├─────────────────────────────────┤
│ Footer (~5-10vh)                │
└─────────────────────────────────┘

Container: 70-80vh (flex-1)
Content: ~55vh (40vh image + 15vh text)
Waste: ~20-25vh empty black space
```

## Solution Implemented

### Key Changes

#### 1. Vertical Alignment Strategy
```diff
- justify-center
+ justify-start sm:justify-center
```
**Why:** On mobile, content flows from top instead of being centered in a tall container

#### 2. Image Size Optimization
```diff
- max-h-[40vh]
+ max-h-[55vh]
```
**Why:** Larger image fills more viewport space, reducing empty areas

#### 3. Spacing Compression (Mobile Only)
```diff
Header:
- p-6
+ py-4 px-6

Content area:
- py-4
+ pt-2 pb-4

Gaps:
- gap-8
+ gap-4

Text spacing:
- space-y-6
+ space-y-4

Footer:
- p-6
+ py-4 px-6
```
**Why:** Tighter spacing creates more compact, efficient layout on mobile

### After Fix:

```
┌─────────────────────────────────┐
│ Header (compact, ~8vh)          │
├─────────────────────────────────┤
│ ┌─────────────────────┐         │ ← Content starts from top
│ │ Image (55vh)        │         │
│ └─────────────────────┘         │
│ Text (~12vh)                    │
├─────────────────────────────────┤
│ Footer (compact, ~5vh)          │
└─────────────────────────────────┘

Container: 80vh (flex-1)
Content: ~67vh (55vh image + 12vh text)
Waste: ~5vh (minimal, acceptable)
```

## Files Modified

- `src/components/ExhibitionView.tsx` (lines 31, 48, 56, 57, 69, 106)

## Commits

1. `0053992` - Initial fix: removed overflow-y-auto, centered image
2. `e9c6598` - Improved flex layout, enhanced gradients
3. `6e11942` - Comprehensive mobile optimization with spacing compression

## Testing Recommendations

### Manual Testing
- [ ] Test on iOS Safari (iPhone 12, 13, 14, 15)
- [ ] Test on Android Chrome (various screen sizes)
- [ ] Test landscape orientation
- [ ] Test with items that have varying text content lengths
- [ ] Test with different collection types (different field counts)

### Automated Testing
- [ ] Add visual regression tests for Exhibition View
- [ ] Test different viewport sizes (320px, 375px, 390px, 428px widths)
- [ ] Verify no scrolling required for standard content

### Edge Cases to Verify
- [ ] Very long item titles (3+ lines)
- [ ] Items with no notes/description
- [ ] Items with no custom field data
- [ ] Collections with 1-2 custom fields vs 4+ fields
- [ ] Very wide images (landscape orientation)
- [ ] Very tall images (portrait orientation)

## Design Principles Applied

### Mobile-First Constraints (from CLAUDE.md)
✅ **Delight before auth** - Exhibition mode works pre-login
✅ **Explicit outcomes** - Clear visual presentation without confusion
✅ **Recoverable AI** - Not AI-related, but layout doesn't block user actions

### Responsive Design Patterns
1. **Content-first on mobile** - Let content determine layout, not abstract containers
2. **Progressive enhancement** - Mobile gets compact layout, desktop gets spacious centered layout
3. **Touch-friendly spacing** - 4-unit gaps minimum for touch targets
4. **Viewport efficiency** - Maximize use of limited mobile screen space

## Future Improvements

### Short-term (Next Sprint)
- [ ] Add fade-in animation when transitioning between items
- [ ] Consider adjusting title font size dynamically based on length
- [ ] Add swipe gestures for next/prev navigation
- [ ] Optimize footer pagination dots for collections with many items

### Long-term (Future Iterations)
- [ ] Implement pinch-to-zoom on exhibition images
- [ ] Add fullscreen image view mode
- [ ] Consider lazy loading for image transitions
- [ ] Evaluate variable image sizes based on aspect ratio

## Related Issues

None currently. This is the first documented instance of exhibition layout problems.

## References

- Exhibition View Component: `src/components/ExhibitionView.tsx`
- Project Constraints: `CLAUDE.md` (MVP: Value in 5 Minutes)
- Design System: `theme.tsx` (Typography and spacing classes)

## Team Discussion Points

1. **Should desktop also get the more compact spacing?** Currently only mobile is optimized.
2. **Image max-height on mobile:** 55vh feels good, but should we test 50vh or 60vh alternatives?
3. **Vertical centering on desktop:** Should we also use justify-start on desktop for consistency?
4. **Custom field display:** With 4 fields, layout can get cramped. Should we limit to 2-3 fields in exhibition mode?
5. **Aspect ratio handling:** 3:4 aspect ratio is hardcoded. Should we adapt to actual image ratios?

## Priority

**High** - This affects core user experience for one of the app's signature features (exhibition/gallery mode).

## Assignee

Fixed by: Claude Agent
Needs review by: Design team + Mobile developers

---

*Created: 2026-01-24*
*Branch: `claude/fix-exhibition-item-layout-JGzWi`*
*Status: Pending review*
