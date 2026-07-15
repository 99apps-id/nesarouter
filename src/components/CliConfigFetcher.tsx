"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Download, PlugZap, RotateCcw, Terminal } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { Combo, ProviderConfig, RouterSettings } from "@/core/types";
import { ModelAlias } from "@/core/aliases";
import { adminFetch } from "@/lib/adminFetch";
import { isCliToolFilePatchable, listCliModelTargets } from "@/lib/cliToolConfig";
import type { KeyRow } from "@/lib/keyIdentity";

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

type ConfigStatus = "connected" | "other" | "not_configured" | "unsupported";

type SetupResult = {
  tool: string;
  baseUrl: string;
  model: string;
  modelLabel?: string;
  apiKey?: string;
  key?: { id: string; preview: string };
  keyCreated?: boolean;
  summary?: string;
  instructions?: string;
  env?: Record<string, string>;
  installScript?: { bash: string; powershell: string };
  error?: string;
  local?: {
    skipped?: boolean;
    reason?: string;
    applied?: Array<{ path: string; mode: string }>;
  };
  status?: {
    configStatus?: ConfigStatus;
    currentBaseUrl?: string;
    settingsPath?: string;
  };
};

export default function CliConfigFetcher({
  baseUrl,
  router,
  combos,
  aliases,
  providers,
  keys
}: {
  baseUrl: string;
  router: RouterSettings;
  combos: Combo[];
  aliases: ModelAlias[];
  providers: ProviderConfig[];
  keys: KeyRow[];
}) {
  const { t } = useI18n();
  const cli = t.cli;
  const common = t.common;

  const modelOptions = useMemo(
    () => listCliModelTargets({ combos, aliases, providers }),
    [aliases, combos, providers]
  );

  const [tool, setTool] = useState("claude-code");
  const [modelTarget, setModelTarget] = useState(router.cliTools?.["claude-code"]?.modelTarget ?? "auto");
  const [endpointOverride, setEndpointOverride] = useState("");
  const [keyChoice, setKeyChoice] = useState(keys[0]?.id ?? "new");
  const [shell, setShell] = useState<"powershell" | "bash">("powershell");
  const [showScript, setShowScript] = useState(false);
  const [result, setResult] = useState<SetupResult | null>(null);
  const [status, setStatus] = useState<{
    configStatus?: ConfigStatus;
    currentBaseUrl?: string;
    settingsPath?: string;
    installed?: boolean;
  } | null>(null);
  const [checking, setChecking] = useState(false);
  const [applying, setApplying] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState("");
  const [copied, setCopied] = useState("");
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const effectiveBase = (endpointOverride.trim() || baseUrl).replace(/\/$/, "");
  const patchable = isCliToolFilePatchable(tool);

  async function refreshStatus(nextTool = tool) {
    setChecking(true);
    const response = await adminFetch(`/api/cli-tools/${nextTool}/apply`);
    const payload = await response.json().catch(() => ({}));
    if (response.ok) {
      setStatus({
        configStatus: payload.configStatus,
        currentBaseUrl: payload.currentBaseUrl,
        settingsPath: payload.settingsPath,
        installed: payload.installed
      });
      if (payload.modelTarget) setModelTarget(payload.modelTarget);
    } else {
      setStatus(null);
    }
    setChecking(false);
  }

  useEffect(() => {
    void refreshStatus(tool);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh only when tool changes
  }, [tool]);

  function selectTool(nextTool: string) {
    setTool(nextTool);
    setModelTarget(router.cliTools?.[nextTool]?.modelTarget ?? "auto");
    setResult(null);
    setMessage(null);
    setTestMessage("");
    setShowScript(false);
  }

  async function applyPatch() {
    setApplying(true);
    setMessage(null);
    setTestMessage("");
    setResult(null);
    const body: Record<string, unknown> = {
      modelTarget,
      savePreference: true,
      baseUrl: effectiveBase
    };
    if (keyChoice === "new") {
      body.createKey = true;
    } else {
      body.keyId = keyChoice;
      body.createKey = false;
    }
    const response = await adminFetch(`/api/cli-tools/${tool}/apply`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    const payload = (await response.json().catch(() => ({}))) as SetupResult;
    if (!response.ok) {
      setMessage({ type: "error", text: payload.error ?? cli.applyFailed });
    } else {
      setResult(payload);
      if (payload.key?.id && payload.keyCreated) {
        setKeyChoice(payload.key.id);
      }
      setStatus(payload.status ?? null);
      setMessage({
        type: "ok",
        text: payload.local?.skipped ? payload.local.reason ?? cli.noLocalFile : cli.patchedOk
      });
      await refreshStatus();
    }
    setApplying(false);
  }

  async function resetPatch() {
    setResetting(true);
    setMessage(null);
    const response = await adminFetch(`/api/cli-tools/${tool}/apply`, { method: "DELETE" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage({ type: "error", text: payload.error ?? cli.resetFailed });
    } else {
      setMessage({ type: "ok", text: payload.message ?? common.reset });
      setStatus(payload.status ?? null);
      setResult(null);
    }
    setResetting(false);
  }

  async function testConnection() {
    const token = result?.apiKey;
    const selectedKeyId = keyChoice !== "new" ? keyChoice : result?.key?.id;
    if (!token && !selectedKeyId) {
      setTestMessage(cli.testNeedsNewKey);
      return;
    }
    setTesting(true);
    setTestMessage("");
    const response = await adminFetch("/api/cli-tools/ping", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        token
          ? { token, model: result?.model ?? modelTarget }
          : { keyId: selectedKeyId, model: result?.model ?? modelTarget }
      )
    });
    const payload = await response.json().catch(() => ({}));
    if (payload.ok) {
      const skip = payload.skipped ? ` · skipped: ${payload.skipped}` : "";
      setTestMessage(
        `OK — ${payload.message ?? `provider: ${payload.provider ?? "unknown"}, model: ${payload.model ?? modelTarget}`}${skip}`
      );
    } else {
      const attempts = Array.isArray(payload.attempts) ? ` · ${payload.attempts.join(" | ")}` : "";
      setTestMessage(`${payload.error ?? cli.testFailed}${attempts}`);
    }
    setTesting(false);
  }

  async function copyText(label: string, text: string) {
    await navigator.clipboard?.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(""), 1200);
  }

  const installScript = result?.installScript?.[shell] ?? "";
  const statusLabel =
    status?.configStatus === "connected"
      ? cli.connected
      : status?.configStatus === "other"
        ? cli.otherEndpoint
        : status?.configStatus === "unsupported"
          ? cli.manualOnly
          : cli.notConfigured;
  const statusTone =
    status?.configStatus === "connected" ? "success" : status?.configStatus === "other" ? "neutral" : "error";

  return (
    <section className="panel compact">
      <div className="panel-heading">
        <div>
          <p className="subtle">{cli.panelSubtle}</p>
          <h2>{cli.panelTitle}</h2>
        </div>
        <Terminal size={18} />
      </div>
      <p className="compact-copy">
        {cli.panelBodyBefore} <strong>{common.apply}</strong>
        {cli.panelBodyAfter}
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

      <div className="policy-grid" style={{ marginTop: "1rem" }}>
        <div>
          <span>{common.status}</span>
          <strong>
            {checking ? common.checking : <span className={`status ${statusTone}`}>{statusLabel}</span>}
          </strong>
        </div>
        <div>
          <span>{common.current}</span>
          <strong className="subtle" style={{ fontWeight: 600 }}>
            {status?.currentBaseUrl ?? "—"}
          </strong>
        </div>
      </div>

      <div className="settings-grid" style={{ marginTop: "1rem" }}>
        <label>
          {cli.targetRouting}
          <select value={modelTarget} onChange={(event) => setModelTarget(event.target.value)}>
            {modelOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          {cli.clientKey}
          <select value={keyChoice} onChange={(event) => setKeyChoice(event.target.value)}>
            <option value="new">{cli.createKeyOnApply}</option>
            {keys.map((key) => (
              <option key={key.id} value={key.id}>
                {key.preview}
              </option>
            ))}
            {result?.keyCreated && result.key && !keys.some((key) => key.id === result.key!.id) ? (
              <option value={result.key.id}>
                {result.key.preview} {cli.newKeySuffix}
              </option>
            ) : null}
          </select>
        </label>
        <label className="settings-full">
          {cli.endpointOverride}
          <input
            suppressHydrationWarning
            type="url"
            placeholder={baseUrl}
            value={endpointOverride}
            onChange={(event) => setEndpointOverride(event.target.value)}
          />
        </label>
        <label>
          {cli.activeEndpoint}
          <input readOnly value={`${effectiveBase}/v1`} />
        </label>
      </div>

      <div className="button-row" style={{ marginTop: "0.75rem" }}>
        <button className="button primary" type="button" onClick={applyPatch} disabled={applying || resetting}>
          <PlugZap size={16} />{" "}
          {applying ? common.applying : patchable ? cli.applyPatch : cli.generateConfig}
        </button>
        {patchable ? (
          <button className="button" type="button" onClick={resetPatch} disabled={applying || resetting}>
            <RotateCcw size={16} /> {resetting ? common.resetting : common.reset}
          </button>
        ) : null}
        <button className="button" type="button" onClick={() => setShowScript((value) => !value)}>
          <Download size={16} /> {showScript ? cli.hideScript : cli.showScript}
        </button>
      </div>

      {!patchable ? <p className="compact-copy">{cli.nonPatchableHint}</p> : null}

      {message ? <p className={`test-message ${message.type === "ok" ? "ok" : "error"}`}>{message.text}</p> : null}

      {result?.apiKey ? (
        <div className="key-reveal">
          <code>{result.apiKey}</code>
          <button className="button inline-button" type="button" onClick={() => copyText("key", result.apiKey!)}>
            <Copy size={14} /> {copied === "key" ? common.copied : cli.copyNewKey}
          </button>
        </div>
      ) : null}

      {result?.instructions ? <pre className="code-block">{result.instructions}</pre> : null}

      {result?.local?.applied?.length ? (
        <p className="compact-copy">
          {cli.patchedFiles}{" "}
          {result.local.applied.map((item) => (
            <code key={item.path} style={{ marginRight: 8 }}>
              {item.path}
            </code>
          ))}
        </p>
      ) : null}

      {result?.apiKey || (keyChoice !== "new" && keys.some((key) => key.id === keyChoice)) ? (
        <div className="button-row">
          <button className="button" type="button" onClick={testConnection} disabled={testing}>
            <PlugZap size={14} /> {testing ? cli.testing : cli.testConnection}
          </button>
        </div>
      ) : null}
      {testMessage ? <p className={`test-message ${testMessage.startsWith("OK") ? "ok" : "error"}`}>{testMessage}</p> : null}

      {showScript && result?.installScript ? (
        <div className="cli-config-output">
          <p className="compact-copy">{cli.remoteScriptHint}</p>
          <div className="button-row">
            <button className={`button ${shell === "powershell" ? "primary" : ""}`} type="button" onClick={() => setShell("powershell")}>
              PowerShell
            </button>
            <button className={`button ${shell === "bash" ? "primary" : ""}`} type="button" onClick={() => setShell("bash")}>
              Bash
            </button>
            <button className="button" type="button" onClick={() => copyText("script", installScript)}>
              <Copy size={14} /> {copied === "script" ? common.copied : common.copy}
            </button>
          </div>
          <pre className="code-block">{installScript}</pre>
        </div>
      ) : null}

      {showScript && !result?.installScript ? <p className="subtle">{cli.applyFirstForScript}</p> : null}
    </section>
  );
}
