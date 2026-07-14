import { ShieldCheck } from "lucide-react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuthEnabled, adminPasswordMustChange, resolveVerifiedAdminSessionToken } from "@/core/adminAuth";
import { getBudgetStatus } from "@/core/budget";
import { publicOrigin } from "@/core/publicUrl";
import { readStore } from "@/lib/store";
import { readAppVersion } from "@/lib/appVersion";
import AppNav from "@/components/AppNav";
import BrandTagline from "@/components/BrandTagline";
import EndpointBox from "@/components/EndpointBox";
import LanguageSelect from "@/components/LanguageSelect";
import MustChangePasswordBanner from "@/components/MustChangePasswordBanner";
import ThemeToggle from "@/components/ThemeToggle";
import UpdateBanner from "@/components/UpdateBanner";
import SessionKeeper from "@/components/SessionKeeper";
import WorkspaceTitle, { type ShellPageId } from "@/components/WorkspaceTitle";

export default async function AppShell({
  active,
  titleOverride,
  children
}: {
  active: ShellPageId;
  titleOverride?: string;
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
            <BrandTagline version={appVersion} />
          </div>
        </div>
        <AppNav active={active} routingOnly={mustChangePassword} />
        <EndpointBox endpointBase={endpointBase} />
      </aside>

      <section className="workspace">
        <header className="topbar">
          <WorkspaceTitle active={active} titleOverride={titleOverride} />
          <div className="topbar-actions">
            <LanguageSelect />
            <ThemeToggle />
            <div className={`budget-pill ${budgetStatus}`}>
              <ShieldCheck size={16} />
              <span>{budgetStatus}</span>
            </div>
          </div>
        </header>
        {mustChangePassword ? <MustChangePasswordBanner /> : <UpdateBanner />}
        {children}
      </section>
    </main>
  );
}
