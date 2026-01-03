import { vi } from 'vitest';

/**
 * Mock Supabase client for testing
 * Used in Phase 1 (auth tests), Phase 2 (db operations), and Phase 3 (hooks)
 */

export const mockSupabaseClient = {
  auth: {
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    getSession: vi.fn(),
    getUser: vi.fn(),
    updateUser: vi.fn(),
    onAuthStateChange: vi.fn(),
  },
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn(),
  })),
  storage: {
    from: vi.fn(() => ({
      upload: vi.fn(),
      download: vi.fn(),
      getPublicUrl: vi.fn(),
      remove: vi.fn(),
    })),
  },
};

/**
 * Reset all mocks between tests
 */
export function resetSupabaseMocks() {
  vi.clearAllMocks();

  // Reset default behaviors
  mockSupabaseClient.auth.signUp.mockResolvedValue({
    data: {
      user: { id: 'test-user-id', email: 'test@example.com' },
      session: { access_token: 'test-token', refresh_token: 'test-refresh' },
    },
    error: null,
  });

  mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
    data: {
      user: { id: 'test-user-id', email: 'test@example.com' },
      session: { access_token: 'test-token', refresh_token: 'test-refresh' },
    },
    error: null,
  });

  mockSupabaseClient.auth.signOut.mockResolvedValue({
    error: null,
  });

  mockSupabaseClient.auth.getSession.mockResolvedValue({
    data: { session: null },
    error: null,
  });

  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: null },
    error: null,
  });

  mockSupabaseClient.auth.updateUser.mockResolvedValue({
    data: { user: { id: 'test-user-id', email: 'test@example.com' } },
    error: null,
  });

  mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  });
}

/**
 * Mock factory for creating test sessions
 */
export function createMockSession(overrides = {}) {
  return {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id: 'test-user-id',
      email: 'test@example.com',
      ...overrides,
    },
  };
}

/**
 * Mock factory for creating test users
 */
export function createMockUser(overrides = {}) {
  return {
    id: 'test-user-id',
    email: 'test@example.com',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}
