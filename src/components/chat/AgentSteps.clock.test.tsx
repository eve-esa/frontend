// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolActivityEntry } from "@/types";
import { AgentSteps } from "./AgentSteps";
import { sendTimeFromId } from "@/utilities/agentSteps";

const SENT = new Date("2026-11-18T18:57:10Z").getTime();
const clock = () => screen.getByTestId("agent-steps-clock").textContent;
const head = () => screen.getByTestId("agent-steps-summary-head").textContent;
const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

const mcpRunning: ToolActivityEntry = {
  label: "Calling tool",
  state: "running",
  id: "m1",
  tool: "dummy_image_generate",
  server: "dummy_image",
  kind: "mcp",
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(SENT);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("the turn clock", () => {
  it("keeps ticking every second while an MCP call runs with no stream event", () => {
    render(<AgentSteps activity={[mcpRunning]} live answerStarted={false} agentic startedAt={SENT} />);
    let elapsed = 0;
    for (const at of [1, 2, 6, 12, 21]) {
      advance((at - elapsed) * 1000);
      elapsed = at;
      expect(clock()).toBe(`0:${String(at).padStart(2, "0")}`);
    }
  });

  it("counts from the send when the block mounts late", () => {
    vi.setSystemTime(SENT + 30_000);
    render(<AgentSteps activity={[]} live answerStarted={false} agentic startedAt={SENT} />);
    expect(clock()).toBe("0:30");
    advance(2000);
    expect(clock()).toBe("0:32");
  });

  it("shows the real time at once when a hidden tab comes back", () => {
    render(<AgentSteps activity={[mcpRunning]} live answerStarted={false} agentic startedAt={SENT} />);
    // Timers are throttled while hidden: the clock moves without a tick.
    vi.setSystemTime(SENT + 40_000);
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(clock()).toBe("0:40");
  });

  it("ends at the real turn time, from the send to the first answer token", () => {
    const { rerender } = render(
      <AgentSteps activity={[mcpRunning]} live answerStarted={false} agentic startedAt={SENT} />,
    );
    advance(48_000);
    rerender(<AgentSteps activity={[mcpRunning]} live answerStarted agentic startedAt={SENT} />);
    expect(head()).toBe("Worked for 48s");
  });

  it("keeps the send time across the hand-over when the id stops being temp-*", () => {
    const { rerender } = render(<AgentSteps activity={[mcpRunning]} live answerStarted={false} agentic startedAt={SENT} />);
    advance(20_000);
    rerender(<AgentSteps activity={[mcpRunning]} live={false} answerStarted agentic startedAt={null} />);
    expect(head()).toBe("Worked for 20s");
  });

  it("reads the send time from the optimistic id only", () => {
    expect(sendTimeFromId(`temp-${SENT}`)).toBe(SENT);
    expect(sendTimeFromId("srv-1763492230000")).toBeNull();
    expect(sendTimeFromId("6a1b2c3d4e5f60718293a4b5")).toBeNull();
    expect(sendTimeFromId(undefined)).toBeNull();
  });
});
