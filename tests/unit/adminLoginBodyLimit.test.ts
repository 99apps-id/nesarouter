import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/auth/login/route";

describe("admin login body limits", () => {
  it("rejects oversized public login bodies", async () => {
    const response = await POST(new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: "x".repeat(20_000) })
    }));

    expect(response.status).toBe(413);
  });

  it("rejects malformed JSON without treating it as a password", async () => {
    const response = await POST(new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{"
    }));

    expect(response.status).toBe(400);
  });
});
