import { afterEach, describe, expect, it } from "vitest";
import { checkRateLimit, clearRateLimit, rateLimitKey } from "@/lib/rateLimit";

describe("rateLimitKey", () => {
  const prevTrustProxy = process.env.NESA_TRUST_PROXY;

  afterEach(() => {
    if (prevTrustProxy === undefined) delete process.env.NESA_TRUST_PROXY;
    else process.env.NESA_TRUST_PROXY = prevTrustProxy;
  });

  it("ignores X-Forwarded-For by default, so spoofed IPs share one bucket", () => {
    delete process.env.NESA_TRUST_PROXY;
    const a = new Request("http://localhost/x", { headers: { "x-forwarded-for": "1.1.1.1" } });
    const b = new Request("http://localhost/x", { headers: { "x-forwarded-for": "2.2.2.2" } });
    expect(rateLimitKey(a, "suffix")).toBe(rateLimitKey(b, "suffix"));
    expect(rateLimitKey(a, "suffix")).toBe("local:suffix");
  });

  it("honors X-Forwarded-For only when NESA_TRUST_PROXY is enabled", () => {
    process.env.NESA_TRUST_PROXY = "true";
    const a = new Request("http://localhost/x", { headers: { "x-forwarded-for": "1.1.1.1" } });
    const b = new Request("http://localhost/x", { headers: { "x-forwarded-for": "2.2.2.2" } });
    expect(rateLimitKey(a, "suffix")).toBe("1.1.1.1:suffix");
    expect(rateLimitKey(a, "suffix")).not.toBe(rateLimitKey(b, "suffix"));
  });

  it("cannot be bypassed by spoofing X-Forwarded-For when untrusted", () => {
    delete process.env.NESA_TRUST_PROXY;
    clearRateLimit("local:probe");
    for (let i = 0; i < 3; i += 1) {
      const request = new Request("http://localhost/x", { headers: { "x-forwarded-for": `10.0.0.${i}` } });
      const result = checkRateLimit(rateLimitKey(request, "probe"), 3);
      expect(result.allowed).toBe(true);
    }
    const request = new Request("http://localhost/x", { headers: { "x-forwarded-for": "10.0.0.99" } });
    expect(checkRateLimit(rateLimitKey(request, "probe"), 3).allowed).toBe(false);
  });
});
