# NesaRouter

**Next Smart Adaptive Router**. A local-first, OpenAI-compatible AI gateway that routes requests across providers, controls budgets, tracks usage, and keeps provider credentials in one encrypted local store.

NesaRouter is designed for a laptop or small VPS. It runs as one Next.js service with SQLite by default and exposes one endpoint for apps and CLI tools.

## What It Does

- Serves OpenAI-compatible chat, responses, messages, embeddings, image, audio, search, and web-fetch endpoints.
- Routes by mode: auto, free-first, cheapest, best, or manual.
- Supports fallback chains, combos, model aliases, and round-robin across API keys or OAuth accounts.
- Supports **multi-account OAuth** per provider (add / remove / use; round-robin; skip fatal-error accounts).
- Shows per-account connection health on the provider detail page (green / red, with periodic status probe).
- Enforces a daily budget, warning thresholds, provider and per-key token quotas, and paid-provider blocking.
- Caches equivalent requests and records routing reason, usage, and estimated or provider-reported cost.
- Encrypts provider API keys, OAuth tokens, client `/v1` keys, MCP env values, and short-lived OAuth pending secrets at rest (AES-256-GCM).
- Saves tokens with **Caveman** (default lite) and full **RTK** compression on tool results (git / grep / ls / logs / builds).
- Connects subscription accounts via OAuth or local IDE import (Claude, ChatGPT/Codex, Gemini CLI, GitHub Copilot, Kiro, Antigravity, Cursor).
- Includes keyless free-tier providers such as **OpenCode Free** (`oc/` / `opencode/` prefix; no API key required).
- Supports short provider prefixes in `model` (`cx/gpt-5.5`, `cc/...`, `oc/...`, full provider id also works).
- Includes a dashboard for providers, keys, routing, usage (live provider flow map), MCP, tunnels, Headroom, and CLI configuration.
- Locks the dashboard until the bootstrap admin password is changed; admin sessions are random and revocable.
- Shows an update banner when a newer GitHub Release exists than the installed version.

## Authentication Modes

NesaRouter intentionally keeps subscription sign-in separate from usage-billed API keys.

| Use case | Where | Authentication |
| --- | --- | --- |
| OpenAI API | Providers | API key, usage billing |
| ChatGPT / Codex | OAuth | ChatGPT browser OAuth (PKCE) |
| Anthropic API | Providers | API key, usage billing |
| Claude subscription | OAuth | Browser OAuth (PKCE) |
| Gemini API | Providers | API key, usage billing |
| Gemini CLI | OAuth | Google OAuth with PKCE |
| GitHub Copilot | OAuth | GitHub device flow |
| Kiro | OAuth | AWS Builder ID device flow |
| Antigravity | OAuth | Google OAuth with PKCE |
| Cursor IDE | OAuth / Import | Auto-import from local `state.vscdb` or paste token |
| OpenCode Free | Provider | Keyless Zen endpoint (`Bearer public`); optional paid OpenCode Go with API key |

Provider subscriptions, API products, and their quotas are different products. Configure each route you are entitled to use and review the relevant vendor terms. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for public CLI OAuth client identifiers.

For OAuth providers, open the provider detail page to connect **multiple accounts**, set the active account, and watch live connection status. Routing round-robins across healthy accounts and skips accounts marked with fatal auth/quota errors.

## Quick Start

Requirements: Node.js 22 or newer.

```powershell
Copy-Item .env.example .env
npm ci
npm run dev
```

Open `http://localhost:20129`.

For a first local development run, the bootstrap password is `nesa123456` when `NESA_ADMIN_PASSWORD` is unset. Until you change it under **Routing → Password**, other dashboard menus stay locked and most admin APIs return `403`.

### VPS / production install

Production requires a unique `NESA_ADMIN_PASSWORD` (not `nesa123456`). Installers and automation agents must either ask the operator for that password or print the chosen value clearly once — do not set a hidden random password. After first login, change it under **Routing → Password**.

Do not expose the dashboard on a public tunnel until that password is changed.

If the dashboard is reached via a domain (e.g. `https://router.example.com`), set either:

- env: `NESA_PUBLIC_URL=https://router.example.com`, or
- **Routing → Domain → Public base URL** to the same value

so OAuth and login redirects return to that domain instead of `localhost`.

For a reverse proxy, also forward the original host and HTTPS scheme. With Caddy this is normally automatic. For Nginx, include:

```nginx
proxy_set_header Host $host;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
```

Then:

1. Open **Providers** and choose either an API-key provider or the **OAuth / account sign-in** group.
2. Connect or test the provider and set it active.
   - **Claude / Gemini CLI**: Connect opens the vendor page; paste the authorization code back into NesaRouter.
   - **ChatGPT / Codex**: uses `http://localhost:1455/auth/callback`. On a remote VPS, tunnel first: `ssh -L 1455:127.0.0.1:1455 user@vps`.
   - **Copilot / Kiro**: device-code flow (no localhost redirect).
   - **OpenCode Free**: no key or OAuth — enable the preset and Test; it should show connected.
   - **Multi-account OAuth**: on the provider detail page, use **Add account** to attach another subscription login; Use / Remove per account.
3. Open **Keys** and create a NesaRouter client key (the full token is shown once).
4. Point an app or CLI tool to `http://localhost:20129/v1`.

For dashboard Google/GitHub login, set `NESA_PUBLIC_URL` to the URL you open in the browser and register the same origin’s `/api/auth/oauth/{github|google}/callback` in the OAuth app settings.

```bash
curl http://localhost:20129/v1/models \
  -H "Authorization: Bearer YOUR_NESA_CLIENT_KEY"
```

## Configuration

Copy `.env.example` to `.env`. The important production variables are:

| Variable | Required | Purpose |
| --- | --- | --- |
| `NESA_ENCRYPTION_KEY` | Yes in production | AES-GCM key for secrets at rest and (by default) admin-session HMAC. Use a long random value. |
| `NESA_ADMIN_PASSWORD` | Yes in production | Bootstrap dashboard password. Must not be the development default. Change it immediately in the dashboard. |
| `DATA_DIR` | Recommended | Persistent location for the SQLite database. Defaults to `data`. |
| `NESA_ADMIN_SESSION_SECRET` | Optional | Separate admin-session HMAC secret. Falls back to `NESA_ENCRYPTION_KEY`. |
| `NESA_OAUTH_ALLOWED_EMAILS` | Optional | Comma-separated allowlist for Google or GitHub **dashboard** OAuth login. |
| `NESA_PUBLIC_URL` | Recommended behind proxy | Public origin (`https://host` or `http://ip:20129`) used for OAuth redirects and post-login URLs. |
| `NESA_COOKIE_SECURE` | Optional | Force `Secure` cookies on/off (`true`/`false`). Default: on for https public URL or production. |
| `NESA_METRICS_TOKEN` | Optional (required to scrape) | Enables `GET /api/metrics`. Without it, metrics return 401. |

Generate an encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Never commit `.env`, the `data` directory, provider keys, OAuth tokens, or exported client keys.

## Security highlights

- Empty client key list = `/v1` locked (not an open proxy).
- Admin password: scrypt hash, login lockout, must-change gate on UI and APIs.
- Admin cookie: random session id, HMAC-signed, hashed in SQLite; logout revokes one session; password change revokes all.
- Dashboard JSON/SSR redacts provider secrets, device client secrets, and cache response bodies.
- Production refuses to start without a strong `NESA_ENCRYPTION_KEY` / `NESA_ADMIN_PASSWORD`.

### Clear an accidental login lock

After three wrong password attempts, the dashboard locks for 30 minutes. An operator with VPS shell access can clear only that lock without changing the password, sessions, or provider data:

```bash
npm run unlock-admin
```

The command prints which data directory it cleared. If that path is `data-test-version` or a smoke folder, unset `DATA_DIR` and run it again against `./data`.

Details: [SECURITY.md](SECURITY.md).

## Docker

```bash
cp .env.example .env
# Set NESA_ENCRYPTION_KEY and NESA_ADMIN_PASSWORD in .env
docker compose up -d --build
```

The Compose file persists SQLite data in the `nesa-router-data` volume and exposes port `20129`.

## API

The base URL is `http://localhost:20129/v1`.

Common endpoints:

- `POST /v1/chat/completions`
- `POST /v1/responses`
- `POST /v1/messages`
- `GET /v1/models`
- `POST /v1/embeddings`
- `POST /v1/images/generations`
- `POST /v1/audio/speech`
- `POST /v1/audio/transcriptions`
- `POST /v1/web/fetch` (SSRF-guarded; DNS is validated and the connection is pinned to that approved address)

All `/v1` endpoints require a NesaRouter client key created in **Keys**. The dashboard has separate admin authentication (cookie session), not the client Bearer key.

### Model ids

| Form | Example | Meaning |
| --- | --- | --- |
| Auto | `auto` | Smart routing |
| Bare model | `gpt-5.5` | Match configured provider model |
| Prefix | `cx/gpt-5.5` | ChatGPT OAuth provider + upstream model |
| Provider id | `oauth-claude/claude-sonnet-4` | Explicit provider + model |
| Alias / combo | `fast`, `my-chain` | Custom alias or combo name |

Common prefixes: `cx`/`codex`, `cc`/`claude`, `gemini`/`gcli`, `copilot`, `kiro`, `cursor`, `oc`/`opencode`, `or`/`openrouter`, `ollama`, `ds`/`deepseek`.

Response headers may include routing and saver metadata such as `x-nesa-cache` and `x-nesa-rtk-saved`.

## Operations

- **Health**: `GET /api/health` returns liveness (`ok: true`) plus readiness (`ready`, `checks.db`, app `version` from `package.json`). HTTP **503** when the database check fails (usable as a readiness probe). Docker liveness can keep checking for process up / TCP.
- **Metrics**: `GET /api/metrics` exposes Prometheus text (`nesa_requests_total`, queue gauges, budget spend, …). **Deny-by-default** — set `NESA_METRICS_TOKEN` and scrape with `Authorization: Bearer …` or `?token=`. Without the env var, the endpoint returns 401.
- **Aliases import**: paste 9router `GET /api/models/alias` JSON on the Aliases page (or `POST /api/aliases/import`) to migrate shorthand model maps.
- **Concurrency queue**: under Routing settings, set global / per-provider max concurrent upstream calls (`0` = unlimited). Queue wait timeouts return HTTP 503 with `code: queue_timeout`; disconnected clients are removed from the queue.
- **Routing**: mode, strategy, fallback, cache, budget, token savers (Caveman / RTK), and admin password.
- **Combos**: named fallback or round-robin chains; aliases map friendly model names to targets.
- **Usage**: live provider-flow map (NesaRouter hub with spaced provider ring). It polls real request logs and animates the provider used by a recent request; idle links do not animate. The Usage page also shows daily **provider + per-key token quota** bars.
- **Providers**: API keys, keyless free presets, or OAuth / IDE import. OAuth tokens are encrypted; multi-account pools round-robin and skip unhealthy accounts.
- **Provider / per-key token quotas**: on a provider detail page, set **Daily token quota (provider default)** (`0` = unlimited). Under **API keys / tokens**, each account has its own **Daily quota** (`0` = inherit the provider default). Explicit per-key limits are preferred when routing; exhausted keys are skipped and other keys in the pool keep serving. Quotas use the local calendar day (same window as Usage charts).
- **Keys**: create/revoke client Bearer keys for `/v1` (preview only after create). These are gateway client keys, not upstream provider key quotas.
- **MCP**: bridge configured stdio servers over SSE and RPC (trusted binaries only).
- **Tunnel**: optional Cloudflare quick tunnel or Tailscale for controlled remote access.
- **Headroom / CLI**: optional compression proxy and CLI config helpers.

Do not expose the dashboard publicly without a reverse proxy, TLS, and an access policy you trust.

## Development

```powershell
npm run typecheck
npm test
npm run build
npm run start
# In another terminal after the production server is ready:
npm run smoke
```

Do not run `npm run dev` while `npm run build` or `npm run start` uses the same `.next` directory. CI runs type checking, unit tests, production build, and the smoke suite. Docker images are published to GHCR when a `v*` tag is pushed.

## Project Docs

- [Changelog](CHANGELOG.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [Product notes](PRODUCT.md)
- [Design notes](DESIGN.md)
- [Code of conduct](CODE_OF_CONDUCT.md)
- [Provider asset attribution](public/providers/ATTRIBUTION.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)

## License

NesaRouter is released under the [MIT License](LICENSE).

## Disclaimer

NesaRouter is an independent open-source project and is not affiliated with OpenAI, Anthropic, Google, AWS, GitHub, Cursor, OpenCode, or any other provider. Provider names and marks identify compatible upstream services and remain the property of their respective owners. Subscription OAuth or IDE token import can be subject to vendor terms and plan restrictions.
