"use client";

import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, AlertTriangle, Check, Clock3, LocateFixed, Pause, Play, RefreshCw, Server, ZoomIn, ZoomOut } from "lucide-react";
import type { ProviderConfig, UsageLog } from "@/core/types";
import ProviderIcon from "@/components/ProviderIcon";
import { money, formatNumber, formatTime } from "@/lib/format";
import { providerActivity, routeEventsForProviders, type RouteEvent } from "@/lib/usageFlow";

const LIVE_REFRESH_MS = 4_000;

function relativeTime(ageMs: number) {
  if (!Number.isFinite(ageMs)) return "unknown";
  if (ageMs < 10_000) return "now";
  if (ageMs < 60_000) return `${Math.floor(ageMs / 1000)}s ago`;
  if (ageMs < 3_600_000) return `${Math.floor(ageMs / 60_000)}m ago`;
  return `${Math.floor(ageMs / 3_600_000)}h ago`;
}

type RouteMapNode = {
  id: string;
  label: string;
  title: string;
  detail: string;
  x: number;
  y: number;
  state: "neutral" | "success" | "error" | "cache";
  live: boolean;
  provider?: { id?: string; name?: string; providerName?: string; model?: string };
};

function isVisibleProvider(provider?: Pick<ProviderConfig, "status" | "connectionStatus">) {
  if (!provider || provider.status === "disabled") return false;
  return provider.status === "active" || provider.connectionStatus === "connected";
}

function clampZoom(value: number) {
  return Math.min(1.8, Math.max(0.1, Number(value.toFixed(2))));
}

function providerMapNodes(providers: ProviderConfig[], selected?: RouteEvent, liveProviderIds?: Set<string>) {
  let ring = 0;
  let ringStart = 0;
  return providers.map((provider, index): RouteMapNode => {
    let capacity = 6 + ring * 4;
    while (index >= ringStart + capacity) {
      ringStart += capacity;
      ring += 1;
      capacity = 6 + ring * 4;
    }
    const position = index - ringStart;
    const count = Math.min(capacity, providers.length - ringStart);
    const angle = -Math.PI / 2 + (Math.PI * 2 * position) / Math.max(count, 1);
    // Ring spacing is based on the rendered 176x58px provider card. The
    // increasing capacity keeps tangential spacing above the card width while
    // the radial gap prevents neighboring rings from colliding.
    const radiusX = 260 + ring * 210;
    const radiusY = 130 + ring * 110;
    const isSelected = provider.id === selected?.providerId || provider.name === selected?.providerName;
    return {
      id: provider.id,
      label: provider.connectionStatus === "connected" ? "Connected" : "Active",
      title: provider.name,
      detail: provider.model || "Default model",
      x: Math.round(Math.cos(angle) * radiusX),
      y: Math.round(Math.sin(angle) * radiusY),
      state: isSelected ? (selected?.cacheStatus === "hit" ? "cache" : selected?.status === "error" ? "error" : "success") : "neutral",
      live: liveProviderIds?.has(provider.id) ?? false,
      provider
    };
  });
}

function flowPath(node: RouteMapNode, index: number) {
  const distance = Math.max(Math.hypot(node.x, node.y), 1);
  const unitX = node.x / distance;
  const unitY = node.y / distance;
  const startX = Math.round(unitX * 72);
  const startY = Math.round(unitY * 72);
  const endX = Math.round(node.x - unitX * 102);
  const endY = Math.round(node.y - unitY * 38);
  const bend = (index % 2 === 0 ? 1 : -1) * (20 + (index % 3) * 7);
  const middleX = Math.round((startX + endX) / 2 - unitY * bend);
  const middleY = Math.round((startY + endY) / 2 + unitX * bend);
  return `M ${startX} ${startY} Q ${middleX} ${middleY} ${endX} ${endY}`;
}

function RouteMapNodeCard({ node }: { node: RouteMapNode }) {
  return (
    <div
      className={`route-map-node ${node.state}${node.live ? " live" : ""}`}
      style={{ left: `calc(50% + ${node.x}px)`, top: `calc(50% + ${node.y}px)` }}
    >
      {node.provider ? <ProviderIcon provider={node.provider} size="sm" active={node.state === "success" || node.state === "cache"} /> : null}
      <span>
        <small>{node.label}</small>
        <strong title={node.title}>{node.title}</strong>
        <em title={node.detail}>{node.detail}</em>
      </span>
    </div>
  );
}

/** Comet head + fading glow trail following the selected route path. */
function RouteComet({ path, tone }: { path: string; tone: "success" | "error" | "cache" }) {
  // Negative begins keep every trail dot mid-flight on mount; each dot lags the
  // head by 45ms so the trail hugs the curve instead of drawing a chord.
  const trail = [
    { r: 3.1, begin: "-2.655s", className: "t1" },
    { r: 2.4, begin: "-2.61s", className: "t2" },
    { r: 1.8, begin: "-2.565s", className: "t3" },
    { r: 1.2, begin: "-2.52s", className: "t4" }
  ];
  return (
    <g className={`route-flow-comet ${tone}`}>
      {trail.map((dot) => (
        <circle key={dot.className} className={`route-comet-trail ${dot.className}`} r={dot.r}>
          <animateMotion dur="1.35s" path={path} repeatCount="indefinite" begin={dot.begin} />
        </circle>
      ))}
      <circle className="route-comet-head" r="4">
        <animateMotion dur="1.35s" path={path} repeatCount="indefinite" begin="-2.7s" />
      </circle>
    </g>
  );
}

function RouteMap({
  selected,
  providers,
  liveProviderIds
}: {
  selected?: RouteEvent;
  providers: ProviderConfig[];
  liveProviderIds: Set<string>;
}) {
  const nodes = useMemo(() => providerMapNodes(providers, selected, liveProviderIds), [providers, selected, liveProviderIds]);
  const [mapSize, setMapSize] = useState({ width: 820, height: 430 });
  const maxNodeX = Math.max(1, ...nodes.map((node) => Math.abs(node.x) + 94));
  const maxNodeY = Math.max(1, ...nodes.map((node) => Math.abs(node.y) + 38));
  const fittedScale = clampZoom(Math.min(1, (mapSize.width / 2 - 24) / maxNodeX, (mapSize.height / 2 - 24) / maxNodeY));
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: fittedScale });
  const [dragging, setDragging] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const viewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const syncSize = () => {
      const rect = viewport.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) setMapSize({ width: rect.width, height: rect.height });
    };
    syncSize();
    const observer = new ResizeObserver(syncSize);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setTransform({ x: 0, y: 0, scale: fittedScale });
  }, [fittedScale]);

  function zoom(delta: number) {
    setTransform((current) => ({ ...current, scale: clampZoom(current.scale + delta) }));
  }

  function resetView() {
    setTransform({ x: 0, y: 0, scale: fittedScale });
  }

  function onWheel(event: ReactWheelEvent<HTMLDivElement>) {
    event.preventDefault();
    zoom(event.deltaY < 0 ? 0.08 : -0.08);
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest(".route-map-controls")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    dragStart.current = { x: event.clientX, y: event.clientY, tx: transform.x, ty: transform.y };
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    setTransform((current) => ({
      ...current,
      x: dragStart.current.tx + event.clientX - dragStart.current.x,
      y: dragStart.current.ty + event.clientY - dragStart.current.y
    }));
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setDragging(false);
  }

  return (
    <div
      ref={viewportRef}
      className={`route-map ${selected?.isRecent ? "recent" : ""} ${selected?.status ?? "idle"} ${dragging ? "dragging" : ""}`}
      aria-label="Selected route live map"
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className="route-map-controls"
        aria-label="Live map controls"
        onPointerDown={(event) => event.stopPropagation()}
        onWheel={(event) => event.stopPropagation()}
      >
        <button className="icon-button" type="button" onClick={() => zoom(-0.1)} aria-label="Zoom out selected route map"><ZoomOut size={14} /></button>
        <button className="icon-button" type="button" onClick={resetView} aria-label="Reset selected route map"><LocateFixed size={14} /></button>
        <button className="icon-button" type="button" onClick={() => zoom(0.1)} aria-label="Zoom in selected route map"><ZoomIn size={14} /></button>
        <span>{Math.round(transform.scale * 100)}%</span>
      </div>
      <div
        className="route-map-stage"
        style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})` }}
      >
        <svg className="route-map-lines" viewBox="-410 -215 820 430" aria-hidden="true">
          <defs>
            <marker id="route-arrow-idle" markerHeight="6" markerWidth="7" orient="auto" refX="6" refY="3">
              <path d="M 0 0 L 7 3 L 0 6 Z" className="route-flow-arrow idle" />
            </marker>
            <marker id="route-arrow-active" markerHeight="7" markerWidth="8" orient="auto" refX="7" refY="3.5">
              <path d="M 0 0 L 8 3.5 L 0 7 Z" className="route-flow-arrow active" />
            </marker>
          </defs>
          {nodes.map((node, index) => {
            const selectedProvider = node.state !== "neutral";
            const path = flowPath(node, index);
            const tone = node.state === "cache" ? "cache" : node.state === "error" ? "error" : "success";
            return (
              <g key={node.id}>
                <path
                  className={`route-flow-path ${selectedProvider ? `active ${tone}` : "idle"}`}
                  d={path}
                  markerEnd={`url(#route-arrow-${selectedProvider ? "active" : "idle"})`}
                />
                {selectedProvider && !reduceMotion ? <RouteComet path={path} tone={tone} /> : null}
              </g>
            );
          })}
        </svg>
        {!reduceMotion ? (
          <div className="route-hub-waves" key={selected?.id ?? "idle"} aria-hidden="true">
            <span className="route-hub-flash" />
            <span className="route-hub-wave w1" />
            <span className="route-hub-wave w2" />
            <span className="route-hub-wave w3" />
          </div>
        ) : null}
        <div className="route-hub" aria-label="NesaRouter decision hub">
          <span className="brand-icon router-center-logo" aria-hidden="true">
            <span className="brand-letter">N</span>
          </span>
          <span>Router</span>
          <strong title={selected?.routingReason || "Waiting for route"}>NesaRouter</strong>
          <em title={selected?.routingReason || "Waiting for route"}>{selected?.cacheStatus === "hit" ? "Cache hit" : selected?.routingReason || "Waiting for route"}</em>
        </div>
        {nodes.map((node) => <RouteMapNodeCard node={node} key={node.id} />)}
      </div>
    </div>
  );
}

export default function UsageFlow({ providers, usage }: { providers: ProviderConfig[]; usage: UsageLog[] }) {
  const [liveUsage, setLiveUsage] = useState(usage);
  const [selectedId, setSelectedId] = useState(usage[0]?.id ?? "");
  const [paused, setPaused] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshError, setRefreshError] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const visibleProviders = useMemo(() => providers.filter(isVisibleProvider), [providers]);
  const visibleProviderIds = useMemo(() => new Set(visibleProviders.map((provider) => provider.id)), [visibleProviders]);
  const events = useMemo(
    () => routeEventsForProviders(liveUsage, visibleProviders, nowMs),
    [liveUsage, nowMs, visibleProviders]
  );
  const selected = events.find((row) => row.id === selectedId) ?? events[0];
  const fleet = useMemo(() => providerActivity(visibleProviders, events), [events, visibleProviders]);
  const recentUpstream = events.filter((row) => row.isRecent && row.isUpstream);
  const recentErrors = recentUpstream.filter((row) => row.status === "error").length;
  const liveProviderIds = useMemo(
    () => new Set(recentUpstream.map((row) => row.providerId).filter((id): id is string => Boolean(id))),
    [recentUpstream]
  );
  const liveProviderCount = liveProviderIds.size;
  const selectedVisibleSkipped = selected?.skippedProviders?.filter((item) => visibleProviderIds.has(item.providerId)) ?? [];

  async function refresh() {
    setRefreshing(true);
    setRefreshError("");
    try {
      const response = await fetch("/api/usage", { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error(`Usage refresh failed (${response.status})`);
      const rows = (await response.json()) as UsageLog[];
      if (!Array.isArray(rows)) throw new Error("Usage response is invalid");
      setLiveUsage(rows);
      setNowMs(Date.now());
      setLastUpdated(new Date());
      setSelectedId((current) => current || rows[0]?.id || "");
    } catch (error) {
      setRefreshError(error instanceof Error ? error.message : "Usage refresh failed");
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (paused) return;
    void refresh();
    const timer = window.setInterval(() => void refresh(), LIVE_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [paused]);

  return (
    <section className="panel usage-flow-panel" aria-labelledby="live-routing-title">
      <div className="live-map-header">
        <div>
          <div className="live-map-title-row">
            <span className={`live-indicator ${paused ? "paused" : ""}`} aria-hidden="true" />
            <h2 id="live-routing-title">Live routing</h2>
          </div>
          <p>Inspect the selected route, skipped providers, cost, and provider health.</p>
        </div>
        <div className="live-map-actions">
          <span className="live-map-updated" role="status">
            {refreshError || (paused ? "Updates paused" : lastUpdated ? `Updated ${formatTime(lastUpdated)}` : "Connecting…")}
          </span>
          <button className="button secondary compact-button" type="button" onClick={() => setPaused((value) => !value)} aria-pressed={paused}>
            {paused ? <Play size={14} /> : <Pause size={14} />}
            {paused ? "Resume" : "Pause"}
          </button>
          <button className="icon-button" type="button" onClick={() => void refresh()} disabled={refreshing} aria-label="Refresh live routing">
            <RefreshCw size={15} className={refreshing ? "spin" : ""} />
          </button>
        </div>
      </div>

      <div className="live-map-summary" aria-label="Recent routing summary">
        <div><Activity size={15} /><span>Recent routes</span><strong>{recentUpstream.length}</strong></div>
        <div><Server size={15} /><span>Providers used</span><strong>{liveProviderCount}</strong></div>
        <div className={recentErrors ? "has-error" : ""}><AlertTriangle size={15} /><span>Errors</span><strong>{recentErrors}</strong></div>
        <div><Clock3 size={15} /><span>Window</span><strong>10 min</strong></div>
      </div>

      {events.length === 0 && visibleProviders.length === 0 ? (
        <div className="live-map-empty">
          <Activity size={22} />
          <strong>No routing events yet</strong>
          <p>Send a request through the NesaRouter endpoint. Its route and decision trail will appear here.</p>
        </div>
      ) : (
        <div className="routing-workbench">
          <article className="route-inspector" aria-live="polite">
            <div className="workbench-heading">
              <span>{selected ? "Selected route" : "Provider topology"}</span>
              {selected ? (
                <strong className={`route-result ${selected.status}`}>{selected.status === "success" ? <Check size={13} /> : <AlertTriangle size={13} />}{selected.status}</strong>
              ) : <strong>Idle</strong>}
            </div>
            <RouteMap selected={selected} providers={visibleProviders} liveProviderIds={liveProviderIds} />
          </article>

          <div className="route-side-rail route-detail-collage">
          <section className="route-audit-panel" aria-labelledby="request-inspector-title">
            <div className="workbench-heading"><span id="request-inspector-title">Request inspector</span><strong>{selected?.status ?? "Idle"}</strong></div>
            {selected ? (
              <>
                <dl className="route-facts">
                  <div><dt>Tokens</dt><dd>{formatNumber(selected.inputTokens + selected.outputTokens)}</dd></div>
                  <div><dt>Cost</dt><dd>{money(selected.totalCostUsd)}</dd></div>
                  <div><dt>Budget</dt><dd>{selected.budgetStatus}</dd></div>
                  <div><dt>Cache</dt><dd>{selected.cacheStatus}</dd></div>
                  <div><dt>Tier</dt><dd>{selected.tier}</dd></div>
                  <div><dt>Task</dt><dd>{selected.taskType}</dd></div>
                </dl>
                <div className="route-decision">
                  <span>Decision</span>
                  <p>{selected.routingReason || "No routing reason was recorded."}</p>
                </div>
                {selectedVisibleSkipped.length ? (
                  <div className="route-skips">
                    <span>{selectedVisibleSkipped.length} skipped</span>
                    <p title={selectedVisibleSkipped.map((item) => `${item.providerId}: ${item.reason}`).join("\n")}>
                      {selectedVisibleSkipped.slice(0, 2).map((item) => item.providerId).join(", ")}
                      {selectedVisibleSkipped.length > 2 ? ` +${selectedVisibleSkipped.length - 2}` : ""}
                    </p>
                  </div>
                ) : null}
                {selected.error ? <p className="route-error">{selected.error}</p> : null}
              </>
            ) : (
              <div className="request-inspector-empty">
                <strong>No request selected</strong>
                <p>Active providers remain visible above. Send a request to inspect its routing decision.</p>
              </div>
            )}
          </section>
          <div className="provider-fleet-column">
              <div className="workbench-heading"><span>Provider fleet</span><strong>{visibleProviders.length}</strong></div>
            <div className="provider-fleet-list">
              {fleet.map(({ provider, activity }) => (
                <div className="fleet-row" key={provider.id}>
                  <ProviderIcon provider={provider} size="sm" active={Boolean(activity?.requests)} className="fleet-provider-icon" />
                  <span><strong>{provider.name}</strong><small>{provider.model || "Default model"}</small></span>
                  <span className="fleet-metrics"><strong>{activity?.requests ?? 0} req</strong><small>{provider.status}{activity?.errors ? ` / ${activity.errors} error` : ""}</small></span>
                </div>
              ))}
            </div>
          </div>
          <div className="route-rail-bottom">
          <div className="route-event-column">
            <div className="workbench-heading"><span>Event stream</span><strong>{events.length}</strong></div>
            <div className="route-event-list" aria-label="Routing events">
              {events.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  aria-pressed={selected?.id === row.id}
                  className={`route-event ${selected?.id === row.id ? "selected" : ""}`}
                  onClick={() => setSelectedId(row.id)}
                >
                  <span className={`event-state ${row.status} ${row.cacheStatus === "hit" ? "cache" : ""}`} aria-hidden="true" />
                  <span className="event-main"><strong>{row.model}</strong><small>{row.cacheStatus === "hit" ? "Cache" : row.providerName}</small></span>
                  <span className="event-meta"><strong>{money(row.totalCostUsd)}</strong><small>{relativeTime(row.ageMs)}</small></span>
                </button>
              ))}
              {events.length === 0 ? <p className="route-events-empty">No routing events yet.</p> : null}
            </div>
          </div>
          </div>
          </div>
        </div>
      )}
    </section>
  );
}
