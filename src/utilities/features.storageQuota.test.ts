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

describe("STORAGE_QUOTA_ENABLED", () => {
  it("is off by default and when blank", async () => {
    expect((await load({})).STORAGE_QUOTA_ENABLED).toBe(false);
    expect((await load({ FEATURE_STORAGE_QUOTA: "" })).STORAGE_QUOTA_ENABLED).toBe(false);
  });

  it("is on only when the injected config says true", async () => {
    expect((await load({ FEATURE_STORAGE_QUOTA: "true" })).STORAGE_QUOTA_ENABLED).toBe(true);
    expect((await load({ FEATURE_STORAGE_QUOTA: "false" })).STORAGE_QUOTA_ENABLED).toBe(false);
  });
});
