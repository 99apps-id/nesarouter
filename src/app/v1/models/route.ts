import { NextResponse } from "next/server";
import { authorizeRequest } from "@/core/auth";
import { listPrefixesForProvider } from "@/core/providerPrefixes";
import { readStore } from "@/lib/store";
import {
  authorizeSaasRequestDetailed,
  saasAuthFailureMessage
} from "@/core/saas/saasAuth";
import { isSaasEnabled } from "@/core/saas/saasConfig";
import { listSaasModels } from "@/core/saas/saasCatalog";
import { toPublicModelList } from "@/core/saas/publicModels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const store = await readStore();
  const saasEnabled = isSaasEnabled();
  if (saasEnabled) {
    const saasAuth = await authorizeSaasRequestDetailed(request);
    if (!saasAuth.ok) {
      return NextResponse.json({ error: { message: saasAuthFailureMessage(saasAuth.reason) } }, { status: 401 });
    }
    const saas = saasAuth.ctx;

    const publicIds = await listSaasModels(saas.planKind);
    return NextResponse.json({
      object: "list",
      data: toPublicModelList(publicIds)
    });
  }

  if (!authorizeRequest(store, request)) {
    return NextResponse.json({ error: { message: "Invalid NesaRouter API key." } }, { status: 401 });
  }

  const providerModels = store.providers.flatMap((provider) => {
    const ids = Array.isArray(provider.models) && provider.models.length ? provider.models : [provider.model];
    const prefixes = listPrefixesForProvider(provider.id);
    const bare = ids.map((id) => ({
      id,
      object: "model" as const,
      created: 0,
      owned_by: provider.name,
      nesa_provider_id: provider.id,
      nesa_tier: provider.tier,
      nesa_status: provider.status
    }));
    const prefixed = prefixes.flatMap((prefix) =>
      ids.map((id) => ({
        id: `${prefix}/${id}`,
        object: "model" as const,
        created: 0,
        owned_by: provider.name,
        nesa_provider_id: provider.id,
        nesa_tier: provider.tier,
        nesa_status: provider.status,
        nesa_prefix: prefix
      }))
    );
    return [...bare, ...prefixed];
  });

  // De-dupe by id while keeping first occurrence (bare before prefix collisions).
  const seen = new Set<string>();
  const data = [
    {
      id: "auto",
      object: "model",
      created: 0,
      owned_by: "NesaRouter",
      nesa_provider_id: "auto",
      nesa_tier: "auto",
      nesa_status: "active"
    },
    ...store.combos.map((combo) => ({
      id: combo.name,
      object: "model",
      created: 0,
      owned_by: "NesaRouter",
      nesa_provider_id: combo.id,
      nesa_tier: "combo",
      nesa_status: "active"
    })),
    ...(store.aliases ?? []).map((alias) => ({
      id: alias.alias,
      object: "model",
      created: 0,
      owned_by: "NesaRouter",
      nesa_provider_id: `alias:${alias.id}`,
      nesa_tier: "alias",
      nesa_status: "active",
      nesa_alias_target: alias.target
    })),
    ...providerModels
  ].filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });

  return NextResponse.json({ object: "list", data });
}
