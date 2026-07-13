import { describe, expect, it } from "vitest";
import { compareVersions, readPackageVersion } from "@/lib/updateCheck";

describe("updateCheck", () => {
  it("reads a real version from package.json (not 0.0.0)", () => {
    const version = readPackageVersion();
    expect(version).not.toBe("0.0.0");
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("compares semver tags", () => {
    expect(compareVersions("0.1.8", "0.1.7")).toBe(1);
    expect(compareVersions("0.1.7", "0.1.8")).toBe(-1);
    expect(compareVersions("v0.1.8", "0.1.8")).toBe(0);
  });
});
