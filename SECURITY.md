# Security Policy

## Supported Version

Security fixes are applied to the latest version on the default branch.

## Reporting a Vulnerability

Do not open a public issue for suspected vulnerabilities, exposed credentials, authentication bypasses, or SSRF problems.

Use the repository's private GitHub Security Advisory reporting feature. Include:

- A clear description and impact.
- Reproduction steps or a proof of concept.
- Affected version or commit.
- Any suggested mitigation.

If private reporting is not enabled yet, contact a repository maintainer privately and do not include secrets in the report. The project will acknowledge valid reports, investigate them, and coordinate a fix before public disclosure.

## Threat model (local-first gateway)

NesaRouter is intended to run on a trusted machine or private network. The admin dashboard can configure providers, tunnels, and MCP process commands. Treat a stolen admin session as full local operator access.

| Surface | Auth | Notes |
| --- | --- | --- |
| Dashboard + `/api/*` (except public auth) | Admin session cookie | Random id, HMAC-signed, hashed in SQLite; revocable |
| `/v1/*` | Client Bearer key | Empty key list = deny; keys encrypted at rest |
| Provider OAuth / IDE import | Operator action | Tokens encrypted; pending PKCE/device secrets encrypted |
| MCP bridge | Admin-configured | Spawns local commands — trusted binaries only |

## Operational Guidance

- Set a unique `NESA_ENCRYPTION_KEY` and `NESA_ADMIN_PASSWORD` in production.
- Change the bootstrap admin password on first login. Until you do, the dashboard stays limited to **Routing** and most admin APIs return `403`.
- Keep the dashboard behind a trusted network boundary or reverse proxy. Treat Cloudflare Funnel / public tunnels as full internet exposure of the admin UI and MCP process spawn.
- Admin sessions are random, HMAC-signed cookies stored by hash in SQLite. Logout revokes the current session; changing the password revokes all sessions.
- Middleware rejects cookies that fail format / expiry / HMAC checks; route handlers also confirm the session still exists in the database.
- MCP bridges can run arbitrary local commands configured by an authenticated admin — only register trusted binaries, and never expose the dashboard to untrusted networks.
- Do not expose the local SQLite data directory, `.env`, provider credentials, or OAuth token storage.
- Client `/v1` API keys are encrypted at rest; the full token is shown only once at creation. Admin APIs return key id + preview only.
- Provider secrets and OAuth device client secrets are redacted in dashboard JSON and SSR; masked `********` values cannot overwrite stored secrets.
- Rotate provider credentials after accidental exposure.

## Production checklist

1. `NESA_ENCRYPTION_KEY` = long random secret (required; process refuses weak/missing values in production).
2. `NESA_ADMIN_PASSWORD` = unique bootstrap password (not `nesa123456` / `change-me`).
3. Log in once → **Routing → Password** → set a new password.
4. Create at least one client key before calling `/v1`.
5. Prefer Tailscale or a private reverse proxy over a public Funnel URL for the dashboard.
