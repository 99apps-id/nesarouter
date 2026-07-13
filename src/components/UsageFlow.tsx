"use client";

import type { CSSProperties, PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Hand, LocateFixed, ZoomIn, ZoomOut } from "lucide-react";
import type { ProviderConfig, UsageLog } from "@/core/types";
import ProviderIcon from "@/components/ProviderIcon";

const maxVisibleNodes = 24;
const outerRingLimit = 14;

type MapNode =
  | (ProviderConfig & { kind: "provider" })
  | { id: string; name: string; status: "disabled"; kind: "overflow"; hiddenCount: number };

type Transform = { x: number; y: number; scale: number };

function curvePath(from: { x: number; y: number }, to: { x: number; y: number }, index: number) {
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
  const bend = (index % 2 === 0 ? 1 : -1) * 12;
  const cx = midX + (-dy / length) * bend;
  const cy = midY + (dx / length) * bend;
  return `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`;
}

function mapNodes(providers: ProviderConfig[]): MapNode[] {
  if (providers.length <= maxVisibleNodes) {
    return providers.map((provider) => ({ ...provider, kind: "provider" as const }));
  }
  const visibleProviderCount = maxVisibleNodes - 1;
  const hiddenCount = providers.length - visibleProviderCount;
  return [
    ...providers.slice(0, visibleProviderCount).map((provider) => ({ ...provider, kind: "provider" as const })),
    { id: "overflow", name: `+${hiddenCount} providers`, status: "disabled", kind: "overflow", hiddenCount }
  ];
}

function nodePoint(index: number, total: number) {
  if (total <= 8) {
    const angle = (360 / Math.max(total, 1)) * index - 90;
    const radians = (angle * Math.PI) / 180;
    return { x: 50 + Math.cos(radians) * 31, y: 50 + Math.sin(radians) * 29 };
  }
  const outerCount = Math.min(total, outerRingLimit);
  const innerCount = Math.max(total - outerCount, 0);
  const isOuter = index < outerCount;
  const ringIndex = isOuter ? index : index - outerCount;
  const ringTotal = isOuter ? outerCount : innerCount;
  const angleOffset = isOuter ? -90 : -90 + 180 / Math.max(innerCount, 1) + 14;
  const angle = (360 / Math.max(ringTotal, 1)) * ringIndex + angleOffset;
  const radians = (angle * Math.PI) / 180;
  const radiusX = isOuter ? 31 : 21;
  const radiusY = isOuter ? 30 : 20;
  return { x: 50 + Math.cos(radians) * radiusX, y: 50 + Math.sin(radians) * radiusY };
}

function fitZoom(nodeCount: number) {
  if (nodeCount > 16) return 0.72;
  if (nodeCount > 12) return 0.8;
  if (nodeCount > 8) return 0.88;
  return 0.96;
}

function clampZoom(value: number) {
  return Math.min(2.4, Math.max(0.35, Number(value.toFixed(3))));
}

function providerUsageMap(usage: UsageLog[]) {
  const map = new Map<string, { requests: number; tokens: number }>();
  for (const row of usage) {
    if (row.status !== "success") continue;
    const existing = map.get(row.providerId) ?? { requests: 0, tokens: 0 };
    existing.requests += 1;
    existing.tokens += row.inputTokens + row.outputTokens;
    map.set(row.providerId, existing);
  }
  return map;
}

export default function UsageFlow({
  providers,
  usage,
  latestProviderId
}: {
  providers: ProviderConfig[];
  usage: UsageLog[];
  latestProviderId?: string;
}) {
  const visibleNodes = useMemo(() => mapNodes(providers), [providers]);
  const usageMap = useMemo(() => providerUsageMap(usage), [usage]);
  const nodeCount = visibleNodes.length;
  const nodeScale = nodeCount > 14 ? 0.68 : nodeCount > 10 ? 0.76 : nodeCount > 8 ? 0.84 : 1;
  const defaultZoom = fitZoom(nodeCount);
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: defaultZoom });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const pinchStart = useRef<{ distance: number; scale: number } | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const activeProviderId = latestProviderId;
  const center = { x: 50, y: 50 };

  useEffect(() => {
    // A denser provider catalog needs a new fit calculation. Reset pan too so
    // the NesaRouter hub never drifts away from the visual center.
    setTransform({ x: 0, y: 0, scale: defaultZoom });
  }, [defaultZoom, nodeCount]);

  const onWheel = useCallback((event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const delta = event.deltaY < 0 ? 0.08 : -0.08;
    // Zoom around the map hub. Pointer-anchored zoom made the center move
    // whenever the wheel was used over an off-center provider.
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
          <p className="subtle">Live map</p>
          <h2>Provider flow</h2>
        </div>
        <div className="map-controls" aria-label="Map zoom controls">
          <span className="map-hint">
            <Hand size={14} /> drag · pinch / wheel zoom
          </span>
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
          <div className="router-map-orbit" aria-hidden="true" />
          <svg className="router-map-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {visibleNodes.map((node, index) => {
              const point = nodePoint(index, nodeCount);
              const active = node.kind === "provider" && node.id === activeProviderId;
              const path = curvePath(center, point, index);
              return (
                <g key={`line-${node.id}`}>
                  <path d={path} className={`map-line ${active ? "active" : ""} ${node.kind === "overflow" ? "overflow" : ""}`} pathLength="1" />
                  {active ? <circle r="0.55" className="map-pulse-dot"><animateMotion dur="1.6s" repeatCount="indefinite" path={path} /></circle> : null}
                  {!active && node.kind === "provider" && usageMap.has(node.id) ? (
                    <circle r="0.35" className="map-flow-dot">
                      <animateMotion dur={`${2.2 + (index % 4) * 0.3}s`} repeatCount="indefinite" path={path} />
                    </circle>
                  ) : null}
                </g>
              );
            })}
          </svg>

          <div className="router-center pulse-hub" style={{ "--x": "50%", "--y": "50%" } as CSSProperties}>
            <span className="brand-icon router-center-logo" aria-hidden="true">
              <span className="brand-letter">N</span>
            </span>
            <strong>NesaRouter</strong>
          </div>

          {visibleNodes.map((node, index) => {
            const point = nodePoint(index, nodeCount);
            const active = node.kind === "provider" && node.id === activeProviderId;
            const connected = node.kind === "provider" && node.connectionStatus === "connected";
            const stats = node.kind === "provider" ? usageMap.get(node.id) : undefined;
            return (
              <div
                className={`map-provider ${node.status} ${node.kind === "overflow" ? "overflow" : ""} ${connected ? "connected" : ""} ${active ? "active" : ""} ${stats ? "has-traffic" : ""}`}
                style={{ "--x": `${point.x}%`, "--y": `${point.y}%` } as CSSProperties}
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
