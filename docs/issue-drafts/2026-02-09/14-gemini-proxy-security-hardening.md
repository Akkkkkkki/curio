## Title

Gemini proxy server needs security hardening: missing API key validation and fragile env parsing

## Labels

- type:bug
- severity:p1

## Problem

`server/geminiProxy.js` has several security concerns:

1. **No GEMINI_API_KEY validation at startup (line 223-224):** Server starts and accepts requests even without a valid API key, failing only when proxying to Gemini. Should fail fast at startup.

2. **Fragile custom .env parser (lines 14-33):** Reinvents `dotenv` with incomplete handling:
   - No support for values containing `=` inside quotes
   - No multiline value support
   - No escaped quote support
   - Should use the `dotenv` package

3. **Silent CORS misconfiguration (lines 104-107):** `CORS_ORIGINS=''` silently produces empty allowed origins array. Should warn or fail.

4. **Hardcoded JWT algorithm (line 195):** `algorithms: ['HS256']` prevents future migration to RS256.

5. **Error messages leak implementation details (lines 500-514):** Messages reference model names and API configuration details.

6. **No request body validation (line 261):** `req.body` destructured without schema validation. Malformed requests pass through to Gemini API.

7. **No file size validation before cloud upload (db.ts lines 706-713):** Assets uploaded to Supabase storage without size checks.

## Expected

- API key validated at startup
- Use `dotenv` for env parsing
- Request body validated with schema
- Error messages sanitized for external users

## Actual

Server starts without valid config and leaks implementation details in errors.

## Acceptance Criteria

- [ ] Server refuses to start without valid GEMINI_API_KEY
- [ ] Replace custom env parser with `dotenv`
- [ ] Add request body schema validation (at minimum: required fields, size limits)
- [ ] Sanitize error messages to not reveal model names or API details
- [ ] Log warnings for misconfigured CORS_ORIGINS
- [ ] Add asset size limit validation before upload
