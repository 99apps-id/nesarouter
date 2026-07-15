import { NextResponse } from "next/server";
import { adminJson, requireAdmin } from "@/lib/adminApi";
import { getBudgetStatus } from "@/core/budget";
import { keyRows } from "@/lib/keyIdentity";
import { redactCacheEntryForClient, redactProviderForClient } from "@/lib/providerRedact";
import { getTodaySpend, getTodayRequestCount, readStore, writeStore } from "@/lib/store";
import { Combo } from "@/core/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const store = await readStore();
  const todaySpend = getTodaySpend(store);
  const budgetStatus = getBudgetStatus(store);
  const { localApiKeys: _keys, cache, providers, ...publicStore } = store;
  return adminJson(request, {
    ...publicStore,
    secretsRedacted: true,
    localApiKeys: keyRows(_keys),
    cache: cache.map(redactCacheEntryForClient),
    providers: providers.map(redactProviderForClient),
    metrics: {
      todaySpend,
      remainingBudget: Math.max(0, store.budget.dailyBudgetUsd - todaySpend),
      budgetStatus,
      cacheEntries: cache.length,
      totalRequests: getTodayRequestCount(store)
    }
  });
}

export async function PUT(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const patch = await request.json();
  const store = await readStore();

  // Never accept a full providers rewrite from the client — secrets arrive redacted.
  if (Array.isArray(patch.providers)) {
    return NextResponse.json(
      { error: "Bulk provider rewrite via /api/state is not allowed. Use /api/providers instead." },
      { status: 400 }
    );
  }
  // Client keys are managed only via /api/keys (full token returned once on create).
  if (patch.localApiKeys !== undefined) {
    return NextResponse.json(
      { error: "Client API keys cannot be rewritten via /api/state. Use /api/keys instead." },
      { status: 400 }
    );
  }

  const combos: Combo[] = Array.isArray(patch.combos) ? (patch.combos as Combo[]) : store.combos;
  const aliases = Array.isArray(patch.aliases) ? patch.aliases : store.aliases;

  const nextStore = {
    ...store,
    budget: patch.budget ? { ...store.budget, ...patch.budget } : store.budget,
    router: patch.router ? { ...store.router, ...patch.router } : store.router,
    combos,
    aliases
  };
  await writeStore(nextStore);
  return adminJson(request, { ok: true });
}
