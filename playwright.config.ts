import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 480_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://127.0.0.1:5185",
    browserName: "chromium",
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    viewport: { width: 1600, height: 1000 }
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5185",
    url: "http://127.0.0.1:5185/__tpg/workbench",
    reuseExistingServer: false,
    timeout: 60_000
  }
});
