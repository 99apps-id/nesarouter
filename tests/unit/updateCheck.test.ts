import { describe, expect, it } from "vitest";
import { readAppVersion } from "@/lib/appVersion";
import { compareVersions, readPackageVersion } from "@/lib/updateCheck";

describe("updateCheck", () => {
  it("delegates readPackageVersion to readAppVersion", () => {
    expect(readPackageVersion()).toBe(readAppVersion());
  });

  it("compares semver tags", () => {
    expect(compareVersions("0.1.8", "0.1.7")).toBe(1);
    expect(compareVersions("0.1.7", "0.1.8")).toBe(-1);
    expect(compareVersions("v0.1.8", "0.1.8")).toBe(0);
  });
});
