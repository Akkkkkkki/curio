
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Access environment variables with a safe fallback to an empty object
const env = (typeof process !== 'undefined' && process.env) ? process.env : {};

const supabaseUrl = (env as any).VITE_SUPABASE_URL as string | undefined;

// Prioritize the new publishable key as requested, with the old anon key as a secondary fallback
const supabaseKey = (env as any).VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY || (env as any).VITE_SUPABASE_ANON_KEY as string | undefined;

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
 * Ensures a session exists. 
 * If Supabase is missing, it returns a placeholder for "Local Mode".
 */
export const ensureAuth = async () => {
  if (!supabase) return { id: 'local-user', is_anonymous: false, is_local: true };
  
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) return session.user;

    // Default to anonymous sign-in if no session exists to support local-first sync
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) {
      console.warn('Supabase anonymous sign-in failed:', error);
      return { id: 'local-user', is_anonymous: false, is_local: true };
    }
    return data.user;
  } catch (e) {
    console.warn('Auth check error:', e);
    return { id: 'local-user', is_anonymous: false, is_local: true };
  }
};

export const signUpWithEmail = async (email: string, pass: string) => {
  if (!supabase) {
    // Local Mode fallback
    console.info("Supabase not configured. Creating local profile.");
    localStorage.setItem('curio_local_user', JSON.stringify({ email, registeredAt: new Date().toISOString() }));
    return { id: 'local-user', email, is_local: true };
  }
  const { data, error } = await supabase.auth.signUp({ email, password: pass });
  if (error) throw error;
  return data.user;
};

export const signInWithEmail = async (email: string, pass: string) => {
  if (!supabase) {
    const local = localStorage.getItem('curio_local_user');
    if (local) {
        const user = JSON.parse(local);
        if (user.email === email) return { id: 'local-user', email: user.email, is_local: true };
    }
    throw new Error("Local profile not found. Please register first.");
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
  if (error) throw error;
  return data.user;
};

export const signOutUser = async () => {
  if (!supabase) {
    localStorage.removeItem('curio_local_user');
    window.location.reload();
    return;
  }
  await supabase.auth.signOut();
};
