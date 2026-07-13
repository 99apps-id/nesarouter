import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  adminAuthEnabled,
  adminCookieName,
  adminLoginPasswordHint,
  defaultAdminPassword,
  readLoginLock,
  verifyAdminToken
} from "@/core/adminAuth";
import { availableOAuthProviders } from "@/core/oauth";
import LoginForm from "@/components/LoginForm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const cookieStore = await cookies();
  if (!(await adminAuthEnabled()) || (await verifyAdminToken(cookieStore.get(adminCookieName)?.value))) {
    redirect("/");
  }

  const lock = await readLoginLock();
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
