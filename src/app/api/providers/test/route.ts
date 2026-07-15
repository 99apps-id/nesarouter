import { NextResponse } from "next/server";
import { finalizeAdminResponse, requireAdmin } from "@/lib/adminApi";
import { isKeylessProvider } from "@/core/providerCredentials";
import { testProviderConnection } from "@/core/providerClient";
import { configuredProviderKeys } from "@/core/providerKeys";
import { configuredOAuthAccounts, providerForOAuthAccount } from "@/core/oauthAccounts";
import { ensureFreshAccessToken } from "@/core/providerOAuthFlow";
import { ProviderConfig } from "@/core/types";
import { keyPreview } from "@/lib/providerLabels";
import { markOAuthAccountConnection, markProviderConnection, readStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const body = (await request.json()) as { providerId?: string; provider?: ProviderConfig; allAccounts?: boolean };
  const store = await readStore();
  let provider =
    body.provider ??
    store.providers.find((item) => item.id === body.providerId);

  if (!provider) {
    return finalizeAdminResponse(NextResponse.json({ ok: false, error: "Provider not found." }, { status: 404 }), request);
  }

  if (provider.oauthProfile && !body.provider) {
    const fresh = await ensureFreshAccessToken(provider);
    if (fresh) provider = { ...provider, oauthAccessToken: fresh };
  }

  const keylessAllowed =
    provider.oauthProfile ||
    isKeylessProvider(provider);

  if (!provider.apiKey && !keylessAllowed && !provider.oauthAccessToken) {
    return finalizeAdminResponse(
      NextResponse.json({ ok: false, error: "Provider API key is empty." }, { status: 400 }),
      request
    );
  }

  try {
    if (body.allAccounts) {
      const accounts = configuredProviderKeys(provider);
      if (accounts.length > 1) {
        const results = await Promise.all(accounts.map(async (account) => {
          try {
            const result = await testProviderConnection({ ...provider, apiKey: account.key, apiKeys: [] });
            return { index: account.index, preview: keyPreview(account.key), ok: true, message: result?.message ?? "Connected.", models: result?.models ?? [] };
          } catch (error) {
            return { index: account.index, preview: keyPreview(account.key), ok: false, message: error instanceof Error ? error.message : "Provider test failed." };
          }
        }));
        const connected = results.filter((result) => result.ok).length;
        await markProviderConnection(provider.id, connected > 0, connected ? undefined : results[0]?.message);
        return finalizeAdminResponse(
          NextResponse.json(
            {
              ok: connected > 0,
              message: `${connected}/${results.length} accounts connected.`,
              accounts: results
            },
            { status: connected > 0 ? 200 : 502 }
          ),
          request
        );
      }
    }

    // OAuth multi-account: probe each slot so UI can show green "connected".
    if (provider.oauthProfile) {
      const oauthAccounts = configuredOAuthAccounts(provider);
      if (oauthAccounts.length > 0) {
        const results: Array<{
          index: number;
          preview: string;
          ok: boolean;
          message: string;
          models?: string[];
        }> = [];
        for (const account of oauthAccounts) {
          const fresh = await ensureFreshAccessToken(provider, account.id);
          if (!fresh) {
            await markOAuthAccountConnection(provider.id, account.id, false, "OAuth token unavailable or refresh failed.");
            results.push({
              index: account.index,
              preview: account.name ?? `Account ${account.index + 1}`,
              ok: false,
              message: "OAuth token unavailable or refresh failed."
            });
            continue;
          }
          try {
            const snapshot = { ...providerForOAuthAccount(provider, account), oauthAccessToken: fresh };
            const result = await testProviderConnection(snapshot);
            await markOAuthAccountConnection(provider.id, account.id, true);
            results.push({
              index: account.index,
              preview: account.name ?? `Account ${account.index + 1}`,
              ok: true,
              message: result?.message ?? "Connected.",
              models: result?.models ?? []
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : "Provider test failed.";
            await markOAuthAccountConnection(provider.id, account.id, false, message);
            results.push({
              index: account.index,
              preview: account.name ?? `Account ${account.index + 1}`,
              ok: false,
              message
            });
          }
        }
        const connected = results.filter((result) => result.ok).length;
        await markProviderConnection(provider.id, connected > 0, connected ? undefined : results[0]?.message);
        const models = results.find((result) => result.ok)?.models ?? [];
        return finalizeAdminResponse(
          NextResponse.json(
            {
              ok: connected > 0,
              message:
                connected > 0
                  ? `${provider.name} connected (${connected}/${results.length}). ${results.find((r) => r.ok)?.message ?? ""}`.trim()
                  : `${provider.name} test failed.`,
              error: connected > 0 ? undefined : results[0]?.message,
              accounts: results,
              models
            },
            { status: connected > 0 ? 200 : 502 }
          ),
          request
        );
      }
    }

    const result = await testProviderConnection(provider);
    await markProviderConnection(provider.id, true);
    return finalizeAdminResponse(
      NextResponse.json({ ok: true, message: `${provider.name} connected. ${result?.message ?? ""}`.trim(), models: result?.models ?? [] }),
      request
    );
  } catch (error) {
    await markProviderConnection(provider.id, false, error instanceof Error ? error.message : "Provider test failed.");
    return finalizeAdminResponse(
      NextResponse.json(
        { ok: false, error: error instanceof Error ? error.message : "Provider test failed." },
        { status: 502 }
      ),
      request
    );
  }
}
