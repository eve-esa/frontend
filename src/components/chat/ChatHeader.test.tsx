// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { blankBuildTimeEnv } from "@/test-utils/runtimeConfigStub";
import type { ConfigKey } from "@/utilities/runtimeConfig";
import type { ModelListResponse } from "@/types";

/**
 * The header: flag on below md it is hamburger, model field, New chat; flag off, or md and up, it
 * is the one on main (one bare hamburger button). Opening the sheet and switching the model is
 * covered in ModelField.test.tsx.
 */
const models = {
  platform: [
    { id: "eve-instruct", display_name: "EVE-Instruct", llm_type: "main" },
    { id: "mistral-small", display_name: "Mistral Small", llm_type: "fallback" },
  ],
  providers: [],
  custom: [],
} as unknown as ModelListResponse;

// A cold first render is slow on a busy machine.
vi.setConfig({ testTimeout: 20_000 });

const state = { phone: true, toggle: vi.fn() };

vi.mock("@/utilities/routes", () => ({
  routes: { EMPTY_CHAT: { path: "/new" } },
}));
vi.mock("./DynamicSidebarProvider", () => ({
  useSidebar: () => ({ toggleConversationsSidebar: state.toggle }),
}));
vi.mock("@/hooks/useIsMobile", () => ({ useIsMobile: () => true }));
vi.mock("@/hooks/useIsPhone", () => ({ useIsPhone: () => state.phone }));
vi.mock("@/services/useListModels", () => ({
  useListModels: () => ({ data: models }),
}));

const renderHeader = async (
  config: Partial<Record<ConfigKey, string>>,
  phone: boolean,
) => {
  state.phone = phone;
  blankBuildTimeEnv();
  window.__EVE_CONFIG__ = config;
  const { ChatHeader } = await import("./ChatHeader");
  return render(
    <MemoryRouter initialEntries={["/chat/abc"]}>
      <Routes>
        <Route path="*" element={<ChatHeader />} />
        <Route path="/new" element={<div data-testid="empty-chat-page" />} />
      </Routes>
    </MemoryRouter>,
  );
};

beforeEach(() => {
  state.toggle = vi.fn();
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  delete window.__EVE_CONFIG__;
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("ChatHeader", () => {
  it("flag on, phone: hamburger named, model field with the current model, New chat named", async () => {
    localStorage.setItem(
      "model_selection",
      JSON.stringify({ type: "platform", id: "mistral-small" }),
    );
    await renderHeader({ FEATURE_MOBILE_COMPOSER: "true" }, true);
    expect(screen.getByRole("button", { name: "Open sidebar" })).toBeTruthy();
    expect(screen.getByTestId("chat-header-menu")).toBeTruthy();
    expect(screen.getByRole("button", { name: "New chat" })).toBeTruthy();
    const field = screen.getByTestId("header-model-field");
    expect(field.textContent).toContain("Model");
    expect(screen.getByTestId("header-model-name").textContent).toBe("Mistral Small");
    // No chevron: the field holds text only.
    expect(field.querySelector("svg")).toBeNull();
  });

  it("flag on, phone: the hamburger opens the sidebar and New chat goes to the empty chat", async () => {
    await renderHeader({ FEATURE_MOBILE_COMPOSER: "true" }, true);
    fireEvent.click(screen.getByTestId("chat-header-menu"));
    expect(state.toggle).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId("header-new-chat"));
    expect(screen.getByTestId("empty-chat-page")).toBeTruthy();
  });

  it("flag on, phone: three items in a 48 / 1fr / 48 grid, 44 px high", async () => {
    const { container } = await renderHeader({ FEATURE_MOBILE_COMPOSER: "true" }, true);
    const grid = container.firstElementChild as HTMLElement;
    expect(grid.className).toContain("grid-cols-[48px_1fr_48px]");
    expect(grid.children).toHaveLength(3);
    expect(screen.getByTestId("header-model-field").className).toContain("h-[44px]");
    expect(screen.getByTestId("header-new-chat").className).toContain("h-[44px]");
  });

  it("flag on, md and up: the header of main, no model field, no New chat", async () => {
    const { container } = await renderHeader({ FEATURE_MOBILE_COMPOSER: "true" }, false);
    expect(screen.queryByTestId("header-model-field")).toBeNull();
    expect(screen.queryByTestId("header-new-chat")).toBeNull();
    expect(container.querySelectorAll("button")).toHaveLength(1);
    expect((container.firstElementChild as HTMLElement).className).toBe(
      "flex items-center gap-3 w-ful p-2 md:p-6 lg:py-8",
    );
  });

  it("flag off, phone: the header of main", async () => {
    const { container } = await renderHeader({}, true);
    expect(screen.queryByTestId("header-model-field")).toBeNull();
    expect(screen.queryByTestId("header-new-chat")).toBeNull();
    expect(screen.queryByTestId("chat-header-menu")).toBeNull();
    expect(container.querySelectorAll("button")).toHaveLength(1);
    fireEvent.click(container.querySelector("button") as HTMLElement);
    expect(state.toggle).toHaveBeenCalledTimes(1);
  });
});
