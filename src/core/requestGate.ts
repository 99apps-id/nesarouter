export class QueueTimeoutError extends Error {
  readonly code = "queue_timeout" as const;

  constructor(message = "Upstream concurrency queue timed out.") {
    super(message);
    this.name = "QueueTimeoutError";
  }
}

export class GateAbortedError extends Error {
  readonly code = "request_aborted" as const;
  constructor() {
    super("Request was cancelled while waiting for an upstream slot.");
    this.name = "GateAbortedError";
  }
}

export interface GateLimits {
  maxGlobal: number;
  maxPerProvider: number;
  waitMs: number;
}

export interface GateTicket {
  providerId: string;
  release: () => void;
}

export interface GateSnapshot {
  inFlight: number;
  waiting: number;
  perProvider: Record<string, number>;
}

interface Waiter {
  providerId: string;
  limits: GateLimits;
  resolve: (ticket: GateTicket) => void;
  reject: (error: QueueTimeoutError) => void;
  timer: ReturnType<typeof setTimeout>;
  signal?: AbortSignal;
  abort?: () => void;
}

const inFlightByProvider = new Map<string, number>();
let inFlightTotal = 0;
const waitQueue: Waiter[] = [];

function providerCount(providerId: string) {
  return inFlightByProvider.get(providerId) ?? 0;
}

function canAcquire(providerId: string, limits: GateLimits) {
  if (limits.maxGlobal > 0 && inFlightTotal >= limits.maxGlobal) return false;
  if (limits.maxPerProvider > 0 && providerCount(providerId) >= limits.maxPerProvider) return false;
  return true;
}

function takeSlot(providerId: string): GateTicket {
  inFlightTotal += 1;
  inFlightByProvider.set(providerId, providerCount(providerId) + 1);
  let released = false;
  return {
    providerId,
    release() {
      if (released) return;
      released = true;
      inFlightTotal = Math.max(0, inFlightTotal - 1);
      const next = providerCount(providerId) - 1;
      if (next <= 0) inFlightByProvider.delete(providerId);
      else inFlightByProvider.set(providerId, next);
      drainQueue();
    }
  };
}

function drainQueue() {
  let i = 0;
  while (i < waitQueue.length) {
    const waiter = waitQueue[i];
    if (!canAcquire(waiter.providerId, waiter.limits)) {
      i += 1;
      continue;
    }
    waitQueue.splice(i, 1);
    clearTimeout(waiter.timer);
    if (waiter.abort) waiter.signal?.removeEventListener("abort", waiter.abort);
    waiter.resolve(takeSlot(waiter.providerId));
  }
}

/**
 * Acquire an upstream concurrency slot. `maxGlobal` / `maxPerProvider` of 0 mean unlimited.
 * When both are 0, resolves immediately without tracking.
 */
export async function acquireGate(providerId: string, limits: GateLimits, signal?: AbortSignal): Promise<GateTicket> {
  const normalized = providerId.trim() || "unknown";
  const effective: GateLimits = {
    maxGlobal: Math.max(0, Math.floor(limits.maxGlobal)),
    maxPerProvider: Math.max(0, Math.floor(limits.maxPerProvider)),
    waitMs: Math.max(0, Math.floor(limits.waitMs))
  };

  if (signal?.aborted) throw new GateAbortedError();

  if (effective.maxGlobal <= 0 && effective.maxPerProvider <= 0) {
    return { providerId: normalized, release() {} };
  }

  if (canAcquire(normalized, effective)) {
    return takeSlot(normalized);
  }

  if (effective.waitMs <= 0) {
    throw new QueueTimeoutError();
  }

  return new Promise<GateTicket>((resolve, reject) => {
    const waiter: Waiter = {
      providerId: normalized,
      limits: effective,
      resolve,
      reject,
      timer: setTimeout(() => {
        const idx = waitQueue.indexOf(waiter);
        if (idx >= 0) waitQueue.splice(idx, 1);
        if (waiter.abort) signal?.removeEventListener("abort", waiter.abort);
        reject(new QueueTimeoutError());
      }, effective.waitMs),
      signal
    };
    if (signal) {
      waiter.abort = () => {
        const idx = waitQueue.indexOf(waiter);
        if (idx < 0) return;
        waitQueue.splice(idx, 1);
        clearTimeout(waiter.timer);
        reject(new GateAbortedError());
      };
      signal.addEventListener("abort", waiter.abort, { once: true });
    }
    waitQueue.push(waiter);
  });
}

export function getGateSnapshot(): GateSnapshot {
  const perProvider: Record<string, number> = {};
  for (const [id, count] of inFlightByProvider) perProvider[id] = count;
  return {
    inFlight: inFlightTotal,
    waiting: waitQueue.length,
    perProvider
  };
}

/** Test helper — clears in-flight and waiters. */
export function resetGateForTests() {
  inFlightTotal = 0;
  inFlightByProvider.clear();
  for (const waiter of waitQueue) {
    clearTimeout(waiter.timer);
    if (waiter.abort) waiter.signal?.removeEventListener("abort", waiter.abort);
  }
  waitQueue.length = 0;
}
