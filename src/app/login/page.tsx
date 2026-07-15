import { redirect } from "next/navigation";
import { headers } from "next/headers";
import {
  adminAuthEnabled,
  adminLoginPasswordHint,
  defaultAdminPassword,
  loginRateLimitKey,
  readLoginLock,
  resolveVerifiedAdminSessionToken
} from "@/core/adminAuth";
import { availableOAuthProviders } from "@/core/oauth";
import LoginForm from "@/components/LoginForm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams?: Promise<{ error?: string; next?: string }> }) {
  const requestHeaders = await headers();
  const probeRequest = new Request("http://nesa-router.local/", { headers: requestHeaders });
  if (!(await adminAuthEnabled()) || (await resolveVerifiedAdminSessionToken(probeRequest))) {
    const params = searchParams ? await searchParams : {};
    const next = params.next?.trim();
    if (next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/login")) {
      redirect(next);
    }
    redirect("/");
  }

  const lock = await readLoginLock(loginRateLimitKey(probeRequest));
  const params = searchParams ? await searchParams : {};
  const passwordHint = await adminLoginPasswordHint();
  return (
    <LoginForm
      defaultPassword={passwordHint === "default" ? defaultAdminPassword : undefined}
      passwordHint={passwordHint ?? undefined}
      initialLock={lock}
      oauthProviders={availableOAuthProviders()}
      oauthError={params.error}
    />
  );
}
