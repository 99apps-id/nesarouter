import http from "node:http";
import { exchangeCode, resolveIflowApiKey } from "@/core/oauthPkce";
import { getPreset } from "@/core/oauthProviderPresets";
import { publicUrl } from "@/core/publicUrl";
import { deleteOAuthPending, readOAuthPending, readProviderById, readPublicBaseUrlSync, saveProviderOAuthTokens } from "@/lib/store";

type LoopbackEntry = {
  server: http.Server;
  path: string;
  successRedirect: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __nesaOauthLoopbacks: Map<number, LoopbackEntry> | undefined;
}

function loopbackMap() {
  if (!globalThis.__nesaOauthLoopbacks) globalThis.__nesaOauthLoopbacks = new Map();
  return globalThis.__nesaOauthLoopbacks;
}

const OAUTH_STATE_TTL_MS = 10 * 60_000;

export function escapeOAuthHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };
    return entities[character];
  });
}

function htmlPage(title: string, body: string) {
  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="referrer" content="no-referrer"/><title>${escapeOAuthHtml(title)}</title></head><body style="font-family:system-ui;padding:2rem;max-width:40rem">${body}</body></html>`;
}

function backLink(entry: LoopbackEntry) {
  return `<p><a href="${escapeOAuthHtml(entry.successRedirect)}">Back to NesaRouter</a></p>`;
}

async function handleLoopbackCallback(req: http.IncomingMessage, res: http.ServerResponse, entry: LoopbackEntry) {
  try {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (url.pathname !== entry.path) {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("Not found");
      return;
    }

    const errorParam = url.searchParams.get("error");
    if (errorParam) {
      res.writeHead(400, { "content-type": "text/html; charset=utf-8" });
      res.end(htmlPage("OAuth error", `<p>Authorization failed: <code>${escapeOAuthHtml(errorParam)}</code></p>${backLink(entry)}`));
      return;
    }

    const state = url.searchParams.get("state");
    const tokenParam = url.searchParams.get("token");
    const code = url.searchParams.get("code");

    if (!state) {
      res.writeHead(400, { "content-type": "text/html; charset=utf-8" });
      res.end(htmlPage("OAuth error", `<p>Missing state.</p>${backLink(entry)}`));
      return;
    }

    const pending = await readOAuthPending(state);
    if (!pending) {
      res.writeHead(400, { "content-type": "text/html; charset=utf-8" });
      res.end(htmlPage("OAuth error", `<p>Invalid or expired OAuth state. Start Connect again from NesaRouter.</p>`));
      return;
    }
    const createdAt = new Date(pending.createdAt).getTime();
    if (!Number.isFinite(createdAt) || Date.now() - createdAt > OAUTH_STATE_TTL_MS) {
      await deleteOAuthPending(state);
      res.writeHead(400, { "content-type": "text/html; charset=utf-8" });
      res.end(htmlPage("OAuth error", "<p>Invalid or expired OAuth state. Start Connect again from NesaRouter.</p>"));
      return;
    }
    await deleteOAuthPending(state);

    const provider = await readProviderById(pending.providerId);
    const preset = getPreset(provider?.oauthProfile);
    if (!provider || !preset) {
      res.writeHead(400, { "content-type": "text/html; charset=utf-8" });
      res.end(htmlPage("OAuth error", `<p>Provider missing.</p>`));
      return;
    }

    let accessToken: string;
    let refreshToken: string | undefined;
    let expiresAt: string | undefined;

    if (preset.tokenInCallback) {
      if (!tokenParam) {
        res.writeHead(400, { "content-type": "text/html; charset=utf-8" });
        res.end(htmlPage("OAuth error", `<p>Missing token in callback.</p>`));
        return;
      }
      accessToken = tokenParam.trim();
    } else {
      if (!code) {
        res.writeHead(400, { "content-type": "text/html; charset=utf-8" });
        res.end(htmlPage("OAuth error", `<p>Missing code.</p>${backLink(entry)}`));
        return;
      }
      const tokens = await exchangeCode(preset, code, pending.redirectUri, pending.codeVerifier);
      accessToken = tokens.access_token;
      refreshToken = tokens.refresh_token;
      expiresAt = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : undefined;
      if (preset.profile === "iflow" && accessToken) {
        accessToken = await resolveIflowApiKey(preset, accessToken);
      }
    }

    await saveProviderOAuthTokens(
      provider.id,
      { accessToken, refreshToken, expiresAt },
      { accountId: pending.accountId, createNew: !pending.accountId }
    );

    const done = entry.successRedirect.includes("?")
      ? `${entry.successRedirect}&oauth=connected`
      : `${entry.successRedirect}?oauth=connected`;
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(
      htmlPage(
        "Connected",
        `<p><strong>OAuth connected.</strong> You can close this tab and return to NesaRouter.</p>
         <p><a href="${escapeOAuthHtml(done)}">Open NesaRouter providers</a></p>
         <script>setTimeout(function(){ window.close(); }, 1200);</script>`
      )
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "exchange failed";
    res.writeHead(500, { "content-type": "text/html; charset=utf-8" });
    res.end(htmlPage("OAuth error", `<p>${escapeOAuthHtml(message)}</p>${backLink(entry)}`));
  }
}

/**
 * Ensure a short-lived loopback HTTP server is listening for CLI OAuth redirects
 * (e.g. Codex on http://localhost:1455/auth/callback).
 */
export async function ensureOauthLoopback(port: number, path: string, request?: Request): Promise<void> {
  const publicBase = readPublicBaseUrlSync();
  const successRedirect = publicUrl("/providers", request, publicBase);
  const existing = loopbackMap().get(port);
  if (existing) {
    existing.successRedirect = successRedirect;
    existing.path = path;
    return;
  }

  const entry: LoopbackEntry = {
    server: null as unknown as http.Server,
    path,
    successRedirect
  };

  const server = http.createServer((req, res) => {
    void handleLoopbackCallback(req, res, entry);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        reject(new Error(`Port ${port} is already in use. Free it (or stop another OAuth login), then try Connect again.`));
      } else {
        reject(err);
      }
    });
    server.listen(port, "127.0.0.1", () => resolve());
  });

  entry.server = server;
  loopbackMap().set(port, entry);
}
