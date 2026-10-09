import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  ANTIGRAVITY_CLIENT_ID_ENV,
  ANTIGRAVITY_CLIENT_SECRET_ENV,
  ANTIGRAVITY_SESSION_ID_ENV,
  antigravityCredentials,
  antigravityCredentialsError,
  antigravityRequestId,
  antigravitySessionId,
  hasAntigravityCredentials
} from "@/core/antigravityCredentials";
import { getPreset } from "@/core/oauthProviderPresets";

const ENV_NAMES = [
  ANTIGRAVITY_CLIENT_ID_ENV,
  ANTIGRAVITY_CLIENT_SECRET_ENV,
  ANTIGRAVITY_SESSION_ID_ENV
];
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const name of ENV_NAMES) {
    saved[name] = process.env[name];
    delete process.env[name];
  }
});

afterEach(() => {
  for (const name of ENV_NAMES) {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
  }
});

describe("antigravity credential stamping", () => {
  it("is unstamped on a bare checkout", () => {
    expect(hasAntigravityCredentials()).toBe(false);
    expect(antigravityCredentials()).toEqual({ clientId: "", clientSecret: "" });
  });

  it("reads both halves from the deployment env", () => {
    process.env[ANTIGRAVITY_CLIENT_ID_ENV] = "client.apps.googleusercontent.com";
    process.env[ANTIGRAVITY_CLIENT_SECRET_ENV] = "GOCSPX-secret";
    expect(hasAntigravityCredentials()).toBe(true);
    expect(antigravityCredentials()).toEqual({
      clientId: "client.apps.googleusercontent.com",
      clientSecret: "GOCSPX-secret"
    });
  });

  it("tolerates quotes and padding pasted from shell snippets", () => {
    process.env[ANTIGRAVITY_CLIENT_ID_ENV] = '  "client-id"  ';
    process.env[ANTIGRAVITY_CLIENT_SECRET_ENV] = "'secret'";
    expect(antigravityCredentials()).toEqual({ clientId: "client-id", clientSecret: "secret" });
  });

  it("requires both halves, so a half-stamped deploy is not treated as configured", () => {
    process.env[ANTIGRAVITY_CLIENT_ID_ENV] = "client-id";
    expect(hasAntigravityCredentials()).toBe(false);
    expect(antigravityCredentialsError()).toContain(ANTIGRAVITY_CLIENT_SECRET_ENV);
  });

  it("turns a missing stamp into an actionable message rather than invalid_client", () => {
    const message = antigravityCredentialsError();
    expect(message).toContain(ANTIGRAVITY_CLIENT_ID_ENV);
    expect(message).toContain(ANTIGRAVITY_CLIENT_SECRET_ENV);
    expect(message).toMatch(/not committed to the repository/);
  });

  it("reports no error once stamped", () => {
    process.env[ANTIGRAVITY_CLIENT_ID_ENV] = "client-id";
    process.env[ANTIGRAVITY_CLIENT_SECRET_ENV] = "secret";
    expect(antigravityCredentialsError()).toBe("");
  });
});

describe("getPreset fills the stamped antigravity pair", () => {
  it("leaves other profiles untouched", () => {
    expect(getPreset("muse")?.clientId).toBe("1031625952748946");
  });

  it("injects the stamped pair so callers never read an empty client id", () => {
    process.env[ANTIGRAVITY_CLIENT_ID_ENV] = "stamped-id";
    process.env[ANTIGRAVITY_CLIENT_SECRET_ENV] = "stamped-secret";
    const preset = getPreset("antigravity");
    expect(preset?.clientId).toBe("stamped-id");
    expect(preset?.clientSecret).toBe("stamped-secret");
  });

  it("does not carry a committed Google secret when unstamped", () => {
    const preset = getPreset("antigravity");
    expect(preset?.clientId).toBe("");
    expect(preset?.clientSecret).toBe("");
  });
});

describe("antigravity session id", () => {
  it("is a non-negative 63-bit integer string, which Cloud Code requires", () => {
    const session = antigravitySessionId("account-1");
    expect(session).toMatch(/^\d+$/);
    expect(BigInt(session) >= 0n).toBe(true);
    expect(BigInt(session) <= 0x7fffffffffffffffn).toBe(true);
  });

  it("is stable for one seed and distinct across seeds", () => {
    expect(antigravitySessionId("account-1")).toBe(antigravitySessionId("account-1"));
    expect(antigravitySessionId("account-1")).not.toBe(antigravitySessionId("account-2"));
  });

  it("honors an operator stamp and ignores a non-numeric one", () => {
    process.env[ANTIGRAVITY_SESSION_ID_ENV] = "123456789";
    expect(antigravitySessionId("account-1")).toBe("123456789");
    process.env[ANTIGRAVITY_SESSION_ID_ENV] = "not-a-number";
    expect(antigravitySessionId("account-1")).not.toBe("not-a-number");
  });

  it("builds the request id in the shape Cloud Code expects", () => {
    const id = antigravityRequestId("1", "gemini-3-flash", 2);
    // agent/<32 hex>/<unix millis>/<32 hex>/<step>  with step = messages*2-1
    expect(id).toMatch(/^agent\/[0-9a-f]{32}\/\d{13}\/[0-9a-f]{32}\/3$/);
  });

  it("is unique per request, so a retry is not mistaken for a replay", () => {
    expect(antigravityRequestId("1", "gemini-3-flash", 2)).not.toBe(antigravityRequestId("1", "gemini-3-flash", 2));
  });

  it("never emits a step below 1", () => {
    expect(antigravityRequestId("1", "gemini-3-flash", 0)).toMatch(/\/1$/);
  });
});
