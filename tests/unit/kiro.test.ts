import { describe, expect, it, vi, afterEach } from "vitest";
import { endpointFor, kiroEventStreamToOpenAiSse, kiroRequest, shouldUseKiroAmazonQFallback } from "@/core/providers/kiro";
import { ProviderConfig } from "@/core/types";

const encoder = new TextEncoder();

function eventFrame(eventType: string, payload: unknown) {
  const name = encoder.encode(":event-type");
  const value = encoder.encode(eventType);
  const headers = new Uint8Array(1 + name.length + 1 + 2 + value.length);
  let offset = 0;
  headers[offset++] = name.length;
  headers.set(name, offset); offset += name.length;
  headers[offset++] = 7;
  new DataView(headers.buffer).setUint16(offset, value.length, false); offset += 2;
  headers.set(value, offset);
  const data = encoder.encode(JSON.stringify(payload));
  const frame = new Uint8Array(16 + headers.length + data.length);
  const view = new DataView(frame.buffer);
  view.setUint32(0, frame.length, false);
  view.setUint32(4, headers.length, false);
  frame.set(headers, 12);
  frame.set(data, 12 + headers.length);
  return frame;
}

const kiroOauth = {
  id: "oauth-kiro",
  name: "Kiro",
  type: "kiro",
  tier: "free",
  status: "active",
  baseUrl: "https://runtime.us-east-1.kiro.dev/generateAssistantResponse",
  apiKey: "",
  model: "claude-sonnet-4.5",
  priority: 1,
  inputCostPerMTok: 0,
  outputCostPerMTok: 0,
  oauthProfile: "kiro"
} as ProviderConfig;

describe("Kiro event stream", () => {
  it("converts binary assistant and metrics events into OpenAI SSE", async () => {
    const frames = [
      eventFrame("assistantResponseEvent", { content: "Hello" }),
      eventFrame("metricsEvent", { metricsEvent: { inputTokens: 12, outputTokens: 4 } }),
      eventFrame("messageStopEvent", {})
    ];
    const source = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const frame of frames) controller.enqueue(frame);
        controller.close();
      }
    });
    const result = await new Response(kiroEventStreamToOpenAiSse(source, "claude-sonnet-4.5")).text();
    expect(result).toContain('"content":"Hello"');
    expect(result).toContain('"prompt_tokens":12');
    expect(result).toContain("data: [DONE]");
  });

  it("converts tool-use events and finishes with tool_calls", async () => {
    const source = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(eventFrame("toolUseEvent", { toolUseId: "call_1", name: "lookup_city", input: { city: "Jakarta" } }));
        controller.enqueue(eventFrame("messageStopEvent", {}));
        controller.close();
      }
    });
    const result = await new Response(kiroEventStreamToOpenAiSse(source, "claude-sonnet-4.5")).text();
    expect(result).toContain('"name":"lookup_city"');
    expect(result).toContain('"finish_reason":"tool_calls"');
  });

  it("assigns distinct indices for parallel tool-use events", async () => {
    const source = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(eventFrame("toolUseEvent", { toolUseId: "call_a", name: "one", input: {} }));
        controller.enqueue(eventFrame("toolUseEvent", { toolUseId: "call_b", name: "two", input: {} }));
        controller.enqueue(eventFrame("messageStopEvent", {}));
        controller.close();
      }
    });
    const result = await new Response(kiroEventStreamToOpenAiSse(source, "claude-sonnet-4.5")).text();
    expect(result).toContain('"index":0');
    expect(result).toContain('"index":1');
    expect(result).toContain('"id":"call_a"');
    expect(result).toContain('"id":"call_b"');
  });
});

describe("Kiro request tools", () => {
  it("preserves schemas, assistant calls, and tool results", () => {
    const request = kiroRequest({
      tools: [{ type: "function", function: { name: "lookup_city", description: "Lookup", parameters: { type: "object" } } }],
      messages: [
        { role: "user", content: "Weather?" },
        { role: "assistant", content: null, tool_calls: [{ id: "call_1", type: "function", function: { name: "lookup_city", arguments: '{"city":"Jakarta"}' } }] },
        { role: "tool", tool_call_id: "call_1", content: "31 C" }
      ]
    }, "claude-sonnet-4.5");
    expect(request.conversationState.history[1].assistantResponseMessage.toolUses[0].name).toBe("lookup_city");
    expect(request.conversationState.currentMessage.userInputMessage.userInputMessageContext.toolResults[0].toolUseId).toBe("call_1");
    expect(request.conversationState.currentMessage.userInputMessage.userInputMessageContext.tools[0].toolSpecification.name).toBe("lookup_city");
  });
});

describe("Kiro Builder ID profileArn fallback", () => {
  it("routes Builder ID OAuth without profileArn to Amazon Q host", () => {
    expect(shouldUseKiroAmazonQFallback(kiroOauth, false, undefined)).toBe(true);
    expect(endpointFor(kiroOauth, false, true)).toBe("https://q.us-east-1.amazonaws.com");
  });

  it("keeps runtime host when profileArn is present", () => {
    expect(shouldUseKiroAmazonQFallback(kiroOauth, false, "arn:aws:codewhisperer:us-east-1:123:profile/abc")).toBe(false);
    expect(endpointFor(kiroOauth, false, false)).toContain("runtime.us-east-1.kiro.dev");
  });
});

describe("KiroExecutor.validate soft probe", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("keeps Builder ID connected when ListAvailableModels returns 403", async () => {
    const { KiroExecutor } = await import("@/core/providers/kiro");
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ message: "forbidden" }), { status: 403 })) as typeof fetch;
    const result = await new KiroExecutor().validate({
      ...kiroOauth,
      oauthAccessToken: "eya-builder-id-token"
    });
    expect(result.message).toMatch(/accepted/i);
    expect(result.models?.length).toBeGreaterThan(0);
  });

  it("fails hard only on 401 for Builder ID", async () => {
    const { KiroExecutor } = await import("@/core/providers/kiro");
    globalThis.fetch = vi.fn(async () => new Response("unauthorized", { status: 401 })) as typeof fetch;
    await expect(
      new KiroExecutor().validate({
        ...kiroOauth,
        oauthAccessToken: "bad-token"
      })
    ).rejects.toThrow(/401|unauthorized|returned/i);
  });
});
