import { vi } from "vitest";
import type { ConfigKey } from "@/utilities/runtimeConfig";

/**
 * Values read from import.meta.env at module scope. A developer who copied
 * .env.example has all six opening-scope flags set to true there, and Vite
 * hands those to import.meta.env in a test run as well, so a value a test means
 * to decide for itself would instead be decided by the machine it runs on.
 * Blanking them leaves the injected config as the only source.
 */
const BUILD_TIME_ENV_KEYS = [
  "VITE_FEATURE_MODEL_PICKER",
  "VITE_FEATURE_CUSTOM_MODELS",
  "VITE_FEATURE_STREAMING",
  "VITE_FEATURE_CLASSIFICATION_FILTERS",
  "VITE_FEATURE_ARTIFACTS",
  "VITE_FEATURE_TOOLKITS",
  "VITE_FEATURE_PRIVATE_COLLECTIONS",
  "VITE_FEATURE_ATTACHMENTS",
  "VITE_FEATURE_ANSWERED_BY",
  "VITE_FEATURE_BETA_BADGE",
  // Not flags, same reasoning: AppVersion reads these at module scope and the
  // profile dialog renders it, so a developer's .env would otherwise decide
  // whether a version line appears in a test that never asked about one.
  "VITE_APP_VERSION",
  "VITE_APP_COMMIT",
];

/**
 * Point the runtime config at an explicit set of values, the same shape the
 * release pipeline injects, and clear the module registry so the next dynamic
 * import of a module that reads a flag at module scope sees them.
 *
 * Call it before `await import(...)`, and undo it with `vi.unstubAllGlobals()`
 * plus `vi.unstubAllEnvs()` in an afterEach.
 */
export const stubRuntimeConfig = (
  config: Partial<Record<ConfigKey, string>>,
) => {
  vi.resetModules();
  for (const key of BUILD_TIME_ENV_KEYS) {
    vi.stubEnv(key, "");
  }
  vi.stubGlobal("window", { __EVE_CONFIG__: config });
};
