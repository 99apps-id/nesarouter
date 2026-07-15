import { describe, expect, it } from "vitest";
import { normalizeTunnelPort } from "@/lib/tunnel/port";
import { parseTailscaleServeStatus } from "@/lib/tunnel/tailscale";

describe("normalizeTunnelPort", () => {
  it("accepts valid ports and falls back", () => {
    expect(normalizeTunnelPort(20129)).toBe(20129);
    expect(normalizeTunnelPort("8080")).toBe(8080);
    expect(normalizeTunnelPort(undefined, 20129)).toBe(20129);
    expect(() => normalizeTunnelPort(0)).toThrow(/1 and 65535/);
    expect(() => normalizeTunnelPort(70000)).toThrow(/1 and 65535/);
  });
});

describe("parseTailscaleServeStatus", () => {
  it("reads Web HTTPS host handlers", () => {
    const parsed = parseTailscaleServeStatus({
      Web: {
        "https://nesa.tailnet-name.ts.net:443": {
          Handlers: { "/": { Proxy: "http://127.0.0.1:20129" } }
        }
      }
    });
    expect(parsed.active).toBe(true);
    expect(parsed.url).toContain("nesa.tailnet-name.ts.net");
  });

  it("reads Background.Web shape", () => {
    const parsed = parseTailscaleServeStatus({
      Background: {
        Web: {
          "https://box.ts.net": {
            Handlers: { "/": { Proxy: "http://127.0.0.1:20129" } }
          }
        }
      }
    });
    expect(parsed.url).toBe("https://box.ts.net");
  });

  it("treats empty status as inactive", () => {
    expect(parseTailscaleServeStatus({})).toEqual({ url: "", active: false });
  });
});
