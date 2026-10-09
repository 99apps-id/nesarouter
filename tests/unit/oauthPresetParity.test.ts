import { describe, expect, it } from "vitest";
import { OAUTH_PRESETS, getPreset } from "@/core/oauthProviderPresets";
import { COPILOT_MODELS, copilotRoot } from "@/core/providers/githubCopilot";

/**
 * These pin the GitHub and Grok OAuth presets to the reference client's spec
 * (termixgo internal/oauth/spec.go), so a silent drift in a client id, scope or
 * endpoint is caught here rather than by a failing login in production.
 */
describe("GitHub Copilot OAuth preset parity", () => {
  const preset = getPreset("github_copilot")!;

  it("uses the public GitHub device-flow client and endpoints", () => {
    expect(preset.clientId).toBe("Iv1.b507a08c87ecfe98");
    expect(preset.scope).toBe("read:user");
    expect(preset.deviceCodeUrl).toBe("https://github.com/login/device/code");
    expect(preset.tokenUrl).toBe("https://github.com/login/oauth/access_token");
    expect(preset.deviceFlow).toBe(true);
  });

  it("mints the Copilot session token from the GitHub access token", () => {
    expect(preset.copilotTokenUrl).toBe("https://api.github.com/copilot_internal/v2/token");
    expect(preset.refreshLeadMs).toBe(5 * 60_000);
    // The mint request needs the Copilot client identity, not just the bearer.
    expect(preset.copilotHeaders?.["editor-version"]).toBeTruthy();
    expect(preset.copilotHeaders?.["x-github-api-version"]).toBeTruthy();
  });

  it("keeps a base URL the executor can derive both API paths from", () => {
    expect(preset.baseUrl).toBe("https://api.githubcopilot.com/chat/completions");
    expect(copilotRoot({ baseUrl: preset.baseUrl! } as any)).toBe("https://api.githubcopilot.com");
  });

  it("offers the current Copilot catalogue and a default inside it", () => {
    expect(COPILOT_MODELS).toContain("gpt-5.4");
    expect(COPILOT_MODELS).toContain("grok-4.7");
    expect(preset.defaultModel).toBeTruthy();
  });
});

describe("Grok OAuth preset parity", () => {
  const preset = getPreset("grok_cli")!;

  it("uses the public Grok CLI client id and scope", () => {
    expect(preset.clientId).toBe("b1a00492-073a-47ea-816f-4c329264a828");
    expect(preset.scope).toBe(
      "openid profile email offline_access grok-cli:access api:access conversations:read conversations:write"
    );
  });

  it("uses the x.ai device endpoints", () => {
    expect(preset.deviceCodeUrl).toBe("https://auth.x.ai/oauth2/device/code");
    expect(preset.tokenUrl).toBe("https://auth.x.ai/oauth2/token");
    expect(preset.deviceFlow).toBe(true);
    expect(preset.deviceReferrer).toBe("grok-build");
  });

  it("offers the current Grok OAuth model ids without dropping any existing one", () => {
    for (const id of ["grok-4.5", "grok-4.5-high", "grok-4.5-medium", "grok-4.5-low", "grok-4.7", "grok-build-0.1"]) {
      expect(preset.models).toContain(id);
    }
    expect(preset.defaultModel).toBe("grok-4.5");
    expect(preset.models).toContain(preset.defaultModel!);
  });
});

describe("OAuth preset default model invariant", () => {
  it("never offers a default that is outside its own model list", () => {
    const offenders: string[] = [];
    for (const [profile, preset] of Object.entries(OAUTH_PRESETS)) {
      if (!preset.models?.length || !preset.defaultModel) continue;
      if (!preset.models.includes(preset.defaultModel)) offenders.push(`${profile}: ${preset.defaultModel}`);
    }
    expect(offenders).toEqual([]);
  });
});
