// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgenticTraceStep, ToolActivityEntry } from "@/types";
import { AgentSteps } from "./AgentSteps";
import { turnTimeS, sendTimeFromId } from "@/utilities/agentSteps";

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

  it("ends at the real turn time, from the send to the end of the stream", () => {
    const { rerender } = render(
      <AgentSteps activity={[mcpRunning]} live answerStarted={false} agentic startedAt={SENT} />,
    );
    advance(48_000);
    // Interim text next to the tool calls: the clock keeps going.
    rerender(<AgentSteps activity={[mcpRunning]} live answerStarted agentic startedAt={SENT} />);
    advance(30_000);
    expect(clock()).toBe("1:18");
    rerender(<AgentSteps activity={[mcpRunning]} live={false} answerStarted agentic startedAt={SENT} />);
    expect(head()).toBe("Worked for 1m 18s");
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

// Measured on dev (geocode MCP turn, 2026-11-18): the turn took 21.7 s, the header
// read "Worked for 21s" while it streamed and "Worked for 16s" once the saved turn
// replaced it. The trace starts after the setup (MCP loading, sandbox start), so its
// steps end at 16 s; the backend stores the time to the first answer token apart.
const SAVED_TRACE: AgenticTraceStep[] = [
  { role: "assistant", content: "", tool_calls: [{ name: "geocode_search", args: { q: "Colosseum" }, id: "c1" }], started_at_s: 0, latency_s: 2 },
  { role: "tool", name: "geocode_search", tool_call_id: "c1", content: "{}", started_at_s: 2, latency_s: 12 },
  { role: "assistant", content: "Done.", started_at_s: 14, latency_s: 2 },
];

describe("the header of a saved turn", () => {
  const saved = (extra: Partial<Parameters<typeof AgentSteps>[0]> = {}) =>
    render(<AgentSteps activity={[]} trace={SAVED_TRACE} live={false} answerStarted agentic={false} {...extra} />);

  it("reads the trace total alone when the backend stored no turn time", () => {
    saved();
    expect(head()).toBe("Worked for 16s");
  });

  it("counts the setup before the first step: the time to the first answer token", () => {
    saved({ workS: 21.4 });
    expect(head()).toBe("Worked for 21s");
  });

  it("reads the stored total latency of a turn with tool steps (dev, 2026-11-18)", () => {
    // 22 s turn, 6 steps, trace total 16 s; first_token_latency came before the tools.
    const stored = { latencies: { first_token_latency: 9.48, generation_latency: 15.92, total_latency: 21.47 } };
    saved({ workS: turnTimeS(stored) });
    expect(head()).toBe("Worked for 21s");
  });

  it("never shortens the trace total", () => {
    saved({ workS: 9 });
    expect(head()).toBe("Worked for 16s");
  });

  it("leaves a Stop at the time of the Stop", () => {
    saved({ workS: 21.4, stopped: true });
    expect(head()).not.toContain("21s");
  });

  it("prefers the total latency, then the first token time, and only a real one", () => {
    expect(turnTimeS({ latencies: { first_token_latency: 9.48, total_latency: 21.47 } })).toBe(21.47);
    expect(turnTimeS({ latencies: { first_token_latency: 7.33, total_latency: null } })).toBe(7.33);
    expect(turnTimeS({ latencies: { first_token_latency: 0, total_latency: 0 } })).toBeNull();
    expect(turnTimeS(undefined)).toBeNull();
  });
});

describe("the live clock without a tick", () => {
  it("shows the real time when a stream frame re-renders the block", () => {
    const { rerender } = render(<AgentSteps activity={[]} live answerStarted={false} agentic startedAt={SENT} />);
    // Timers stop (a hidden tab, a busy page): no interval callback runs.
    vi.setSystemTime(SENT + 11_000);
    rerender(<AgentSteps activity={[mcpRunning]} live answerStarted={false} agentic startedAt={SENT} />);
    expect(clock()).toBe("0:11");
  });
});
