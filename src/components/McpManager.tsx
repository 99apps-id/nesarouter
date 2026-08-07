"use client";

import { useState } from "react";
import { Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { McpServer } from "@/core/types";
import {
  buildMcpPresetPayload,
  MCP_PRESETS,
  McpPreset,
  McpPresetField,
  missingMcpPresetFields
} from "@/lib/mcpPresets";

export default function McpManager({
  servers,
  baseUrl,
  presets = MCP_PRESETS
}: {
  servers: McpServer[];
  baseUrl: string;
  /** Curated one-click catalog; the SaaS overlay page passes OSS + SaaS presets. */
  presets?: McpPreset[];
}) {
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [presetDraft, setPresetDraft] = useState<{ preset: McpPreset; values: Record<string, string> } | null>(null);

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
      setEditingId(null);
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

  function editServer(server: McpServer) {
    setEditingId(server.id);
    setPresetDraft(null);
    setError("");
    setDraft({
      id: server.id,
      name: server.name,
      command: server.command,
      args: server.args,
      env: {}
    });
    setArgsText(server.args.join("\n"));
    // Redacted env arrives as "********"; keys are pre-filled so the API keeps
    // existing secrets unless the operator types a new value.
    setEnvText(
      Object.keys(server.env ?? {}).length
        ? JSON.stringify(Object.fromEntries(Object.keys(server.env!).map((key) => [key, "********"])), null, 2)
        : ""
    );
  }

  function cancelEdit() {
    setEditingId(null);
    setPresetDraft(null);
    setError("");
    setDraft({ id: "", name: "", command: "", args: [], env: {} });
    setArgsText("");
    setEnvText("");
  }

  function startPreset(preset: McpPreset) {
    setError("");
    const values: Record<string, string> = {};
    for (const field of preset.fields) {
      if (field.default) values[field.target] = field.default;
    }
    if (missingMcpPresetFields(preset, values).length) {
      setPresetDraft({ preset, values });
    } else {
      setPresetDraft(null);
      void addPreset(preset, values);
    }
  }

  async function addPreset(preset: McpPreset, values: Record<string, string>) {
    const missing = missingMcpPresetFields(preset, values);
    if (missing.length) {
      setPresetDraft({ preset, values });
      setError(`Fill in: ${missing.map((field) => field.label).join(", ")}`);
      return;
    }
    setError("");
    try {
      const response = await fetch("/api/mcp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildMcpPresetPayload(preset, values))
      });
      if (response.ok) {
        setPresetDraft(null);
        setTimeout(() => window.location.reload(), 450);
      } else {
        const result = await response.json().catch(() => ({}));
        setError(result.error ?? `Failed to add ${preset.name}.`);
      }
    } catch { setError(`Failed to reach the server while adding ${preset.name}.`); }
  }

  function updatePresetField(field: McpPresetField, value: string) {
    if (!presetDraft) return;
    setPresetDraft({ preset: presetDraft.preset, values: { ...presetDraft.values, [field.target]: value } });
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

      {error ? <p className="test-message error">{error}</p> : null}

      <div className="combo-list">
        {servers.length === 0 ? (
          <p className="subtle">No MCP servers configured.</p>
        ) : (
          servers.map((server) => (
            <article key={server.id} className={`combo-item ${editingId === server.id ? "editing" : ""}`}>
              <div>
                <strong>{server.name}</strong>
                <span>{server.command} {server.args.join(" ")}</span>
              </div>
              <div className="mcp-endpoints">
                <code>{baseUrl}/v1/mcp/{server.id}/sse</code>
                <code>{baseUrl}/v1/mcp/{server.id}/rpc</code>
              </div>
              <div className="combo-actions">
                <button className="button" type="button" onClick={() => editServer(server)}>
                  <Pencil size={16} /> Edit
                </button>
                <button className="button danger-button" type="button" onClick={() => remove(server.id)}>
                  <Trash2 size={16} /> Delete
                </button>
              </div>
            </article>
          ))
        )}
      </div>

      <div className="mcp-presets">
        <div className="panel-heading">
          <div>
            <p className="subtle">one-click add — npx fetches the package on first use</p>
            <h3>Quick add from catalog</h3>
          </div>
          <Sparkles size={18} />
        </div>
        <div className="mcp-preset-grid">
          {presets.map((preset) => {
            const added = servers.some((server) => server.id === preset.id);
            const open = presetDraft?.preset.id === preset.id;
            return (
              <article key={preset.id} className={`mcp-preset-card ${open ? "open" : ""}`}>
                <div className="mcp-preset-meta">
                  <strong>{preset.name}</strong>
                  <span>{preset.category}</span>
                </div>
                <p>{preset.description}</p>
                <code>{preset.package}</code>
                {open && presetDraft ? (
                  <div className="mcp-preset-fields">
                    {preset.fields.map((field) => (
                      <label key={`${preset.id}-${field.kind}-${field.target}`}>
                        {field.label}
                        <input
                          suppressHydrationWarning
                          type={field.secret ? "password" : "text"}
                          placeholder={field.placeholder ?? field.default ?? ""}
                          value={presetDraft.values[field.target] ?? ""}
                          onChange={(event) => updatePresetField(field, event.target.value)}
                        />
                      </label>
                    ))}
                    <div className="mcp-preset-actions">
                      <button
                        className="button primary"
                        type="button"
                        onClick={() => void addPreset(preset, presetDraft.values)}
                      >
                        <Plus size={16} /> Add {preset.name}
                      </button>
                      <button className="button" type="button" onClick={() => setPresetDraft(null)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mcp-preset-actions">
                    <button className="button" type="button" disabled={added} onClick={() => startPreset(preset)}>
                      {added ? "Added ✓" : (<><Plus size={16} /> Add</>)}
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
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
          <Plus size={16} /> {editingId ? "Update MCP server" : "Add MCP server"}
        </button>
        {editingId ? (
          <button className="button" type="button" onClick={cancelEdit}>
            Cancel edit
          </button>
        ) : null}
      </div>
    </section>
  );
}
