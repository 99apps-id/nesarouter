import { afterEach, describe, expect, it } from "vitest";
import { cookieSecurePreferred, publicOrigin, publicUrl } from "@/core/publicUrl";

describe("publicUrl", () => {
  const prevPublic = process.env.NESA_PUBLIC_URL;
  const prevCookie = process.env.NESA_COOKIE_SECURE;

  afterEach(() => {
    if (prevPublic === undefined) delete process.env.NESA_PUBLIC_URL;
    else process.env.NESA_PUBLIC_URL = prevPublic;
    if (prevCookie === undefined) delete process.env.NESA_COOKIE_SECURE;
    else process.env.NESA_COOKIE_SECURE = prevCookie;
  });

  it("prefers NESA_PUBLIC_URL over request.url", () => {
    process.env.NESA_PUBLIC_URL = "https://nesa.example.com";
    const request = new Request("http://localhost:20129/api/x");
    expect(publicOrigin(request)).toBe("https://nesa.example.com");
    expect(publicUrl("/login", request)).toBe("https://nesa.example.com/login");
  });

  it("uses X-Forwarded-Host and Proto when env unset", () => {
    delete process.env.NESA_PUBLIC_URL;
    const request = new Request("http://127.0.0.1:20129/", {
      headers: {
        "x-forwarded-host": "gateway.example.com",
        "x-forwarded-proto": "https"
      }
    });
    expect(publicOrigin(request)).toBe("https://gateway.example.com");
  });

  it("uses non-loopback Host over localhost request.url", () => {
    delete process.env.NESA_PUBLIC_URL;
    const request = new Request("http://localhost:20129/api/providers/x/oauth/start", {
      headers: {
        host: "nesa.example.com",
        "x-forwarded-proto": "https"
      }
    });
    expect(publicOrigin(request)).toBe("https://nesa.example.com");
  });

  it("cookieSecurePreferred follows https public URL", () => {
    process.env.NESA_PUBLIC_URL = "https://nesa.example.com";
    delete process.env.NESA_COOKIE_SECURE;
    expect(cookieSecurePreferred()).toBe(true);
  });

  it("cookieSecurePreferred respects x-forwarded-proto http", () => {
    delete process.env.NESA_PUBLIC_URL;
    delete process.env.NESA_COOKIE_SECURE;
    const request = new Request("http://127.0.0.1:20129/api/auth/login", {
      headers: {
        host: "nesa.example.com:20129",
        "x-forwarded-proto": "http"
      }
    });
    expect(cookieSecurePreferred(request)).toBe(false);
  });

  it("cookieSecurePreferred respects x-forwarded-proto https", () => {
    delete process.env.NESA_PUBLIC_URL;
    delete process.env.NESA_COOKIE_SECURE;
    const request = new Request("http://127.0.0.1:20129/api/auth/login", {
      headers: {
        host: "nesa.example.com",
        "x-forwarded-proto": "https"
      }
    });
    expect(cookieSecurePreferred(request)).toBe(true);
  });

  it("cookieSecurePreferred can be forced off", () => {
    process.env.NESA_PUBLIC_URL = "https://nesa.example.com";
    process.env.NESA_COOKIE_SECURE = "false";
    expect(cookieSecurePreferred()).toBe(false);
  });
});
