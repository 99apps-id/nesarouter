import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const port = 20139;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"]
  },
  webServer: {
    command: "npx next dev --port 20139",
    url: `${baseURL}/login`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      PORT: String(port),
      DATA_DIR: path.join(process.cwd(), ".tmp", "e2e-data"),
      NESA_ADMIN_PASSWORD: "e2e-bootstrap-password",
      NESA_ENCRYPTION_KEY: "e2e-only-encryption-key-at-least-32-chars"
    }
  }
});
