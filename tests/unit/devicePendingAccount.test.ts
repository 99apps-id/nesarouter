import { afterEach, describe, expect, it } from "vitest";
import { deleteDevicePending, readDevicePending, saveDevicePending } from "@/lib/store";

describe("device OAuth pending account identity", () => {
  const providerId = "device-pending-account-regression";

  afterEach(async () => {
    await deleteDevicePending(providerId);
  });

  it("does not turn a new-flow pending id into a permanent account id", async () => {
    const pendingId = "new-regression-flow";
    await saveDevicePending(providerId, {
      deviceCode: "device-code",
      createdAt: new Date().toISOString()
    }, pendingId);

    const pending = await readDevicePending(providerId, pendingId);
    expect(pending).toBeTruthy();
    expect(pending?.accountId).toBeUndefined();
  });

  it("preserves the selected account id when reconnecting", async () => {
    const accountId = "oauth-existing-account";
    await saveDevicePending(providerId, {
      deviceCode: "device-code",
      createdAt: new Date().toISOString(),
      accountId
    }, accountId);

    const pending = await readDevicePending(providerId, accountId);
    expect(pending?.accountId).toBe(accountId);
  });
});
