import { NextResponse } from "next/server";
import { handleMediaPassthrough } from "@/core/mediaPassthrough";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    return NextResponse.json({ error: { message: "Audio transcriptions require multipart/form-data." } }, { status: 400 });
  }
  try {
    const form = await request.formData();
    return handleMediaPassthrough(request, "transcriptions", {
      body: form,
      isFormData: true,
      probeText: "stt"
    });
  } catch {
    return NextResponse.json({ error: { message: "Failed to parse multipart upload." } }, { status: 400 });
  }
}
