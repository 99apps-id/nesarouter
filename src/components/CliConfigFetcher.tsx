"use client";

import { useMemo, useState } from "react";
import { Copy, Download, PlugZap, Terminal } from "lucide-react";
import { Combo, ProviderConfig, RouterSettings } from "@/core/types";
import { ModelAlias } from "@/core/aliases";
import { adminFetch } from "@/lib/adminFetch";
import { listCliModelTargets } from "@/lib/cliToolConfig";

const TOOLS = [
  { id: "claude-code", label: "Claude Code" },
  { id: "codex", label: "Codex CLI" },
  { id: "gemini-cli", label: "Gemini CLI" },
  { id: "qwen-code", label: "Qwen Code" },
  { id: "hermes", label: "Hermes" },
  { id: "openclaw", label: "OpenClaw" },
  { id: "cursor", label: "Cursor" },
  { id: "cline", label: "Cline" },
  { id: "opencode", label: "OpenCode" },
  { id: "continue", label: "Continue" },
  { id: "roo", label: "Roo" },
  { id: "kilo", label: "Kilo Code" },
  { id: "amp", label: "Amp CLI" },
  { id: "droid", label: "Factory Droid" },
  { id: "cowork", label: "Cowork" },
  { id: "deepseek-tui", label: "DeepSeek TUI" },
  { id: "jcode", label: "jcode" }
] as const;

type SetupResult = {
  tool: string;
  baseUrl: string;
  model: string;
  modelLabel?: string;
  apiKey?: string;
  key?: { id: string; preview: string };
  summary?: string;
  instructions?: string;
  env?: Record<string, string>;
  files?: Array<{ path: string; content: string }>;
  installScript?: { bash: string; powershell: string };
  preview?: boolean;
  error?: string;
};

export default function CliConfigFetcher({
  baseUrl,
  router,
  combos,
  aliases,
  providers
}: {
  baseUrl: string;
  router: RouterSettings;
  combos: Combo[];
  aliases: ModelAlias[];
  providers: ProviderConfig[];
}) {
  const modelOptions = useMemo(
    () => listCliModelTargets({ combos, aliases, providers }),
    [aliases, combos, providers]
  );

  const [tool, setTool] = useState("claude-code");
  const [modelTarget, setModelTarget] = useState(router.cliTools?.["claude-code"]?.modelTarget ?? "auto");
  const [shell, setShell] = useState<"powershell" | "bash">("powershell");
  const [result, setResult] = useState<SetupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState("");
  const [copied, setCopied] = useState("");

  function selectTool(nextTool: string) {
    setTool(nextTool);
    setModelTarget(router.cliTools?.[nextTool]?.modelTarget ?? "auto");
    setResult(null);
    setTestMessage("");
  }

  async function generate() {
    setLoading(true);
    setResult(null);
    setTestMessage("");
    const response = await adminFetch(`/api/cli-tools/${tool}/config`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ modelTarget, createKey: true, savePreference: true })
    });
    const payload = (await response.json().catch(() => ({}))) as SetupResult;
    if (!response.ok) {
      setResult({ tool, baseUrl, model: modelTarget, error: payload.error ?? "Gagal generate config." });
    } else {
      setResult(payload);
    }
    setLoading(false);
  }

  async function testConnection() {
    if (!result?.apiKey) return;
    setTesting(true);
    setTestMessage("");
    const response = await adminFetch("/api/cli-tools/ping", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: result.apiKey, model: result.model })
    });
    const payload = await response.json().catch(() => ({}));
    if (payload.ok) {
      setTestMessage(`OK — provider: ${payload.provider ?? "unknown"}, model: ${payload.model ?? result.model}`);
    } else {
      setTestMessage(payload.error ?? "Test gagal.");
    }
    setTesting(false);
  }

  async function copyText(label: string, text: string) {
    await navigator.clipboard?.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(""), 1200);
  }

  const installScript = result?.installScript?.[shell] ?? "";

  return (
    <section className="panel compact">
      <div className="panel-heading">
        <div>
          <p className="subtle">Setup wizard</p>
          <h2>Hubungkan CLI — tanpa edit manual</h2>
        </div>
        <Terminal size={18} />
      </div>
      <p className="compact-copy">
        Pilih tool, pilih target routing (auto / combo / alias / provider), lalu generate. NesaRouter buat client key,
        tulis config, dan siapkan skrip install — cukup jalankan satu perintah di mesin CLI Anda.
      </p>

      <div className="cli-tool-buttons">
        {TOOLS.map((item) => (
          <button
            key={item.id}
            className={`button ${tool === item.id ? "primary" : ""}`}
            type="button"
            onClick={() => selectTool(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="settings-grid" style={{ marginTop: "1rem" }}>
        <label>
          Target routing
          <select value={modelTarget} onChange={(event) => setModelTarget(event.target.value)}>
            {modelOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Endpoint
          <input readOnly value={`${baseUrl}/v1`} />
        </label>
      </div>

      <div className="button-row" style={{ marginTop: "0.75rem" }}>
        <button className="button primary" type="button" onClick={generate} disabled={loading}>
          <Download size={16} /> {loading ? "Generating…" : "Generate & buat key"}
        </button>
      </div>

      {result?.error ? <p className="test-message error">{result.error}</p> : null}

      {result && !result.error ? (
        <div className="cli-config-output">
          <p className="subtle">{result.summary}</p>
          <div className="policy-grid">
            <div>
              <span>Model</span>
              <strong>{result.modelLabel ?? result.model}</strong>
            </div>
            <div>
              <span>Client key</span>
              <strong>{result.key?.preview ?? "—"}</strong>
            </div>
          </div>

          {result.apiKey ? (
            <div className="key-reveal">
              <code>{result.apiKey}</code>
              <button className="button inline-button" type="button" onClick={() => copyText("key", result.apiKey!)}>
                <Copy size={14} /> {copied === "key" ? "Copied" : "Copy key"}
              </button>
            </div>
          ) : null}

          {result.instructions ? <pre className="code-block">{result.instructions}</pre> : null}

          {installScript ? (
            <>
              <div className="button-row">
                <button className={`button ${shell === "powershell" ? "primary" : ""}`} type="button" onClick={() => setShell("powershell")}>
                  PowerShell
                </button>
                <button className={`button ${shell === "bash" ? "primary" : ""}`} type="button" onClick={() => setShell("bash")}>
                  Bash
                </button>
                <button className="button" type="button" onClick={() => copyText("script", installScript)}>
                  <Copy size={14} /> {copied === "script" ? "Copied" : "Copy install script"}
                </button>
                {result.apiKey ? (
                  <button className="button" type="button" onClick={testConnection} disabled={testing}>
                    <PlugZap size={14} /> {testing ? "Testing…" : "Test koneksi"}
                  </button>
                ) : null}
              </div>
              <pre className="code-block">{installScript}</pre>
              <p className="compact-copy">
                Jalankan skrip di atas di komputer tempat CLI berjalan. File config dan env vars akan ditulis otomatis.
              </p>
            </>
          ) : null}

          {testMessage ? <p className={`test-message ${testMessage.startsWith("OK") ? "ok" : "error"}`}>{testMessage}</p> : null}

          {result.env && Object.keys(result.env).length ? (
            <pre className="code-block">
              {Object.entries(result.env)
                .map(([key, value]) => `export ${key}=${value}`)
                .join("\n")}
            </pre>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
