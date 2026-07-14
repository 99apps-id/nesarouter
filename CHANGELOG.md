# Changelog

All notable changes to NesaRouter are documented in this file.

## 0.1.19 - 2026-07-14

### Added

- Dashboard **i18n**: 20 locales (English default) including Indonesian, Malay, Chinese (Simplified/Traditional), Japanese, Korean, Arabic (RTL), Russian, Spanish, French, German, Portuguese, Hindi, Thai, Vietnamese, Turkish, Italian, Dutch, and Polish. Language picker in the top bar.
- CLI **Apply / Patch** on this machine (merge into existing settings, like 9router), with status, Reset, existing client-key reuse, and optional endpoint override.
- Combos can be **edited** in place (stable id); Manual provider and Provider strategy use full-width rows; daily budget shows `$` + `USD`.

### Fixes

- Claude Code gateway override uses `ANTHROPIC_AUTH_TOKEN` + merge into `~/.claude/settings.json` instead of wiping the file / wrong auth var.
- CLI menu default copy is English (no hardcoded Indonesian); API helper errors for CLI tools are English.

## 0.1.18 - 2026-07-14

### Fixes

- Routing **Manual provider** is selectable without first flipping Mode (picking a provider enables Manual); budget heuristics no longer override Manual mode.
- Xiaomi MiMo auth: send both `Authorization: Bearer` and `api-key` headers; clear error when `sk-` / `tp-` keys are paired with the wrong base URL; Token Plan CN preset + `mimo` / `xmtp` prefixes.
- `npm run unlock-admin` prints the absolute data directory and fails clearly when the SQLite file is missing (helps catch a polluted `DATA_DIR`).

## 0.1.14 - 2026-07-14

### Added

- `npm run unlock-admin` clears an accidental dashboard login lock without resetting the admin password, sessions, provider credentials, or router data. The script prints the absolute data directory so a polluted `DATA_DIR` (e.g. smoke test folder) is obvious.

## 0.1.13 - 2026-07-14

### Fixes

- Dashboard middleware now builds unauthenticated login redirects from `NESA_PUBLIC_URL` or reverse-proxy headers, rather than the internal upstream URL. This prevents VPS deployments from redirecting visitors to `localhost:20129`.

## 0.1.12 - 2026-07-14

### Features

- **Multi-account OAuth** per provider: add/remove accounts, pick the active one, round-robin across healthy accounts, and skip accounts with fatal auth/quota errors.
- Provider detail shows **live OAuth account health** (connected vs error) with lightweight status polling and probe.
- **OpenCode Free** executor (`type: "opencode"`) talks to OpenCode Zen with keyless `Bearer public` (replacing the broken Kiro-bound preset path). Model prefixes: `oc/`, `opencode/`.
- Keyless providers are treated as credentialed for routing / Test when no API key is required.
- Usage **live map** layout: NesaRouter hub centered, providers spaced on a growing ellipse (9router-style), including dual-ring for large catalogs.
- The live map now polls real usage logs and animates only the provider that handled a recent request; idle connections stay still.

### Fixes

- OpenCode Free no longer routes through the Kiro/AWS executor (403 / “not connected”).
- Live map no longer collapses provider nodes into a pile or leaves the hub in the corner after CSS/positioning regressions.
- Standalone startup now copies the Next server manifests required by middleware, preventing production endpoints from returning `500` after a successful start.
- Smoke cleanup closes mock-provider keep-alive connections, so CI completes after end-to-end routing checks.

## 0.1.11

### Fixes

- Sidebar and update banner no longer show `v0.0.0` on Docker/standalone installs: version is baked via webpack `DefinePlugin`, runtime `NESA_APP_VERSION`, and broader `package.json` discovery from the standalone server path.
- Docker releases now pass the release version into the image and refresh the `latest` tag on each tagged release.

## 0.1.10

### Fixes

- ChatGPT/Codex OAuth matches 9router: after redirect to `localhost:1455`, paste the **full callback URL** from the address bar and Save (parses `code` + `state`).

## 0.1.9

### Fixes

- Report the real app version in the dashboard/update banner on standalone and Docker installs (no more `v0.0.0`). Version is baked at build via `NESA_APP_VERSION`, with start-script and `package.json` fallbacks.

## 0.1.8

### Fixes

- Stop Edge middleware from rejecting `/api/*` with false "Admin authentication required" when the session cookie is valid for SSR pages (common behind reverse proxies).
- `requireAdmin` reads the session via `cookies()` (same as AppShell) with Cookie-header fallback.
- Provider detail admin calls use `credentials: "include"`.

## 0.1.7

### Fixes

- Teach webpack to rewrite `node:` imports (e.g. `node:crypto`) so Edge/middleware builds no longer hit `UnhandledSchemeError`.

## 0.1.6

### Fixes

- Remove SQLite/`node:*` import chain from `publicUrl` so Edge middleware builds cleanly again (fixes client "Application error" / failed `next build` on v0.1.5).
- Dashboard public base URL is still applied from Routing settings / `NESA_PUBLIC_URL` without pulling the store into middleware.

## 0.1.5

### Fixes

- Middleware login redirect uses `NESA_PUBLIC_URL` / `X-Forwarded-*` / public Host so unauthenticated users are sent to the real domain instead of `localhost:20129`.

## 0.1.4

### Fixes

- Admin sessions work behind reverse proxies: Edge middleware no longer HMAC-rejects valid cookies when `NESA_ENCRYPTION_KEY` is missing from the Edge runtime; Node handlers still fully verify sessions in SQLite.
- Cookie `Secure` follows `X-Forwarded-Proto` (override with `NESA_COOKIE_SECURE`); password change reloads so the new session sticks.
- OAuth provider Connect opens the vendor login in a new tab (9router-style) with paste-code / loopback wait on the dashboard.
- Public base URL via `NESA_PUBLIC_URL` or **Routing → Domain** so OAuth and post-login redirects return to your domain instead of localhost.
- Claude / Gemini use vendor paste-code flows; ChatGPT/Codex and Antigravity use fixed localhost loopback listeners.

## 0.1.3

### Fixes

- Login explains when the bootstrap password comes from `NESA_ADMIN_PASSWORD` in `.env` (without revealing the value), so VPS installs are less confusing when `nesa123456` is not shown.
- Document installer/agent guidance: do not silently randomize the admin password (`AGENTS.md`, README).

## 0.1.2

### Fixes

- `scripts/start-standalone.mjs` auto-detects nested Next standalone output (e.g. `.next/standalone/nesarouter/server.js`) so VPS/Docker starts no longer miss `server.js`.

## 0.1.1

### Features

- Provider prefix model routing (9router-style), e.g. `cx/gpt-5.5`, `cc/claude-sonnet-4`, or `oauth-chatgpt/gpt-5.5`. Prefixed ids appear in `/v1/models`.
- Dashboard update banner checks GitHub Releases for a newer tag than the local `package.json` version (cached 6h; disable with `NESA_UPDATE_CHECK=false`).

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
