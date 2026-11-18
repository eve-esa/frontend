// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CustomModel } from "@/types";
import { ModelsSection } from "./ModelsSection";

const model = (id: string, name: string): CustomModel => ({
  id,
  display_name: name,
  provider_id: "openai",
  catalog_model_id: "gpt",
  provider_display_name: "OpenAI",
  model_display_name: "GPT",
  model_name: "gpt",
  has_api_key: true,
  created_at: "2026-11-12T00:00:00Z",
  updated_at: "2026-11-12T00:00:00Z",
});

let listed: { providers: unknown[]; custom: CustomModel[] };
const deleteMutate = vi.fn();

vi.mock("@/services/useListModels", () => ({
  useListModels: () => ({ data: listed, isLoading: false }),
}));
vi.mock("@/services/useCustomModels", () => ({
  useCreateCustomModel: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateCustomModel: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteCustomModel: () => ({ mutate: deleteMutate, isPending: false }),
}));

beforeEach(() => {
  deleteMutate.mockClear();
  listed = {
    providers: [
      {
        id: "openai",
        display_name: "OpenAI",
        models: [{ id: "gpt", display_name: "GPT" }],
      },
    ],
    custom: [model("cm-1", "My GPT"), model("cm-2", "Work GPT")],
  };
});
afterEach(cleanup);

describe("ModelsSection", () => {
  it("lists a row per custom model with Edit and Delete", () => {
    render(<ModelsSection />);
    expect(screen.getByTestId("settings-models-row-cm-1").textContent).toContain("My GPT");
    expect(screen.getByTestId("settings-models-row-cm-2").textContent).toContain("Work GPT");
    expect(screen.getByTestId("settings-models-edit-cm-1")).toBeTruthy();
    expect(screen.getByTestId("settings-models-delete-cm-2")).toBeTruthy();
  });

  it("shows the empty state with the Add button", () => {
    listed.custom = [];
    render(<ModelsSection />);
    expect(screen.getByTestId("settings-models-count").textContent).toBe("No custom models yet.");
    expect(screen.getByTestId("settings-models-add")).toBeTruthy();
  });

  it("Delete asks first, names the model, and deletes only on confirm", () => {
    render(<ModelsSection />);
    fireEvent.click(screen.getByTestId("settings-models-delete-cm-1"));
    expect(deleteMutate).not.toHaveBeenCalled();
    const dialog = screen.getByTestId("custom-model-delete-dialog");
    expect(dialog.textContent).toContain("Delete My GPT?");
    fireEvent.click(screen.getByTestId("custom-model-delete-confirm"));
    expect(deleteMutate).toHaveBeenCalledWith("cm-1", expect.anything());
  });

  it("Add opens the dialog with empty fields, Edit opens it pre-filled", () => {
    render(<ModelsSection />);
    expect(screen.queryByTestId("settings-models-dialog")).toBeNull();
    fireEvent.click(screen.getByTestId("settings-models-add"));
    expect(screen.getByTestId("settings-models-dialog").textContent).toContain("Add model");
    expect((screen.getByTestId("settings-models-name") as HTMLInputElement).value).toBe("");
    fireEvent.click(screen.getByTestId("settings-models-cancel"));
    expect(screen.queryByTestId("settings-models-dialog")).toBeNull();

    fireEvent.click(screen.getByTestId("settings-models-edit-cm-2"));
    expect(screen.getByTestId("settings-models-dialog").textContent).toContain("Edit model");
    expect((screen.getByTestId("settings-models-name") as HTMLInputElement).value).toBe("Work GPT");
  });
});
