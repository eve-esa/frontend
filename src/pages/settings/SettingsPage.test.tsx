// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

// Only Profile and Account are on: every other section is hidden by its feature.
vi.mock("@/utilities/features", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utilities/features")>()),
  THEME_SWITCH_ENABLED: false,
  CUSTOM_MODELS_ENABLED: false,
  TOOLKIT_CREDENTIALS_ENABLED: false,
  SETTINGS_USAGE_ENABLED: false,
  API_KEYS_ENABLED: false,
}));
vi.mock("@/components/chat/ChatHeader", () => ({ ChatHeader: () => null }));
vi.mock("./ProfileSection", () => ({
  ProfileSection: () => <div data-testid="stub-profile" />,
}));
vi.mock("./AccountSection", () => ({
  AccountSection: () => <div data-testid="stub-account" />,
}));
vi.mock("./AppearanceSection", () => ({
  AppearanceSection: () => <div data-testid="stub-appearance" />,
}));
vi.mock("./ModelsSection", () => ({
  ModelsSection: () => <div data-testid="stub-models" />,
}));
vi.mock("./ToolkitsSection", () => ({
  ToolkitsSection: () => <div data-testid="stub-toolkits" />,
}));
vi.mock("./UsageSection", () => ({
  UsageSection: () => <div data-testid="stub-usage" />,
}));
vi.mock("./ApiKeysSection", () => ({
  ApiKeysSection: () => <div data-testid="stub-api-keys" />,
}));

import { SettingsPage } from "./SettingsPage";

afterEach(cleanup);

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/settings/:section" element={<SettingsPage />} />
      </Routes>
    </MemoryRouter>
  );

describe("SettingsPage", () => {
  it("opens the section the URL names", () => {
    renderAt("/settings/account");
    expect(screen.getByTestId("stub-account")).toBeTruthy();
    expect(screen.queryByTestId("stub-profile")).toBeNull();
  });

  it("falls back to Profile for an unknown section", () => {
    renderAt("/settings/nope");
    expect(screen.getByTestId("stub-profile")).toBeTruthy();
  });

  it("falls back to Profile for a section its feature hides, and does not list it", () => {
    renderAt("/settings/usage");
    expect(screen.getByTestId("stub-profile")).toBeTruthy();
    expect(screen.queryByTestId("stub-usage")).toBeNull();
    expect(screen.getByTestId("settings-nav-profile")).toBeTruthy();
    expect(screen.getByTestId("settings-nav-account")).toBeTruthy();
    expect(screen.queryByTestId("settings-nav-usage")).toBeNull();
    expect(screen.queryByTestId("settings-nav-models")).toBeNull();
  });
});
