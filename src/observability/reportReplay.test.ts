import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TelemetryConfig } from "./telemetry";

const mocks = vi.hoisted(() => ({
  resolveTelemetryConfig: vi.fn<() => TelemetryConfig | null>(),
  startReplayOnDemand: vi.fn<() => Promise<boolean>>(),
}));

vi.mock("./telemetry", () => ({
  resolveTelemetryConfig: mocks.resolveTelemetryConfig,
  startReplayOnDemand: mocks.startReplayOnDemand,
}));

import { REPLAY_START_TIMEOUT_MS, openBugReport } from "./reportReplay";

const config = (privacyMode: TelemetryConfig["privacyMode"]): TelemetryConfig => ({
  endpoint: "http://localhost:4318",
  ingestKey: "k",
  uiUrl: "http://localhost:8081",
  privacyMode,
  consoleCapture: false,
});

beforeEach(() => {
  mocks.resolveTelemetryConfig.mockReset();
  mocks.startReplayOnDemand.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("openBugReport", () => {
  it("starts the on demand replay, then opens", async () => {
    const events: string[] = [];
    mocks.resolveTelemetryConfig.mockReturnValue(config("on_demand"));
    mocks.startReplayOnDemand.mockImplementation(() => {
      events.push("replay");
      return Promise.resolve(true);
    });
    await openBugReport(() => events.push("open"));
    expect(events).toEqual(["replay", "open"]);
  });

  it.each(["off", "mask", "clear"] as const)(
    "opens right away in %s mode",
    async (mode) => {
      mocks.resolveTelemetryConfig.mockReturnValue(config(mode));
      const open = vi.fn();
      await openBugReport(open);
      expect(mocks.startReplayOnDemand).not.toHaveBeenCalled();
      expect(open).toHaveBeenCalledTimes(1);
    },
  );

  it("opens right away with telemetry off", async () => {
    mocks.resolveTelemetryConfig.mockReturnValue(null);
    const open = vi.fn();
    await openBugReport(open);
    expect(mocks.startReplayOnDemand).not.toHaveBeenCalled();
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("opens after the timeout when the replay never starts", async () => {
    vi.useFakeTimers();
    mocks.resolveTelemetryConfig.mockReturnValue(config("on_demand"));
    mocks.startReplayOnDemand.mockReturnValue(new Promise(() => undefined));
    const open = vi.fn();
    const pending = openBugReport(open);
    await vi.advanceTimersByTimeAsync(REPLAY_START_TIMEOUT_MS - 1);
    expect(open).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("opens when the replay fails to start", async () => {
    mocks.resolveTelemetryConfig.mockReturnValue(config("on_demand"));
    mocks.startReplayOnDemand.mockRejectedValue(new Error("chunk failed"));
    const open = vi.fn();
    await openBugReport(open);
    expect(open).toHaveBeenCalledTimes(1);
  });
});
