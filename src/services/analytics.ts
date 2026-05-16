/**
 * Analytics shim — no-op stub for CUR-13.
 *
 * CUR-8 will replace the body of `trackEvent` with a real sink (PostHog,
 * Plausible, etc.). Until then, calls are buffered to the console in dev
 * and silently dropped in production. The event vocabulary is owned by
 * the callers; this module deliberately does no validation so it can ship
 * before the analytics provider decision lands.
 */

export type AnalyticsEvent =
  | 'add_item_saved_with_story'
  | 'add_item_saved_without_story'
  | 'story_prompt_panel_opened'
  | 'story_prompt_inserted'
  | 'story_legacy_banner_action';

export interface AnalyticsPayload {
  [key: string]: string | number | boolean | null | undefined;
}

export const trackEvent = (event: AnalyticsEvent, payload: AnalyticsPayload = {}): void => {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug('[analytics]', event, payload);
  }
  // CUR-8: forward to the real analytics provider here.
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
