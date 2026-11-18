// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LOCAL_STORAGE_THEME } from "@/utilities/localStorage";

vi.mock("@/utilities/features", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utilities/features")>()),
  THEME_SWITCH_ENABLED: true,
}));

import { AppearanceSection } from "./AppearanceSection";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

const radio = (value: string) =>
  screen.getByTestId(`settings-theme-${value}`) as HTMLInputElement;

describe("AppearanceSection", () => {
  it("applies a choice at once and keeps it in this browser", () => {
    render(<AppearanceSection />);
    expect(radio("system").checked).toBe(true);

    fireEvent.click(radio("light"));

    expect(radio("light").checked).toBe(true);
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(window.localStorage.getItem(LOCAL_STORAGE_THEME)).toBe("light");
  });

  it("shows one status line, which names the browser", () => {
    render(<AppearanceSection />);
    const status = screen.getByTestId("settings-appearance-status");
    expect(status.textContent).toMatch(/this browser only/);

    fireEvent.click(radio("dark"));

    expect(screen.getByTestId("settings-appearance-status").textContent).toBe(
      "Saved on this browser only."
    );
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });
});
