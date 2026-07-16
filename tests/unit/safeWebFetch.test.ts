import { describe, expect, it, vi } from "vitest";
import { createPinnedLookup, isBlockedAddress } from "@/core/safeWebFetch";

describe("outbound web fetch address guard", () => {
  it("blocks local, private, carrier-grade, and link-local addresses", () => {
    for (const address of ["localhost", "127.0.0.1", "10.2.3.4", "100.64.0.1", "169.254.1.1", "172.16.0.1", "192.168.1.2", "::1", "fc00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:a00:1"]) {
      expect(isBlockedAddress(address)).toBe(true);
    }
  });

  it("allows public addresses", () => {
    expect(isBlockedAddress("1.1.1.1")).toBe(false);
    expect(isBlockedAddress("2606:4700:4700::1111")).toBe(false);
  });

  it("pins the validated address instead of resolving the hostname again", () => {
    const callback = vi.fn();
    createPinnedLookup("1.1.1.1", 4)("attacker.example", {}, callback);
    expect(callback).toHaveBeenCalledWith(null, "1.1.1.1", 4);
  });
});
