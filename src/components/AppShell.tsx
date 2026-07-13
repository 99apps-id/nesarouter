import { Activity, Boxes, FlaskConical, Gauge, KeyRound, Network, ShieldCheck, SlidersHorizontal, Terminal, Waypoints } from "lucide-react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuthEnabled, adminPasswordMustChange, resolveVerifiedAdminSessionToken } from "@/core/adminAuth";
import { getBudgetStatus } from "@/core/budget";
import { publicOrigin } from "@/core/publicUrl";
import { readStore } from "@/lib/store";
import { readAppVersion } from "@/lib/appVersion";
import ThemeToggle from "@/components/ThemeToggle";
import UpdateBanner from "@/components/UpdateBanner";
import SessionKeeper from "@/components/SessionKeeper";

const navItems = [
  { href: "/", label: "Overview", icon: Gauge, id: "overview" as const },
  { href: "/providers", label: "Providers", icon: KeyRound, id: "providers" as const },
  { href: "/combos", label: "Combos", icon: Network, id: "combos" as const },
  { href: "/keys", label: "Keys", icon: ShieldCheck, id: "keys" as const },
  { href: "/usage", label: "Usage", icon: Activity, id: "usage" as const },
  { href: "/routing", label: "Routing", icon: SlidersHorizontal, id: "routing" as const },
  { href: "/mcp", label: "MCP", icon: Boxes, id: "mcp" as const },
  { href: "/tunnel", label: "Tunnel", icon: Waypoints, id: "tunnel" as const },
  { href: "/headroom", label: "Headroom", icon: FlaskConical, id: "headroom" as const },
  { href: "/cli", label: "CLI", icon: Terminal, id: "cli" as const }
];

export default async function AppShell({
  active,
  eyebrow,
  title,
  children
}: {
  active: "overview" | "providers" | "combos" | "keys" | "usage" | "routing" | "mcp" | "tunnel" | "headroom" | "cli";
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  const requestHeaders = await headers();
  if (await adminAuthEnabled()) {
    const cookieHeader = requestHeaders.get("cookie");
    const probeRequest = cookieHeader
      ? new Request("http://nesa-router.local/", { headers: { cookie: cookieHeader } })
      : undefined;
    if (!(await resolveVerifiedAdminSessionToken(probeRequest))) {
      const pathname = requestHeaders.get("x-nesa-pathname") || "/";
      redirect(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }

  const store = await readStore();
  const budgetStatus = getBudgetStatus(store);
  const mustChangePassword = await adminPasswordMustChange();

  if (mustChangePassword && active !== "routing") {
    redirect("/routing");
  }

  const visibleNav = mustChangePassword ? navItems.filter((item) => item.id === "routing") : navItems;
  const appVersion = readAppVersion();
  const endpointBase = `${publicOrigin(undefined, store.router.publicBaseUrl)}/v1`;

  return (
    <main className="app-shell">
      <SessionKeeper />
      <aside className="sidebar">
        <div className="brand-mark">
          <div className="brand-icon">
            <span className="brand-letter">N</span>
          </div>
          <div>
            <strong>NesaRouter</strong>
            <span>Smart AI gateway · v{appVersion}</span>
          </div>
        </div>
        <nav className="nav-list" aria-label="Main navigation">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            return (
              <a className={`nav-item ${active === item.id ? "active" : ""}`} href={item.href} key={item.href}>
                <Icon size={17} /> {item.label}
              </a>
            );
          })}
        </nav>
        <div className="endpoint-box">
          <span>Endpoint</span>
          <code>{endpointBase}</code>
          <small>Manage client keys in Keys.</small>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="subtle">{eyebrow}</p>
            <h1>{title}</h1>
          </div>
          <div className="topbar-actions">
            <ThemeToggle />
            <div className={`budget-pill ${budgetStatus}`}>
              <ShieldCheck size={16} />
              <span>{budgetStatus}</span>
            </div>
          </div>
        </header>
        {mustChangePassword ? (
          <section className="alert-banner">
            <ShieldCheck size={18} />
            <div>
              <strong>Change temporary default password</strong>
              <span>Use Password below. Other menus unlock after you save a new password.</span>
            </div>
          </section>
        ) : (
          <UpdateBanner />
        )}
        {children}
      </section>
    </main>
  );
}
