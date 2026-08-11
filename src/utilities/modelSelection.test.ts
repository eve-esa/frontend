import { describe, expect, it } from "vitest";
import {
  DEFAULT_MODEL_SELECTION,
  modelSelectionToPayload,
  reconcileModelSelection,
} from "./modelSelection";
import type { ModelListResponse } from "@/types";

// The backend orders /models by intent: the first platform entry is the default
// (the JSC model when FEATURE_JSC_MODEL is on, EVE-Instruct otherwise).
const MODELS: ModelListResponse = {
  platform: [
    {
      id: "eve-instruct-jsc",
      llm_type: "eve_jsc",
      display_name: "EVE-Instruct (JSC)",
    },
    { id: "eve-instruct", llm_type: "main", display_name: "EVE-Instruct" },
    {
      id: "mistral-small-latest",
      llm_type: "fallback",
      display_name: "Mistral Small",
    },
  ],
  providers: [],
  custom: [],
};

const EMPTY_MODELS: ModelListResponse = {
  platform: [],
  providers: [],
  custom: [],
};

describe("reconcileModelSelection", () => {
  it("falls back to the first platform model when the selection vanished", () => {
    expect(
      reconcileModelSelection({ type: "platform", id: "gone" }, MODELS),
    ).toEqual({ type: "platform", id: "eve-instruct-jsc" });
  });

  it("keeps a selection that is still available", () => {
    expect(
      reconcileModelSelection(
        { type: "platform", id: "mistral-small-latest" },
        MODELS,
      ),
    ).toEqual({ type: "platform", id: "mistral-small-latest" });
  });

  it("falls back to the literal default when the platform list is empty", () => {
    expect(
      reconcileModelSelection({ type: "platform", id: "gone" }, EMPTY_MODELS),
    ).toEqual(DEFAULT_MODEL_SELECTION);
  });
});

describe("modelSelectionToPayload", () => {
  it("maps the JSC platform model to its llm_type", () => {
    expect(
      modelSelectionToPayload({ type: "platform", id: "eve-instruct-jsc" }, MODELS),
    ).toEqual({ llm_type: "eve_jsc" });
  });

  it("keeps custom model selections untouched", () => {
    expect(
      modelSelectionToPayload({ type: "custom", id: "uuid-1" }, MODELS),
    ).toEqual({ custom_model_id: "uuid-1" });
  });
});
