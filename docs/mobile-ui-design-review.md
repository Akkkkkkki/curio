# Mobile UI Design Review & Recommendations

> **Date:** January 2026
> **Scope:** Mobile UI design, motion, animation, and touch interactions
> **Goal:** Identify improvements while keeping implementation simple and following industry best practices

---

## Executive Summary

Curio's mobile UI is well-architected with a solid foundation of responsive design, motion-safe animations, and theme-aware styling. This review identifies opportunities to enhance the mobile experience through improved touch interactions, refined animation timing, and better loading states—all achievable with minimal additional complexity.

---

## Current State Assessment

### Strengths

| Area                   | Current Implementation                                             |
| ---------------------- | ------------------------------------------------------------------ |
| **Animation approach** | Pure CSS/Tailwind (no heavy libraries) - excellent for bundle size |
| **Motion safety**      | 68+ `motion-safe:` utilities respect user preferences              |
| **Safe areas**         | Proper `env(safe-area-inset-*)` handling for notches               |
| **Theme system**       | Three cohesive themes with consistent shadows and colors           |
| **Entry animations**   | Well-timed 220-260ms modal and card animations                     |
| **Touch feedback**     | Active states with scale transforms (0.98)                         |

### Areas for Improvement

| Area                         | Current Gap                                            |
| ---------------------------- | ------------------------------------------------------ |
| **Touch gestures**           | No swipe-to-dismiss, drag gestures, or pull-to-refresh |
| **Page transitions**         | Routes change instantly without animation              |
| **Loading states**           | Spinner-only; no skeleton screens                      |
| **Haptic feedback**          | Not utilizing device vibration APIs                    |
| **Scroll-linked animations** | No intersection observer patterns                      |
| **Animation easing**         | Using generic ease-out; could use spring curves        |

---

## Recommendations

### 1. Refine Animation Timing Curves

**Priority:** High
**Effort:** Low
**Impact:** Polished, native-like feel

**Current:** Generic `ease-out` and `ease-in-out` for most transitions.

**Recommendation:** Adopt spring-based timing functions that feel more natural on mobile.

```css
/* Add to Tailwind config or index.html */
:root {
  /* iOS-inspired spring curve - snappy with subtle bounce */
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);

  /* Smooth deceleration for entries */
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);

  /* Natural feeling for interactions */
  --ease-out-back: cubic-bezier(0.34, 1.3, 0.64, 1);
}
```

**Apply to:**

- Button press feedback (use `--ease-spring`)
- Modal entry animations (use `--ease-out-expo`)
- Card hover/tap states (use `--ease-out-back`)

---

### 2. Add Swipe-to-Dismiss for Bottom Sheet Modals

**Priority:** High
**Effort:** Medium
**Impact:** Critical mobile UX pattern

**Current:** Modals require tapping close button or backdrop.

**Recommendation:** Allow users to swipe down to dismiss modals (industry standard on iOS/Android).

**Implementation approach:**

```tsx
// Simplified touch handling for bottom sheets
const [dragY, setDragY] = useState(0);
const [isDragging, setIsDragging] = useState(false);

const handleTouchMove = (e: TouchEvent) => {
  const deltaY = e.touches[0].clientY - startY;
  if (deltaY > 0) setDragY(deltaY); // Only allow downward drag
};

const handleTouchEnd = () => {
  if (dragY > 100)
    onClose(); // Dismiss threshold
  else setDragY(0); // Snap back
};
```

**Visual indicator:** Add a drag handle bar at the top of modals:

```tsx
<div className="w-12 h-1.5 bg-stone-300 rounded-full mx-auto mb-4" />
```

---

### 3. Implement Skeleton Loading States

**Priority:** High
**Effort:** Medium
**Impact:** Perceived performance improvement

**Current:** Spinner-only loading states.

**Recommendation:** Add skeleton screens for content-heavy views (collection grid, item details).

```tsx
// components/ui/Skeleton.tsx
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse bg-stone-200 dark:bg-stone-700 rounded-lg', className)} />
  );
}

// Usage in ItemCard placeholder
<div className="space-y-3">
  <Skeleton className="aspect-[3/4] w-full" />
  <Skeleton className="h-4 w-3/4" />
  <Skeleton className="h-3 w-1/2" />
</div>;
```

**Apply to:**

- Collection grid during initial load
- Item detail view while fetching data
- Image placeholders before load

---

### 4. Add Subtle Haptic Feedback

**Priority:** Medium
**Effort:** Low
**Impact:** Tactile confirmation on supported devices

**Current:** No haptic feedback.

**Recommendation:** Add light vibration for key actions (saves gracefully on unsupported devices).

```tsx
// utils/haptics.ts
export const haptics = {
  light: () => navigator.vibrate?.(10),
  medium: () => navigator.vibrate?.(20),
  success: () => navigator.vibrate?.([10, 50, 10]),
  error: () => navigator.vibrate?.([50, 30, 50]),
};

// Usage
<Button
  onClick={() => {
    haptics.light();
    handleSave();
  }}
>
  Save
</Button>;
```

**Apply to:**

- Item saved confirmation
- Delete actions
- Toggle switches
- Rating star selection

---

### 5. Enhance Page Transitions

**Priority:** Medium
**Effort:** Medium
**Impact:** Cohesive navigation experience

**Current:** Instant route changes with no animation.

**Recommendation:** Add cross-fade transitions between routes using React Router's built-in patterns or CSS-only approach.

**CSS-only approach (simpler):**

```css
/* Add to main styles */
.page-enter {
  opacity: 0;
  transform: translateY(8px);
}

.page-enter-active {
  opacity: 1;
  transform: translateY(0);
  transition:
    opacity 200ms ease-out,
    transform 200ms ease-out;
}
```

**React Router approach:**
Use `useNavigation()` hook to detect pending navigation and apply transition classes.

**Keep it subtle:** Mobile users expect quick transitions; limit to 150-200ms.

---

### 6. Improve Touch Target Sizes

**Priority:** High
**Effort:** Low
**Impact:** Accessibility and usability

**Current:** Some interactive elements may be undersized.

**Recommendation:** Ensure all touch targets meet minimum 44x44px (iOS) / 48x48dp (Android).

```tsx
// Minimum touch target wrapper
<button className="min-w-[44px] min-h-[44px] flex items-center justify-center">
  <Icon size={20} />
</button>
```

**Audit these areas:**

- Filter chips in collection view
- Close buttons on modals
- Navigation icons in header
- Rating stars (increase tap area)

---

### 7. Add Pull-to-Refresh Pattern

**Priority:** Low
**Effort:** Medium
**Impact:** Familiar mobile refresh pattern

**Current:** No pull-to-refresh; users must use reload or sync button.

**Recommendation:** Implement for collection views to refresh data from Supabase.

```tsx
// Simplified pull-to-refresh hook
const usePullToRefresh = (onRefresh: () => Promise<void>) => {
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);

  // Track touch start/move at top of scroll container
  // Trigger refresh when pullDistance > threshold (60px)
  // Show spinner during refresh
};
```

**Visual:** Use existing `Loader2` spinner with pull distance indicator.

---

### 8. Optimize Scroll-Linked Animations

**Priority:** Low
**Effort:** Low
**Impact:** Polish and delight

**Current:** Cards have entry animation but no scroll-based reveal.

**Recommendation:** Stagger card animations as they enter viewport using Intersection Observer.

```tsx
// hooks/useScrollReveal.ts
export function useScrollReveal(ref: RefObject<HTMLElement>) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.1, rootMargin: '50px' }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return isVisible;
}

// Usage
<div className={cn(
  "transition-all duration-300",
  isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
)}>
```

**Note:** Use sparingly to avoid jank; apply only to initially off-screen content.

---

### 9. Standardize Animation Durations

**Priority:** Medium
**Effort:** Low
**Impact:** Consistency and predictability

**Recommendation:** Define a clear animation timing scale and apply consistently:

| Token                | Duration | Use Case                            |
| -------------------- | -------- | ----------------------------------- |
| `--duration-instant` | 100ms    | Micro-interactions (toggles, color) |
| `--duration-fast`    | 150ms    | Button feedback, small transitions  |
| `--duration-normal`  | 220ms    | Modal entry, card animations        |
| `--duration-slow`    | 350ms    | Page transitions, large reveals     |
| `--duration-slower`  | 500ms    | Exhibition mode, emphasis           |

**Current inconsistency:** Durations range from 200ms to 700ms without clear pattern.

---

### 10. Add Loading Progress for AI Analysis

**Priority:** Medium
**Effort:** Low
**Impact:** Reduced perceived wait time

**Current:** Simple spinner during AI analysis.

**Recommendation:** Add staged progress indicator showing analysis steps.

```tsx
const analysisSteps = [
  'Uploading image...',
  'Analyzing content...',
  'Extracting metadata...',
  'Preparing results...',
];

// Show current step with progress bar
<div className="space-y-2">
  <div className="h-1 bg-stone-200 rounded-full overflow-hidden">
    <div
      className="h-full bg-amber-500 transition-all duration-300"
      style={{ width: `${(currentStep / steps.length) * 100}%` }}
    />
  </div>
  <p className="text-sm text-stone-500">{steps[currentStep]}</p>
</div>;
```

---

## Implementation Priority Matrix

| Recommendation           | Priority | Effort | Impact | Order |
| ------------------------ | -------- | ------ | ------ | ----- |
| Touch target sizes       | High     | Low    | High   | 1     |
| Animation timing curves  | High     | Low    | Medium | 2     |
| Skeleton loading states  | High     | Medium | High   | 3     |
| Swipe-to-dismiss modals  | High     | Medium | High   | 4     |
| Standardize durations    | Medium   | Low    | Medium | 5     |
| Haptic feedback          | Medium   | Low    | Medium | 6     |
| AI progress indicator    | Medium   | Low    | Medium | 7     |
| Page transitions         | Medium   | Medium | Medium | 8     |
| Scroll-linked animations | Low      | Low    | Low    | 9     |
| Pull-to-refresh          | Low      | Medium | Low    | 10    |

---

## Quick Wins (< 1 hour each)

1. **Add drag handle to modals** - Visual indicator for swipe dismissal
2. **Define timing variables** - Create CSS custom properties for durations
3. **Add spring easing curve** - Update Tailwind config
4. **Audit touch targets** - Review and fix undersized buttons
5. **Add haptics utility** - Create simple vibration helper

---

## Testing Recommendations

### Device Testing

- Test on actual iOS and Android devices (not just simulators)
- Verify touch targets with accessibility scanner
- Test with reduced motion preference enabled

### Performance Monitoring

- Use Chrome DevTools Performance tab to verify 60fps animations
- Check for layout thrashing during scroll
- Profile memory during long sessions

### Accessibility Checks

- Verify `prefers-reduced-motion` is respected
- Test with screen readers (VoiceOver, TalkBack)
- Ensure focus states are visible

---

## References

- [Apple Human Interface Guidelines - Motion](https://developer.apple.com/design/human-interface-guidelines/motion)
- [Material Design - Motion](https://m3.material.io/styles/motion/overview)
- [Web.dev - Animations Guide](https://web.dev/animations-guide/)
- [WCAG 2.1 - Animation from Interactions](https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions.html)
