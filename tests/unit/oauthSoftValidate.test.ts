import { afterEach, describe, expect, it, vi } from "vitest";
import { AnthropicMessagesExecutor } from "@/core/providers/anthropic";
import { CursorExecutor } from "@/core/providers/cursor";
import { GithubCopilotExecutor } from "@/core/providers/githubCopilot";
import { ProviderConfig } from "@/core/types";

function base(partial: Partial<ProviderConfig>): ProviderConfig {
  return {
    id: "p",
    name: "P",
    type: "openai_compatible",
    tier: "premium",
    status: "active",
    baseUrl: "https://example.com",
    apiKey: "",
    model: "m",
    priority: 1,
    inputCostPerMTok: 0,
    outputCostPerMTok: 0,
    ...partial
  };
}

describe("soft OAuth validation", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("accepts Claude OAuth without calling Messages", async () => {
    const result = await new AnthropicMessagesExecutor().validate(
      base({
        type: "anthropic_messages",
        oauthProfile: "anthropic_claude",
        oauthAccessToken: "sk-ant-oat-abcdefghijklmnopqrstuvwxyz",
        baseUrl: "https://api.anthropic.com/v1/messages",
        model: "claude-sonnet-5"
      })
    );
    expect(result.message).toMatch(/OAuth token present/i);
  });

  it("accepts Cursor only after the inference endpoint accepts the request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(new Uint8Array(), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await new CursorExecutor().validate(
      base({
        type: "cursor",
        oauthProfile: "cursor",
        oauthAccessToken: "a".repeat(60),
        oauthMachineId: "machine-abc",
        baseUrl: "https://api2.cursor.sh"
      })
    );
    expect(result.message).toMatch(/inference endpoint accepted/i);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("rejects Cursor when inference returns HTTP 464", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 464 })));
    await expect(
      new CursorExecutor().validate(
        base({
          type: "cursor",
          oauthProfile: "cursor",
          oauthAccessToken: "a".repeat(60),
          oauthMachineId: "machine-abc",
          baseUrl: "https://api2.cursor.sh"
        })
      )
    ).rejects.toMatchObject({ status: 464 });
  });

  it("rejects Cursor without machine id", async () => {
    await expect(
      new CursorExecutor().validate(
        base({
          type: "cursor",
          oauthProfile: "cursor",
          oauthAccessToken: "a".repeat(60),
          baseUrl: "https://api2.cursor.sh"
        })
      )
    ).rejects.toThrow(/machine id/i);
  });

  it("accepts GitHub Copilot when OAuth material exists", async () => {
    const result = await new GithubCopilotExecutor().validate(
      base({
        type: "github_copilot",
        oauthProfile: "github_copilot",
        oauthAccessToken: "gho_xxxx",
        baseUrl: "https://api.githubcopilot.com/chat/completions"
      })
    );
    expect(result.message).toMatch(/GitHub/i);
  });
});
