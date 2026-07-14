import { ShieldCheck } from "lucide-react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuthEnabled, adminPasswordMustChange, resolveVerifiedAdminSessionToken } from "@/core/adminAuth";
import { getBudgetStatus } from "@/core/budget";
import { publicOrigin } from "@/core/publicUrl";
import { readStore } from "@/lib/store";
import { readAppVersion } from "@/lib/appVersion";
import AppNav from "@/components/AppNav";
import EndpointBox from "@/components/EndpointBox";
import LanguageSelect from "@/components/LanguageSelect";
import ThemeToggle from "@/components/ThemeToggle";
import UpdateBanner from "@/components/UpdateBanner";
import SessionKeeper from "@/components/SessionKeeper";

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
        <AppNav active={active} routingOnly={mustChangePassword} />
        <EndpointBox endpointBase={endpointBase} />
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="subtle">{eyebrow}</p>
            <h1>{title}</h1>
          </div>
          <div className="topbar-actions">
            <LanguageSelect />
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
