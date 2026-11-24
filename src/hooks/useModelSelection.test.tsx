// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { blankBuildTimeEnv } from "@/test-utils/runtimeConfigStub";
import type { ModelListResponse } from "@/types";

const models = {
  platform: [
    { id: "eve-instruct", display_name: "EVE-Instruct", llm_type: "main" },
    { id: "mistral-small", display_name: "Mistral Small", llm_type: "fallback" },
  ],
  providers: [],
  custom: [],
} as unknown as ModelListResponse;

vi.mock("@/services/useListModels", () => ({
  useListModels: () => ({ data: models }),
}));

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(
    "model_selection",
    JSON.stringify({ type: "platform", id: "eve-instruct" }),
  );
});

afterEach(() => {
  cleanup();
  delete window.__EVE_CONFIG__;
  vi.resetModules();
});

const load = () => {
  blankBuildTimeEnv();
  window.__EVE_CONFIG__ = { FEATURE_CUSTOM_MODELS: "true" };
  return import("./useModelSelection");
};

describe("useModelSelection", () => {
  it("resolves the current name from the list", async () => {
    const { useModelSelection } = await load();
    const { result } = renderHook(() => useModelSelection());
    expect(result.current.currentName).toBe("EVE-Instruct");
  });

  it("a selection event with a model that is no longer offered falls back to the default", async () => {
    const { useModelSelection, MODEL_SELECTION_EVENT } = await load();
    const { result } = renderHook(() => useModelSelection());
    act(() => {
      localStorage.setItem(
        "model_selection",
        JSON.stringify({ type: "platform", id: "gone" }),
      );
      window.dispatchEvent(new Event(MODEL_SELECTION_EVENT));
    });
    expect(result.current.value).toBe("platform:eve-instruct");
  });

  it("a selection event with an offered model is followed", async () => {
    const { useModelSelection, MODEL_SELECTION_EVENT } = await load();
    const { result } = renderHook(() => useModelSelection());
    act(() => {
      localStorage.setItem(
        "model_selection",
        JSON.stringify({ type: "platform", id: "mistral-small" }),
      );
      window.dispatchEvent(new Event(MODEL_SELECTION_EVENT));
    });
    expect(result.current.value).toBe("platform:mistral-small");
    expect(result.current.currentName).toBe("Mistral Small");
  });
});
