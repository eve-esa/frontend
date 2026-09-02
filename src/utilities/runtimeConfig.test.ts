import { afterEach, describe, expect, it, vi } from "vitest";
import { stubRuntimeConfig } from "@/test-utils/runtimeConfigStub";
import type { ConfigKey } from "./runtimeConfig";

// Both modules read the injected config at module scope, so each case loads
// them again against the config it wants (same pattern as services/oidc.test).
const loadRuntimeConfig = (config: Partial<Record<ConfigKey, string>>) => {
  stubRuntimeConfig(config);
  return import("./runtimeConfig");
};

const loadFeatures = (config: Partial<Record<ConfigKey, string>>) => {
  stubRuntimeConfig(config);
  return import("./features");
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("isEnabled", () => {
  it("returns the default when nothing is configured", async () => {
    const { isEnabled } = await loadRuntimeConfig({});

    expect(isEnabled("FEATURE_ARTIFACTS", false)).toBe(false);
    expect(isEnabled("FEATURE_STREAMING", true)).toBe(true);
  });

  it("reads true as on and false as off, whatever the default is", async () => {
    const { isEnabled } = await loadRuntimeConfig({
      FEATURE_ARTIFACTS: "true",
      FEATURE_STREAMING: "false",
    });

    expect(isEnabled("FEATURE_ARTIFACTS", false)).toBe(true);
    expect(isEnabled("FEATURE_STREAMING", true)).toBe(false);
  });

  it("treats a blank value as absent, so the default decides", async () => {
    // What an undefined GitHub Actions variable expands to.
    const { isEnabled } = await loadRuntimeConfig({
      FEATURE_ARTIFACTS: "",
      FEATURE_STREAMING: "  ",
    });

    expect(isEnabled("FEATURE_ARTIFACTS", false)).toBe(false);
    expect(isEnabled("FEATURE_STREAMING", true)).toBe(true);
  });

  it("ignores case and surrounding whitespace", async () => {
    const { isEnabled } = await loadRuntimeConfig({
      FEATURE_ARTIFACTS: " TRUE ",
    });

    expect(isEnabled("FEATURE_ARTIFACTS", false)).toBe(true);
  });

  it("reads anything else as off", async () => {
    const { isEnabled } = await loadRuntimeConfig({
      FEATURE_ARTIFACTS: "yes",
      FEATURE_STREAMING: "1",
    });

    expect(isEnabled("FEATURE_ARTIFACTS", false)).toBe(false);
    expect(isEnabled("FEATURE_STREAMING", true)).toBe(false);
  });
});

describe("configValue", () => {
  it("returns undefined rather than an empty string", async () => {
    const { configValue } = await loadRuntimeConfig({
      CONTACT_URL: " ",
      ABOUT_US_URL: " https://example.org/about ",
    });

    expect(configValue("CONTACT_URL")).toBeUndefined();
    expect(configValue("PRIVACY_POLICY_URL")).toBeUndefined();
    expect(configValue("ABOUT_US_URL")).toBe("https://example.org/about");
  });
});

const openingScopeFlags = (features: typeof import("./features")) => ({
  ARTIFACTS_ENABLED: features.ARTIFACTS_ENABLED,
  TOOLKITS_ENABLED: features.TOOLKITS_ENABLED,
  PRIVATE_COLLECTIONS_ENABLED: features.PRIVATE_COLLECTIONS_ENABLED,
  ATTACHMENTS_ENABLED: features.ATTACHMENTS_ENABLED,
  ANSWERED_BY_ENABLED: features.ANSWERED_BY_ENABLED,
  BETA_BADGE_ENABLED: features.BETA_BADGE_ENABLED,
});

describe("the opening-scope flags", () => {
  it("are all off when the environment sets nothing", async () => {
    const features = await loadFeatures({});

    expect(openingScopeFlags(features)).toEqual({
      ARTIFACTS_ENABLED: false,
      TOOLKITS_ENABLED: false,
      PRIVATE_COLLECTIONS_ENABLED: false,
      ATTACHMENTS_ENABLED: false,
      ANSWERED_BY_ENABLED: false,
      BETA_BADGE_ENABLED: false,
    });
  });

  it("are on only where the environment says true", async () => {
    const features = await loadFeatures({
      FEATURE_ARTIFACTS: "true",
      FEATURE_TOOLKITS: "true",
      FEATURE_PRIVATE_COLLECTIONS: "true",
      FEATURE_ATTACHMENTS: "true",
      FEATURE_ANSWERED_BY: "true",
      FEATURE_BETA_BADGE: "true",
    });

    expect(openingScopeFlags(features)).toEqual({
      ARTIFACTS_ENABLED: true,
      TOOLKITS_ENABLED: true,
      PRIVATE_COLLECTIONS_ENABLED: true,
      ATTACHMENTS_ENABLED: true,
      ANSWERED_BY_ENABLED: true,
      BETA_BADGE_ENABLED: true,
    });
  });

  it("stay off on false and on blank, the unset-variable case", async () => {
    const features = await loadFeatures({
      FEATURE_ARTIFACTS: "false",
      FEATURE_TOOLKITS: "false",
      FEATURE_PRIVATE_COLLECTIONS: "",
      FEATURE_ATTACHMENTS: "",
      // A diagnostic must not appear because a variable went missing.
      FEATURE_ANSWERED_BY: "",
      FEATURE_BETA_BADGE: "",
    });

    expect(openingScopeFlags(features)).toEqual({
      ARTIFACTS_ENABLED: false,
      TOOLKITS_ENABLED: false,
      PRIVATE_COLLECTIONS_ENABLED: false,
      ATTACHMENTS_ENABLED: false,
      ANSWERED_BY_ENABLED: false,
      BETA_BADGE_ENABLED: false,
    });
  });

  it("leaves the four original flags on when nothing is set", async () => {
    const features = await loadFeatures({});

    expect(features.MODEL_PICKER_ENABLED).toBe(true);
    expect(features.CUSTOM_MODELS_ENABLED).toBe(true);
    expect(features.STREAMING_ENABLED).toBe(true);
    expect(features.CLASSIFICATION_FILTERS_ENABLED).toBe(true);
  });
});
