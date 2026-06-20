import { track } from '@vercel/analytics';

export type AnalyticsEvent =
  | 'item_creation_started'
  | 'item_saved'
  | 'item_edited'
  | 'sync_failed'
  | 'upload_failed'
  | 'share_initiated'
  | 'share_completed'
  | 'share_failed'
  | 'story_prompt_panel_opened'
  | 'story_prompt_inserted'
  | 'story_legacy_banner_action';

export interface AnalyticsPayload {
  [key: string]: string | number | boolean | null | undefined;
}

export type AnalyticsPlatform = 'web' | 'android' | 'ios';

type CapacitorWindow = Window & {
  Capacitor?: {
    getPlatform?: () => string;
  };
};

export const getAnalyticsPlatform = (): AnalyticsPlatform => {
  if (typeof window === 'undefined') return 'web';
  const platform = (window as CapacitorWindow).Capacitor?.getPlatform?.();
  if (platform === 'android' || platform === 'ios') return platform;
  return 'web';
};

export const trackEvent = (event: AnalyticsEvent, payload: AnalyticsPayload = {}): void => {
  const properties = {
    ...payload,
    platform: getAnalyticsPlatform(),
  };

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug('[analytics]', event, properties);
  }

  track(event, properties);
};

/**
 * Bucket a story's length into one of the analytics buckets defined in the
 * CUR-13 design spec §5.1.
 */
export const storyLengthBucket = (length: number): '0' | '1-50' | '51-200' | '201-500' | '500+' => {
  if (length === 0) return '0';
  if (length <= 50) return '1-50';
  if (length <= 200) return '51-200';
  if (length <= 500) return '201-500';
  return '500+';
};
