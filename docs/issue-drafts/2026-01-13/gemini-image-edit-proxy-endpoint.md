## Title

Add `/api/gemini/edit-image` proxy endpoint for image background removal and deblur tools

## Labels

- type:enhancement
- area:forms
- severity:p2

## Problem

We want to offer simple, outcome-driven photo tools like “Remove Background” and “Fix Blur”. These require a server-side proxy endpoint to keep API keys off the client and to return image results.

## Steps to Reproduce

N/A (enhancement)

## Expected

The Gemini proxy server exposes a safe endpoint that accepts `{ image, prompt }` and returns a generated image result (base64), suitable for client-side tooling.

## Actual

No `/api/gemini/edit-image` endpoint exists in `server/geminiProxy.js`, and the client has no production implementation for these tools.

## Acceptance Criteria

- Add `POST /api/gemini/edit-image` to the proxy server (with basic validation and error handling).
- Ensure response is consistent and includes the returned image data (base64).
- Add a corresponding client helper in `services/geminiService.ts` (or a small dedicated module) for calling this endpoint.
- Handle failure cases gracefully (timeout / model errors) without blocking item creation.
- Add tests (unit-level) for request/response shape and error handling.

## Notes (optional)

- Source: `docs/DESIGN_REVIEW_image_enhancement_and_theme_strategy.md` (Phase 2).
