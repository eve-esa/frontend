import { afterEach, describe, expect, it, vi } from "vitest";
import { stubRuntimeConfig } from "@/test-utils/runtimeConfigStub";
import type { ConfigKey } from "./runtimeConfig";

const load = (config: Partial<Record<ConfigKey, string>>) => {
  stubRuntimeConfig(config);
  return import("./features");
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("MOBILE_COMPOSER_ENABLED", () => {
  it("is off by default and when blank", async () => {
    expect((await load({})).MOBILE_COMPOSER_ENABLED).toBe(false);
    expect((await load({ FEATURE_MOBILE_COMPOSER: "" })).MOBILE_COMPOSER_ENABLED).toBe(false);
  });

  it("is on only when the injected config says true", async () => {
    expect((await load({ FEATURE_MOBILE_COMPOSER: "true" })).MOBILE_COMPOSER_ENABLED).toBe(true);
    expect((await load({ FEATURE_MOBILE_COMPOSER: "false" })).MOBILE_COMPOSER_ENABLED).toBe(false);
  });
});
