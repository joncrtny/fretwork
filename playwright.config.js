import { defineConfig, devices } from "@playwright/test";

/* Smoke-test config for the refactor safety net. Runs the Vite dev server on a
   dedicated port and drives it with headless Chromium. Kept intentionally small
   and fast so it can run after every refactor step. */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"]],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://localhost:5180",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev -- --port 5180 --strictPort",
    url: "http://localhost:5180",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
