"use client";

import {
  Activity,
  Boxes,
  FlaskConical,
  Gauge,
  KeyRound,
  Network,
  Package,
  SlidersHorizontal,
  Terminal,
  Users,
  Waypoints
} from "lucide-react";
import { useEffect, useRef } from "react";
import { useI18n } from "@/components/I18nProvider";

const items = [
  { href: "/overview", id: "overview" as const, icon: Gauge },
  { href: "/saas", id: "keys" as const, icon: Users, label: "SaaS ops" },
  { href: "/saas/packages", id: "packages" as const, icon: Package, label: "SaaS packages" },
  { href: "/saas/usage", id: "usage" as const, icon: Activity, label: "SaaS usage" },
  { href: "/providers", id: "providers" as const, icon: KeyRound },
  { href: "/combos", id: "combos" as const, icon: Network },
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
  active: (typeof items)[number]["id"] | "keys" | "usage" | "packages";
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
        const label = "label" in item && item.label ? item.label : labels[item.id as keyof typeof labels];
        return (
          <a
            className={`nav-item ${active === item.id ? "active" : ""}`}
            href={item.href}
            key={item.href}
            ref={active === item.id ? activeRef : undefined}
          >
            <Icon size={17} /> {label}
          </a>
        );
      })}
    </nav>
  );
}
