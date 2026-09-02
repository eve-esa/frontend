import { afterEach, describe, expect, it, vi } from "vitest";
import { stubRuntimeConfig } from "@/test-utils/runtimeConfigStub";

const loadSteps = async (privateCollections: "true" | "false") => {
  stubRuntimeConfig({ FEATURE_PRIVATE_COLLECTIONS: privateCollections });
  const { buildTourSteps } = await import("./onboardingSteps");
  return buildTourSteps();
};

const COLLECTION_TARGETS = [
  ".my-collections-button-tour",
  ".my-collections-sidebar-tour",
  ".new-my-collections-button-tour",
  ".new-my-collections-list-tour",
  ".my-collections-documents-tour",
];

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("buildTourSteps", () => {
  it("walks through the collections when private collections are on", async () => {
    const steps = await loadSteps("true");

    expect(steps).toHaveLength(10);
    expect(steps.map((step) => step.target)).toEqual([
      ".conversations-sidebar-tour",
      ".new-chat-button-tour",
      ".settings-button-tour",
      ".control-panel-tour",
      ...COLLECTION_TARGETS,
      ".start-new-chat-tour",
    ]);
  });

  it("drops the five collection steps when they are off", async () => {
    const steps = await loadSteps("false");

    expect(steps).toHaveLength(5);
    expect(steps.map((step) => step.target)).toEqual([
      ".conversations-sidebar-tour",
      ".new-chat-button-tour",
      ".settings-button-tour",
      ".control-panel-tour",
      ".start-new-chat-tour",
    ]);
  });

  it("ends on the new-chat step either way, which is what totalSteps - 1 points at", async () => {
    // MessageInput shows its suggestions on the last step and used to hardcode
    // index 9 for it, which the shorter tour would never reach.
    for (const flag of ["true", "false"] as const) {
      const steps = await loadSteps(flag);
      expect(steps[steps.length - 1].target).toBe(".start-new-chat-tour");
    }
  });
});
