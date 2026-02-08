import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

describe('useDebouncedValue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns initial value immediately', () => {
    const { result } = renderHook(() => useDebouncedValue('initial', 500));
    expect(result.current).toBe('initial');
  });

  it('updates value after delay', () => {
    const { result, rerender } = renderHook(({ value, delay }) => useDebouncedValue(value, delay), {
      initialProps: { value: 'initial', delay: 500 },
    });

    expect(result.current).toBe('initial');

    // Update value
    rerender({ value: 'updated', delay: 500 });

    // Value should not update immediately
    expect(result.current).toBe('initial');

    // Fast forward time
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current).toBe('updated');
  });

  it('resets timer if value changes within delay', () => {
    const { result, rerender } = renderHook(({ value, delay }) => useDebouncedValue(value, delay), {
      initialProps: { value: 'initial', delay: 500 },
    });

    // Update value first time
    rerender({ value: 'update1', delay: 500 });

    // Fast forward partially
    act(() => {
      vi.advanceTimersByTime(250);
    });

    // Update value second time
    rerender({ value: 'update2', delay: 500 });

    // Fast forward past the first delay but not the second
    act(() => {
      vi.advanceTimersByTime(250);
    });

    // Should still not be updated because timer reset
    expect(result.current).toBe('initial');

    // Fast forward remaining time
    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(result.current).toBe('update2');
  });
});
