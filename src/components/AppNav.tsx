"use client";

import {
  Activity,
  Boxes,
  FlaskConical,
  Gauge,
  KeyRound,
  Network,
  ShieldCheck,
  SlidersHorizontal,
  Terminal,
  Waypoints
} from "lucide-react";
import { useEffect, useRef } from "react";
import { useI18n } from "@/components/I18nProvider";

const items = [
  { href: "/", id: "overview" as const, icon: Gauge },
  { href: "/providers", id: "providers" as const, icon: KeyRound },
  { href: "/combos", id: "combos" as const, icon: Network },
  { href: "/keys", id: "keys" as const, icon: ShieldCheck },
  { href: "/usage", id: "usage" as const, icon: Activity },
  { href: "/routing", id: "routing" as const, icon: SlidersHorizontal },
  { href: "/mcp", id: "mcp" as const, icon: Boxes },
  { href: "/tunnel", id: "tunnel" as const, icon: Waypoints },
  { href: "/headroom", id: "headroom" as const, icon: FlaskConical },
  { href: "/cli", id: "cli" as const, icon: Terminal }
];

export default function AppNav({
  active,
  routingOnly
}: {
  active: (typeof items)[number]["id"];
  routingOnly?: boolean;
}) {
  const { t } = useI18n();
  const activeRef = useRef<HTMLAnchorElement | null>(null);
  const labels = t.nav;
  const visible = routingOnly ? items.filter((item) => item.id === "routing") : items;

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [active]);

  return (
    <nav className="nav-list" aria-label={labels.mainNav}>
      {visible.map((item) => {
        const Icon = item.icon;
        return (
          <a
            className={`nav-item ${active === item.id ? "active" : ""}`}
            href={item.href}
            key={item.href}
            ref={active === item.id ? activeRef : undefined}
          >
            <Icon size={17} /> {labels[item.id]}
          </a>
        );
      })}
    </nav>
  );
}
