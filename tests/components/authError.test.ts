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

  it('maps an existing-account error to friendly localized copy', () => {
    expect(mapAuthErrorMessage('User already registered', makeT('en'))).toBe(
      translations.en.authEmailInUse,
    );
    expect(mapAuthErrorMessage('Email already exists', makeT('zh'))).toBe(
      translations.zh.authEmailInUse,
    );
  });

  it('maps an unconfirmed-email error to friendly localized copy', () => {
    expect(mapAuthErrorMessage('Email not confirmed', makeT('en'))).toBe(
      translations.en.authEmailNotConfirmed,
    );
    expect(mapAuthErrorMessage('Email not confirmed', makeT('zh'))).toBe(
      translations.zh.authEmailNotConfirmed,
    );
  });

  it('maps a rate-limit error to friendly localized copy', () => {
    expect(mapAuthErrorMessage('Email rate limit exceeded', makeT('en'))).toBe(
      translations.en.authTooManyRequests,
    );
    expect(mapAuthErrorMessage('Email rate limit exceeded', makeT('zh'))).toBe(
      translations.zh.authTooManyRequests,
    );
  });

  it('never surfaces raw exception text — unrecognized errors fall back to generic copy', () => {
    // A malformed auth response can throw a bare JSON parse error; the user must
    // never see it (see #375). Both locales get the generic authFailed copy.
    const parseError = `Unexpected token '', "�..." is not valid JSON`;
    expect(mapAuthErrorMessage(parseError, makeT('en'))).toBe(translations.en.authFailed);
    expect(mapAuthErrorMessage(parseError, makeT('zh'))).toBe(translations.zh.authFailed);
    expect(mapAuthErrorMessage(parseError, makeT('en'))).not.toContain('JSON');
  });

  it('falls back to the generic authFailed copy for an empty error', () => {
    expect(mapAuthErrorMessage('', makeT('en'))).toBe(translations.en.authFailed);
  });
});
