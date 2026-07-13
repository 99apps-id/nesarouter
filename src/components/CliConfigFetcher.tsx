"use client";

import { useState } from "react";
import { Copy, Download } from "lucide-react";

const TOOLS = [
  { id: "claude-code", label: "Claude Code" },
  { id: "codex", label: "Codex CLI" },
  { id: "cursor", label: "Cursor" },
  { id: "cline", label: "Cline" },
  { id: "opencode", label: "OpenCode" },
  { id: "openclaw", label: "OpenClaw" }
] as const;

export default function CliConfigFetcher() {
  const [active, setActive] = useState<string>("");
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function load(tool: string) {
    setActive(tool);
    setLoading(true);
    setConfig(null);
    const response = await fetch(`/api/cli-tools/${tool}/config`);
    setConfig(await response.json().catch(() => null));
    setLoading(false);
  }

  function copyEnv() {
    if (!config?.env) return;
    const text = Object.entries(config.env).map(([k, v]) => `export ${k}=${v}`).join("\n");
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <section className="panel compact">
      <div className="panel-heading">
        <div>
          <p className="subtle">Auto-config</p>
          <h2>Generate CLI config</h2>
        </div>
        <Download size={18} />
      </div>
      <p className="compact-copy">
        Generate a safe template. Create a client key in Keys, then paste it only on the machine running this CLI.
      </p>
      <div className="cli-tool-buttons">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            className={`button ${active === tool.id ? "primary" : ""}`}
            type="button"
            onClick={() => load(tool.id)}
          >
            {tool.label}
          </button>
        ))}
      </div>
      {loading ? <p className="subtle">Loading…</p> : null}
      {config ? (
        <div className="cli-config-output">
          <p className="subtle">{config.summary}</p>
          {config.instructions ? <pre className="code-block">{config.instructions}</pre> : null}
          {config.env && Object.keys(config.env).length ? (
            <>
              <pre className="code-block">{Object.entries(config.env).map(([k, v]) => `export ${k}=${v}`).join("\n")}</pre>
              <button className="button" type="button" onClick={copyEnv}>
                <Copy size={14} /> {copied ? "Copied" : "Copy env"}
              </button>
            </>
          ) : null}
          {Array.isArray(config.files) && config.files.length
            ? config.files.map((file: any) => (
                <div key={file.path}>
                  <p className="subtle">{file.path}</p>
                  <pre className="code-block">{file.content}</pre>
                </div>
              ))
            : null}
        </div>
      ) : null}
    </section>
  );
}
