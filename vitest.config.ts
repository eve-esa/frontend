import path from "path";
import { defineConfig } from "vitest/config";

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
  },
});
