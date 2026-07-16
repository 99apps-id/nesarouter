"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { McpServer } from "@/core/types";

export default function McpManager({ servers, baseUrl }: { servers: McpServer[]; baseUrl: string }) {
  const [draft, setDraft] = useState<McpServer>({
    id: "",
    name: "",
    command: "",
    args: [],
    env: {}
  });
  const [argsText, setArgsText] = useState("");
  const [envText, setEnvText] = useState("");
  const [error, setError] = useState("");

  async function save() {
    setError("");
    const id = draft.id.trim() || draft.name.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-");
    if (!id || !draft.name.trim() || !draft.command.trim()) return;
    let args: string[] = [];
    let env: Record<string, string> = {};
    try { args = argsText.split(/\r?\n/).map((a) => a.trim()).filter(Boolean); } catch {}
    try {
      env = envText.trim() ? JSON.parse(envText) : {};
      if (typeof env !== "object" || Array.isArray(env)) throw new Error("env must be an object");
    } catch (e) {
      setError("Env must be a JSON object, e.g. {\"KEY\":\"value\"}");
      return;
    }
    const response = await fetch("/api/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...draft, id, args, env })
    });
    if (response.ok) {
      setDraft({ id: "", name: "", command: "", args: [], env: {} });
      setArgsText("");
      setEnvText("");
      setTimeout(() => window.location.reload(), 450);
    } else {
      const result = await response.json().catch(() => ({}));
      setError(result.error ?? "Failed to save MCP server.");
    }
  }

  async function remove(id: string) {
    setError("");
    try {
      const response = await fetch("/api/mcp", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id })
      });
      if (response.ok) window.location.reload();
      else setError((await response.json().catch(() => ({}))).error ?? "Failed to delete MCP server.");
    } catch { setError("Failed to reach the server."); }
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="subtle">stdio ↔ SSE bridge</p>
          <h2>MCP servers</h2>
        </div>
      </div>
      <p className="compact-copy">
        Spawn a local MCP server over stdio (Content-Length JSON-RPC) and expose it at{" "}
        <code>{baseUrl}/v1/mcp/&lt;id&gt;/sse</code>. Send JSON-RPC via POST to{" "}
        <code>/v1/mcp/&lt;id&gt;/rpc</code> (auto-starts the child if needed). Admin-configured commands run with this
        server&apos;s privileges — only configure trusted binaries. Env secrets stay server-side (never sent to the
        browser).
      </p>

      <div className="combo-list">
        {servers.length === 0 ? (
          <p className="subtle">No MCP servers configured.</p>
        ) : (
          servers.map((server) => (
            <article key={server.id} className="combo-item">
              <div>
                <strong>{server.name}</strong>
                <span>{server.command} {server.args.join(" ")}</span>
              </div>
              <div className="mcp-endpoints">
                <code>{baseUrl}/v1/mcp/{server.id}/sse</code>
                <code>{baseUrl}/v1/mcp/{server.id}/rpc</code>
              </div>
              <button className="button danger-button" type="button" onClick={() => remove(server.id)}>
                <Trash2 size={16} /> Delete
              </button>
            </article>
          ))
        )}
      </div>

      <div className="combo-form">
        <label>
          Name
          <input
            suppressHydrationWarning
            value={draft.name}
            placeholder="filesystem"
            onChange={(event) => setDraft({ ...draft, name: event.target.value, id: event.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-") })}
          />
        </label>
        <label>
          Command
          <input
            suppressHydrationWarning
            value={draft.command}
            placeholder="npx"
            onChange={(event) => setDraft({ ...draft, command: event.target.value })}
          />
        </label>
        <label>
          Args (one per line)
          <textarea
            suppressHydrationWarning
            rows={2}
            value={argsText}
            placeholder={"-y\n@modelcontextprotocol/server-filesystem\n/tmp"}
            onChange={(event) => setArgsText(event.target.value)}
          />
        </label>
        <label>
          Env (JSON object)
          <textarea
            suppressHydrationWarning
            rows={2}
            value={envText}
            placeholder={'{"API_KEY":"..."}'}
            onChange={(event) => setEnvText(event.target.value)}
          />
        </label>
        <button className="button primary" type="button" onClick={save} disabled={!draft.name.trim() || !draft.command.trim()}>
          <Plus size={16} /> Add MCP server
        </button>
        {error ? <p className="test-message error">{error}</p> : null}
      </div>
    </section>
  );
}
