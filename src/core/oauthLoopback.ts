import http from "node:http";
import { exchangeCode } from "@/core/oauthPkce";
import { getPreset } from "@/core/oauthProviderPresets";
import { publicUrl } from "@/core/publicUrl";
import { deleteOAuthPending, readOAuthPending, readProviderById, saveProviderOAuthTokens } from "@/lib/store";

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

function htmlPage(title: string, body: string) {
  return `<!doctype html><html><head><meta charset="utf-8"/><title>${title}</title></head><body style="font-family:system-ui;padding:2rem;max-width:40rem">${body}</body></html>`;
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
      res.end(htmlPage("OAuth error", `<p>Authorization failed: <code>${errorParam}</code></p><p><a href="${entry.successRedirect}">Back to NesaRouter</a></p>`));
      return;
    }

    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state) {
      res.writeHead(400, { "content-type": "text/html; charset=utf-8" });
      res.end(htmlPage("OAuth error", `<p>Missing code or state.</p><p><a href="${entry.successRedirect}">Back to NesaRouter</a></p>`));
      return;
    }

    const pending = await readOAuthPending(state);
    if (!pending) {
      res.writeHead(400, { "content-type": "text/html; charset=utf-8" });
      res.end(htmlPage("OAuth error", `<p>Invalid or expired OAuth state. Start Connect again from NesaRouter.</p>`));
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

    const tokens = await exchangeCode(preset, code, pending.redirectUri, pending.codeVerifier);
    const expiresAt = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : undefined;
    await saveProviderOAuthTokens(provider.id, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt
    });

    const done = entry.successRedirect.includes("?")
      ? `${entry.successRedirect}&oauth=connected`
      : `${entry.successRedirect}?oauth=connected`;
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(
      htmlPage(
        "Connected",
        `<p><strong>OAuth connected.</strong> You can close this tab and return to NesaRouter.</p>
         <p><a href="${done}">Open NesaRouter providers</a></p>
         <script>setTimeout(function(){ window.close(); }, 1200);</script>`
      )
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "exchange failed";
    res.writeHead(500, { "content-type": "text/html; charset=utf-8" });
    res.end(htmlPage("OAuth error", `<p>${message}</p><p><a href="${entry.successRedirect}">Back to NesaRouter</a></p>`));
  }
}

/**
 * Ensure a short-lived loopback HTTP server is listening for CLI OAuth redirects
 * (e.g. Codex on http://localhost:1455/auth/callback).
 */
export async function ensureOauthLoopback(port: number, path: string, request?: Request): Promise<void> {
  const existing = loopbackMap().get(port);
  if (existing) {
    existing.successRedirect = publicUrl("/providers", request);
    existing.path = path;
    return;
  }

  const entry: LoopbackEntry = {
    server: null as unknown as http.Server,
    path,
    successRedirect: publicUrl("/providers", request)
  };

  const server = http.createServer((req, res) => {
    void handleLoopbackCallback(req, res, entry);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        reject(new Error(`Port ${port} is already in use. Free it (or stop another Codex login), then try Connect again.`));
      } else {
        reject(err);
      }
    });
    server.listen(port, "127.0.0.1", () => resolve());
  });

  entry.server = server;
  loopbackMap().set(port, entry);
}
