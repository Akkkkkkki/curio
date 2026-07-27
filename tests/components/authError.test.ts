import { describe, it, expect } from 'vitest';
import { mapAuthErrorMessage } from '@/components/AuthModal';
import { translations, TranslationKey } from '@/i18n';

// Build a minimal translate function backed by the real string tables so the
// test asserts against the copy users actually see, in both locales.
const makeT =
  (lang: 'en' | 'zh') =>
  (key: TranslationKey | (string & {})): string =>
    (translations[lang] as Record<string, string>)[key as string] ?? (key as string);

describe('mapAuthErrorMessage', () => {
  it('maps a raw "Failed to fetch" network error to friendly localized copy', () => {
    expect(mapAuthErrorMessage('Failed to fetch', makeT('en'))).toBe(
      translations.en.authNetworkError,
    );
    expect(mapAuthErrorMessage('Failed to fetch', makeT('zh'))).toBe(
      translations.zh.authNetworkError,
    );
  });

  it('maps other network phrasings (Load failed / NetworkError / Network request failed) to the network message', () => {
    expect(mapAuthErrorMessage('Load failed', makeT('en'))).toBe(translations.en.authNetworkError);
    expect(
      mapAuthErrorMessage('NetworkError when attempting to fetch resource.', makeT('en')),
    ).toBe(translations.en.authNetworkError);
    // Supabase transport failures throw an Error("Network request failed")
    // (see tests/unit/services/supabase.test.ts), common on mobile clients.
    expect(mapAuthErrorMessage('Network request failed', makeT('en'))).toBe(
      translations.en.authNetworkError,
    );
    expect(mapAuthErrorMessage('Network request failed', makeT('zh'))).toBe(
      translations.zh.authNetworkError,
    );
  });

  it('maps Supabase "Invalid login credentials" to friendly localized copy', () => {
    expect(mapAuthErrorMessage('Invalid login credentials', makeT('en'))).toBe(
      translations.en.authInvalidCredentials,
    );
    expect(mapAuthErrorMessage('Invalid login credentials', makeT('zh'))).toBe(
      translations.zh.authInvalidCredentials,
    );
  });

  it('falls back to the raw message for unrecognized non-empty errors', () => {
    expect(mapAuthErrorMessage('Email rate limit exceeded', makeT('en'))).toBe(
      'Email rate limit exceeded',
    );
  });

  it('falls back to the generic authFailed copy for an empty error', () => {
    expect(mapAuthErrorMessage('', makeT('en'))).toBe(translations.en.authFailed);
  });
});
