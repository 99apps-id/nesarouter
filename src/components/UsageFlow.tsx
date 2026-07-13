"use client";

import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { LocateFixed, ZoomIn, ZoomOut } from "lucide-react";
import type { ProviderConfig } from "@/core/types";
import ProviderIcon from "@/components/ProviderIcon";

const maxVisibleNodes = 18;
const outerRingLimit = 12;

type MapNode =
  | (ProviderConfig & {
      kind: "provider";
    })
  | {
      id: string;
      name: string;
      status: "disabled";
      kind: "overflow";
      hiddenCount: number;
    };

function curvePath(from: { x: number; y: number }, to: { x: number; y: number }, index: number) {
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
  const bend = (index % 2 === 0 ? 1 : -1) * 10;
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
    {
      id: "overflow",
      name: `+${hiddenCount} providers`,
      status: "disabled",
      kind: "overflow",
      hiddenCount
    }
  ];
}

function nodePoint(index: number, total: number) {
  if (total <= 8) {
    const angle = (360 / Math.max(total, 1)) * index - 90;
    const radians = (angle * Math.PI) / 180;
    return {
      x: 50 + Math.cos(radians) * 31,
      y: 50 + Math.sin(radians) * 29,
      ring: "single"
    };
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

  return {
    x: 50 + Math.cos(radians) * radiusX,
    y: 50 + Math.sin(radians) * radiusY,
    ring: isOuter ? "outer" : "inner"
  };
}

function fitZoom(nodeCount: number) {
  if (nodeCount > 14) return 0.68;
  if (nodeCount > 10) return 0.76;
  if (nodeCount > 8) return 0.84;
  if (nodeCount > 6) return 0.92;
  return 0.96;
}

function clampZoom(value: number) {
  return Math.min(1.15, Math.max(0.5, Number(value.toFixed(2))));
}

export default function UsageFlow({
  providers,
  latestProviderId
}: {
  providers: ProviderConfig[];
  latestProviderId?: string;
}) {
  const visibleNodes = useMemo(() => mapNodes(providers), [providers]);
  const nodeCount = visibleNodes.length;
  const nodeScale = nodeCount > 14 ? 0.68 : nodeCount > 10 ? 0.76 : nodeCount > 8 ? 0.84 : nodeCount > 6 ? 0.9 : 1;
  const defaultZoom = fitZoom(nodeCount);
  const [zoom, setZoom] = useState(defaultZoom);
  const activeProviderId = latestProviderId;
  const center = { x: 50, y: 50 };

  return (
    <section className="panel usage-flow-panel">
      <div className="panel-heading">
        <div>
          <p className="subtle">Map</p>
          <h2>NesaRouter</h2>
        </div>
        <div className="map-controls" aria-label="Map zoom controls">
          <button className="icon-button" type="button" onClick={() => setZoom((value) => clampZoom(value - 0.08))} aria-label="Zoom out">
            <ZoomOut size={15} />
          </button>
          <button className="icon-button" type="button" onClick={() => setZoom(defaultZoom)} aria-label="Reset map zoom">
            <LocateFixed size={15} />
          </button>
          <button className="icon-button" type="button" onClick={() => setZoom((value) => clampZoom(value + 0.08))} aria-label="Zoom in">
            <ZoomIn size={15} />
          </button>
          <span>{Math.round(zoom * 100)}%</span>
        </div>
      </div>

      <div
        className={`router-map ${nodeCount > 8 ? "dense" : ""} ${nodeCount > outerRingLimit ? "multi-ring" : ""}`}
        style={{ "--node-scale": String(nodeScale) } as CSSProperties}
        aria-label="NesaRouter provider map"
      >
        <div className="router-map-content" style={{ "--map-zoom": String(zoom) } as CSSProperties}>
          <svg className="router-map-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {visibleNodes.map((node, index) => {
              const point = nodePoint(index, nodeCount);
              const active = node.kind === "provider" && node.id === activeProviderId;
              return (
                <path
                  d={curvePath(center, point, index)}
                  className={`map-line ${active ? "active" : ""} ${node.kind === "overflow" ? "overflow" : ""}`}
                  pathLength="1"
                  key={node.id}
                />
              );
            })}
          </svg>

          <div className="router-center" style={{ "--x": "50%", "--y": "50%" } as CSSProperties}>
            <span className="brand-icon router-center-logo" aria-hidden="true">
              <span className="brand-letter">N</span>
            </span>
            <strong>NesaRouter</strong>
          </div>

          {visibleNodes.map((node, index) => {
            const point = nodePoint(index, nodeCount);
            const active = node.kind === "provider" && node.id === activeProviderId;
            const connected = node.kind === "provider" && node.connectionStatus === "connected";
            const hasKey = node.kind === "provider" && Boolean(node.apiKey);
            return (
              <div
                className={`map-provider ${node.status} ${node.kind === "overflow" ? "overflow" : ""} ${connected ? "connected" : ""} ${hasKey ? "has-key" : ""} ${active ? "active" : ""}`}
                style={{ "--x": `${point.x}%`, "--y": `${point.y}%` } as CSSProperties}
                title={
                  node.kind === "overflow"
                    ? `${node.hiddenCount} providers hidden from this map view.`
                    : `${node.name} / ${node.connectionStatus ?? "unknown"}${hasKey ? " / key saved" : " / no key"}`
                }
                key={node.id}
              >
                {node.kind === "overflow" ? (
                  <span className="provider-badge">{`+${node.hiddenCount}`}</span>
                ) : (
                  <ProviderIcon provider={node} size="sm" active={active} />
                )}
                <strong>{node.name}</strong>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
