import { expect, it } from "vitest";
import { addLocalApiKey, appendUsage, readStore, writeStore } from "@/lib/store";

it("settings writes preserve keys and usage added after the snapshot", async () => {
  const snapshot = await readStore();
  const token = "nesa_store_write_isolation_key";
  const usageId = "store-write-isolation-usage";
  await addLocalApiKey(token);
  await appendUsage({
    id: usageId,
    createdAt: new Date().toISOString(),
    providerId: "test",
    providerName: "Test",
    model: "test",
    tier: "free",
    taskType: "chat",
    inputTokens: 1,
    outputTokens: 1,
    totalCostUsd: 0,
    costSource: "free",
    cacheStatus: "skipped",
    budgetStatus: "ok",
    routingReason: "regression",
    status: "success"
  });

  await writeStore({ ...snapshot, router: { ...snapshot.router, cacheEnabled: !snapshot.router.cacheEnabled } });
  const after = await readStore();
  expect(after.localApiKeys).toContain(token);
  expect(after.usage.some((item) => item.id === usageId)).toBe(true);
});
