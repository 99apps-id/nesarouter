import { describe, it, expect } from "vitest";
import { injectTokenSaver } from "@/core/tokenSaver";

describe("tokenSaver", () => {
  it("is a no-op when all levels are off", () => {
    const body = { messages: [{ role: "user", content: "hi" }] };
    expect(injectTokenSaver(body, { caveman: "off", ponytail: "off" })).toBe(body);
  });

  it("prepends a system message when none exists", () => {
    const out = injectTokenSaver({ messages: [{ role: "user", content: "hi" }] }, { caveman: "full", ponytail: "off" });
    expect(out.messages[0].role).toBe("system");
    expect(out.messages[0].content).toMatch(/caveman/i);
  });

  it("merges into an existing system message", () => {
    const out = injectTokenSaver(
      { messages: [{ role: "system", content: "Be helpful." }, { role: "user", content: "hi" }] },
      { caveman: "off", ponytail: "full" }
    );
    expect(out.messages[0].role).toBe("system");
    expect(out.messages[0].content).toContain("Be helpful.");
    expect(out.messages[0].content).toMatch(/YAGNI/i);
    expect(out.messages.length).toBe(2);
  });

  it("combines caveman and ponytail guidance", () => {
    const out = injectTokenSaver({ messages: [{ role: "user", content: "hi" }] }, { caveman: "ultra", ponytail: "ultra" });
    expect(out.messages[0].content).toMatch(/ultra-terse/i);
    expect(out.messages[0].content).toMatch(/YAGNI extremist/i);
  });
});
