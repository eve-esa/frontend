import { describe, expect, it } from "vitest";
import { buildUpdatePayload, emptyCustomModelForm } from "./customModelForm";

describe("buildUpdatePayload", () => {
  it("includes every field when all are present", () => {
    expect(
      buildUpdatePayload("model-1", {
        display_name: "My model",
        provider_id: "openai",
        catalog_model_id: "gpt-4o",
        api_key: "sk-secret",
      }),
    ).toEqual({
      id: "model-1",
      display_name: "My model",
      catalog_model_id: "gpt-4o",
      api_key: "sk-secret",
    });
  });

  it("omits catalog_model_id when it is blank so the API min_length is never violated", () => {
    const payload = buildUpdatePayload("model-1", {
      display_name: "My model",
      provider_id: "openai",
      catalog_model_id: "",
      api_key: "",
    });

    expect(payload).not.toHaveProperty("catalog_model_id");
    expect(payload).toEqual({ id: "model-1", display_name: "My model" });
  });

  it("omits api_key when it is blank so the stored secret is not overwritten", () => {
    const payload = buildUpdatePayload("model-1", {
      display_name: "My model",
      provider_id: "openai",
      catalog_model_id: "gpt-4o",
      api_key: "",
    });

    expect(payload).not.toHaveProperty("api_key");
    expect(payload).toEqual({
      id: "model-1",
      display_name: "My model",
      catalog_model_id: "gpt-4o",
    });
  });

  it("always carries the id even when the form is empty", () => {
    expect(buildUpdatePayload("model-1", emptyCustomModelForm())).toEqual({
      id: "model-1",
    });
  });
});
