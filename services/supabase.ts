import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Use process.env instead of import.meta.env to resolve TypeScript 'Property env does not exist on type ImportMeta' errors.
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
 * Ensures the user is authenticated (anonymously) to satisfy Row Level Security (RLS) policies.
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
