# Changelog

All notable changes to NesaRouter are documented in this file.

## 0.1.0

### Features

- OpenAI-compatible local gateway (`/v1`) with routing modes, budget guard, cache, combos, and model aliases.
- Provider catalog for API-key providers plus OAuth / account presets:
  - Claude (Anthropic subscription), ChatGPT (Codex), Gemini CLI, GitHub Copilot, Kiro (AWS Builder ID), Antigravity, Cursor IDE import.
- Token savers: Caveman (default lite) and full RTK tool-result filters; optional Headroom / pxpipe hooks.
- Dashboard for providers, keys, routing, usage, MCP, tunnel (Cloudflare / Tailscale), Headroom, and CLI helpers.
- Docker Compose + GHCR publish path for tagged releases.

### Security

- AES-256-GCM encryption for provider secrets, OAuth tokens, client API keys, and OAuth pending / device-flow secrets.
- Bootstrap admin password must be changed before the full dashboard unlocks; admin APIs return `403` until then.
- Random, HMAC-signed, revocable admin sessions (logout and password-change revoke).
- Middleware validates session cookie shape, expiry, and HMAC; handlers confirm the session hash in SQLite.
- Admin APIs and SSR redact secrets (including `oauthDeviceClientSecret` / machine id) and omit cache response bodies.
- Empty client key list locks `/v1`; production requires strong `NESA_ENCRYPTION_KEY` and `NESA_ADMIN_PASSWORD`.
- Timing-safe OAuth login state comparison; SSRF controls on `/v1/web/fetch`.

### Docs

- README, SECURITY, PRODUCT, DESIGN, CONTRIBUTING, `.env.example`, and THIRD_PARTY_NOTICES updated for the above.
