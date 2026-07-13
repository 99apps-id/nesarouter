"use client";

import type { CSSProperties, PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LocateFixed, ZoomIn, ZoomOut } from "lucide-react";
import type { ProviderConfig, UsageLog } from "@/core/types";
import ProviderIcon from "@/components/ProviderIcon";

const maxVisibleNodes = 24;
const outerRingLimit = 14;
const MAP_COORD_DECIMALS = 2;
const LIVE_WINDOW_MS = 60_000;
const LIVE_REFRESH_MS = 1_500;

/** Stable coords for SSR + client (avoids hydration drift from float math). */
function mapCoord(value: number) {
  const factor = 10 ** MAP_COORD_DECIMALS;
  return Math.round(value * factor) / factor;
}

function mapCoordText(value: number) {
  return mapCoord(value).toFixed(MAP_COORD_DECIMALS);
}

type MapNode =
  | (ProviderConfig & { kind: "provider" })
  | { id: string; name: string; status: "disabled"; kind: "overflow"; hiddenCount: number };

type Transform = { x: number; y: number; scale: number };
type Point = { x: number; y: number };

function curvePath(from: Point, to: Point, index: number) {
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
  const bend = (index % 2 === 0 ? 1 : -1) * Math.min(48, length * 0.18);
  const cx = mapCoord(midX + (-dy / length) * bend);
  const cy = mapCoord(midY + (dx / length) * bend);
  return `M ${mapCoordText(from.x)} ${mapCoordText(from.y)} Q ${mapCoordText(cx)} ${mapCoordText(cy)} ${mapCoordText(to.x)} ${mapCoordText(to.y)}`;
}

function mapNodes(providers: ProviderConfig[]): MapNode[] {
  // The map represents selectable upstream routes, not the entire provider
  // catalog. Disabled and cooldown presets cannot receive traffic.
  const activeProviders = providers.filter((provider) => provider.status === "active");
  if (activeProviders.length <= maxVisibleNodes) {
    return activeProviders.map((provider) => ({ ...provider, kind: "provider" as const }));
  }
  const visibleProviderCount = maxVisibleNodes - 1;
  const hiddenCount = activeProviders.length - visibleProviderCount;
  return [
    ...activeProviders.slice(0, visibleProviderCount).map((provider) => ({ ...provider, kind: "provider" as const })),
    { id: "overflow", name: `+${hiddenCount} providers`, status: "disabled", kind: "overflow", hiddenCount }
  ];
}

/**
 * Pixel ellipse layout like 9router: radius grows with node count so pills
 * stay spaced on the ring instead of overlapping.
 */
function buildRingPoints(count: number, rx: number, ry: number, angleOffset = -Math.PI / 2): Point[] {
  if (count <= 0) return [];
  return Array.from({ length: count }, (_, index) => {
    const angle = angleOffset + (2 * Math.PI * index) / count;
    return {
      x: mapCoord(rx * Math.cos(angle)),
      y: mapCoord(ry * Math.sin(angle))
    };
  });
}

/** Minimum ellipse radii so consecutive chord ≈ node width + gap. */
function ringRadii(count: number, nodeW: number, nodeGap: number, width: number, height: number, fill: number) {
  const safeCount = Math.max(count, 1);
  const minChord = nodeW + nodeGap;
  // Extra headroom because the ring is slightly elliptical (not a perfect circle).
  const minR = (minChord * 1.2) / (2 * Math.sin(Math.PI / safeCount));
  const rx = Math.max(Math.min(width, height) * fill, minR);
  const ry = Math.max(height * (fill * 0.92), rx * 0.86);
  return { rx, ry };
}

function layoutPoints(total: number, width: number, height: number): Point[] {
  const safeW = Math.max(width, 320);
  const safeH = Math.max(height, 240);
  const nodeW = total > 14 ? 108 : total > 8 ? 122 : 140;
  const nodeGap = total > 14 ? 18 : 24;

  if (total <= 8) {
    const { rx, ry } = ringRadii(total, nodeW, nodeGap, safeW, safeH, 0.34);
    return buildRingPoints(total, rx, ry);
  }

  const outerCount = Math.min(total, outerRingLimit);
  const innerCount = Math.max(total - outerCount, 0);
  const outer = ringRadii(outerCount, nodeW, nodeGap, safeW, safeH, 0.4);
  const outerPoints = buildRingPoints(outerCount, outer.rx, outer.ry);

  if (innerCount === 0) return outerPoints;

  const inner = ringRadii(innerCount, nodeW * 0.92, nodeGap, safeW, safeH, 0.24);
  const innerRx = Math.min(inner.rx, outer.rx * 0.58);
  const innerRy = Math.min(inner.ry, outer.ry * 0.58);
  const innerPoints = buildRingPoints(innerCount, innerRx, innerRy, -Math.PI / 2 + Math.PI / Math.max(innerCount, 1));
  return [...outerPoints, ...innerPoints];
}

function fitZoom(nodeCount: number, span: number, viewport: number) {
  if (viewport <= 0 || span <= 0) {
    if (nodeCount > 16) return 0.72;
    if (nodeCount > 12) return 0.8;
    if (nodeCount > 8) return 0.88;
    return 0.96;
  }
  // Leave margin so outer pills don't clip.
  const fitted = (viewport * 0.86) / span;
  return clampZoom(Math.min(fitted, 1));
}

function clampZoom(value: number) {
  return Math.min(2.4, Math.max(0.35, Number(value.toFixed(3))));
}

function providerUsageMap(usage: UsageLog[]) {
  const map = new Map<string, { requests: number; tokens: number }>();
  for (const row of usage) {
    // A cache hit is real dashboard usage, but it never opens an upstream
    // provider connection and must not make a provider look active on the map.
    if (row.status !== "success" || row.cacheStatus === "hit") continue;
    const existing = map.get(row.providerId) ?? { requests: 0, tokens: 0 };
    existing.requests += 1;
    existing.tokens += row.inputTokens + row.outputTokens;
    map.set(row.providerId, existing);
  }
  return map;
}

export default function UsageFlow({
  providers,
  usage
}: {
  providers: ProviderConfig[];
  usage: UsageLog[];
}) {
  const visibleNodes = useMemo(() => mapNodes(providers), [providers]);
  const [liveUsage, setLiveUsage] = useState<UsageLog[]>(usage);
  const usageMap = useMemo(() => providerUsageMap(liveUsage), [liveUsage]);
  const nodeCount = visibleNodes.length;
  const [mapSize, setMapSize] = useState({ width: 900, height: 430 });
  const points = useMemo(() => layoutPoints(nodeCount, mapSize.width, mapSize.height), [nodeCount, mapSize.height, mapSize.width]);
  const layout = useMemo(
    () => visibleNodes.map((node, index) => ({ node, index, point: points[index] ?? { x: 0, y: 0 } })),
    [visibleNodes, points]
  );
  const span = useMemo(() => {
    if (points.length === 0) return Math.min(mapSize.width, mapSize.height);
    const maxR = Math.max(...points.map((point) => Math.hypot(point.x, point.y)));
    return maxR * 2 + 180;
  }, [mapSize.height, mapSize.width, points]);
  const nodeScale = nodeCount > 14 ? 0.72 : nodeCount > 10 ? 0.82 : nodeCount > 8 ? 0.9 : 1;
  const defaultZoom = fitZoom(nodeCount, span, Math.min(mapSize.width, mapSize.height));
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: defaultZoom });
  const [mounted, setMounted] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const pinchStart = useRef<{ distance: number; scale: number } | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const latestUsage = liveUsage.find((row) => row.status === "success" && row.cacheStatus !== "hit");
  const recentTraffic = Boolean(latestUsage && Date.now() - new Date(latestUsage.createdAt).getTime() < LIVE_WINDOW_MS);
  const activeProviderId = recentTraffic ? latestUsage?.providerId : undefined;
  const center: Point = { x: 0, y: 0 };
  const viewBox = useMemo(() => {
    const w = Math.max(mapSize.width, 1);
    const h = Math.max(mapSize.height, 1);
    return `${mapCoordText(-w / 2)} ${mapCoordText(-h / 2)} ${mapCoordText(w)} ${mapCoordText(h)}`;
  }, [mapSize.height, mapSize.width]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const refreshUsage = async () => {
      const response = await fetch("/api/usage", { credentials: "include", cache: "no-store" }).catch(() => null);
      if (!response?.ok || cancelled) return;
      const rows = (await response.json().catch(() => null)) as UsageLog[] | null;
      if (Array.isArray(rows) && !cancelled) setLiveUsage(rows);
    };

    void refreshUsage();
    const timer = window.setInterval(() => void refreshUsage(), LIVE_REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const mapEl = viewportRef.current;
    if (!mapEl) return;
    const syncSize = () => {
      const { width, height } = mapEl.getBoundingClientRect();
      if (width > 0 && height > 0) {
        setMapSize({ width, height });
      }
    };
    syncSize();
    const observer = new ResizeObserver(syncSize);
    observer.observe(mapEl);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setTransform({ x: 0, y: 0, scale: defaultZoom });
  }, [defaultZoom, nodeCount]);

  const onWheel = useCallback((event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const delta = event.deltaY < 0 ? 0.08 : -0.08;
    setTransform((current) => ({ ...current, scale: clampZoom(current.scale + delta) }));
  }, []);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    dragStart.current = { x: event.clientX, y: event.clientY, tx: transform.x, ty: transform.y };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setTransform((current) => ({
      ...current,
      x: dragStart.current.tx + (event.clientX - dragStart.current.x),
      y: dragStart.current.ty + (event.clientY - dragStart.current.y)
    }));
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragging(false);
  };

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 2) return;
      event.preventDefault();
      const [a, b] = [event.touches[0], event.touches[1]];
      const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      if (!pinchStart.current) {
        pinchStart.current = { distance, scale: transform.scale };
        return;
      }
      const nextScale = clampZoom(pinchStart.current.scale * (distance / pinchStart.current.distance));
      setTransform((current) => ({ ...current, scale: nextScale }));
    };

    const onTouchEnd = () => {
      pinchStart.current = null;
    };

    viewport.addEventListener("touchmove", onTouchMove, { passive: false });
    viewport.addEventListener("touchend", onTouchEnd);
    viewport.addEventListener("touchcancel", onTouchEnd);
    return () => {
      viewport.removeEventListener("touchmove", onTouchMove);
      viewport.removeEventListener("touchend", onTouchEnd);
      viewport.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [transform.scale]);

  return (
    <section className="panel usage-flow-panel">
      <div className="panel-heading">
        <div>
          <h2>Live routing</h2>
        </div>
        <div className="map-controls" aria-label="Map zoom controls">
          <button className="icon-button" type="button" onClick={() => setTransform((v) => ({ ...v, scale: clampZoom(v.scale - 0.1) }))} aria-label="Zoom out">
            <ZoomOut size={15} />
          </button>
          <button
            className="icon-button"
            type="button"
            onClick={() => setTransform({ x: 0, y: 0, scale: defaultZoom })}
            aria-label="Reset map view"
          >
            <LocateFixed size={15} />
          </button>
          <button className="icon-button" type="button" onClick={() => setTransform((v) => ({ ...v, scale: clampZoom(v.scale + 0.1) }))} aria-label="Zoom in">
            <ZoomIn size={15} />
          </button>
          <span>{Math.round(transform.scale * 100)}%</span>
        </div>
      </div>

      <div
        ref={viewportRef}
        className={`router-map router-map-interactive ${dragging ? "dragging" : ""} ${nodeCount > 8 ? "dense" : ""} ${nodeCount > outerRingLimit ? "multi-ring" : ""}`}
        style={{ "--node-scale": String(nodeScale) } as CSSProperties}
        aria-label="NesaRouter provider flow map"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className="router-map-stage"
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`
          }}
        >
          <div className="router-map-orbit" aria-hidden="true" style={{ width: span * 0.72, height: span * 0.72 }} />
          {mounted ? (
            <svg className="router-map-lines" viewBox={viewBox} preserveAspectRatio="none" aria-hidden="true">
              {layout.map(({ node, index, point }) => {
                const active = node.kind === "provider" && node.id === activeProviderId;
                const path = curvePath(center, point, index);
                return (
                  <g key={`line-${node.id}`}>
                    <path d={path} className={`map-line ${active ? "active" : ""} ${node.kind === "overflow" ? "overflow" : ""}`} pathLength="1">
                      {active ? (
                        <animate
                          attributeName="stroke-dashoffset"
                          dur="1.1s"
                          from="0"
                          repeatCount="indefinite"
                          to="-0.26"
                        />
                      ) : null}
                    </path>
                    {active ? (
                      <circle r="4" className="map-pulse-dot">
                        <animateMotion dur="1.6s" repeatCount="indefinite" path={path} />
                      </circle>
                    ) : null}
                  </g>
                );
              })}
            </svg>
          ) : null}

          <div className="router-center pulse-hub" style={{ left: "50%", top: "50%" }}>
            <span className="brand-icon router-center-logo" aria-hidden="true">
              <span className="brand-letter">N</span>
            </span>
            <strong>NesaRouter</strong>
          </div>

          {layout.map(({ node, index, point }) => {
            const active = node.kind === "provider" && node.id === activeProviderId;
            const connected = node.kind === "provider" && node.connectionStatus === "connected";
            const stats = node.kind === "provider" ? usageMap.get(node.id) : undefined;
            return (
              <div
                className={`map-provider ${node.status} ${node.kind === "overflow" ? "overflow" : ""} ${connected ? "connected" : ""} ${active ? "live" : ""} ${stats ? "has-traffic" : ""}`}
                style={{
                  left: `calc(50% + ${mapCoordText(point.x)}px)`,
                  top: `calc(50% + ${mapCoordText(point.y)}px)`
                }}
                title={
                  node.kind === "overflow"
                    ? `${node.hiddenCount} providers hidden from this map view.`
                    : `${node.name}${stats ? ` · ${stats.requests} req · ${stats.tokens.toLocaleString()} tok` : ""}`
                }
                key={node.id}
              >
                {node.kind === "overflow" ? (
                  <span className="provider-badge">{`+${node.hiddenCount}`}</span>
                ) : (
                  <ProviderIcon provider={node} size="sm" active={active} />
                )}
                <div className="map-provider-copy">
                  <strong>{node.name}</strong>
                  {stats ? <small>{stats.requests} req</small> : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
