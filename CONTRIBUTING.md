# Contributing to NesaRouter

Thanks for helping improve NesaRouter.

## Before You Start

- Use Node.js 22 or newer.
- Copy `.env.example` to `.env` and set a local `NESA_ENCRYPTION_KEY`.
- Do not commit `.env`, SQLite files, provider keys, OAuth tokens, logs, tunnel binaries, or `scripts/tmp-*` debug helpers.
- Keep changes focused. Do not reformat unrelated files.

## Local Development

```powershell
npm ci
Copy-Item .env.example .env
npm run dev
```

The dashboard is available at `http://localhost:20129`.

On first run with the development bootstrap password, change it under **Routing → Password** so the rest of the UI unlocks.

## Checks

Run these before opening a pull request:

```powershell
npm run typecheck
npm test
npm run build
npm run start
# In another terminal:
npm run smoke
```

`npm run smoke` needs the standalone server created by `npm run build`; it exercises routing against local mock providers and cleans up its temporary records. Do not keep `npm run dev` running during the build or smoke run because both use `.next`.

## Pull Requests

1. Explain the user-facing behavior you changed.
2. Add or update focused tests for routing, auth, provider, or API behavior.
3. Update [README](README.md), [CHANGELOG](CHANGELOG.md), [SECURITY](SECURITY.md), or other docs when setup, environment variables, endpoints, providers, or security behavior changes.
4. Keep provider credentials and vendor access tokens out of screenshots, logs, and commits.

## Provider Integrations

Provider adapters must fail closed on missing credentials, redact secrets from API responses and SSR props, and record clear connection errors. Do not claim OAuth or IDE-import support until authorization, token persistence (encrypted), refresh (where applicable), and upstream request paths are implemented and tested.

When returning provider objects to the browser, use the shared redaction helpers — never send live `apiKey`, OAuth tokens, `oauthDeviceClientSecret`, or cache response bodies.

## Auth & secrets

- Admin session verification belongs in route handlers (`requireAdmin` / `verifyAdminToken`); middleware only does Edge-safe cookie shape + HMAC checks.
- Client `/v1` keys must stay encrypted at rest; list APIs expose id + preview only.
- Prefer extending existing store/crypto helpers over inventing parallel secret formats.
- To reset a local admin password during development: `node scripts/reset-admin.mjs` (also clears sessions), then use the bootstrap password from `.env`.
- To clear only a local login lock without changing password or sessions: `npm run unlock-admin`.
