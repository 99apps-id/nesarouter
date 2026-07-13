"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, KeyRound, Layers, ListRestart, PlugZap, Plus, Save, Star, Trash2 } from "lucide-react";
import { ProviderConfig } from "@/core/types";
import ProviderIcon from "@/components/ProviderIcon";
import { adminFetch } from "@/lib/adminFetch";

export default function ProviderDetail({
  provider,
  keyPreviews,
  keyCount,
  hasApiKey,
  hasOAuthToken,
  tierLabel,
  canDelete = false
}: {
  provider: ProviderConfig;
  keyPreviews: string[];
  keyCount: number;
  hasApiKey: boolean;
  hasOAuthToken: boolean;
  tierLabel: string;
  canDelete?: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<ProviderConfig>({ ...provider });
  const [models, setModels] = useState<string[]>(
    Array.isArray(provider.models) && provider.models.length ? [...provider.models] : provider.model ? [provider.model] : []
  );
  const [newModel, setNewModel] = useState("");
  const [newKey, setNewKey] = useState("");
  const [keys, setKeys] = useState<string[]>(keyPreviews);
  const [keyCountState, setKeyCountState] = useState(keyCount);
  const [saved, setSaved] = useState(false);
  const [testResult, setTestResult] = useState<"idle" | "testing" | "ok" | "error">("idle");
  const [testMessage, setTestMessage] = useState("");
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsMessage, setModelsMessage] = useState("");
  const [oauthMessage, setOauthMessage] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [oauthPaste, setOauthPaste] = useState<{ state: string; hint?: string } | null>(null);
  const [oauthCode, setOauthCode] = useState("");
  const [oauthWaiting, setOauthWaiting] = useState(false);
  const oauthPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [importTok, setImportTok] = useState({ accessToken: "", refreshToken: "", expiresIn: "", machineId: "" });
  const [device, setDevice] = useState<{ userCode: string; verificationUri: string; interval: number } | null>(null);
  const [devicePolling, setDevicePolling] = useState(false);
  const [cursorImporting, setCursorImporting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    return () => {
      if (oauthPollRef.current) clearInterval(oauthPollRef.current);
    };
  }, []);

  function stopOauthPoll() {
    if (oauthPollRef.current) {
      clearInterval(oauthPollRef.current);
      oauthPollRef.current = null;
    }
    setOauthWaiting(false);
  }

  function startOauthPoll(baseline?: { expiresAt?: string; lastRefreshAt?: string; hadToken: boolean }) {
    stopOauthPoll();
    setOauthWaiting(true);
    const startedAt = Date.now();
    oauthPollRef.current = setInterval(async () => {
      if (Date.now() - startedAt > 10 * 60_000) {
        stopOauthPoll();
        setOauthMessage("Timed out waiting for OAuth. Click Connect and try again.");
        return;
      }
      try {
        const response = await adminFetch("/api/providers");
        if (!response.ok) return;
        const list = (await response.json()) as ProviderConfig[];
        const current = list.find((item) => item.id === draft.id);
        if (!current?.oauthAccessToken) return;
        const changed =
          !baseline?.hadToken ||
          current.oauthTokenExpiresAt !== baseline.expiresAt ||
          current.oauthLastRefreshAt !== baseline.lastRefreshAt;
        if (!changed) return;
        stopOauthPoll();
        setOauthPaste(null);
        setOauthCode("");
        setOauthMessage("Connected.");
        router.refresh();
      } catch {
        /* ignore transient poll errors */
      }
    }, 2000);
  }
  async function addKey() {
    setError("");
    const key = newKey.trim().replace(/^Bearer\s+/i, "").trim();
    if (!key) return;
    const response = await adminFetch(`/api/providers/${draft.id}/keys`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key })
    });
    const result = await response.json().catch(() => ({}));
    if (response.ok) {
      setKeys([...keys, result.preview]);
      setKeyCountState(result.count);
      setNewKey("");
    } else {
      setError(result.error ?? "Failed to add key.");
    }
  }

  async function removeKey(index: number) {
    setError("");
    const response = await adminFetch(`/api/providers/${draft.id}/keys`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ index })
    });
    const result = await response.json().catch(() => ({}));
    if (response.ok) {
      setKeys(keys.filter((_, i) => i !== index));
      setKeyCountState(result.count);
    } else {
      setError(result.error ?? "Failed to remove key.");
    }
  }

  function addModel() {
    const id = newModel.trim();
    if (!id || models.includes(id)) return;
    setModels([...models, id]);
    setNewModel("");
    if (!draft.model) setDraft({ ...draft, model: id });
  }

  function removeModel(id: string) {
    const next = models.filter((m) => m !== id);
    setModels(next);
    if (draft.model === id) setDraft({ ...draft, model: next[0] ?? "" });
  }

  function setPrimary(id: string) {
    const next = [id, ...models.filter((m) => m !== id)];
    setModels(next);
    setDraft({ ...draft, model: id });
  }

  async function saveProvider() {
    setError("");
    setSaved(false);
    const payload: ProviderConfig = { ...draft, models, model: models[0] ?? draft.model };
    delete (payload as any).apiKeys;
    delete (payload as any).oauthAccessToken;
    delete (payload as any).oauthRefreshToken;
    const response = await adminFetch("/api/providers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (response.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } else {
      const result = await response.json().catch(() => ({}));
      setError(result.error ?? "Failed to save provider.");
    }
  }

  async function testProvider(allAccounts = false) {
    setTestResult("testing");
    setTestMessage("");
    const response = await adminFetch("/api/providers/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ providerId: draft.id, allAccounts })
    });
    const result = await response.json().catch(() => ({}));
    setTestResult(result.ok ? "ok" : "error");
    const accountSummary = Array.isArray(result.accounts)
      ? ` ${result.accounts.map((account: { index: number; ok: boolean }) => `Account ${account.index + 1}: ${account.ok ? "OK" : "failed"}`).join(" · ")}`
      : "";
    setTestMessage(`${result.message ?? result.error ?? "Test done."}${accountSummary}`);
    if (result.ok) setTimeout(() => router.refresh(), 400);
  }

  async function loadModels() {
    setModelsLoading(true);
    setModelsMessage("");
    const response = await adminFetch("/api/providers/models", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ providerId: draft.id })
    });
    const result = await response.json().catch(() => ({}));
    if (result.ok) {
      const loaded: string[] = result.models ?? [];
      const merged = Array.from(new Set([...models, ...loaded]));
      setModels(merged);
      setModelsMessage(`${loaded.length} models loaded.`);
      if (!draft.model && merged[0]) setDraft({ ...draft, model: merged[0] });
    } else {
      setModelsMessage(result.error ?? "Failed to load models.");
    }
    setModelsLoading(false);
  }

  async function deleteProvider() {
    const response = await adminFetch("/api/providers", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: draft.id })
    });
    if (response.ok) router.push("/providers");
  }

  async function connectOAuth() {
    setError("");
    setOauthMessage("Opening provider authorization in a new tab…");
    setOauthPaste(null);
    setOauthCode("");
    stopOauthPoll();
    const response = await adminFetch(`/api/providers/${draft.id}/oauth/start`, { method: "POST" });
    const result = await response.json().catch(() => ({}));
    if (!result.authorizeUrl) {
      setOauthMessage(result.error ?? "Failed to start OAuth flow.");
      return;
    }

    const popup = window.open(result.authorizeUrl, "_blank", "noopener,noreferrer");
    if (!popup) {
      setError("Pop-up blocked. Allow pop-ups for this site, then click Connect again.");
      setOauthMessage("");
      return;
    }

    // Keep this tab on NesaRouter (9router-style): paste code here and/or wait for loopback.
    setOauthPaste({
      state: result.state,
      hint:
        result.hint ??
        (result.manualCode
          ? "Authorize in the other tab, then paste the code here."
          : "Authorize in the other tab. If a code is shown, paste it here — otherwise this page updates when the login finishes.")
    });
    setOauthMessage(
      result.manualCode
        ? "Authorize in the new tab, then paste the code below."
        : "Authorize in the new tab. Waiting for token…"
    );
    startOauthPoll({
      hadToken: Boolean(draft.oauthAccessToken),
      expiresAt: draft.oauthTokenExpiresAt,
      lastRefreshAt: draft.oauthLastRefreshAt
    });
  }

  async function submitOAuthCode() {
    setError("");
    if (!oauthPaste || !oauthCode.trim()) {
      setError("Paste the authorization code first.");
      return;
    }
    setOauthMessage("Exchanging code…");
    const response = await adminFetch(`/api/providers/${draft.id}/oauth/complete`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: oauthCode.trim(), state: oauthPaste.state })
    });
    const result = await response.json().catch(() => ({}));
    if (response.ok) {
      stopOauthPoll();
      setOauthPaste(null);
      setOauthCode("");
      setOauthMessage("Connected.");
      router.refresh();
    } else {
      setError(result.error ?? "Failed to complete OAuth.");
      setOauthMessage("");
    }
  }

  async function disconnectOAuth() {
    const payload = { ...draft, models, model: models[0] ?? draft.model, oauthAccessToken: "", oauthRefreshToken: "" };
    delete (payload as any).apiKeys;
    delete (payload as any).oauthTokenExpiresAt;
    delete (payload as any).oauthLastRefreshAt;
    const response = await adminFetch("/api/providers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (response.ok) router.refresh();
  }

  async function importToken() {
    setError("");
    const accessToken = importTok.accessToken.trim();
    if (!accessToken) { setError("Access token is required."); return; }
    const response = await adminFetch(`/api/providers/${draft.id}/oauth/import`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        accessToken,
        refreshToken: importTok.refreshToken.trim() || undefined,
        expiresIn: importTok.expiresIn ? Number(importTok.expiresIn) : undefined,
        machineId: importTok.machineId.trim() || undefined
      })
    });
    if (response.ok) {
      setShowImport(false);
      setImportTok({ accessToken: "", refreshToken: "", expiresIn: "", machineId: "" });
      setOauthMessage("Token imported.");
      router.refresh();
    } else {
      const result = await response.json().catch(() => ({}));
      setError(result.error ?? "Failed to import token.");
    }
  }

  async function autoImportCursor() {
    setError("");
    setOauthMessage("");
    setCursorImporting(true);
    try {
      const detect = await adminFetch(`/api/providers/${draft.id}/oauth/cursor/auto-import`);
      const found = await detect.json().catch(() => ({}));
      if (!detect.ok || !found.found || !found.imported) {
        setShowImport(true);
        setError(found.error ?? "Could not auto-import from Cursor IDE. Paste tokens manually.");
        return;
      }
      setOauthMessage("Imported token from local Cursor IDE.");
      router.refresh();
    } finally {
      setCursorImporting(false);
    }
  }

  async function startDeviceFlow() {
    setError("");
    setOauthMessage("");
    const response = await adminFetch(`/api/providers/${draft.id}/oauth/device/start`, { method: "POST" });
    const result = await response.json().catch(() => ({}));
    if (response.ok && result.user_code) {
      setDevice({ userCode: result.user_code, verificationUri: result.verification_uri, interval: result.interval ?? 5 });
    } else {
      setError(result.error ?? "Failed to start device flow.");
    }
  }

  async function pollDeviceFlow() {
    if (!device) return;
    setDevicePolling(true);
    const response = await adminFetch(`/api/providers/${draft.id}/oauth/device/poll`, { method: "POST" });
    const result = await response.json().catch(() => ({}));
    if (response.ok && result.status === "ok") {
      setDevice(null);
      setDevicePolling(false);
      router.refresh();
      return;
    }
    setDevicePolling(false);
    if (result.status === "pending") {
      setOauthMessage(`Waiting for authorization… (retry in ${result.interval ?? device.interval}s)`);
    } else {
      setError(result.error ?? "Device flow failed.");
      setDevice(null);
    }
  }

  const connectionStatus = draft.connectionStatus ?? "unknown";
  const connectionLabel = connectionStatus === "connected" ? "Connected" : connectionStatus === "error" ? "Error" : "Not tested";
  const isAccountProvider = Boolean(draft.oauthProfile);
  const usesDeviceFlow = draft.oauthProfile === "github_copilot" || draft.oauthProfile === "kiro";
  const usesCursorImport = draft.oauthProfile === "cursor";
  const deviceVendorLabel = draft.oauthProfile === "kiro" ? "AWS Builder ID" : "GitHub";

  return (
    <div className="providers-stack">
      <div className="provider-detail-header">
        <Link href="/providers" className="button"><ArrowLeft size={16} /> Back</Link>
      </div>

      <section className="panel">
        <div className="provider-title">
          <ProviderIcon provider={draft} size="md" active={draft.status === "active"} />
          <div>
            <strong>{draft.name}</strong>
            <span>{tierLabel}</span>
            <div className="provider-badges">
              <span className={`status ${connectionStatus === "connected" ? "success" : connectionStatus === "error" ? "error" : "neutral"}`}>{connectionLabel}</span>
              {isAccountProvider ? <span className={`status ${hasOAuthToken ? "success" : "neutral"}`}>OAuth {hasOAuthToken ? "connected" : "not connected"}</span> : <span className={`status ${keyCountState > 0 ? "success" : "neutral"}`}><KeyRound size={12} /> {keyCountState} key{keyCountState === 1 ? "" : "s"}</span>}
              <span className="status neutral"><Layers size={12} /> {models.length} model{models.length === 1 ? "" : "s"}</span>
            </div>
            {draft.lastError ? <small title={draft.lastError}>Last error: {draft.lastError}</small> : null}
          </div>
          <select
            aria-label={`${draft.name} status`}
            value={draft.status}
            onChange={(event) => setDraft({ ...draft, status: event.target.value as ProviderConfig["status"] })}
          >
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
            <option value="cooldown">Cooldown</option>
          </select>
        </div>

        <div className="provider-fields">
          <label>
            Name
            <input suppressHydrationWarning value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
          </label>
          <label>
            Adapter
            <select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as ProviderConfig["type"] })}>
              <option value="openai_compatible">OpenAI API</option>
              <option value="gemini">Gemini</option>
              <option value="gemini_cli">Gemini CLI (Cloud Code)</option>
              <option value="anthropic_messages">Anthropic Messages</option>
              <option value="openai_responses">OpenAI Responses</option>
              <option value="github_copilot">GitHub Copilot</option>
              <option value="kiro">Kiro / custom transport</option>
              <option value="cursor">Cursor IDE</option>
            </select>
          </label>
          <label>
            Tier
            <select value={draft.tier} onChange={(event) => setDraft({ ...draft, tier: event.target.value as ProviderConfig["tier"] })}>
              <option value="free">Free</option>
              <option value="cheap">Cheap</option>
              <option value="balanced">Balanced</option>
              <option value="premium">Premium</option>
            </select>
          </label>
          <label>
            Base URL
            <input suppressHydrationWarning value={draft.baseUrl} onChange={(event) => setDraft({ ...draft, baseUrl: event.target.value })} />
          </label>
          <label>
            Priority
            <input suppressHydrationWarning type="number" min="1" step="1" value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: Number(event.target.value) })} />
          </label>
          <label>
            Input $/MTok
            <input suppressHydrationWarning type="number" min="0" step="0.01" value={draft.inputCostPerMTok} onChange={(event) => setDraft({ ...draft, inputCostPerMTok: Number(event.target.value) })} />
          </label>
          <label>
            Output $/MTok
            <input suppressHydrationWarning type="number" min="0" step="0.01" value={draft.outputCostPerMTok} onChange={(event) => setDraft({ ...draft, outputCostPerMTok: Number(event.target.value) })} />
          </label>
          <label>
            Daily token quota
            <input suppressHydrationWarning type="number" min="0" step="1000" placeholder="0 = unlimited" value={draft.quotaLimitTokens ?? 0} onChange={(event) => setDraft({ ...draft, quotaLimitTokens: Number(event.target.value) || undefined })} />
          </label>
          <label>
            Outbound proxy URL (optional)
            <input suppressHydrationWarning value={draft.proxyUrl ?? ""} onChange={(event) => setDraft({ ...draft, proxyUrl: event.target.value || undefined })} placeholder="http://host:port — applied to upstream calls" />
          </label>
        </div>

        <div className="button-row">
          <button className="button" type="button" onClick={() => testProvider()}>
            <PlugZap size={16} /> {testResult === "testing" ? "Testing" : "Test"}
          </button>
          {keyCountState > 1 ? (
            <button className="button" type="button" onClick={() => testProvider(true)} disabled={testResult === "testing"}>
              <Layers size={16} /> Test accounts
            </button>
          ) : null}
          <button className="button primary" type="button" onClick={saveProvider}>
            {saved ? <Check size={16} /> : <Save size={16} />} {saved ? "Saved" : "Save"}
          </button>
          {canDelete ? (
            <button className="button danger-button" type="button" onClick={deleteProvider}>
              <Trash2 size={16} /> Delete
            </button>
          ) : null}
        </div>
        {testMessage ? <p className={`test-message ${testResult}`}>{testMessage}</p> : null}
        {error ? <p className="test-message error">{error}</p> : null}
      </section>

      {!isAccountProvider ? <section className="panel compact">
        <div className="panel-heading">
          <div>
            <p className="subtle">Account pool</p>
            <h2>API keys / tokens</h2>
          </div>
          <KeyRound size={18} />
        </div>
        <p className="compact-copy">Add one key or token per account. All accounts are encrypted, rotated in turn, and cooled down separately after quota or rate-limit errors.</p>
        <div className="key-list">
          {keys.length === 0 ? <p className="subtle">No keys saved.</p> : keys.map((preview, index) => (
            <div key={index} className="key-row">
              <span className="key-preview"><KeyRound size={14} /> {preview}</span>
              {index === 0 ? <span className="status success">account 1</span> : <span className="status neutral">account {index + 1}</span>}
              <button className="button danger-button" type="button" onClick={() => removeKey(index)}>
                <Trash2 size={14} /> Remove
              </button>
            </div>
          ))}
        </div>
        <div className="key-add">
          <input
            suppressHydrationWarning
            type="password"
            placeholder="Paste API key or access token"
            value={newKey}
            onChange={(event) => setNewKey(event.target.value)}
          />
          <button className="button primary" type="button" onClick={addKey} disabled={!newKey.trim()}>
            <Plus size={16} /> Add key
          </button>
        </div>
      </section> : null}

      <section className="panel compact">
        <div className="panel-heading">
          <div>
            <p className="subtle">Models served by this provider</p>
            <h2>Models</h2>
          </div>
          <button className="button" type="button" onClick={loadModels}>
            <ListRestart size={16} /> {modelsLoading ? "Loading" : "Load from upstream"}
          </button>
        </div>
        {modelsMessage ? <p className="test-message">{modelsMessage}</p> : null}
        <div className="model-list">
          {models.length === 0 ? <p className="subtle">No models yet — add one below or load from upstream.</p> : models.map((id) => (
            <div key={id} className={`model-row ${id === draft.model ? "primary" : ""}`}>
              <span className="model-id">{id}</span>
              {id === draft.model ? <span className="status success"><Star size={12} /> primary</span> : (
                <button className="button" type="button" onClick={() => setPrimary(id)}><Star size={14} /> Set primary</button>
              )}
              <button className="button danger-button" type="button" onClick={() => removeModel(id)}>
                <Trash2 size={14} /> Remove
              </button>
            </div>
          ))}
        </div>
        <div className="key-add">
          <input
            suppressHydrationWarning
            placeholder="Model id, e.g. deepseek-chat"
            value={newModel}
            onChange={(event) => setNewModel(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addModel(); } }}
          />
          <button className="button primary" type="button" onClick={addModel} disabled={!newModel.trim()}>
            <Plus size={16} /> Add model
          </button>
        </div>
      </section>

      {draft.oauthProfile ? (
        <section className="panel compact">
          <div className="panel-heading">
            <div>
              <p className="subtle">Subscription OAuth ({draft.oauthProfile})</p>
              <h2>OAuth connection</h2>
            </div>
          </div>
          <p className="compact-copy">
            {hasOAuthToken
              ? `Connected${draft.oauthTokenExpiresAt ? ` · expires ${new Date(draft.oauthTokenExpiresAt).toLocaleString()}` : ""}${draft.oauthProjectId ? ` · project ${draft.oauthProjectId}` : ""}${draft.oauthMachineId ? " · machine id set" : ""}. Tokens refresh automatically where supported.`
              : usesDeviceFlow
                ? `Not connected — start the device flow, then authorize NesaRouter with ${deviceVendorLabel} in a browser.`
                : usesCursorImport
                  ? "Not connected — import the token from this machine's Cursor IDE (state.vscdb), or paste access token + machine id."
                  : "Not connected — Connect opens the vendor login in a new tab. Paste the code here (Claude / Gemini), or wait while this page picks up the token."}
          </p>
          {usesCursorImport ? (
            <>
              <div className="button-row">
                <button className="button primary" type="button" onClick={autoImportCursor} disabled={cursorImporting}>
                  <PlugZap size={16} /> {cursorImporting ? "Importing…" : hasOAuthToken ? "Re-import from Cursor" : "Auto-import from Cursor"}
                </button>
                <button className="button" type="button" onClick={() => setShowImport((v) => !v)}>
                  <KeyRound size={16} /> Paste manually
                </button>
                {hasOAuthToken ? (
                  <button className="button danger-button" type="button" onClick={disconnectOAuth}>
                    <Trash2 size={16} /> Disconnect
                  </button>
                ) : null}
              </div>
              {showImport ? (
                <div className="oauth-import">
                  <p className="subtle">From Cursor state.vscdb: cursorAuth/accessToken and storage.serviceMachineId</p>
                  <input suppressHydrationWarning type="password" placeholder="access_token" value={importTok.accessToken} onChange={(e) => setImportTok({ ...importTok, accessToken: e.target.value })} />
                  <input suppressHydrationWarning type="password" placeholder="machine_id" value={importTok.machineId} onChange={(e) => setImportTok({ ...importTok, machineId: e.target.value })} />
                  <button className="button primary" type="button" onClick={importToken} disabled={!importTok.accessToken.trim()}>
                    <Save size={14} /> Save token
                  </button>
                </div>
              ) : null}
            </>
          ) : usesDeviceFlow ? (
            <>
              <div className="button-row">
                <button className="button primary" type="button" onClick={startDeviceFlow} disabled={devicePolling}>
                  <PlugZap size={16} /> {device ? "Restart device flow" : "Start device flow"}
                </button>
                {device ? (
                  <button className="button primary" type="button" onClick={pollDeviceFlow} disabled={devicePolling}>
                    {devicePolling ? "Polling…" : "I've authorized — poll"}
                  </button>
                ) : null}
                <button className="button" type="button" onClick={() => setShowImport((v) => !v)}>
                  <KeyRound size={16} /> Import token
                </button>
                {hasOAuthToken ? (
                  <button className="button danger-button" type="button" onClick={disconnectOAuth}>
                    <Trash2 size={16} /> Disconnect
                  </button>
                ) : null}
              </div>
              {device ? (
                <div className="oauth-import">
                  <p className="subtle">Open {device.verificationUri} and enter this code:</p>
                  <pre className="code-block" style={{ fontSize: "1.4rem", letterSpacing: "0.2em" }}>{device.userCode}</pre>
                  <a className="button primary" href={device.verificationUri} target="_blank" rel="noreferrer">Open {deviceVendorLabel} device page</a>
                </div>
              ) : null}
              {showImport ? (
                <div className="oauth-import">
                  <p className="subtle">Paste an existing token pair (e.g. from 9router or the vendor CLI).</p>
                  <input suppressHydrationWarning type="password" placeholder="access_token" value={importTok.accessToken} onChange={(e) => setImportTok({ ...importTok, accessToken: e.target.value })} />
                  <input suppressHydrationWarning type="password" placeholder="refresh_token (optional)" value={importTok.refreshToken} onChange={(e) => setImportTok({ ...importTok, refreshToken: e.target.value })} />
                  <input suppressHydrationWarning type="number" placeholder="expires_in (seconds, optional)" value={importTok.expiresIn} onChange={(e) => setImportTok({ ...importTok, expiresIn: e.target.value })} />
                  <button className="button primary" type="button" onClick={importToken} disabled={!importTok.accessToken.trim()}>
                    <Save size={14} /> Save token
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <>
              <div className="button-row">
                <button className="button primary" type="button" onClick={connectOAuth}>
                  <PlugZap size={16} /> {hasOAuthToken ? "Reconnect" : "Connect"}
                </button>
                <button className="button" type="button" onClick={() => setShowImport((v) => !v)}>
                  <KeyRound size={16} /> Import token
                </button>
                {hasOAuthToken ? (
                  <button className="button danger-button" type="button" onClick={disconnectOAuth}>
                    <Trash2 size={16} /> Disconnect
                  </button>
                ) : null}
              </div>
              {oauthPaste ? (
                <div className="oauth-import">
                  <p className="subtle">
                    {oauthPaste.hint ??
                      "Paste the authorization code from the other tab (Claude may use code#state)."}
                    {oauthWaiting ? " Waiting for completion…" : ""}
                  </p>
                  <input
                    suppressHydrationWarning
                    placeholder="Authorization code (from the other tab)"
                    value={oauthCode}
                    onChange={(e) => setOauthCode(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void submitOAuthCode(); } }}
                  />
                  <div className="button-row">
                    <button className="button primary" type="button" onClick={submitOAuthCode} disabled={!oauthCode.trim()}>
                      <Save size={14} /> Submit code
                    </button>
                    {oauthWaiting ? (
                      <button className="button" type="button" onClick={stopOauthPoll}>
                        Cancel wait
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
              {showImport ? (
                <div className="oauth-import">
                  <p className="subtle">Paste an existing token pair (e.g. from 9router or the vendor CLI).</p>
                  <input suppressHydrationWarning type="password" placeholder="access_token" value={importTok.accessToken} onChange={(e) => setImportTok({ ...importTok, accessToken: e.target.value })} />
                  <input suppressHydrationWarning type="password" placeholder="refresh_token (optional)" value={importTok.refreshToken} onChange={(e) => setImportTok({ ...importTok, refreshToken: e.target.value })} />
                  <input suppressHydrationWarning type="number" placeholder="expires_in (seconds, optional)" value={importTok.expiresIn} onChange={(e) => setImportTok({ ...importTok, expiresIn: e.target.value })} />
                  <button className="button primary" type="button" onClick={importToken} disabled={!importTok.accessToken.trim()}>
                    <Save size={14} /> Save token
                  </button>
                </div>
              ) : null}
            </>
          )}
          {oauthMessage ? <p className="test-message">{oauthMessage}</p> : null}
        </section>
      ) : null}
    </div>
  );
}
