import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const tunnelMocks = vi.hoisted(() => ({
  isCloudflaredRunning: vi.fn(() => true),
  killCloudflared: vi.fn(),
  setUnexpectedExitHandler: vi.fn(),
  spawnQuickTunnel: vi.fn(async () => ({ tunnelUrl: "https://new.trycloudflare.com" })),
  getDownloadStatus: vi.fn(() => ({ state: "idle", progress: 0 }))
}));

const storeMocks = vi.hoisted(() => ({
  readTunnelSettings: vi.fn(async () => ({
    enabled: true,
    tunnelUrl: "https://live.trycloudflare.com",
    localPort: 20129
  })),
  writeTunnelSettings: vi.fn(async () => undefined)
}));

vi.mock("@/lib/tunnel/cloudflared", () => tunnelMocks);
vi.mock("@/lib/store", () => storeMocks);

describe("Cloudflare tunnel watchdog", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    tunnelMocks.isCloudflaredRunning.mockReturnValue(true);
    tunnelMocks.spawnQuickTunnel.mockClear();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.resetModules();
  });

  it("does not spawn another process while the managed tunnel is alive", async () => {
    const { restoreTunnelIfNeeded } = await import("@/lib/tunnel/manager");

    await restoreTunnelIfNeeded();
    await vi.advanceTimersByTimeAsync(3 * 60_000);

    expect(tunnelMocks.spawnQuickTunnel).not.toHaveBeenCalled();
  });
});
