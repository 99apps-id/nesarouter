# Changelog

All notable changes to NesaRouter are documented in this file.

## Unreleased

## 0.1.47 - 2026-07-24

### Added

- Strengthen dashboard web metadata: a `%s · NesaRouter` title template, explicit application/description, OpenGraph/Twitter cards, an `apple-touch-icon`, and a web app manifest (`/manifest.webmanifest`) so installs and link previews use the official N mark.
- Generate 192/512 PNG app icons and a 180px Apple touch icon from the OSS NesaRouter N mark.

### Changed

- Move all provider brand marks from `public/providers/` to `public/icons/` and resolve every reference (provider identity, tests, E2E selector, and the README attribution link) to the new path.

### Fixed

- Keep temporary device-flow IDs separate from OAuth account IDs so Kiro and other device OAuth providers can add a second account successfully.
- Read and write the admin password hash as a raw value so JSON-persisted legacy hashes migrate cleanly instead of double-encoding.

## 0.1.46 - 2026-07-23

### Added

- Add NesaRouter as an OpenAI-compatible provider preset with its official N mark, public `/v1` endpoint, dynamic model loading, and `nr` / `nesa` routing prefixes.
- Add enforceable Vitest coverage thresholds and a Chromium E2E flow covering admin login, bootstrap-password change, and the provider catalog.

### Security

- Bound the public admin-login JSON body and reject malformed JSON without consuming a password attempt.
- Exclude local agent, test, coverage, and report directories from Git and Docker build contexts.
- Pin a non-vulnerable Sharp release used by the Next.js image pipeline.

### Fixed

- Prevent the Cloudflare quick-tunnel watchdog from spawning a new `cloudflared` process every minute while the managed tunnel is healthy, and serialize recovery attempts after a real exit.
- Convert malformed successful upstream JSON into a structured 502 provider error instead of leaking a generic parser failure.
- Prevent overlapping Live Routing refreshes and reduce Live Routing / Usage polling pressure to ten-second intervals.
- Install Headroom into a persistent, non-root virtual environment and include Python venv support in the production Docker image.

### Validation

- ESLint, TypeScript validation, 336 unit tests across 62 files, coverage thresholds, Chromium E2E, standalone production build/smoke, dependency audit, and OSS public-boundary checks pass.

## 0.1.45 - 2026-07-22

### Security

- Enforce JSON request limits while reading chunked AI, MCP, search, and web-fetch bodies instead of trusting `Content-Length` alone.
- Treat malformed persisted OAuth expiry timestamps as expired so broken credentials cannot remain routable indefinitely.

### Fixed

- Keep multi-key quota, cooldown, rotation, and usage indexes aligned after blank or duplicate credentials are removed.
- Compact duplicate OAuth account slots and select the true latest successful provider for global and combo round-robin routing, even when usage rows are unsorted.
- Sanitize malformed or negative upstream token counts before they reach budgets, quotas, costs, or SQLite usage records.
- Force usage reporting on OpenAI-compatible, OpenRouter, OpenCode, and GitHub Copilot streams so clients cannot accidentally disable accurate ledger accounting.
- Deep-merge nested router state, reject ambiguous bulk combo/alias updates, and prevent partial state saves from erasing media, token-saver, or CLI settings.
- Remove TOML provider tables safely when arrays contain brackets, and reject fractional/out-of-range Headroom proxy ports.

### Validation

- ESLint, TypeScript validation, 326 unit tests across 59 files, dependency audit, OSS public-boundary check, and production build pass.

## 0.1.44 - 2026-07-21

### Fixed

- Stop Live Routing from calling `Date.now()` during the first render so server HTML and browser hydration stay identical.
- Render request timestamps in a fixed UTC clock to avoid timezone hydration mismatches.

## 0.1.43 - 2026-07-21

### Fixed

- Prevent client-side Application errors on Usage by formatting numbers and times with a fixed `en-US` locale so server HTML and browser hydration always match.
- Allow Cloudflare Web Analytics beacon under production Content-Security-Policy when the site is served behind Cloudflare.

## 0.1.42 - 2026-07-21

### Fixed

- Remove a stale unit test that referenced a non-exported helper and blocked TypeScript validation of v0.1.41.

## 0.1.41 - 2026-07-21

### Changed

- Redesign Live Routing animations with hub flash/waves, comet trails on the selected path, and a stronger heartbeat on providers with recent traffic.

### Fixed

- Allow Next.js Fast Refresh under Content-Security-Policy in development by permitting `unsafe-eval` only when `NODE_ENV` is not production.
- Stabilize usage number formatting with an explicit `en-US` locale so theme switches no longer trip hydration mismatches.

### Validation

- Local OSS preview of language/theme toggles and live-map animations; production CSP remains without `unsafe-eval`.

## 0.1.40 - 2026-07-20

### Security

- Stop routing expired OAuth credentials when refresh fails, sanitize upstream OAuth errors, reject stale account targets, isolate concurrent multi-account device flows, and clean up expired pending authorization state.
- Retain OAuth callback state until token exchange and encrypted persistence succeed, close completed loopback listeners, and prevent iFlow credential-bearing URLs from appearing in application errors or logs.

### Fixed

- Preserve function declarations, forced tool choice, assistant tool calls, tool results, streamed arguments, and tool-call finish reasons across OpenAI Chat, Responses, Anthropic Messages, Gemini, Cursor, Kiro, Vertex, GitHub Copilot, OpenRouter, and OpenCode adapters.
- Return a real JSON chat completion when `stream:false` is requested from a streaming upstream, without corrupting usage accounting, cache safety, or concurrency tickets.
- Keep agent continuations on the same upstream account/provider, recognize tool-only continuation turns, and exclude providers that cannot support the requested tool protocol.
- Validate Cursor, OpenRouter, and OpenCode with representative inference requests so the dashboard no longer reports false-positive connections.
- Preserve provider-specific tool names and arguments through Cursor/Gemini continuations, strip private router fields before strict upstream calls, and harden incremental SSE/protobuf argument handling against duplicate payloads.

### Validation

- 313 unit tests across 57 files, TypeScript validation, dependency audit, OSS public-boundary check, production build, and OSS/SaaS VPS health checks pass.

## 0.1.39 - 2026-07-20

### Fixed

- Route requests carrying `tools` or `tool_choice` only through upstream adapters that support function calling, while allowing an explicit per-provider capability override.
- Generate Hermes and OpenClaw configuration with agent context and tool-capability metadata so patched clients can expose file and execution tools reliably.
- Make the Hermes/OpenClaw connection test require a real, harmless function-call response instead of reporting success after an ordinary chat response.

### Validation

- 287 unit tests across 55 files, TypeScript validation, OSS public-boundary check, production build, VPS health check, and internal/public function-call probes pass.

## 0.1.38 - 2026-07-18

### Fixed

- Redesign Live Routing as a responsive, pannable, auto-fitting provider topology with curved directional flow, bounded provider logos, and reliable zoom controls.
- Show only routable providers, keep active provider topology visible before the first request, prevent dense provider nodes and dashboard tables from overlapping, and consolidate the request inspector, provider fleet, and event stream into a responsive operator workspace.
- Filter live events before applying the event limit and reconcile provider activity by stable ID or provider name so fleet counters remain accurate after imports or provider renames.
- Anchor standalone `DATA_DIR` to the project root, support atomic `.next-new` builds, and copy runtime assets into the dist directory embedded by Next.js.
- Never redisplay bootstrap-password guidance after an admin password hash exists, and strip private `_nesa*` request metadata before forwarding requests to strict OpenAI-compatible upstreams.
- Keep the active navigation item visible on compact layouts and prevent local visual-audit/build artifacts from entering public releases.

### Validation

- 285 unit tests across 55 files, TypeScript validation, OSS public-boundary check, production build, isolated end-to-end smoke test, and runtime health/auth-boundary checks pass.

## 0.1.37 - 2026-07-17

### Fixed

- Route CLI connection tests through NesaRouter's internal loopback endpoint so public-tunnel hairpin failures no longer produce false negatives.
- Generate current Qwen Code provider settings, make unsupported Gemini CLI and Continue integrations explicitly manual, and correct Roo's OpenAI-compatible setup guidance.
- Merge Codex, Hermes, DeepSeek TUI, and jcode configuration safely without erasing unrelated user settings; persist Bash environment variables for future shells.
- Reject malformed existing JSON instead of overwriting it, return actionable permission errors, and fully remove NesaRouter references during CLI reset.
- Report executable detection, configuration presence, and credential readiness separately so a config directory alone is not shown as a connected CLI.

### Validation

- 275 unit tests across 53 files, TypeScript validation, OSS public-boundary check, and production build pass.

## 0.1.36 - 2026-07-17

### Security

- Require client authentication before parsing OpenAI-compatible request bodies and reject oversized JSON/audio payloads.
- Trust forwarded host, protocol, and client-IP headers only when `NESA_TRUST_PROXY=true`; cap admin session lifetime and strengthen login throttling defaults.
- Verify downloaded cloudflared assets with the SHA-256 digest published by GitHub Releases, validate managed process identity before signalling a PID, and harden local data permissions on POSIX.
- Add browser security headers, isolate external tunnel links, redact local credential paths, and avoid redisclosing existing CLI API keys.
- Bound MCP sessions and RPC payloads, close failed child-process streams, and emit valid multiline SSE framing.

### Fixed

- Preserve concurrently-created API keys and usage records when saving router settings instead of rewriting unrelated SQLite tables from a stale snapshot.
- Start and stop Headroom/cloudflared safely across Windows, Linux, and macOS without treating a reused PID as a managed process.
- Stream SOCKS responses, encode multipart uploads correctly, apply upstream timeouts, and propagate client cancellation to provider requests.
- Coalesce concurrent OAuth token refreshes per account and correct cache keys, output-token estimates, quota accounting, and failed/cancelled stream spend accounting.
- Handle CRLF and bounded SSE buffers, parallel Claude tool calls, and Responses API function-call input/output translation.

### Validation

- 269 unit tests across 53 files, TypeScript validation, OSS public-boundary check, production build, and cloudflared release-digest availability check pass.

## 0.1.35 - 2026-07-17

### Security

- **Web fetch SSRF**: pin outbound connections to the DNS address that passed validation and block hexadecimal IPv4-mapped IPv6 forms, closing DNS-rebinding and address-encoding bypasses.
- **Public/private boundary**: CI rejects private SaaS source paths, environment markers, migrations, tests, and PostgreSQL dependencies from the OSS repository.

### Fixed

- **Headroom process**: start through the installed Python module when the CLI launcher is outside `PATH`; include pip user-script locations and report spawn/stop failures correctly.
- **Cloudflare Tunnel**: Restart now applies changed ports; startup timeout kills the child; old-process exit events no longer clear a newer PID/process; intentional kills are scoped per child.
- **Tailscale**: never report a public Funnel as private Serve; verify reset before reporting Disable success.
- **Concurrency queue**: cancel queued upstream work when the client disconnects instead of calling a provider later.
- **Settings API**: reject malformed JSON, unknown fields, invalid URLs/enums, negative limits, and malformed combo/alias/tool settings.
- **Dashboard actions**: preserve unsaved Headroom/Tunnel drafts during polling and show backend/network failures for Stop, Disable, Delete, Revoke, alias, and routing actions.
- **Test isolation**: use a temporary SQLite database per Vitest worker and replace the MCP fixed sleep with a bounded readiness assertion.

### Validation

- 263 unit tests, TypeScript validation, the OSS boundary check, production build, and browser navigation smoke pass.

## 0.1.34 - 2026-07-16

### Fixed

- **Live map**: keep recent upstream traffic visible longer and animate every provider with real recent traffic, not only the latest request.

## 0.1.33 - 2026-07-15

### Fixed

- Move `authorizeMetrics` out of the Next.js route module so `next build` accepts `/api/metrics` (v0.1.32 CI build failure).

## 0.1.32 - 2026-07-15

### Added

- **CLI Apply / Patch**: Hermes, Codex CLI, DeepSeek TUI, and jcode now patch local config files (with status detection + Reset); `.env` patches upsert keys instead of wiping the file.

### Fixed

- **OpenCode Free**: catalog and routing stay on free-tier models only, even when a Zen API key is set; paid model ids remap to `big-pickle`.
- **OpenCode / DeepSeek**: disable default DeepSeek thinking on Zen chat unless the client sets thinking or the model is reasoner/R1/thinking (avoids `reasoning_content` 400s).
- **`cleanApiKey`**: tolerate missing/undefined keys.

### Security / ops

- **`/api/metrics`**: deny-by-default — set `NESA_METRICS_TOKEN` to scrape (Bearer or `?token=`).
- **`/api/health`**: reports `version` from `package.json` via `readAppVersion()`; returns HTTP 503 when DB readiness fails.

## 0.1.31 - 2026-07-15

### Added

- **Endpoint box**: sidebar endpoint URL can be shown or hidden; preference persists in the browser.

## 0.1.30 - 2026-07-15

### Fixed

- Align smoke / `unlock-admin` / `reset-admin` with per-client `loginLock:*` keys and the 5-attempt lockout threshold (CI smoke was failing on v0.1.29).

## 0.1.29 - 2026-07-15

### Fixed

- **GitHub Copilot OAuth**: apply fresh Copilot session tokens to `oauthCopilotToken` (not `oauthAccessToken`) so chat/combo routing works after Connect.
- **OAuth credential wipe**: preserve encrypted OAuth account secrets when the admin UI saves redacted `********` placeholders; revive tokens / Cursor machine id from primary columns.
- **OAuth failure isolation**: account-level upstream failures no longer put the whole provider into cooldown while soft probes still show Connected.
- **Connection badges**: OAuth cards derive Connected from routable accounts (not stale `connection_status` alone).
- **Cursor routability**: require machine id before an account is considered routable.

### Added

- **Sticky provider routing**: keep the same upstream provider across agent tool-call follow-ups (namespaced per client API key; does not reorder combo `fallback` chains).
- **Combo readiness UI**: show ready/skipped + reason per provider in a combo chain.
- **Usage skip hints**: surface skipped-provider counts in usage/recent lists; expose `x-nesa-skipped` on responses.
- **CLI ping**: verify via `/v1/models` + chat; allow testing with an existing `keyId`.
- **Port guard**: `npm run dev` / `start` fail fast with PID help when port 20129 is already in use.

### Security

- Login lockouts are isolated per client (IP/UA hash) with a clearer attempt threshold.
- MCP stdio bridge is scoped per SSE session with stdout buffer/message size limits.
- OAuth loopback success/error HTML escapes provider-controlled values.
- Combo id/name uniqueness and prefer exact combo id over conflicting name.

## 0.1.28 - 2026-07-15

### Fixed

- **SQLite store stability**: reopen the database when `DATA_DIR` changes, add SQLite `busy_timeout`, and avoid taking a provider-catalog write lock on every store access.
- **OAuth/provider reliability**: keeps Kiro, Gemini CLI, and multi-account OAuth checks from being affected by unnecessary store writes during validation and routing.

## 0.1.26 - 2026-07-15

### Added

- **MCP stdio bridge**: official Content-Length framing (NDJSON kept as fallback); RPC auto-spawns the child; delete/update kills the process.
- **Tunnel restore**: Cloudflare quick tunnel and Tailscale serve/funnel re-apply after NesaRouter restart (`instrumentation` + status poll); persist Tailscale mode + local port.
- **Overview system strip**: live fallback / Cloudflare / Tailscale / MCP counts (not decorative badges).
- **MiMo Code Free**: anonymous JWT bootstrap path for Xiaomi free-ai chat (upstream may still return `illegal_access`).
- **Providers**: Vertex ADC import, Grok Web executor, Cloudflare Workers AI helpers, more presets/icons (Cline, Kilo, iFlow, Kimchi, CodeBuddy CN, Azure, Blackbox, Minimax CN, etc.).
- **Specialty OAuth**: expanded device/loopback/import flows and presets (Cursor, Kiro, Codex, Antigravity, Gemini CLI, …).

### Fixed

- **Anthropic API key**: use `x-api-key` + `anthropic-version`; normalize base URL to `/v1/messages`; map OpenAI `tool_choice` → Anthropic.
- **Azure OpenAI**: send `api-key` only (omit Bearer on Azure hosts).
- **OpenAI Responses / Codex**: `ChatGPT-Account-ID` from JWT; typed tools/`function_call` for non-Codex Responses; Codex SSE buffer when `stream: false`.
- **Routing**: explicit model ids fall across every provider that lists the model (cross-provider fallback).
- **Headroom**: avoid `/v1/v1/compress`; export `buildCompressEndpoint`.
- **CLI config**: Codex/Hermes/OpenClaw use a single `/v1` base; Hermes `.env` includes `OPENAI_BASE_URL`.
- **Usage / live map**: savings from cache *hits* (not writes); chart + quotas use local calendar day; live map overflow prefers traffic; reduced-motion skips SVG pulse; request counts aligned.
- **Overview metrics**: “Requests today” instead of capped 500-row length.
- **MCP secrets**: never serialize decrypted env to the browser (SSR + API redact).
- **Tunnel UI**: stale URL separate from live URL; port 1–65535 validation; public-exposure warnings for Cloudflare + Funnel.
- **Typecheck**: Cursor stream `Buffer` assignability for CI.
- **Instrumentation**: Node-only tunnel/Tailscale boot restore uses `webpackIgnore` so Edge build does not pull `better-sqlite3` (fixes `next build` on 0.1.26).

### Security / hygiene

- Ignore `.tmp/` (blocks accidental commit of local credentials/cookies).
- MCP admin surfaces remain redacted; `/v1/mcp/*` still API-key gated.

### Known

- Xiaomi MiMo free JWT may be blocked by upstream (`illegal_access`) — prefer PAYG/Token Plan.
- Tailscale Serve/Funnel must be enabled once in the Tailscale admin console before NesaRouter Enable succeeds.
- Grok Web uses browser-session style access — subject to upstream ToS/breakage.

## 0.1.25 - 2026-07-14

### Fixes

- **Add provider form**: show validation/API errors; use `adminFetch`; after add open provider detail.
- **Editable Base URL / API key**: remove `readOnly`-until-focus antifill that blocked typing and paste.

## 0.1.24 - 2026-07-14

### Fixes

- **Usage summary tables**: Usage by provider / Usage by model render as real HTML tables (aligned columns, tabular nums); stop CSS clash with Provider detail `.model-row`.

## 0.1.23 - 2026-07-14

### Fixes

- **Codex OAuth** ([#2](https://github.com/99apps-id/nesarouter/issues/2), [#4](https://github.com/99apps-id/nesarouter/issues/4)): force `store: false`, SSE-only stream, default `instructions`, typed Responses `input`, strip rejected sampling params.
- **Kiro Builder ID** ([#3](https://github.com/99apps-id/nesarouter/issues/3)): fallback OAuth chat to `q.us-east-1.amazonaws.com` when no `profileArn` (runtime endpoint 400).
- **DeepSeek V4** ([#1](https://github.com/99apps-id/nesarouter/issues/1)): auto-inject `thinking: { type: "disabled" }` on DeepSeek hosts/models unless the client sets `thinking`.
- **Gemini CLI / Antigravity** ([#5](https://github.com/99apps-id/nesarouter/issues/5)): resolve/persist Cloud Code `projectId` via `loadCodeAssist`; clear error when missing.

## 0.1.22 - 2026-07-14

### Fixes

- **i18n UI chrome**: Settings, Overview, Password, Aliases, shell chrome, and language picker translate for all 20 locales (not only nav/CLI); custom language dropdown readable in dark theme.
- **Provider icons**: distinct assets/accents so Hyperbolic ≠ OpenRouter, Moonshot ≠ Kimi, Copilot ≠ GitHub, plus OpenCode Go and Xiaomi Token Plan variants.

### Known

- DeepSeek V4 thinking mode can 400 when agent clients omit `reasoning_content` (tracked in [#1](https://github.com/99apps-id/nesarouter/issues/1)).

## 0.1.21 - 2026-07-14

### Added

- **9router alias import**: paste 9router `/api/models/alias` JSON on Aliases (or `POST /api/aliases/import`); `codex/` prefix maps to Codex OAuth.
- **Upstream concurrency queue**: optional global / per-provider limits and wait timeout in Routing (default `0` = unlimited); queue timeout returns HTTP 503 `queue_timeout`.
- **Ops monitoring**: `/api/health` adds `ready` + `checks.db`; Prometheus scrape at `/api/metrics` (optional `NESA_METRICS_TOKEN`).

## 0.1.20 - 2026-07-14

### Fixes

- Repair `globals.css` syntax error (extra `}` / missing `.theme-toggle` base rule) that broke Next.js production builds in CI.

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
