import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY as string | undefined;

/**
 * Validates if the Supabase environment is correctly configured.
 */
export const isSupabaseConfigured = (): boolean => {
  return (
    typeof supabaseUrl === 'string' &&
    supabaseUrl.trim().length > 0 &&
    supabaseUrl.startsWith('http') &&
    typeof supabaseKey === 'string' &&
    supabaseKey.trim().length > 0
  );
};

// Initialize the client only if configuration is valid
export const supabase: SupabaseClient | null = isSupabaseConfigured()
  ? createClient(supabaseUrl!, supabaseKey!)
  : null;

/**
 * Ensures we have an authenticated session (no anonymous fallback).
 */
export const ensureAuth = async () => {
  if (!supabase) return null;

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.user || null;
  } catch (e) {
    console.warn('Auth check error:', e);
    return null;
  }
};

export const signUpWithEmail = async (email: string, pass: string) => {
  if (!supabase) throw new Error('Supabase is not configured.');
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.is_anonymous) {
    const { data, error } = await supabase.auth.updateUser({
      email,
      password: pass,
    });
    if (error) throw error;
    return data.user || user;
  }
  const { data, error } = await supabase.auth.signUp({ email, password: pass });
  if (error) throw error;
  return data.user;
};

export const signInWithEmail = async (email: string, pass: string) => {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: pass,
  });
  if (error) throw error;
  return data.user;
};

export const signOutUser = async () => {
  if (!supabase) return;
  await supabase.auth.signOut();
};
