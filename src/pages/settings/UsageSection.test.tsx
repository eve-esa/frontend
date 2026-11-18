// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TokenUsageResponse } from "@/services/useTokenUsage";

const tokenUsage = vi.fn();
const messageStats = vi.fn();

vi.mock("@/services/useTokenUsage", () => ({
  useTokenUsage: () => tokenUsage(),
}));
vi.mock("@/services/useGetUserMessageStats", () => ({
  useGetUserMessageStats: (enabled: boolean) => messageStats(enabled),
}));

import { UsageSection } from "./UsageSection";

const limited: TokenUsageResponse = {
  unlimited: false,
  rate_limit_group: "free",
  used_tokens: 128400,
  max_tokens: 500000,
  remaining_tokens: 371600,
  used_ratio: 0.2568,
  remaining_ratio: 0.7432,
  period_start: "2026-11-01T00:00:00",
  period_end: "2026-12-01T00:00:00",
};

const stats = {
  message_count: 214,
  input_characters: 1482310,
  output_characters: 389200,
  total_characters: 1871510,
  co2eq_kg: 0.0412,
  text: "",
};

const ok = (data: TokenUsageResponse) => ({
  data,
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
});

beforeEach(() => {
  tokenUsage.mockReturnValue(ok(limited));
  messageStats.mockImplementation((enabled: boolean) => ({
    data: enabled ? stats : undefined,
    isFetching: false,
    isError: false,
    refetch: vi.fn(),
  }));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("UsageSection token budget", () => {
  it("shows used, limit, remaining and the reset date with a bar", () => {
    render(<UsageSection />);
    expect(screen.getByTestId("settings-usage-used").textContent).toBe(
      "128,400"
    );
    expect(screen.getByTestId("settings-usage-limit").textContent).toBe(
      "500,000"
    );
    expect(screen.getByTestId("settings-usage-remaining").textContent).toBe(
      "371,600"
    );
    expect(screen.getByTestId("settings-usage-reset").textContent).toMatch(
      /Dec(ember)? 2026|2026/
    );
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("26");
    expect(screen.queryByTestId("settings-usage-unlimited")).toBeNull();
  });

  it("says Unlimited and draws no bar when the budget is unlimited", () => {
    tokenUsage.mockReturnValue(
      ok({
        ...limited,
        unlimited: true,
        max_tokens: null,
        remaining_tokens: null,
        used_ratio: null,
        remaining_ratio: null,
      })
    );
    render(<UsageSection />);
    expect(screen.getByTestId("settings-usage-unlimited").textContent).toBe(
      "Unlimited"
    );
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.queryByTestId("settings-usage-limit")).toBeNull();
    expect(screen.queryByTestId("settings-usage-remaining")).toBeNull();
  });
});

describe("UsageSection activity", () => {
  it("fetches the stats only after Calculate", () => {
    render(<UsageSection />);
    expect(messageStats).toHaveBeenLastCalledWith(false);
    expect(screen.queryByTestId("settings-usage-co2eq")).toBeNull();

    fireEvent.click(screen.getByTestId("settings-usage-calculate"));

    expect(messageStats).toHaveBeenLastCalledWith(true);
    expect(screen.getByTestId("settings-usage-co2eq").textContent).toBe(
      "0.04 kg"
    );
    expect(screen.getByText(/Estimate, not yet verified/)).toBeTruthy();
  });
});
