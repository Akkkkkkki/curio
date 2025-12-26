
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = (process.env as any).VITE_SUPABASE_URL as string | undefined;
const supabaseKey =
  ((process.env as any).VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY as string | undefined) ??
  ((process.env as any).VITE_SUPABASE_ANON_KEY as string | undefined);

export const isSupabaseConfigured = (): boolean => {
  return !!supabaseUrl && !!supabaseKey && supabaseUrl.startsWith('http');
};

export const supabase: SupabaseClient | null = isSupabaseConfigured()
  ? createClient(supabaseUrl!, supabaseKey!)
  : null;

/**
 * Ensures a session exists (anonymous if necessary)
 */
export const ensureAuth = async () => {
  if (!supabase) return null;
  
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) return session.user;

    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) {
      console.warn('Supabase anonymous sign-in failed:', error);
      return null;
    }
    return data.user;
  } catch (e) {
    console.warn('Auth check error:', e);
    return null;
  }
};

export const signUpWithEmail = async (email: string, pass: string) => {
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase.auth.signUp({ email, password: pass });
  if (error) throw error;
  return data.user;
};

export const signInWithEmail = async (email: string, pass: string) => {
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
  if (error) throw error;
  return data.user;
};

export const signOutUser = async () => {
  if (!supabase) return;
  await supabase.auth.signOut();
};
