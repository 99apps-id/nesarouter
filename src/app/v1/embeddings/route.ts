import { NextResponse } from "next/server";
import { handleMediaPassthrough } from "@/core/mediaPassthrough";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { message: "Request body must be valid JSON." } }, { status: 400 });
  }
  return handleMediaPassthrough(request, "embeddings", { body, probeText: "embed" });
}
