"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, KeyRound, Layers, ListRestart, PlugZap, Plus, Save, Star, Trash2 } from "lucide-react";
import { ProviderConfig } from "@/core/types";
import ProviderIcon from "@/components/ProviderIcon";
import { adminFetch, ADMIN_SESSION_EXPIRED, isAdminUnauthorized, scheduleLoginRedirect } from "@/lib/adminFetch";
import { parseOAuthCallbackPaste } from "@/core/oauthCallbackPaste";

export default function ProviderDetail({
  provider,
  keyPreviews,
  keyCount,
  hasApiKey,
  hasOAuthToken,
  oauthAccountSummaries = [],
  routableOAuthCount = 0,
  tierLabel,
  canDelete = false
}: {
  provider: ProviderConfig;
  keyPreviews: string[];
  keyCount: number;
  hasApiKey: boolean;
  hasOAuthToken: boolean;
  oauthAccountSummaries?: Array<{
    id: string;
    name: string;
    connected: boolean;
    status: "connected" | "error" | "empty" | "unknown";
    lastError?: string;
    lastCheckedAt?: string;
    routable: boolean;
  }>;
  routableOAuthCount?: number;
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
  const [oauthPaste, setOauthPaste] = useState<{ state: string; hint?: string; mode?: "code" | "callbackUrl" } | null>(null);
  const [oauthCode, setOauthCode] = useState("");
  const [oauthWaiting, setOauthWaiting] = useState(false);
  const oauthPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [importTok, setImportTok] = useState({ accessToken: "", refreshToken: "", expiresIn: "", machineId: "" });
  const [device, setDevice] = useState<{ userCode: string; verificationUri: string; interval: number } | null>(null);
  const [devicePolling, setDevicePolling] = useState(false);
  const [cursorImporting, setCursorImporting] = useState(false);
  const [error, setError] = useState("");
  const [oauthTarget, setOauthTarget] = useState<{ accountId?: string; createNew: boolean }>({ createNew: false });
  const [liveOAuthAccounts, setLiveOAuthAccounts] = useState(oauthAccountSummaries);
  const [oauthProbeAt, setOauthProbeAt] = useState<string>("");

  useEffect(() => {
    setLiveOAuthAccounts(oauthAccountSummaries);
  }, [oauthAccountSummaries]);

  useEffect(() => {
    if (!draft.oauthProfile) return;
    let cancelled = false;

    async function refreshStatus(probe = false) {
      const response = await adminFetch(`/api/providers/${draft.id}/oauth/accounts/status`, {
        method: probe ? "POST" : "GET"
      });
      if (!response.ok || cancelled) return;
      const result = await response.json().catch(() => ({}));
      if (!result.accounts || cancelled) return;
      setLiveOAuthAccounts(result.accounts.map((account: any) => ({
        id: account.id,
        name: account.name,
        connected: account.status !== "empty",
        status: account.status,
        lastError: account.lastError,
        lastCheckedAt: account.lastCheckedAt,
        routable: Boolean(account.routable)
      })));
      if (result.updatedAt) setOauthProbeAt(result.updatedAt);
    }

    void refreshStatus(true);
    const fast = window.setInterval(() => { void refreshStatus(false); }, 12_000);
    const probe = window.setInterval(() => { void refreshStatus(true); }, 45_000);
    return () => {
      cancelled = true;
      window.clearInterval(fast);
      window.clearInterval(probe);
    };
  }, [draft.id, draft.oauthProfile]);

  function oauthStatusTone(status: string) {
    if (status === "connected") return "success";
    if (status === "error") return "error";
    return "neutral";
  }

  function oauthStatusText(account: { status: string; routable: boolean }) {
    if (account.status === "connected") return "connected";
    if (account.status === "error") return "error — skipped in routing";
    if (account.status === "empty") return "empty";
    return "checking…";
  }

  function oauthConnectBody() {
    return oauthTarget.createNew
      ? { createNew: true }
      : { accountId: oauthTarget.accountId ?? oauthAccountSummaries[0]?.id };
  }

  async function removeOAuthAccount(accountId: string) {
    const response = await adminFetch(`/api/providers/${draft.id}/oauth/accounts`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accountId })
    });
    if (response.ok) router.refresh();
    else {
      const result = await response.json().catch(() => ({}));
      setError(result.error ?? "Failed to remove OAuth account.");
    }
  }

  function handleSessionExpired(setMessage: (value: string) => void) {
    setMessage(ADMIN_SESSION_EXPIRED);
    scheduleLoginRedirect();
  }

  function guardAdminResponse(response: Response, setMessage: (value: string) => void) {
    if (!isAdminUnauthorized(response)) return false;
    handleSessionExpired(setMessage);
    return true;
  }

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
    if (guardAdminResponse(response, setError)) return;
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
    if (guardAdminResponse(response, setTestMessage)) {
      setTestResult("error");
      return;
    }
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

    // This must happen while handling the click. Opening after an await makes
    // browsers classify it as an unsolicited popup.
    const popup = window.open("", "nesa-oauth", "popup=yes,width=560,height=720");
    if (!popup) {
      setError("Pop-up blocked. Allow pop-ups for this site, then click Connect again.");
      setOauthMessage("");
      return;
    }

    const response = await adminFetch(`/api/providers/${draft.id}/oauth/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(oauthConnectBody())
    });
    if (guardAdminResponse(response, setError)) {
      popup.close();
      setOauthMessage("");
      return;
    }
    const result = await response.json().catch(() => ({}));
    if (!result.authorizeUrl) {
      popup.close();
      setOauthMessage(result.error ?? "Failed to start OAuth flow.");
      return;
    }

    try {
      // `noopener` deliberately returns null in several browsers, which made
      // the previous implementation report a blocked popup even when it opened.
      popup.opener = null;
      popup.location.assign(result.authorizeUrl);
    } catch {
      popup.close();
      setError("Could not open provider authorization. Click Connect again.");
      setOauthMessage("");
      return;
    }

    if (result.manualCode || result.loopback) {
      setOauthPaste({
        state: result.state,
        mode: result.loopback ? "callbackUrl" : "code",
        hint:
          result.hint ??
          (result.loopback
            ? "After ChatGPT redirects to localhost (page may fail to load), copy the FULL URL from the address bar and paste it here, then Save."
            : "Authorize in the other tab, then paste the code here.")
      });
      setOauthMessage(
        result.loopback
          ? "Authorize in the new tab, then paste the localhost callback URL below (same as 9router)."
          : "Authorize in the new tab, then paste the code below."
      );
    } else {
      setOauthPaste({
        state: result.state,
        mode: "code",
        hint: result.hint ?? "Authorize in the other tab. If a code or callback URL is shown, paste it here."
      });
      setOauthMessage("Authorize in the new tab…");
    }
    startOauthPoll({
      hadToken: Boolean(draft.oauthAccessToken),
      expiresAt: draft.oauthTokenExpiresAt,
      lastRefreshAt: draft.oauthLastRefreshAt
    });
  }

  async function submitOAuthCode() {
    setError("");
    const raw = oauthCode.trim();
    if (!raw) {
      setError(
        oauthPasteMode === "callbackUrl"
          ? "Paste the full callback URL from the browser address bar."
          : "Paste the authorization code first."
      );
      return;
    }
    const parsed = parseOAuthCallbackPaste(raw, oauthPaste?.state);
    if (!parsed.code) {
      setError("Could not find ?code= in the pasted value. Paste the full localhost callback URL.");
      return;
    }
    setOauthMessage("Exchanging code…");
    const response = await adminFetch(`/api/providers/${draft.id}/oauth/complete`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        callbackUrl: raw,
        code: raw,
        state: parsed.state ?? oauthPaste?.state
      })
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
    const accountId = oauthTarget.accountId ?? oauthAccountSummaries[0]?.id;
    if (!accountId) return;
    await removeOAuthAccount(accountId);
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
        machineId: importTok.machineId.trim() || undefined,
        ...oauthConnectBody()
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
      if (guardAdminResponse(detect, setError)) return;
      const found = await detect.json().catch(() => ({}));
      if (!detect.ok || !found.imported) {
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
    const response = await adminFetch(`/api/providers/${draft.id}/oauth/device/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(oauthConnectBody())
    });
    if (guardAdminResponse(response, setError)) return;
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
    if (guardAdminResponse(response, setError)) {
      setDevicePolling(false);
      return;
    }
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
  const usesLoopbackCallbackPaste = draft.oauthProfile === "openai_codex";
  const showOauthPastePanel = Boolean(oauthPaste) || usesLoopbackCallbackPaste;
  const oauthPasteMode = oauthPaste?.mode ?? (usesLoopbackCallbackPaste ? "callbackUrl" : "code");
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
              {isAccountProvider ? (
                <span className={`status ${routableOAuthCount > 0 ? "success" : hasOAuthToken ? "error" : "neutral"}`}>
                  OAuth {routableOAuthCount > 0 ? `${routableOAuthCount} routable` : hasOAuthToken ? "all accounts error" : "not connected"}
                </span>
              ) : (
                <span className={`status ${keyCountState > 0 ? "success" : "neutral"}`}>
                  <KeyRound size={12} /> {keyCountState} key{keyCountState === 1 ? "" : "s"}
                </span>
              )}
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
            <input
              suppressHydrationWarning
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              autoComplete="off"
            />
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
            <input
              suppressHydrationWarning
              value={draft.baseUrl}
              onChange={(event) => setDraft({ ...draft, baseUrl: event.target.value })}
              autoComplete="off"
              spellCheck={false}
            />
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
            autoComplete="new-password"
            spellCheck={false}
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
              <h2>OAuth accounts</h2>
            </div>
            <button
              className="button"
              type="button"
              onClick={() => setOauthTarget({ createNew: true })}
            >
              <Plus size={16} /> Add account
            </button>
          </div>
          <p className="compact-copy">
            Status updates in real time (green = routable, red = error/quota/no access and skipped in routing).
            {oauthProbeAt ? ` Last probe: ${new Date(oauthProbeAt).toLocaleTimeString()}.` : ""}
          </p>
          <div className="key-list">
            {liveOAuthAccounts.length === 0 ? (
              <p className="subtle">No accounts yet — Connect or Add account below.</p>
            ) : liveOAuthAccounts.map((account) => (
              <div key={account.id} className="key-row">
                <span className="key-preview"><KeyRound size={14} /> {account.name}</span>
                <span className={`status ${oauthStatusTone(account.status)}`}>{oauthStatusText(account)}</span>
                {account.lastError ? <small title={account.lastError} className="subtle">{account.lastError.slice(0, 80)}</small> : null}
                <button
                  className="button"
                  type="button"
                  onClick={() => setOauthTarget({ accountId: account.id, createNew: false })}
                >
                  Use
                </button>
                {account.connected ? (
                  <button className="button danger-button" type="button" onClick={() => removeOAuthAccount(account.id)}>
                    <Trash2 size={14} /> Remove
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          {oauthTarget.createNew ? <p className="subtle">Adding new account — Connect / device flow / import will attach to a new slot.</p> : oauthTarget.accountId ? <p className="subtle">Active slot: {liveOAuthAccounts.find((item) => item.id === oauthTarget.accountId)?.name ?? "selected account"}</p> : null}
          <p className="compact-copy">
            {hasOAuthToken
              ? `Connected${draft.oauthTokenExpiresAt ? ` · expires ${new Date(draft.oauthTokenExpiresAt).toLocaleString()}` : ""}${draft.oauthProjectId ? ` · project ${draft.oauthProjectId}` : ""}${draft.oauthMachineId ? " · machine id set" : ""}. Tokens refresh automatically where supported.`
              : usesDeviceFlow
                ? `Not connected — start the device flow, then authorize NesaRouter with ${deviceVendorLabel} in a browser.`
                : usesCursorImport
                  ? "Not connected — auto-import reads Cursor on the same machine as NesaRouter (not from your browser PC when using VPS). Or paste access token + machine id manually."
                  : draft.oauthProfile === "openai_codex"
                    ? "Not connected — Connect opens ChatGPT. After redirect to localhost (page may error), copy the FULL URL from the address bar (…?code=…&state=…) and paste it here, then Save — same as 9router."
                    : "Not connected — Connect opens the vendor login in a new tab. Claude / Gemini: paste the code. ChatGPT: paste the full localhost callback URL."}
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
              {showOauthPastePanel ? (
                <div className="oauth-import">
                  <p className="subtle">
                    {oauthPaste?.hint ??
                      (oauthPasteMode === "callbackUrl"
                        ? "After ChatGPT redirects to localhost:1455 (page may error), copy the FULL URL from the address bar and paste below — including ?code=…&state=…. Click Connect first in this tab, then authorize within ~30 minutes."
                        : "Paste the authorization code from the other tab (Claude may use code#state).")}
                    {oauthWaiting ? " Waiting for automatic completion…" : ""}
                  </p>
                  <textarea
                    suppressHydrationWarning
                    className="oauth-callback-paste"
                    rows={3}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    data-lpignore="true"
                    data-1p-ignore="true"
                    name="nesa-oauth-callback"
                    placeholder={
                      oauthPasteMode === "callbackUrl"
                        ? "http://localhost:1455/auth/callback?code=...&state=..."
                        : "Authorization code (from the other tab)"
                    }
                    value={oauthCode}
                    onChange={(e) => setOauthCode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void submitOAuthCode();
                      }
                    }}
                  />
                  <div className="button-row">
                    <button className="button primary" type="button" onClick={submitOAuthCode} disabled={!oauthCode.trim()}>
                      <Save size={14} /> {oauthPasteMode === "callbackUrl" ? "Save callback URL" : "Submit code"}
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
