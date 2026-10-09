import { afterEach, describe, expect, it, vi } from "vitest";
import { ProviderConfig } from "@/core/types";
import { COPILOT_MODELS, copilotRoot, copilotSessionId, GithubCopilotExecutor } from "@/core/providers/githubCopilot";

function provider(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    id: "oauth-github-copilot",
    name: "GitHub Copilot",
    type: "github_copilot",
    tier: "pro",
    status: "active",
    baseUrl: "https://api.githubcopilot.com/chat/completions",
    apiKey: "",
    model: "gpt-5.4",
    priority: 1,
    inputCostPerMTok: 0,
    outputCostPerMTok: 0,
    oauthProfile: "github_copilot",
    oauthCopilotToken: "copilot-session-token",
    ...overrides
  } as ProviderConfig;
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });
}

const executor = new GithubCopilotExecutor();
let calls: Array<{ url: string; init: RequestInit }> = [];

function stubFetch(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: any, init: any) => {
      calls.push({ url: String(input), init: init ?? {} });
      return handler(String(input), init ?? {});
    })
  );
}

function headersOf(index = 0): Record<string, string> {
  return calls[index].init.headers as Record<string, string>;
}

function bodyOf(index = 0): Record<string, any> {
  return JSON.parse(String(calls[index].init.body));
}

afterEach(() => {
  vi.unstubAllGlobals();
  calls = [];
});

describe("GitHub Copilot endpoint derivation", () => {
  it("strips a pinned path back to the Copilot API root", () => {
    expect(copilotRoot(provider())).toBe("https://api.githubcopilot.com");
    expect(copilotRoot(provider({ baseUrl: "https://api.githubcopilot.com/" }))).toBe("https://api.githubcopilot.com");
    expect(copilotRoot(provider({ baseUrl: "https://api.githubcopilot.com" }))).toBe("https://api.githubcopilot.com");
    expect(copilotRoot(provider({ baseUrl: "https://api.githubcopilot.com/v1/messages" }))).toBe(
      "https://api.githubcopilot.com"
    );
  });

  it("derives a session id from the credential, stable across calls", () => {
    expect(copilotSessionId("token-a")).toBe(copilotSessionId("token-a"));
    expect(copilotSessionId("token-a")).not.toBe(copilotSessionId("token-b"));
  });
});

describe("GitHub Copilot chat completions", () => {
  it("posts to the preset base with Copilot identity and session headers", async () => {
    stubFetch(() => jsonResponse({ choices: [{ message: { role: "assistant", content: "ok" } }] }));
    const result = await executor.call(provider(), { messages: [{ role: "user", content: "hi" }], model: "ignored" });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.githubcopilot.com/chat/completions");
    const session = copilotSessionId("copilot-session-token");
    expect(headersOf().session_id).toBe(session);
    expect(headersOf()["x-request-id"]).toBe(`copilot-${session}`);
    expect(headersOf()["copilot-integration-id"]).toBe("vscode-chat");
    expect(headersOf()["X-Initiator"]).toBe("user");
    expect(headersOf().authorization).toBe("Bearer copilot-session-token");
    // The provider's model wins over whatever the client asked for.
    expect(bodyOf().model).toBe("gpt-5.4");
    expect(result.choices[0].message.content).toBe("ok");
  });

  it("refuses to call upstream without a Copilot session token", async () => {
    stubFetch(() => jsonResponse({}));
    await expect(executor.call(provider({ oauthCopilotToken: "" }), { messages: [] })).rejects.toThrow(
      /no Copilot session token/
    );
    expect(calls).toHaveLength(0);
  });

  it("lists the current Copilot catalogue", async () => {
    const models = await executor.listModels(provider());
    expect(models).toContain("gpt-5.4");
    expect(models).toContain("claude-haiku-4.5");
    expect(models).toContain("mai-code-1.1-flash");
    expect(models.length).toBe(COPILOT_MODELS.length);
  });
});

describe("GitHub Copilot Claude models", () => {
  it("serves Claude through /v1/messages with anthropic-version", async () => {
    stubFetch(() => jsonResponse({ content: [{ type: "text", text: "hi" }] }));
    const result = await executor.call(provider({ model: "claude-sonnet-5" }), {
      messages: [{ role: "user", content: "x" }],
      max_tokens: 16
    });

    expect(calls[0].url).toBe("https://api.githubcopilot.com/v1/messages");
    expect(headersOf()["anthropic-version"]).toBe("2023-06-01");
    expect(headersOf().session_id).toBe(copilotSessionId("copilot-session-token"));
    expect(bodyOf().model).toBe("claude-sonnet-5");
    expect(result.choices[0].message.content).toBe("hi");
  });
});

describe("GitHub Copilot /responses escalation", () => {
  const escalationError = { error: { message: "This model is not accessible via the /chat/completions endpoint" } };

  it("retries on /responses when Copilot redirects the model there", async () => {
    stubFetch((url) =>
      url.endsWith("/responses")
        ? jsonResponse({
            id: "resp_1",
            output: [{ type: "message", content: [{ type: "output_text", text: "escalated" }] }],
            usage: { input_tokens: 3, output_tokens: 4 }
          })
        : jsonResponse(escalationError, 400)
    );

    const result = await executor.call(provider({ model: "gpt-5.6-terra" }), {
      messages: [{ role: "user", content: "x" }]
    });

    expect(calls.map((call) => call.url)).toEqual([
      "https://api.githubcopilot.com/chat/completions",
      "https://api.githubcopilot.com/responses"
    ]);
    expect(result.choices[0].message.content).toBe("escalated");
    expect(result.usage.total_tokens).toBe(7);
  });

  it("remembers the escalated model instead of retrying /chat/completions", async () => {
    stubFetch((url) =>
      url.endsWith("/responses")
        ? jsonResponse({ id: "resp_2", output: [{ type: "message", content: [{ type: "output_text", text: "again" }] }] })
        : jsonResponse(escalationError, 400)
    );

    await executor.call(provider({ model: "gpt-5.6-terra" }), { messages: [{ role: "user", content: "y" }] });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.githubcopilot.com/responses");
  });

  it("does not escalate a model Copilot serves only from /chat/completions", async () => {
    stubFetch(() => jsonResponse(escalationError, 400));
    await expect(
      executor.call(provider({ model: "gemini-3.8-flash" }), { messages: [{ role: "user", content: "z" }] })
    ).rejects.toThrow(/returned 400/);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.githubcopilot.com/chat/completions");
  });
});
