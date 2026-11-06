import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "cloudflare.spec.ts",
  timeout: 30_000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:8787",
    headless: process.env.HEADED !== "1",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {},
  },
  webServer: {
    command: "bun run preview:cloudflare",
    url: "http://127.0.0.1:8787",
    reuseExistingServer: false,
    env: { WRANGLER_SEND_METRICS: "false" },
  },
});
