import { beforeEach, describe, expect, it, vi } from 'vitest';
import { track } from '@vercel/analytics';
import { getAnalyticsPlatform, trackEvent } from '@/services/analytics';

vi.mock('@vercel/analytics', () => ({
  track: vi.fn(),
}));

describe('analytics service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (window as Window & { Capacitor?: unknown }).Capacitor;
  });

  it('forwards typed events to Vercel Analytics with the web platform', () => {
    trackEvent('item_saved', {
      mode: 'single',
      story_length_bucket: '1-50',
      has_story: true,
      has_photo: false,
    });

    expect(track).toHaveBeenCalledWith('item_saved', {
      mode: 'single',
      story_length_bucket: '1-50',
      has_story: true,
      has_photo: false,
      platform: 'web',
    });
  });

  it('uses the Capacitor platform so web and native shells share one taxonomy', () => {
    (window as Window & { Capacitor?: { getPlatform: () => string } }).Capacitor = {
      getPlatform: () => 'android',
    };

    expect(getAnalyticsPlatform()).toBe('android');

    trackEvent('share_initiated', {
      surface: 'item_card',
    });

    expect(track).toHaveBeenCalledWith('share_initiated', {
      surface: 'item_card',
      platform: 'android',
    });
  });

  it('falls back to web for unknown native platform values', () => {
    (window as Window & { Capacitor?: { getPlatform: () => string } }).Capacitor = {
      getPlatform: () => 'desktop',
    };

    expect(getAnalyticsPlatform()).toBe('web');
  });
});
