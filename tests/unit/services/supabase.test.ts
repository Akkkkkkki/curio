/**
 * Phase 1.3: Supabase Auth (Isolated) Tests
 *
 * Module under test: services/supabase.ts
 *
 * Goals (from TESTING_ROADMAP.md):
 * - Validate sign-up/sign-in/sign-out helpers with minimal mocking.
 * - Ensure expected error cases are surfaced (duplicate email, weak password, invalid credentials, etc.).
 *
 * Important: TDD only — do not modify production implementations in these tests.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mockSupabaseClient, resetSupabaseMocks } from '@/tests/mocks/supabase';

// Mock the Supabase SDK so `services/supabase.ts` gets a controlled client instance.
vi.mock('@supabase/supabase-js', () => {
  return {
    createClient: vi.fn(() => mockSupabaseClient),
  };
});

async function importSupabaseModuleFresh(env: { url?: string; key?: string } = {}) {
  vi.resetModules();

  // Ensure `services/supabase.ts` sees the desired configuration at module-eval time.
  if (env.url !== undefined) vi.stubEnv('VITE_SUPABASE_URL', env.url);
  if (env.key !== undefined) vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY', env.key);

  return await import('@/services/supabase');
}

describe('services/supabase.ts - Auth Helpers (Phase 1.3)', () => {
  beforeEach(() => {
    resetSupabaseMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  describe('signUpWithEmail(email, password)', () => {
    it('throws a clear error when Supabase is not configured', async () => {
      /**
       * Verifies that calling sign-up without required env config fails fast,
       * instead of silently doing nothing or returning an invalid result.
       */
      const mod = await importSupabaseModuleFresh({ url: '', key: '' });

      await expect(mod.signUpWithEmail('test@example.com', 'password123')).rejects.toThrow(
        'Supabase is not configured.',
      );
    });

    it('returns a user object on success (typical sign-up flow)', async () => {
      /**
       * Happy path: a normal sign-up should resolve with a user object from Supabase.
       */
      const mod = await importSupabaseModuleFresh({
        url: 'https://test.supabase.co',
        key: 'test-key',
      });

      // Typical behavior: no current user (or not anonymous), so signUp is used.
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      });

      mockSupabaseClient.auth.signUp.mockResolvedValueOnce({
        data: { user: { id: 'new-user-id', email: 'new@example.com' } },
        error: null,
      });

      const user = await mod.signUpWithEmail('new@example.com', 'StrongPassword!123');
      expect(user).toMatchObject({ id: 'new-user-id', email: 'new@example.com' });
      expect(mockSupabaseClient.auth.signUp).toHaveBeenCalledTimes(1);
    });

    it('upgrades an anonymous user by calling updateUser and returns the upgraded user', async () => {
      /**
       * Edge case: if the current user is anonymous, the app upgrades the account
       * rather than creating a new user via signUp.
       */
      const mod = await importSupabaseModuleFresh({
        url: 'https://test.supabase.co',
        key: 'test-key',
      });

      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'anon-id', is_anonymous: true } },
        error: null,
      });

      mockSupabaseClient.auth.updateUser.mockResolvedValueOnce({
        data: { user: { id: 'upgraded-id', email: 'upgraded@example.com' } },
        error: null,
      });

      const user = await mod.signUpWithEmail('upgraded@example.com', 'StrongPassword!123');
      expect(mockSupabaseClient.auth.updateUser).toHaveBeenCalledTimes(1);
      expect(mockSupabaseClient.auth.signUp).not.toHaveBeenCalled();
      expect(user).toMatchObject({ id: 'upgraded-id', email: 'upgraded@example.com' });
    });

    it('surfaces duplicate-email errors from Supabase (throws the Supabase error)', async () => {
      /**
       * Error case: duplicate email should be returned as a thrown error so the UI
       * can present a helpful message.
       */
      const mod = await importSupabaseModuleFresh({
        url: 'https://test.supabase.co',
        key: 'test-key',
      });

      const duplicateEmailError = Object.assign(new Error('User already registered'), {
        name: 'AuthApiError',
        status: 400,
      });

      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      });
      mockSupabaseClient.auth.signUp.mockResolvedValueOnce({
        data: { user: null, session: null },
        error: duplicateEmailError,
      });

      await expect(mod.signUpWithEmail('dup@example.com', 'StrongPassword!123')).rejects.toBe(
        duplicateEmailError,
      );
    });

    it('surfaces weak-password errors from Supabase during anonymous upgrade', async () => {
      /**
       * Error case: upgrading an anonymous user can fail if the password is too weak.
       * The helper should throw the auth error object unchanged.
       */
      const mod = await importSupabaseModuleFresh({
        url: 'https://test.supabase.co',
        key: 'test-key',
      });

      const weakPasswordError = Object.assign(
        new Error('Password should be at least 6 characters'),
        {
          name: 'AuthWeakPasswordError',
          status: 400,
        },
      );

      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'anon-id', is_anonymous: true } },
        error: null,
      });
      mockSupabaseClient.auth.updateUser.mockResolvedValueOnce({
        data: { user: null },
        error: weakPasswordError,
      });

      await expect(mod.signUpWithEmail('any@example.com', '123')).rejects.toBe(weakPasswordError);
    });

    it('propagates network failures (when signUp throws rather than returning an error field)', async () => {
      /**
       * Error case: the SDK may throw (network/transport errors). We ensure callers
       * can handle a rejected promise.
       */
      const mod = await importSupabaseModuleFresh({
        url: 'https://test.supabase.co',
        key: 'test-key',
      });

      const networkError = new Error('Network request failed');
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      });
      mockSupabaseClient.auth.signUp.mockRejectedValueOnce(networkError);

      await expect(mod.signUpWithEmail('net@example.com', 'StrongPassword!123')).rejects.toBe(
        networkError,
      );
    });
  });

  describe('signInWithEmail(email, password)', () => {
    it('returns a user on success (Option A: keep implementation simple)', async () => {
      /**
       * Happy path: the current implementation returns `data.user` from Supabase.
       *
       * Note: This intentionally chooses "Option A" (return user, not session) to keep
       * auth usage simple while the app is changing rapidly. If we later need access/refresh
       * tokens for server-side calls or advanced flows, we can switch the helper to return
       * `data.session` (or `{ user, session }`) and update tests accordingly.
       */
      const mod = await importSupabaseModuleFresh({
        url: 'https://test.supabase.co',
        key: 'test-key',
      });

      const session = { access_token: 'access', refresh_token: 'refresh' };
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValueOnce({
        data: {
          user: { id: 'signed-in-user', email: 'signedin@example.com' },
          session,
        },
        error: null,
      });

      const result = await mod.signInWithEmail('signedin@example.com', 'StrongPassword!123');
      expect(result).toMatchObject({ id: 'signed-in-user', email: 'signedin@example.com' });
    });

    it('throws on invalid credentials (e.g., wrong email/password)', async () => {
      /**
       * Error case: invalid credentials should be returned as a thrown error so the
       * UI can show "Invalid login credentials".
       */
      const mod = await importSupabaseModuleFresh({
        url: 'https://test.supabase.co',
        key: 'test-key',
      });

      const invalidCredsError = Object.assign(new Error('Invalid login credentials'), {
        name: 'AuthApiError',
        status: 400,
      });

      mockSupabaseClient.auth.signInWithPassword.mockResolvedValueOnce({
        data: { user: null, session: null },
        error: invalidCredsError,
      });

      await expect(mod.signInWithEmail('bad@example.com', 'wrong')).rejects.toBe(invalidCredsError);
    });

    it('throws on unconfirmed email (expected auth error)', async () => {
      /**
       * Error case: some Supabase configs require email confirmation; sign-in should
       * surface this error for the UI to display.
       */
      const mod = await importSupabaseModuleFresh({
        url: 'https://test.supabase.co',
        key: 'test-key',
      });

      const unconfirmedError = Object.assign(new Error('Email not confirmed'), {
        name: 'AuthEmailNotConfirmedError',
        status: 400,
      });

      mockSupabaseClient.auth.signInWithPassword.mockResolvedValueOnce({
        data: { user: null, session: null },
        error: unconfirmedError,
      });

      await expect(mod.signInWithEmail('unconfirmed@example.com', 'pw')).rejects.toBe(
        unconfirmedError,
      );
    });

    it('throws a clear error when Supabase is not configured', async () => {
      /**
       * Edge case: sign-in should fail fast when environment is missing.
       */
      const mod = await importSupabaseModuleFresh({ url: '', key: '' });
      await expect(mod.signInWithEmail('test@example.com', 'pw')).rejects.toThrow(
        'Supabase is not configured.',
      );
    });
  });

  describe('signOutUser()', () => {
    it('calls supabase.auth.signOut and resolves on success', async () => {
      /**
       * Happy path: sign-out should call the SDK method and not throw.
       */
      const mod = await importSupabaseModuleFresh({
        url: 'https://test.supabase.co',
        key: 'test-key',
      });

      await expect(mod.signOutUser()).resolves.toBeUndefined();
      expect(mockSupabaseClient.auth.signOut).toHaveBeenCalledTimes(1);
    });

    it('is safe to call when already signed out (idempotent)', async () => {
      /**
       * Edge case: if the user is already signed out, the helper should still
       * resolve successfully (no-op / idempotent behavior).
       */
      const mod = await importSupabaseModuleFresh({
        url: 'https://test.supabase.co',
        key: 'test-key',
      });

      mockSupabaseClient.auth.signOut.mockResolvedValueOnce({ error: null });
      await expect(mod.signOutUser()).resolves.toBeUndefined();
    });

    it('is a no-op when Supabase is not configured', async () => {
      /**
       * Edge case: without a client, signOutUser should do nothing and not throw.
       */
      const mod = await importSupabaseModuleFresh({ url: '', key: '' });
      await expect(mod.signOutUser()).resolves.toBeUndefined();
      expect(mockSupabaseClient.auth.signOut).not.toHaveBeenCalled();
    });
  });
});
