import { describe, expect, it } from "vitest";
import { escapeOAuthHtml } from "@/core/oauthLoopback";

describe("OAuth loopback HTML", () => {
  it("escapes provider-controlled callback values", () => {
    expect(escapeOAuthHtml(`<script>alert("x")</script>&'`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&amp;&#39;"
    );
  });
});
