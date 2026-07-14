import { describe, expect, it } from "vitest";
import { endpointFor, kiroEventStreamToOpenAiSse, shouldUseKiroAmazonQFallback } from "@/core/providers/kiro";
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