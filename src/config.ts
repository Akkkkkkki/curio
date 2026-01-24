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
