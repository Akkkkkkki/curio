import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

export const isSupabaseConfigured = (): boolean => {
  return !!supabaseUrl && !!supabaseKey && supabaseUrl.startsWith('http');
};

// Only initialize if configuration is valid to avoid "supabaseUrl is required" error
export const supabase: SupabaseClient = isSupabaseConfigured()
  ? createClient(supabaseUrl!, supabaseKey!)
  : (null as any);
