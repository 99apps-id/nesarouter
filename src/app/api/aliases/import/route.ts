import { NextResponse } from "next/server";
import { adminJson, requireAdmin } from "@/lib/adminApi";
import { mergeNineRouterAliases } from "@/core/nineRouterImport";
import { readStore, writeStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const store = await readStore();
  const result = mergeNineRouterAliases(store.aliases, payload);
  if (result.added === 0 && result.updated === 0) {
    return adminJson(request, {
      ok: true,
      added: 0,
      updated: 0,
      skipped: result.skipped,
      aliases: result.aliases,
      message: "No aliases changed."
    });
  }

  await writeStore({ ...store, aliases: result.aliases });
  return adminJson(request, {
    ok: true,
    added: result.added,
    updated: result.updated,
    skipped: result.skipped,
    aliases: result.aliases
  });
}
