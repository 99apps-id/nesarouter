import { NextResponse } from "next/server";
import { authorizeRequest } from "@/core/auth";
import { readStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const store = await readStore();
  if (!authorizeRequest(store, request)) {
    return NextResponse.json({ error: { message: "Invalid NesaRouter API key." } }, { status: 401 });
  }

  return NextResponse.json({
    object: "list",
    data: [
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
      ...store.providers.flatMap((provider) => {
        const ids = Array.isArray(provider.models) && provider.models.length ? provider.models : [provider.model];
        return ids.map((id) => ({
          id,
          object: "model",
          created: 0,
          owned_by: provider.name,
          nesa_provider_id: provider.id,
          nesa_tier: provider.tier,
          nesa_status: provider.status
        }));
      })
    ]
  });
}
