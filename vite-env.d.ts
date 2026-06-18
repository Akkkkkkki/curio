/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY?: string;
  readonly VITE_SUPABASE_SYNC_TIMESTAMPS?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_AI_ENABLED?: string;
  readonly VITE_AI_METADATA_ENABLED?: string;
  readonly VITE_AI_IMAGE_EDIT_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
