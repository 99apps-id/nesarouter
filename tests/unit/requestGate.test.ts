import { afterEach, describe, expect, it } from "vitest";
import { acquireGate, getGateSnapshot, QueueTimeoutError, resetGateForTests } from "@/core/requestGate";

afterEach(() => {
  resetGateForTests();
});

describe("requestGate", () => {
  it("is a no-op when limits are 0", async () => {
    const a = await acquireGate("p1", { maxGlobal: 0, maxPerProvider: 0, waitMs: 0 });
    const b = await acquireGate("p1", { maxGlobal: 0, maxPerProvider: 0, waitMs: 0 });
    a.release();
    b.release();
    expect(getGateSnapshot().inFlight).toBe(0);
  });

  it("enforces global concurrency and FIFO wait", async () => {
    const t1 = await acquireGate("a", { maxGlobal: 1, maxPerProvider: 0, waitMs: 1000 });
    expect(getGateSnapshot().inFlight).toBe(1);

    let acquired = false;
    const pending = acquireGate("b", { maxGlobal: 1, maxPerProvider: 0, waitMs: 1000 }).then((ticket) => {
      acquired = true;
      return ticket;
    });

    await new Promise((r) => setTimeout(r, 20));
    expect(acquired).toBe(false);
    expect(getGateSnapshot().waiting).toBe(1);

    t1.release();
    const t2 = await pending;
    expect(acquired).toBe(true);
    expect(getGateSnapshot().inFlight).toBe(1);
    t2.release();
    expect(getGateSnapshot().inFlight).toBe(0);
  });

  it("enforces per-provider limit", async () => {
    const a1 = await acquireGate("p", { maxGlobal: 0, maxPerProvider: 1, waitMs: 50 });
    await expect(acquireGate("p", { maxGlobal: 0, maxPerProvider: 1, waitMs: 30 })).rejects.toBeInstanceOf(
      QueueTimeoutError
    );
    const other = await acquireGate("q", { maxGlobal: 0, maxPerProvider: 1, waitMs: 50 });
    a1.release();
    other.release();
  });

  it("times out waiting waiters", async () => {
    const held = await acquireGate("x", { maxGlobal: 1, maxPerProvider: 0, waitMs: 1000 });
    await expect(acquireGate("y", { maxGlobal: 1, maxPerProvider: 0, waitMs: 40 })).rejects.toBeInstanceOf(
      QueueTimeoutError
    );
    held.release();
    expect(getGateSnapshot().waiting).toBe(0);
  });
});
