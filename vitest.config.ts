import path from "path";
import { configDefaults, defineConfig } from "vitest/config";

// Only pure, dependency-free modules are under test right now (see
// src/utilities/*.test.ts), so a plain Node environment is enough — no jsdom.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    // e2e/ is the Playwright suite: it runs against a browser, not under Vitest.
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
});
