import { NextResponse } from "next/server";
import { handleMediaPassthrough } from "@/core/mediaPassthrough";
import { authorizeClientRequest, isRequestBodyTooLarge } from "@/core/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await authorizeClientRequest(request))) return NextResponse.json({ error: { message: "Invalid NesaRouter API key." } }, { status: 401 });
  if (isRequestBodyTooLarge(request, 64 * 1024 * 1024)) return NextResponse.json({ error: { message: "Request body exceeds 64 MB." } }, { status: 413 });
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
