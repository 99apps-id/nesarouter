# NesaRouter

**Next Smart Adaptive Router**. A local-first, OpenAI-compatible AI gateway that routes requests across providers, controls budgets, tracks usage, and keeps provider credentials in one encrypted local store.

NesaRouter is designed for a laptop or small VPS. It runs as one Next.js service with SQLite by default and exposes one endpoint for apps and CLI tools.

## What It Does

- Serves OpenAI-compatible chat, responses, messages, embeddings, image, audio, search, and web-fetch endpoints.
- Routes by mode: auto, free-first, cheapest, best, or manual.
- Supports fallback chains, combos, model aliases, and round-robin provider accounts.
- Enforces a daily budget, warning thresholds, provider token quotas, and paid-provider blocking.
- Caches equivalent requests and records routing reason, usage, and estimated or provider-reported cost.
- Encrypts provider API keys, OAuth tokens, client `/v1` keys, MCP env values, and short-lived OAuth pending secrets at rest (AES-256-GCM).
- Saves tokens with **Caveman** (default lite) and full **RTK** compression on tool results (git / grep / ls / logs / builds).
- Connects subscription accounts via OAuth or local IDE import (Claude, ChatGPT/Codex, Gemini CLI, GitHub Copilot, Kiro, Antigravity, Cursor).
- Supports short provider prefixes in `model` (`cx/gpt-5.5`, `cc/...`, full provider id also works).
- Includes a dashboard for providers, keys, routing, usage, MCP, tunnels, Headroom, and CLI configuration.
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

Provider subscriptions, API products, and their quotas are different products. Configure each route you are entitled to use and review the relevant vendor terms. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for public CLI OAuth client identifiers.

## Quick Start

Requirements: Node.js 22 or newer.

```powershell
Copy-Item .env.example .env
npm ci
npm run dev
```

Open `http://localhost:20129`.

For a first local development run, the bootstrap password is `nesa123456` when `NESA_ADMIN_PASSWORD` is unset. Until you change it under **Routing → Password**, other dashboard menus stay locked and most admin APIs return `403`. Do not use the default password on a VPS, Cloudflare Funnel, or any public tunnel — that exposes the admin UI (and MCP command spawn) to the internet.

Then:

1. Open **Providers** and choose either an API-key provider or the **OAuth / account sign-in** group.
2. Connect or test the provider and set it active.
3. Open **Keys** and create a NesaRouter client key (the full token is shown once).
4. Point an app or CLI tool to `http://localhost:20129/v1`.

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
- `POST /v1/web/fetch` (SSRF-guarded)

All `/v1` endpoints require a NesaRouter client key created in **Keys**. The dashboard has separate admin authentication (cookie session), not the client Bearer key.

### Model ids

| Form | Example | Meaning |
| --- | --- | --- |
| Auto | `auto` | Smart routing |
| Bare model | `gpt-5.5` | Match configured provider model |
| Prefix | `cx/gpt-5.5` | ChatGPT OAuth provider + upstream model |
| Provider id | `oauth-claude/claude-sonnet-4` | Explicit provider + model |
| Alias / combo | `fast`, `my-chain` | Custom alias or combo name |

Common prefixes: `cx`/`chatgpt`, `cc`/`claude`, `gemini`/`gcli`, `copilot`, `kiro`, `cursor`, `or`/`openrouter`, `ollama`, `ds`/`deepseek`.

Response headers may include routing and saver metadata such as `x-nesa-cache` and `x-nesa-rtk-saved`.

## Operations

- **Routing**: mode, strategy, fallback, cache, budget, token savers (Caveman / RTK), and admin password.
- **Combos**: named fallback or round-robin chains; aliases map friendly model names to targets.
- **Usage**: provider, model, tokens, cost source, cache status, and routing reason per request.
- **Providers**: API keys or OAuth / IDE import. Tokens are encrypted and refreshed where supported.
- **Keys**: create/revoke client Bearer keys for `/v1` (preview only after create).
- **MCP**: bridge configured stdio servers over SSE and RPC (trusted binaries only).
- **Tunnel**: optional Cloudflare quick tunnel or Tailscale for controlled remote access.
- **Headroom / CLI**: optional compression proxy and CLI config helpers.

Do not expose the dashboard publicly without a reverse proxy, TLS, and an access policy you trust.

## Development

```powershell
npm run typecheck
npm test
npm run build
npm run dev
# In another terminal after the server is ready:
npm run smoke
```

CI runs type checking, unit tests, production build, and the smoke suite. Docker images are published to GHCR when a `v*` tag is pushed.

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

NesaRouter is an independent open-source project and is not affiliated with OpenAI, Anthropic, Google, AWS, GitHub, Cursor, or any other provider. Provider names and marks identify compatible upstream services and remain the property of their respective owners. Subscription OAuth or IDE token import can be subject to vendor terms and plan restrictions.
