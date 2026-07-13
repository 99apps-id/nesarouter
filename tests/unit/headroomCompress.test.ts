import { afterEach, describe, expect, it, vi } from "vitest";
import { compressWithHeadroom, formatHeadroomLog } from "@/core/headroomCompress";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("compressWithHeadroom", () => {
  it("no-ops when disabled", async () => {
    global.fetch = vi.fn();
    const body = { messages: [{ role: "user", content: "hello" }] };
    const result = await compressWithHeadroom(body, { enabled: false, url: "http://localhost:8787" });
    expect(result.applied).toBe(false);
    expect(result.stats).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.body.messages[0].content).toBe("hello");
  });

  it("compresses messages and returns a new body", async () => {
    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          messages: [{ role: "user", content: "short" }],
          tokens_before: 100,
          tokens_after: 20,
          tokens_saved: 80
        }),
        { status: 200 }
      )
    );
    const body = { messages: [{ role: "user", content: "long" }], model: "gpt-4o" };
    const result = await compressWithHeadroom(body, { enabled: true, url: "http://headroom:8787/", model: "gpt-4o" });
    expect(result.applied).toBe(true);
    expect(result.body.messages[0].content).toBe("short");
    expect(body.messages[0].content).toBe("long");
    expect(result.stats?.tokens_saved).toBe(80);
    expect(global.fetch).toHaveBeenCalledWith(
      "http://headroom:8787/v1/compress",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("compresses responses input in-place via clone", async () => {
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ messages: [{ role: "user", content: "short" }] }), { status: 200 })
    );
    const body = { input: [{ role: "user", content: "long" }] };
    const result = await compressWithHeadroom(body, { enabled: true, url: "http://localhost:8787" });
    expect(result.applied).toBe(true);
    expect(result.body.input[0].content).toBe("short");
  });

  it("fails open on HTTP error", async () => {
    global.fetch = vi.fn(async () => new Response("nope", { status: 502 }));
    const body = { messages: [{ role: "user", content: "hello" }] };
    const result = await compressWithHeadroom(body, { enabled: true, url: "http://localhost:8787" });
    expect(result.applied).toBe(false);
    expect(result.body).toBe(body);
  });

  it("fails open on network error", async () => {
    global.fetch = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });
    const body = { messages: [{ role: "user", content: "hello" }] };
    const result = await compressWithHeadroom(body, { enabled: true, url: "http://localhost:8787" });
    expect(result.applied).toBe(false);
  });

  it("passes compress_user_messages config when requested", async () => {
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ messages: [{ role: "user", content: "x" }] }), { status: 200 })
    );
    await compressWithHeadroom(
      { messages: [{ role: "user", content: "hello" }] },
      { enabled: true, url: "http://localhost:8787", compressUserMessages: true }
    );
    const init = (global.fetch as any).mock.calls[0][1];
    expect(JSON.parse(init.body)).toMatchObject({
      config: { compress_user_messages: true }
    });
  });
});

describe("formatHeadroomLog", () => {
  it("formats token delta", () => {
    expect(formatHeadroomLog({ messages: [], tokens_before: 100, tokens_after: 40, tokens_saved: 60 })).toContain("60");
  });

  it("returns null for empty stats", () => {
    expect(formatHeadroomLog(null)).toBeNull();
  });
});
