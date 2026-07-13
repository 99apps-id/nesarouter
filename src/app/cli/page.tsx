import AppShell from "@/components/AppShell";
import CliConfigFetcher from "@/components/CliConfigFetcher";
import { readStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function CliPage() {
  const store = await readStore();
  const defaultKey = "<YOUR_NESA_API_KEY>";
  const base = "http://localhost:20129";
  const v1 = `${base}/v1`;
  const comboNames = store.combos.map((c) => c.name);
  const sampleModel = comboNames[0] ?? "nesa/router";

  return (
    <AppShell active="cli" eyebrow="CLI" title="CLI Tools">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="subtle">OpenAI compatible</p>
            <h2>Use NesaRouter endpoint</h2>
          </div>
        </div>
        <div className="cli-grid">
          <div>
            <span>Base URL</span>
            <code>{v1}</code>
          </div>
          <div>
            <span>API key</span>
            <code>{defaultKey}</code>
          </div>
          <div>
            <span>Model</span>
            <code>{sampleModel}</code>
          </div>
        </div>
        <pre className="code-block">{`export OPENAI_BASE_URL=${v1}
export OPENAI_API_KEY=${defaultKey}
export OPENAI_MODEL=${sampleModel}`}</pre>
        <pre className="code-block">{`curl ${v1}/chat/completions \\
  -H "Authorization: Bearer ${defaultKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${sampleModel}",
    "messages": [{"role": "user", "content": "Halo dari CLI"}]
  }'`}</pre>
      </section>

      <CliConfigFetcher />

      <section className="panel compact">
        <div className="panel-heading">
          <div>
            <p className="subtle">Anthropic Messages</p>
            <h2>Claude Code / Anthropic SDK</h2>
          </div>
        </div>
        <p className="compact-copy">
          NesaRouter exposes an Anthropic-compatible <code>/v1/messages</code> endpoint. Point Claude Code here.
        </p>
        <pre className="code-block">{`# ~/.claude/config.json
{
  "anthropic_api_base": "${v1}",
  "anthropic_api_key": "${defaultKey}"
}`}</pre>
        <pre className="code-block">{`curl ${v1}/messages \\
  -H "x-api-key: ${defaultKey}" \\
  -H "anthropic-version: 2023-06-01" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${sampleModel}",
    "max_tokens": 256,
    "messages": [{"role": "user", "content": "Halo Claude"}]
  }'`}</pre>
      </section>

      <section className="panel compact">
        <div className="panel-heading">
          <div>
            <p className="subtle">OpenAI Responses</p>
            <h2>Codex / OpenAI Responses SDK</h2>
          </div>
        </div>
        <pre className="code-block">{`export OPENAI_BASE_URL=${base}
export OPENAI_API_KEY=${defaultKey}
codex "implement a thin /v1/responses adapter"`}</pre>
        <pre className="code-block">{`curl ${v1}/responses \\
  -H "Authorization: Bearer ${defaultKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${sampleModel}",
    "input": "Refactor this function to be one-liner."
  }'`}</pre>
      </section>

      <section className="panel compact">
        <div className="panel-heading">
          <div>
            <p className="subtle">Cursor / Cline / OpenClaw</p>
            <h2>OpenAI base URL tools</h2>
          </div>
        </div>
        <pre className="code-block">{`# Cursor: Settings -> Models -> Advanced
OpenAI API Base URL: ${v1}
OpenAI API Key:      ${defaultKey}
Model:               ${sampleModel}`}</pre>
        <pre className="code-block">{`# Cline / Roo / Continue: OpenAI Compatible
Base URL: ${v1}
API Key:  ${defaultKey}
Model:    ${sampleModel}`}</pre>
        <pre className="code-block">{`# OpenClaw (~/.openclaw/openclaw.json) — use 127.0.0.1 to avoid IPv6 issues
{
  "models": {
    "providers": {
      "nesa": {
        "baseUrl": "http://127.0.0.1:20129/v1",
        "apiKey": "${defaultKey}",
        "api": "openai-completions",
        "models": [{ "id": "${sampleModel}", "name": "NesaRouter" }]
      }
    }
  }
}`}</pre>
      </section>

      <section className="panel compact">
        <div className="panel-heading">
          <div>
            <p className="subtle">MCP stdio ↔ SSE bridge</p>
            <h2>Model Context Protocol</h2>
          </div>
        </div>
        <p className="compact-copy">
          Configure local MCP servers (stdio JSON-RPC) on the <a href="/mcp">MCP page</a>; NesaRouter exposes each one over SSE so any MCP client can connect.
        </p>
        <pre className="code-block">{`# SSE endpoint (long-lived event stream)
GET  ${v1}/mcp/<server-id>/sse
Authorization: Bearer ${defaultKey}

# Send JSON-RPC frames to the spawned child
POST ${v1}/mcp/<server-id>/rpc
Authorization: Bearer ${defaultKey}
Content-Type: application/json

{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}`}</pre>
      </section>

      <section className="panel compact">
        <div className="panel-heading">
          <div>
            <p className="subtle">Subscription OAuth</p>
            <h2>Claude / Codex via your own subscription</h2>
          </div>
        </div>
        <p className="compact-copy">
          Add a provider from the <strong>Claude (Anthropic subscription, OAuth)</strong> or <strong>Codex (OpenAI subscription, OAuth)</strong> preset, then click <strong>Connect</strong> to authorize in your browser. NesaRouter stores the tokens encrypted and refreshes them automatically. Requests are translated to/from the vendor&apos;s native Messages / Responses format. Same ToS stance as 9router — use your own account at your own risk.
        </p>
      </section>

      <section className="panel compact">
        <div className="panel-heading">
          <div>
            <p className="subtle">Log</p>
            <h2>Request log</h2>
          </div>
        </div>
        <p className="compact-copy">
          Semua request dari CLI masuk ke Usage: provider, cost, cache, fallback, dan error upstream.
        </p>
        <a className="button" href="/usage">Open Usage</a>
      </section>
    </AppShell>
  );
}
