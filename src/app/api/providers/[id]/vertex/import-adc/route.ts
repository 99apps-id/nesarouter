import { NextResponse } from "next/server";
import { finalizeAdminResponse, requireAdmin } from "@/lib/adminApi";
import {
  describeVertexCredential,
  parseVertexAdcJson,
  parseVertexSaJson,
  readLocalAdcJson,
  resolveVertexProjectId
} from "@/core/vertexCredentials";
import { readProviderById, updateProvider } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/providers/[id]/vertex/import-adc
 * Load Application Default Credentials from the local machine
 * (GOOGLE_APPLICATION_CREDENTIALS or gcloud ADC path) into the provider apiKey.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const { id } = await context.params;
  const provider = await readProviderById(id);
  if (!provider) return NextResponse.json({ error: "Provider not found." }, { status: 404 });
  if (provider.type !== "vertex") {
    return NextResponse.json({ error: "Provider is not a Vertex adapter." }, { status: 400 });
  }

  const local = readLocalAdcJson();
  if (!local) {
    return NextResponse.json(
      {
        error:
          "No local ADC found. Run `gcloud auth application-default login` on this host, or set GOOGLE_APPLICATION_CREDENTIALS to a SA/ADC JSON file."
      },
      { status: 404 }
    );
  }

  const kind = describeVertexCredential(local.json);
  const projectFromJson = resolveVertexProjectId(local.json, null);
  const projectId = projectFromJson || provider.oauthProjectId;
  await updateProvider({
    ...provider,
    apiKey: local.json,
    oauthProjectId: projectId || provider.oauthProjectId
  });

  const label =
    kind === "service_account"
      ? "service account"
      : kind === "authorized_user"
        ? "ADC authorized_user"
        : "credentials";

  return finalizeAdminResponse(
    NextResponse.json({
      ok: true,
      imported: true,
      source: "local Google credential profile",
      kind,
      projectId: projectId || null,
      needsProjectId: !projectId && (Boolean(parseVertexAdcJson(local.json)) || Boolean(parseVertexSaJson(local.json))),
      message: `Imported ${label} from the local Google credential profile${projectId ? ` · project ${projectId}` : " · set GCP Project ID if missing"}`
    }),
    request
  );
}
