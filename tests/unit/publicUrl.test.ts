import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
import {
  cookieSecurePreferred,
  publicLoginRedirectUrl,
  publicOrigin,
  publicOriginEdge,
  publicUrl
} from "@/core/publicUrl";

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

  it("middleware login redirect uses public origin not localhost", () => {
    process.env.NESA_PUBLIC_URL = "https://nesa.example.com";
    const request = new Request("http://127.0.0.1:20129/providers", {
      headers: { host: "127.0.0.1:20129" }
    });
    expect(publicOriginEdge(request)).toBe("https://nesa.example.com");
    expect(publicLoginRedirectUrl(request, "/providers")).toBe(
      "https://nesa.example.com/login?next=%2Fproviders"
    );
  });

  it("middleware login redirect falls back to forwarded host", () => {
    delete process.env.NESA_PUBLIC_URL;
    const request = new Request("http://127.0.0.1:20129/keys", {
      headers: {
        host: "127.0.0.1:20129",
        "x-forwarded-host": "nesa.example.com",
        "x-forwarded-proto": "https"
      }
    });
    expect(publicLoginRedirectUrl(request, "/keys")).toBe("https://nesa.example.com/login?next=%2Fkeys");
  });

  it("middleware itself redirects to the public URL behind a proxy", async () => {
    process.env.NESA_PUBLIC_URL = "https://router.kliimora.id";
    const request = new NextRequest("http://127.0.0.1:20129/providers", {
      headers: { host: "127.0.0.1:20129" }
    });

    const response = await middleware(request);
    expect(response.headers.get("location")).toBe("https://router.kliimora.id/login?next=%2Fproviders");
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
