import { describe, expect, it } from "vitest";
import { buildHeadroomLaunchSpec } from "@/lib/headroom/detect";

describe("Headroom process launch", () => {
  it("uses the CLI executable when it is on PATH", () => {
    expect(buildHeadroomLaunchSpec("/usr/local/bin/headroom", "/usr/bin/python3")).toEqual({
      command: "/usr/local/bin/headroom",
      prefixArgs: []
    });
  });

  it("falls back to the installed Python module when the launcher is not on PATH", () => {
    expect(buildHeadroomLaunchSpec(null, "/usr/bin/python3")).toEqual({
      command: "/usr/bin/python3",
      prefixArgs: ["-m", "headroom.cli"]
    });
  });

  it("reports no launch method when Headroom is absent", () => {
    expect(buildHeadroomLaunchSpec(null, null)).toBeNull();
  });
});
