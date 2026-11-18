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
      /1 December 2026 UTC/
    );
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("25");
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

describe("UsageSection token budget edges", () => {
  it("hides the period rows when the API returns no period", () => {
    tokenUsage.mockReturnValue(
      ok({
        ...limited,
        unlimited: true,
        max_tokens: null,
        remaining_tokens: null,
        used_ratio: null,
        remaining_ratio: null,
        period_start: null,
        period_end: null,
      })
    );
    render(<UsageSection />);
    expect(screen.queryByText("Period started")).toBeNull();
    expect(screen.queryByText("Resets")).toBeNull();
    expect(screen.queryByText("Not available")).toBeNull();
  });

  it("never rounds a nearly used budget up to full", () => {
    tokenUsage.mockReturnValue(
      ok({ ...limited, used_tokens: 497500, used_ratio: 0.995 })
    );
    render(<UsageSection />);
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
      "99"
    );
  });

  it("says Under 1% for a small real use", () => {
    tokenUsage.mockReturnValue(
      ok({ ...limited, used_tokens: 1200, used_ratio: 0.0024 })
    );
    render(<UsageSection />);
    expect(screen.getByText("Under 1%")).toBeTruthy();
  });
});

describe("UsageSection activity", () => {
  it("fetches the stats only after Calculate and shows grams below 1 kg", () => {
    const refetch = vi.fn();
    let loaded = false;
    messageStats.mockImplementation(() => ({
      data: loaded ? stats : undefined,
      isFetching: false,
      isError: false,
      refetch: () => {
        loaded = true;
        refetch();
      },
    }));
    const view = render(<UsageSection />);
    expect(screen.queryByTestId("settings-usage-co2eq")).toBeNull();

    fireEvent.click(screen.getByTestId("settings-usage-calculate"));
    expect(refetch).toHaveBeenCalledTimes(1);
    view.rerender(<UsageSection />);

    expect(screen.getByTestId("settings-usage-co2eq").textContent).toBe(
      "41.2 g"
    );
    expect(screen.getByText(/Estimate, not yet verified/)).toBeTruthy();
  });

  it("shows cached totals on arrival, with the button reading Recalculate", () => {
    messageStats.mockImplementation(() => ({
      data: stats,
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
    }));
    render(<UsageSection />);
    expect(screen.getByTestId("settings-usage-co2eq")).toBeTruthy();
    expect(screen.getByTestId("settings-usage-calculate").textContent).toBe(
      "Recalculate"
    );
  });

  it("formats a small footprint in grams and a large one in kilograms", () => {
    messageStats.mockImplementation(() => ({
      data: { ...stats, co2eq_kg: 0.0035 },
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
    }));
    const view = render(<UsageSection />);
    expect(screen.getByTestId("settings-usage-co2eq").textContent).toBe(
      "3.5 g"
    );
    messageStats.mockImplementation(() => ({
      data: { ...stats, co2eq_kg: 12.346 },
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
    }));
    view.rerender(<UsageSection />);
    expect(screen.getByTestId("settings-usage-co2eq").textContent).toBe(
      "12.35 kg"
    );
  });
});
