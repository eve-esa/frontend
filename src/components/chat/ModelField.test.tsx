// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { blankBuildTimeEnv } from "@/test-utils/runtimeConfigStub";
import type { ModelListResponse } from "@/types";

/**
 * The phone model field and its bottom sheet: closed by default, opens on a tap, lists every
 * model with the current one marked, a pick switches the stored selection and closes, Escape and
 * the scrim close it and focus returns to the field.
 */
const models = {
  platform: [
    { id: "eve-jsc", display_name: "EVE-Instruct (JSC)", llm_type: "eve_jsc" },
    { id: "eve-instruct", display_name: "EVE-Instruct", llm_type: "main" },
    { id: "mistral-small", display_name: "Mistral Small", llm_type: "fallback" },
  ],
  providers: [],
  custom: [{ id: "c1", display_name: "My model" }],
} as unknown as ModelListResponse;

vi.mock("@/services/useListModels", () => ({
  useListModels: () => ({ data: models }),
}));

// A cold first render of the dialog primitives is slow on a busy machine.
vi.setConfig({ testTimeout: 20_000 });

// Radix arms its outside-press listener one task after the sheet mounts.
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 20)); });

const stored = () => JSON.parse(localStorage.getItem("model_selection") ?? "null");

const renderField = async (customModels = true) => {
  blankBuildTimeEnv();
  window.__EVE_CONFIG__ = {
    FEATURE_CUSTOM_MODELS: customModels ? "true" : "false",
  };
  const { ModelField } = await import("./ModelField");
  return render(<ModelField />);
};

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
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("ModelField", () => {
  it("shows the caption and the current model, with the sheet closed", async () => {
    await renderField();
    const field = screen.getByTestId("header-model-field");
    expect(field.textContent).toContain("Model");
    expect(screen.getByTestId("header-model-name").textContent).toBe("EVE-Instruct");
    expect(field.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByTestId("model-sheet")).toBeNull();
  });

  it("opens the sheet on a tap: every model listed, only the current one marked", async () => {
    await renderField();
    fireEvent.click(screen.getByTestId("header-model-field"));
    const sheet = screen.getByTestId("model-sheet");
    const rows = within(sheet).getAllByTestId("model-sheet-option");
    expect(rows.map((row: HTMLElement) => row.textContent)).toEqual([
      "EVE-Instruct (JSC)",
      "EVE-Instruct",
      "Mistral Small",
      "My model",
    ]);
    const current = rows.filter((row: HTMLElement) => row.getAttribute("data-current") === "true");
    expect(current).toHaveLength(1);
    expect(current[0].textContent).toBe("EVE-Instruct");
    expect(current[0].querySelector("svg")).not.toBeNull();
    expect(screen.getByTestId("header-model-field").getAttribute("aria-expanded")).toBe("true");
  });

  it("announces the rows as radio choices in a named group, one checked", async () => {
    await renderField();
    fireEvent.click(screen.getByTestId("header-model-field"));
    const group = screen.getByRole("radiogroup", { name: "Model" });
    const radios = within(group).getAllByRole("radio");
    expect(radios).toHaveLength(4);
    const checked = radios.filter((radio: HTMLElement) => radio.getAttribute("aria-checked") === "true");
    expect(checked).toHaveLength(1);
    expect(checked[0].textContent).toBe("EVE-Instruct");
    expect(checked[0].querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(radios.some((radio: HTMLElement) => radio.hasAttribute("aria-current"))).toBe(false);
  });

  it("choosing another radio calls the select handler", async () => {
    await renderField();
    fireEvent.click(screen.getByTestId("header-model-field"));
    fireEvent.click(screen.getByRole("radio", { name: "Mistral Small" }));
    expect(stored()).toEqual({ type: "platform", id: "mistral-small" });
  });

  it("a pick switches the stored selection, updates the field and closes the sheet", async () => {
    await renderField();
    const events = vi.fn();
    window.addEventListener("eve:model-selection-changed", events);
    fireEvent.click(screen.getByTestId("header-model-field"));
    fireEvent.click(screen.getByText("Mistral Small"));
    expect(stored()).toEqual({ type: "platform", id: "mistral-small" });
    expect(events).toHaveBeenCalledTimes(1);
    window.removeEventListener("eve:model-selection-changed", events);
    expect(screen.queryByTestId("model-sheet")).toBeNull();
    expect(screen.getByTestId("header-model-name").textContent).toBe("Mistral Small");
  });

  it("a custom model can be picked where custom models are on", async () => {
    await renderField(true);
    fireEvent.click(screen.getByTestId("header-model-field"));
    fireEvent.click(screen.getByText("My model"));
    expect(stored()).toEqual({ type: "custom", id: "c1" });
    expect(screen.getByTestId("header-model-name").textContent).toBe("My model");
  });

  it("custom models are not listed where the flag is off", async () => {
    await renderField(false);
    fireEvent.click(screen.getByTestId("header-model-field"));
    expect(screen.queryByText("My model")).toBeNull();
  });

  it("Escape closes the sheet without changing the model, and focus returns to the field", async () => {
    await renderField();
    const field = screen.getByTestId("header-model-field");
    fireEvent.click(field);
    fireEvent.keyDown(screen.getByTestId("model-sheet"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByTestId("model-sheet")).toBeNull());
    expect(stored()).toEqual({ type: "platform", id: "eve-instruct" });
    await waitFor(() => expect(document.activeElement).toBe(field));
  });

  it("the scrim closes the sheet", async () => {
    await renderField();
    fireEvent.click(screen.getByTestId("header-model-field"));
    await settle();
    const overlay = screen.getByTestId("dialog-overlay");
    fireEvent.pointerDown(overlay);
    fireEvent.pointerUp(overlay);
    fireEvent.click(overlay);
    await waitFor(() => expect(screen.queryByTestId("model-sheet")).toBeNull());
  });

  it("the field is square, outlined with the control border, with the card fill and no chevron", async () => {
    await renderField();
    const field = screen.getByTestId("header-model-field");
    expect(field.className).toContain("border-control");
    expect(field.className).toContain("h-[44px]");
    expect(field.className).not.toMatch(/rounded/);
    expect(field.querySelector("svg")).toBeNull();
  });
});
