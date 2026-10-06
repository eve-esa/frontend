import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end suite against a deployed or local EVE frontend.
 *
 * Target: one project per environment. `E2E_TARGET` overrides the base URL of
 * any project (a preview host, a tunnel). Credentials come from `E2E_EMAIL`
 * and `E2E_PASSWORD` and are never written to disk except as the browser
 * storage state under `e2e/.auth/` (gitignored).
 *
 * Every project runs the browser specs (`specs/`) and the API specs (`api/`,
 * no browser), so one command covers an environment; `yarn e2e --project=dev
 * api/` runs the API specs alone.
 */
const TARGETS = {
  dev: "https://dev.eve-chat.chat",
  staging: "https://staging.eve-chat.chat",
  prod: "https://eve-chat.chat",
  local: "http://localhost:5173",
} as const;

const target = (fallback: string): string => process.env.E2E_TARGET || fallback;
const desktop = { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } };

export default defineConfig({
  testDir: ".",
  testMatch: ["specs/**/*.spec.ts", "api/**/*.spec.ts"],
  outputDir: "./.results",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  reporter: [
    ["list"],
    ["html", { outputFolder: "./report", open: "never" }],
  ],
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
  },
  projects: [
    { name: "dev", use: { ...desktop, baseURL: target(TARGETS.dev) } },
    { name: "staging", use: { ...desktop, baseURL: target(TARGETS.staging) } },
    {
      // Read-only checks only: nothing tagged @prod writes a conversation.
      name: "prod-readonly",
      grep: /@prod/,
      use: { ...desktop, baseURL: target(TARGETS.prod) },
    },
    { name: "local", use: { ...desktop, baseURL: target(TARGETS.local) } },
  ],
});
