"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, Globe, PlugZap, Power, RefreshCw, ShieldAlert, Waypoints } from "lucide-react";

interface TunnelStatus {
  cloudflare: {
    enabled: boolean;
    settingsEnabled: boolean;
    tunnelUrl: string;
    staleUrl?: string;
    running: boolean;
    localPort: number;
    spawnInProgress: boolean;
    download: { downloading: boolean; progress: number };
  };
  tailscale: {
    installed: boolean;
    loggedIn: boolean;
    running: boolean;
    enabled: boolean;
    settingsEnabled?: boolean;
    mode?: "serve" | "funnel";
    url: string;
    staleUrl?: string;
    localPort?: number;
  };
}

function parsePort(raw: string): number | null {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 65535) return null;
  return n;
}

export default function TunnelPanel() {
  const [status, setStatus] = useState<TunnelStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [port, setPort] = useState("20129");
  const [tsMode, setTsMode] = useState<"serve" | "funnel">("serve");
  const [message, setMessage] = useState("");
  const [loginUrl, setLoginUrl] = useState("");
  const portDirty = useRef(false);
  const modeDirty = useRef(false);

  async function refresh() {
    const response = await fetch("/api/tunnel/status").catch(() => null);
    if (response?.ok) {
      const data = await response.json();
      setStatus(data);
      if (!portDirty.current && data.cloudflare?.localPort) setPort(String(data.cloudflare.localPort));
      else if (!portDirty.current && data.tailscale?.localPort) setPort(String(data.tailscale.localPort));
      if (!modeDirty.current && (data.tailscale?.mode === "serve" || data.tailscale?.mode === "funnel")) {
        setTsMode(data.tailscale.mode);
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, []);

  async function enable() {
    setBusy("cf-enable");
    setMessage("");
    const parsed = parsePort(port);
    if (parsed == null) {
      setMessage("Port must be an integer between 1 and 65535.");
      setBusy("");
      return;
    }
    const response = await fetch("/api/tunnel/enable", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ port: parsed })
    });
    const result = await response.json().catch(() => ({}));
    if (response.ok) { setMessage(`Tunnel active: ${result.tunnelUrl}`); portDirty.current = false; }
    else setMessage(result.error ?? "Failed to enable tunnel.");
    setBusy("");
    refresh();
  }

  async function disable() {
    setBusy("cf-disable");
    try {
      const response = await fetch("/api/tunnel/disable", { method: "POST" });
      const result = await response.json().catch(() => ({}));
      setMessage(response.ok ? "Tunnel disabled." : result.error ?? "Failed to disable tunnel.");
      await refresh();
    } catch { setMessage("Failed to reach the server."); }
    finally { setBusy(""); }
  }

  async function enableTailscale() {
    setBusy("ts-enable");
    setMessage("");
    setLoginUrl("");
    const parsed = parsePort(port);
    if (parsed == null) {
      setMessage("Port must be an integer between 1 and 65535.");
      setBusy("");
      return;
    }
    const response = await fetch("/api/tunnel/tailscale", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ port: parsed, mode: tsMode })
    });
    const result = await response.json().catch(() => ({}));
    if (response.ok) { setMessage(`Tailscale ${tsMode} active${result.url ? `: ${result.url}` : ""}`); portDirty.current = false; modeDirty.current = false; }
    else {
      setMessage(result.error ?? "Failed to enable Tailscale.");
      if (result.enableUrl) {
        setLoginUrl(result.enableUrl);
        window.open(result.enableUrl, "_blank");
      }
    }
    setBusy("");
    refresh();
  }

  async function disableTailscale() {
    setBusy("ts-disable");
    try {
      const response = await fetch("/api/tunnel/tailscale", { method: "DELETE" });
      const result = await response.json().catch(() => ({}));
      setMessage(response.ok ? "Tailscale disabled." : result.error ?? "Failed to disable Tailscale.");
      await refresh();
    } catch { setMessage("Failed to reach the server."); }
    finally { setBusy(""); }
  }

  async function loginTailscale() {
    setBusy("ts-login");
    const response = await fetch("/api/tunnel/tailscale/login", { method: "POST" });
    const result = await response.json().catch(() => ({}));
    if (response.ok && result.loginUrl) {
      setLoginUrl(result.loginUrl);
      window.open(result.loginUrl, "_blank");
    } else {
      setMessage(result.error ?? "Tailscale login failed.");
    }
    setBusy("");
  }

  if (loading) return <p className="subtle">Loading tunnel status…</p>;

  const cf = status?.cloudflare;
  const ts = status?.tailscale;

  return (
    <div className="providers-stack">
      <section className="panel compact">
        <div className="panel-heading">
          <div>
            <p className="subtle">No-account quick tunnel</p>
            <h2>Cloudflare Tunnel</h2>
          </div>
          <Waypoints size={18} />
        </div>
        <p className="compact-copy">
          Spawns a local <code>cloudflared</code> binary (downloaded automatically to <code>data/bin</code>) and exposes
          this NesaRouter on a random <code>*.trycloudflare.com</code> URL. No Cloudflare account needed. The URL is
          ephemeral; if Cloudflare was left enabled, NesaRouter restores it after a process restart and respawns if the
          tunnel binary exits.
        </p>
        <p className="test-message" style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <ShieldAlert size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>
            Public tunnels publish the whole app — admin login, <code>/api/health</code>, and{" "}
            <code>/api/metrics</code> (unless <code>NESA_METRICS_TOKEN</code> is set). Use a strong admin password and
            prefer Tailscale <strong>serve</strong> for private access.
          </span>
        </p>
        <div className="settings-grid">
          <label>
            Local port
            <input value={port} onChange={(event) => { portDirty.current = true; setPort(event.target.value || "20129"); }} />
          </label>
        </div>
        {cf?.download.downloading ? (
          <p className="test-message">Downloading cloudflared… {cf.download.progress}%</p>
        ) : null}
        {cf?.tunnelUrl ? (
          <p className="test-message ok">
            <Globe size={14} /> <a href={cf.tunnelUrl} target="_blank" rel="noreferrer">{cf.tunnelUrl}</a>
          </p>
        ) : null}
        {cf?.staleUrl ? (
          <p className="test-message error">
            Configured but not running. Last URL was <code>{cf.staleUrl}</code> — click Enable/Restart to restore.
          </p>
        ) : null}
        {cf?.settingsEnabled && !cf?.running && !cf?.staleUrl && !cf?.spawnInProgress ? (
          <p className="test-message error">Tunnel is marked enabled in settings but is not running.</p>
        ) : null}
        <div className="button-row">
          <button className="button primary" type="button" onClick={enable} disabled={busy === "cf-enable" || cf?.spawnInProgress}>
            <PlugZap size={16} /> {busy === "cf-enable" || cf?.spawnInProgress ? "Starting…" : cf?.enabled ? "Restart" : "Enable"}
          </button>
          {cf?.enabled || cf?.settingsEnabled ? (
            <button className="button danger-button" type="button" onClick={disable} disabled={busy === "cf-disable"}>
              <Power size={16} /> Disable
            </button>
          ) : null}
          <button className="button" type="button" onClick={refresh}>
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </section>

      <section className="panel compact">
        <div className="panel-heading">
          <div>
            <p className="subtle">Private tailnet / public funnel</p>
            <h2>Tailscale</h2>
          </div>
          <Globe size={18} />
        </div>
        <p className="compact-copy">
          Uses the system <code>tailscale</code> binary. <strong>serve</strong> exposes NesaRouter on your private
          tailnet (only your devices); <strong>funnel</strong> exposes it publicly via Tailscale&apos;s proxy.
        </p>
        {tsMode === "funnel" ? (
          <p className="test-message" style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <ShieldAlert size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>
              Funnel is public internet exposure — same risks as Cloudflare quick tunnel (login UI + open health/metrics
              endpoints). Prefer <strong>serve</strong> unless you intentionally need a public URL.
            </span>
          </p>
        ) : null}
        {!ts?.installed ? (
          <p className="test-message error">Tailscale binary not found. Install Tailscale from tailscale.com first.</p>
        ) : (
          <>
            <div className="provider-badges">
              <span className={`status ${ts.running ? "success" : "neutral"}`}>{ts.running ? "daemon running" : "daemon off"}</span>
              <span className={`status ${ts.loggedIn ? "success" : "neutral"}`}>{ts.loggedIn ? "logged in" : "not logged in"}</span>
            </div>
            <div className="settings-grid">
              <label>
                Mode
                <select value={tsMode} onChange={(event) => { modeDirty.current = true; setTsMode(event.target.value as "serve" | "funnel"); }}>
                  <option value="serve">serve (private tailnet)</option>
                  <option value="funnel">funnel (public)</option>
                </select>
              </label>
            </div>
            {ts.url ? (
              <p className="test-message ok">
                <ExternalLink size={14} /> <a href={ts.url} target="_blank" rel="noreferrer">{ts.url}</a>
                {ts.mode ? <span className="subtle"> · {ts.mode}</span> : null}
              </p>
            ) : null}
            {ts.staleUrl ? (
              <p className="test-message error">
                Configured ({ts.mode ?? "serve"}) but not active. Last URL was <code>{ts.staleUrl}</code> — click Enable
                to restore.
              </p>
            ) : null}
            {!ts.loggedIn ? (
              <div className="button-row">
                <button className="button primary" type="button" onClick={loginTailscale} disabled={busy === "ts-login"}>
                  <PlugZap size={16} /> {busy === "ts-login" ? "Starting login…" : "Log in to Tailscale"}
                </button>
              </div>
            ) : (
              <div className="button-row">
                <button className="button primary" type="button" onClick={enableTailscale} disabled={busy === "ts-enable"}>
                  <PlugZap size={16} />{" "}
                  {busy === "ts-enable" ? "Enabling…" : ts.enabled ? "Re-enable" : `Enable ${tsMode}`}
                </button>
                {ts.enabled || ts.settingsEnabled ? (
                  <button className="button danger-button" type="button" onClick={disableTailscale} disabled={busy === "ts-disable"}>
                    <Power size={16} /> Disable
                  </button>
                ) : null}
              </div>
            )}
          </>
        )}
        {loginUrl ? (
          <p className="test-message">
            Open this Tailscale admin link, enable Serve/Funnel for this node, then click Enable again:{" "}
            <a href={loginUrl} target="_blank" rel="noreferrer">{loginUrl}</a>
          </p>
        ) : null}
      </section>

      {message ? <p className="test-message">{message}</p> : null}
    </div>
  );
}
