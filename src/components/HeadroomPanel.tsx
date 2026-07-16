"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, FlaskConical, Package, Play, RefreshCw, Save, Square } from "lucide-react";
import type { HeadroomExtra } from "@/lib/headroom/detect";

interface Status {
  installed: boolean;
  path: string | null;
  running: boolean;
  python: string | null;
  version: string | null;
  extras: Record<HeadroomExtra, boolean>;
  pid: number | null;
  url: string;
}

interface PipelineSettings {
  headroomEnabled: boolean;
  headroomUrl: string;
  headroomCompressUserMessages: boolean;
}

export default function HeadroomPanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [pipeline, setPipeline] = useState<PipelineSettings>({
    headroomEnabled: false,
    headroomUrl: "http://localhost:8787",
    headroomCompressUserMessages: false
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [logs, setLogs] = useState("");
  const [saved, setSaved] = useState(false);
  const pipelineDirty = useRef(false);

  async function refresh() {
    const [statusRes, stateRes] = await Promise.all([
      fetch("/api/headroom/status").catch(() => null),
      fetch("/api/state").catch(() => null)
    ]);
    if (statusRes?.ok) setStatus(await statusRes.json());
    if (stateRes?.ok) {
      const state = await stateRes.json();
      if (!pipelineDirty.current) {
        setPipeline({
          headroomEnabled: Boolean(state.router?.headroomEnabled),
          headroomUrl: state.router?.headroomUrl || "http://localhost:8787",
          headroomCompressUserMessages: Boolean(state.router?.headroomCompressUserMessages)
        });
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, []);

  async function savePipeline() {
    setBusy("save-pipeline");
    setSaved(false);
    setMessage("");
    const stateRes = await fetch("/api/state").catch(() => null);
    if (!stateRes?.ok) {
      setMessage("Could not load current settings.");
      setBusy("");
      return;
    }
    const state = await stateRes.json();
    const response = await fetch("/api/state", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        budget: state.budget,
        router: {
          ...state.router,
          headroomEnabled: pipeline.headroomEnabled,
          headroomUrl: pipeline.headroomUrl,
          headroomCompressUserMessages: pipeline.headroomCompressUserMessages
        }
      })
    });
    setMessage(response.ok ? "Pipeline settings saved." : "Failed to save settings.");
    setSaved(response.ok);
    if (response.ok) pipelineDirty.current = false;
    setBusy("");
  }

  async function start() {
    setBusy("start");
    setMessage("");
    const response = await fetch("/api/headroom/start?action=start", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    const result = await response.json().catch(() => ({}));
    setMessage(response.ok ? `Started (pid ${result.pid}).` : result.error ?? "Failed to start.");
    setBusy("");
    refresh();
  }

  async function stop() {
    setBusy("stop");
    try {
      const response = await fetch("/api/headroom/start?action=stop", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      const result = await response.json().catch(() => ({}));
      setMessage(response.ok ? (result.stopped ? "Stopped." : "Proxy was not running.") : result.error ?? "Failed to stop.");
      await refresh();
    } catch {
      setMessage("Failed to reach the server.");
    } finally {
      setBusy("");
    }
  }

  async function restart() {
    setBusy("restart");
    const response = await fetch("/api/headroom/start?action=restart", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    const result = await response.json().catch(() => ({}));
    setMessage(response.ok ? `Restarted (pid ${result.pid}).` : result.error ?? "Failed to restart.");
    setBusy("");
    refresh();
  }

  async function installBase() {
    setBusy("install-base");
    setMessage("Installing headroom-ai[proxy]…");
    const response = await fetch("/api/headroom/extras", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ extras: [] })
    });
    const result = await response.json().catch(() => ({}));
    setMessage(response.ok ? `Installed ${result.spec}.` : result.error ?? "Install failed.");
    setBusy("");
    refresh();
  }

  async function toggleExtra(extra: HeadroomExtra, on: boolean) {
    setBusy(`extra-${extra}`);
    setMessage("");
    const response = await fetch("/api/headroom/extras", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ extras: [extra], action: on ? "install" : "uninstall" })
    });
    const result = await response.json().catch(() => ({}));
    setMessage(response.ok ? `${on ? "Installed" : "Removed"} ${extra} extras.` : result.error ?? "Action failed.");
    setBusy("");
    refresh();
  }

  async function showLogs() {
    const response = await fetch("/api/headroom/logs?which=proxy").catch(() => null);
    if (response?.ok) {
      const data = await response.json();
      setLogs(data.tail ?? "");
    }
  }

  if (loading) return <p className="subtle">Loading headroom status…</p>;

  return (
    <div className="providers-stack">
      <section className="panel compact">
        <div className="panel-heading">
          <div>
            <p className="subtle">Chat pipeline</p>
            <h2>Route through Headroom</h2>
          </div>
          <Save size={18} />
        </div>
        <p className="compact-copy">
          When enabled, <code>/v1/chat/completions</code> (and translator adapters) POST messages to Headroom
          <code>/v1/compress</code> before cache/upstream. Fail-open: if the proxy is down, the original body is used.
        </p>
        <label className="check-row">
          <input
            type="checkbox"
            checked={pipeline.headroomEnabled}
            onChange={(event) => { pipelineDirty.current = true; setPipeline({ ...pipeline, headroomEnabled: event.target.checked }); }}
          />
          Compress chat requests via Headroom
        </label>
        <div className="settings-grid">
          <label>
            Headroom URL
            <input
              value={pipeline.headroomUrl}
              onChange={(event) => { pipelineDirty.current = true; setPipeline({ ...pipeline, headroomUrl: event.target.value }); }}
              placeholder="http://localhost:8787"
            />
          </label>
        </div>
        <label className="check-row">
          <input
            type="checkbox"
            checked={pipeline.headroomCompressUserMessages}
            onChange={(event) => { pipelineDirty.current = true; setPipeline({ ...pipeline, headroomCompressUserMessages: event.target.checked }); }}
          />
          Also compress user messages
        </label>
        <div className="button-row">
          <button className="button primary" type="button" onClick={savePipeline} disabled={busy === "save-pipeline"}>
            <Save size={16} /> {busy === "save-pipeline" ? "Saving…" : saved ? "Saved" : "Save pipeline settings"}
          </button>
        </div>
      </section>

      <section className="panel compact">
        <div className="panel-heading">
          <div>
            <p className="subtle">Optional compression proxy</p>
            <h2>Headroom process</h2>
          </div>
          <FlaskConical size={18} />
        </div>
        <p className="compact-copy">
          Headroom is an external Python CLI (<code>headroom-ai[proxy]</code>) on port 8787. Start it here, then enable
          the pipeline toggle above. Complements built-in Token Saver / RTK-lite.
        </p>
        {!status?.installed ? (
          <>
            <p className="test-message error">Headroom CLI not installed.</p>
            <div className="button-row">
              <button className="button primary" type="button" onClick={installBase} disabled={busy === "install-base"}>
                <Package size={16} /> {busy === "install-base" ? "Installing…" : "Install headroom-ai[proxy]"}
              </button>
            </div>
            {!status?.python ? <p className="test-message error">Python &ge; 3.10 not found on PATH.</p> : null}
          </>
        ) : (
          <>
            <div className="provider-badges">
              <span className={`status ${status.running ? "success" : "neutral"}`}>{status.running ? "proxy running" : "proxy stopped"}</span>
              <span className="status neutral">v{status.version ?? "?"}</span>
              {status.pid ? <span className="status neutral">pid {status.pid}</span> : null}
            </div>
            <div className="button-row">
              {!status.running ? (
                <button className="button primary" type="button" onClick={start} disabled={busy === "start"}>
                  <Play size={16} /> {busy === "start" ? "Starting…" : "Start proxy"}
                </button>
              ) : (
                <button className="button danger-button" type="button" onClick={stop} disabled={busy === "stop"}>
                  <Square size={16} /> {busy === "stop" ? "Stopping…" : "Stop"}
                </button>
              )}
              <button className="button" type="button" onClick={restart} disabled={busy === "restart"}>
                <RefreshCw size={16} /> {busy === "restart" ? "Restarting…" : "Restart"}
              </button>
              <a className="button" href={status.url} target="_blank" rel="noreferrer">
                <ExternalLink size={16} /> Open dashboard
              </a>
            </div>
            <h3>Compression extras</h3>
            <p className="subtle"><code>code</code> adds tree-sitter AST compression; <code>ml</code> adds Kompress-v2 (HuggingFace model, heavy).</p>
            <div className="button-row">
              {(["code", "ml"] as HeadroomExtra[]).map((extra) => (
                <button
                  key={extra}
                  className={`button ${status.extras?.[extra] ? "primary" : ""}`}
                  type="button"
                  onClick={() => toggleExtra(extra, !status.extras?.[extra])}
                  disabled={busy === `extra-${extra}`}
                >
                  <Package size={14} /> {extra}: {status.extras?.[extra] ? "on" : "off"}
                </button>
              ))}
            </div>
          </>
        )}
        <div className="button-row">
          <button className="button" type="button" onClick={showLogs}>
            <RefreshCw size={14} /> Show proxy log tail
          </button>
        </div>
        {logs ? <pre className="code-block">{logs}</pre> : null}
        {message ? <p className="test-message">{message}</p> : null}
      </section>
    </div>
  );
}
