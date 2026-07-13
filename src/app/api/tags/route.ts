import { NextResponse } from "next/server";
import { authorizeRequest } from "@/core/auth";
import { resolveModelAlias } from "@/core/aliases";
import { readStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Ollama-compatible tags listing for tools that probe /api/tags. */
export async function GET(request: Request) {
  const store = await readStore();
  if (!authorizeRequest(store, request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const models = [
    { name: "auto", model: "auto", modified_at: new Date().toISOString(), size: 0, digest: "nesa-auto", details: { family: "nesa" } },
    ...store.combos.map((combo) => ({
      name: combo.name,
      model: combo.name,
      modified_at: new Date().toISOString(),
      size: 0,
      digest: `combo-${combo.id}`,
      details: { family: "nesa-combo", strategy: combo.strategy }
    })),
    ...(store.aliases ?? []).map((alias) => ({
      name: alias.alias,
      model: resolveModelAlias(store.aliases, alias.alias),
      modified_at: new Date().toISOString(),
      size: 0,
      digest: `alias-${alias.id}`,
      details: { family: "nesa-alias", target: alias.target }
    })),
    ...store.providers.flatMap((provider) => {
      const models = provider.models?.length ? provider.models : [provider.model];
      return models.map((model) => ({
        name: model,
        model,
        modified_at: new Date().toISOString(),
        size: 0,
        digest: `${provider.id}-${model}`,
        details: { family: provider.type, parent_model: provider.id }
      }));
    })
  ];

  return NextResponse.json({ models });
}
