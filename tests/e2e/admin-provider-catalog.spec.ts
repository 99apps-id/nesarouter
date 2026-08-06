import { expect, test } from "@playwright/test";

test("admin can unlock the dashboard and find the NesaRouter provider", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/login");
  await expect(page.getByText("NesaRouter", { exact: true })).toBeVisible();

  await page.getByPlaceholder("Admin password").fill("e2e-bootstrap-password");
  await page.getByRole("button", { name: "Login" }).click();
  await page.waitForURL("**/routing");

  const passwordInputs = page.locator('section.panel input[type="password"]');
  await passwordInputs.nth(0).fill("e2e-bootstrap-password");
  await passwordInputs.nth(1).fill("e2e-final-password");
  const passwordSaved = page.waitForResponse((response) =>
    response.url().endsWith("/api/auth/password") && response.request().method() === "PUT"
  );
  await page.getByRole("button", { name: /Save password/i }).click();
  expect((await passwordSaved).ok()).toBe(true);
  await expect(passwordInputs.nth(0)).toHaveValue("");
  // AdminPasswordPanel intentionally reloads this same URL after 400 ms so the
  // refreshed session reaches every server component. Do not race that reload.
  await page.waitForTimeout(600);
  await page.waitForLoadState("domcontentloaded");

  await page.goto("/providers", { waitUntil: "domcontentloaded", timeout: 90_000 });
  await expect(page.getByRole("heading", { level: 1, name: "Providers" })).toBeVisible();
  const provider = page.locator('a[href="/providers/nesarouter"]');
  await expect(provider).toContainText("NesaRouter");
  await expect(provider.locator('img[src="/icons/nesarouter.svg"]')).toBeAttached();
});
