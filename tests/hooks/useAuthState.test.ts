/**
 * Phase 3.2: hooks/useAuthState.ts — Auth State Management Tests
 *
 * Success criteria (from docs/TESTING_ROADMAP.md Phase 3):
 * - Hooks maintain correct state through auth lifecycle
 * - Initial loading state, auth state change updates, sign out clears user
 * - Edge case: rapid sign-in/out cycles
 *
 * IMPORTANT (TDD): Do not modify production implementations while writing these tests.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { mockSupabaseClient, resetSupabaseMocks } from '@/tests/mocks/supabase';

// Provide a controlled Supabase client for the hook under test.
vi.mock('@/services/supabase', () => {
  return {
    supabase: mockSupabaseClient,
  };
});

describe('hooks/useAuthState.ts (Phase 3.2)', () => {
  beforeEach(() => {
    resetSupabaseMocks();
    // Default profiles query for tests that don't care about isAdmin:
    // return non-admin and avoid noisy console warnings.
    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { is_admin: false }, error: null }),
    } as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('initial state: user is null and authReady is false until getSession resolves', async () => {
    /**
     * Verifies the initial "loading" behavior:
     * - Immediately after mount, the hook should indicate auth is not ready yet.
     * - user should be null until Supabase session initialization completes.
     */
    let resolveSession: (value: any) => void;
    const pending = new Promise((r) => (resolveSession = r));
    mockSupabaseClient.auth.getSession.mockReturnValueOnce(pending as any);

    const { useAuthState } = await import('@/hooks/useAuthState');
    const { result } = renderHook(() => useAuthState(true));

    expect(result.current.user).toBeNull();
    expect(result.current.authReady).toBe(false);

    resolveSession!({ data: { session: null } });
    await waitFor(() => expect(result.current.authReady).toBe(true));
    expect(result.current.user).toBeNull();
  });

  it('auth state changes: onAuthStateChange updates user (sign-in and sign-out)', async () => {
    /**
     * Verifies that Supabase auth events update React state.
     * - SIGNED_IN should set user
     * - SIGNED_OUT should clear user
     */
    const unsubscribe = vi.fn();
    let handler: ((event: string, session: any) => void) | null = null;
    mockSupabaseClient.auth.onAuthStateChange.mockImplementationOnce((cb: any) => {
      handler = cb;
      return { data: { subscription: { unsubscribe } } };
    });
    mockSupabaseClient.auth.getSession.mockResolvedValueOnce({ data: { session: null } });

    const { useAuthState } = await import('@/hooks/useAuthState');
    const { result, unmount } = renderHook(() => useAuthState(true));

    await waitFor(() => expect(result.current.authReady).toBe(true));

    await act(async () => {
      handler?.('SIGNED_IN', { user: { id: 'u1', email: 'u1@example.com' } });
    });
    expect(result.current.user).toMatchObject({ id: 'u1', email: 'u1@example.com' });

    await act(async () => {
      handler?.('SIGNED_OUT', null);
    });
    expect(result.current.user).toBeNull();

    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('admin status: when a user is present, loads profiles.is_admin; clears isAdmin when user becomes null', async () => {
    /**
     * Verifies admin lookup behavior:
     * - With a user, queries profiles table for is_admin
     * - If user becomes null, isAdmin resets to false
     */
    const unsubscribe = vi.fn();
    let handler: ((event: string, session: any) => void) | null = null;
    mockSupabaseClient.auth.onAuthStateChange.mockImplementationOnce((cb: any) => {
      handler = cb;
      return { data: { subscription: { unsubscribe } } };
    });

    mockSupabaseClient.auth.getSession.mockResolvedValueOnce({
      data: { session: { user: { id: 'u1', email: 'u1@example.com' } } },
    });

    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { is_admin: true }, error: null }),
    };
    mockSupabaseClient.from.mockReturnValueOnce(query as any);

    const { useAuthState } = await import('@/hooks/useAuthState');
    const { result } = renderHook(() => useAuthState(true));

    await waitFor(() => expect(result.current.authReady).toBe(true));
    await waitFor(() => expect(result.current.isAdmin).toBe(true));

    await act(async () => {
      handler?.('SIGNED_OUT', null);
    });
    await waitFor(() => expect(result.current.isAdmin).toBe(false));
  });

  it('edge case: handles rapid sign-in/out cycles and ends in the latest state', async () => {
    /**
     * Verifies resilience to quick successive auth events (e.g., flaky network / multiple tabs).
     * The hook should converge to the state from the last event it receives.
     */
    let handler: ((event: string, session: any) => void) | null = null;
    mockSupabaseClient.auth.onAuthStateChange.mockImplementationOnce((cb: any) => {
      handler = cb;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    mockSupabaseClient.auth.getSession.mockResolvedValueOnce({ data: { session: null } });

    const { useAuthState } = await import('@/hooks/useAuthState');
    const { result } = renderHook(() => useAuthState(true));
    await waitFor(() => expect(result.current.authReady).toBe(true));

    await act(async () => {
      handler?.('SIGNED_IN', { user: { id: 'u1' } });
      handler?.('SIGNED_OUT', null);
      handler?.('SIGNED_IN', { user: { id: 'u2' } });
    });

    // Assert within waitFor to ensure any follow-on effects are also wrapped in act().
    await waitFor(() => expect(result.current.user).toMatchObject({ id: 'u2' }));
  });
});
