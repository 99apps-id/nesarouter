import { describe, expect, it } from "vitest";
import { buildHeadroomLaunchSpec } from "@/lib/headroom/detect";
import { headroomVenvPython, normalizeHeadroomPort } from "@/lib/headroom/process";

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

  it("rejects fractional and out-of-range proxy ports", () => {
    expect(normalizeHeadroomPort(9000)).toBe(9000);
    expect(normalizeHeadroomPort(9000.5)).toBe(8787);
    expect(normalizeHeadroomPort(0)).toBe(8787);
    expect(normalizeHeadroomPort(65536)).toBe(8787);
  });

  it("uses a persistent per-data-dir Python environment", () => {
    expect(headroomVenvPython("/data/headroom/venv", "linux")).toBe("/data/headroom/venv/bin/python");
    expect(headroomVenvPython("C:\\data\\headroom\\venv", "win32")).toMatch(/Scripts[\\/]python\.exe$/);
  });
});
