const parseEnvNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const STORAGE_QUOTA_WARNING_THRESHOLD_BYTES = parseEnvNumber(
  import.meta.env.VITE_STORAGE_QUOTA_WARNING_THRESHOLD_BYTES,
  50 * 1024 * 1024,
);

export const STORAGE_QUOTA_WARNING_THRESHOLD_RATIO = parseEnvNumber(
  import.meta.env.VITE_STORAGE_QUOTA_WARNING_THRESHOLD_RATIO,
  0.1,
);

export const STORAGE_QUOTA_CHECK_INTERVAL_MS = parseEnvNumber(
  import.meta.env.VITE_STORAGE_QUOTA_CHECK_INTERVAL_MS,
  10 * 60 * 1000,
);

export const getEnvValidationErrors = (): string[] => {
  const errors: string[] = [];
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
  if (!supabaseUrl || !supabaseUrl.trim().startsWith('http')) {
    errors.push('VITE_SUPABASE_URL');
  }
  if (!supabaseKey || !supabaseKey.trim()) {
    errors.push('VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY');
  }

  const aiEnabled =
    import.meta.env.VITE_AI_ENABLED === 'true' ||
    import.meta.env.VITE_AI_IMAGE_EDIT_ENABLED === 'true';
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
  if (import.meta.env.DEV && aiEnabled && (!apiBaseUrl || !apiBaseUrl.trim())) {
    errors.push('VITE_API_BASE_URL');
  }

  return errors;
};
