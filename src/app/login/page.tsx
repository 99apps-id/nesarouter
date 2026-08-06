import { headers } from "next/headers";
import {
  adminLoginPasswordHint,
  defaultAdminPassword,
  loginRateLimitKey,
  readLoginLock
} from "@/core/adminAuth";
import { availableOAuthProviders } from "@/core/oauth";
import LoginForm from "@/components/LoginForm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Always render the admin login form for GET /login (typed URL or link).
 * Do not bounce signed-in operators to "/" (public SaaS landing) or /overview —
 * that made typing /login look broken when a session cookie was still present.
 * Successful submit still navigates to /overview via LoginForm.
 */
export default async function LoginPage({ searchParams }: { searchParams?: Promise<{ error?: string; next?: string }> }) {
  const requestHeaders = await headers();
  const probeRequest = new Request("http://nesa-router.local/", { headers: requestHeaders });
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
