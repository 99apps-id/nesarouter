import { describe, expect, it } from "vitest";
import {
  describeVertexCredential,
  parseVertexAdcJson,
  parseVertexSaJson,
  resolveVertexProjectId
} from "@/core/vertexCredentials";
import { providerIdentity } from "@/lib/providerIdentity";

describe("vertex credentials", () => {
  it("parses service account and ADC JSON", () => {
    const sa = JSON.stringify({
      type: "service_account",
      project_id: "proj-sa",
      private_key: "-----BEGIN PRIVATE KEY-----\nX\n-----END PRIVATE KEY-----\n",
      client_email: "sa@proj.iam.gserviceaccount.com"
    });
    const adc = JSON.stringify({
      type: "authorized_user",
      client_id: "cid",
      client_secret: "sec",
      refresh_token: "rt",
      quota_project_id: "proj-adc"
    });
    expect(parseVertexSaJson(sa)?.project_id).toBe("proj-sa");
    expect(parseVertexAdcJson(adc)?.quota_project_id).toBe("proj-adc");
    expect(describeVertexCredential(sa)).toBe("service_account");
    expect(describeVertexCredential(adc)).toBe("authorized_user");
    expect(describeVertexCredential("AIza...")).toBe("api_key");
  });

  it("resolves project id with explicit override", () => {
    const adc = JSON.stringify({
      type: "authorized_user",
      client_id: "cid",
      client_secret: "sec",
      refresh_token: "rt"
    });
    expect(resolveVertexProjectId(adc, "manual-proj")).toBe("manual-proj");
    expect(resolveVertexProjectId(adc, null)).toBe("");
  });

  it("resolves Vertex brand icon", () => {
    expect(providerIdentity({ id: "vertex-ai", name: "Vertex AI" }).iconPath).toBe("/providers/vertex.png");
    expect(providerIdentity({ id: "vertex-partner", name: "Vertex Partner" }).key).toBe("vertex");
  });
});
