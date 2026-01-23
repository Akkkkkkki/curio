## Title

Harden AI gateway with restricted CORS, auth, and rate limiting

## Labels

- type:enhancement
- area:auth
- severity:p1

## Problem

The AI gateway currently allows wildcard CORS and has no explicit authentication or rate limiting. This increases the risk of abuse, unexpected cost, and security exposure in production.

## Steps to Reproduce

1. Send cross-origin requests to the gateway from any origin.
2. Observe that requests are accepted without auth or throttling.

## Expected

Only approved origins can call the gateway, and requests are authenticated or signed, with rate limiting to protect quota and availability.

## Actual

Requests are allowed from any origin without auth or rate limiting.

## Acceptance Criteria

- CORS is restricted to known origins in production.
- Gateway requires auth/signed requests from the frontend.
- Rate limiting is enforced (configurable thresholds + response messaging).
- Update documentation for required env/config.

## Notes (optional)

This is a production-readiness requirement.
