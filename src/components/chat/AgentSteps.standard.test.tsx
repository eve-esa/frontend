// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolActivityEntry } from "@/types";
import { buildStepsFromActivity } from "@/utilities/agentSteps";
import { AgentSteps } from "./AgentSteps";

/**
 * The steps part of the UI standard (review/UI-STANDARD-STEPS-CITATIONS.md,
 * section 3) on the approved A1 row order: the tense carries the status,
 * repeated calls fold, a finished subagent folds, the screen reader contract.
 */

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-13T10:00:00Z"));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const kb = (id: string, o: Partial<ToolActivityEntry> = {}): ToolActivityEntry => ({
  label: "Calling tool",
  state: "done",
  id,
  tool: "eve_retrieval_retrieve",
  query: `query ${id}`,
  args: { query: `query ${id}` },
  durationMs: 2100,
  ...o,
});
const exec = (id: string, o: Partial<ToolActivityEntry> = {}): ToolActivityEntry => ({
  label: "Calling tool",
  state: "done",
  id,
  tool: "execute",
  kind: "builtin",
  args: { command: "python a.py" },
  durationMs: 1000,
  ...o,
});
const open = () => fireEvent.click(screen.getByTestId("agent-steps-toggle"));
const topRows = () => screen.getAllByTestId("agent-step").filter((r) => !r.hasAttribute("data-nested"));
const verb = (row: HTMLElement) => within(row).getAllByTestId("agent-step-verb")[0].textContent;

describe("the tense carries the status", () => {
  it("present while running, past when done", () => {
    const { rerender } = render(<AgentSteps activity={[kb("a", { state: "running" })]} live answerStarted={false} agentic />);
    expect(verb(topRows()[0])).toBe("Searching");
    rerender(<AgentSteps activity={[kb("a")]} live answerStarted={false} agentic />);
    expect(verb(topRows()[0])).toBe("Searched");
  });

  it("the verb says a failed call failed, in the danger token, no duration next to it", () => {
    render(<AgentSteps activity={[kb("a", { status: "error", preview: "HTTP 502" })]} live={false} answerStarted failed />);
    // Folded after the turn, the failed row stays in sight.
    const row = topRows()[0];
    const failedVerb = within(row).getByTestId("agent-step-verb");
    expect(failedVerb.textContent).toBe("Failed to search");
    expect(failedVerb.className).toContain("text-danger-300");
    expect(within(row).queryByTestId("agent-step-failed")).toBeNull();
    expect(within(row).queryByTestId("agent-step-duration")).toBeNull();
  });

  it("puts the failures of the run in the danger token in the header", () => {
    render(<AgentSteps activity={[kb("a"), kb("b", { status: "error" })]} live={false} answerStarted failed />);
    const failed = screen.getByTestId("agent-steps-failed");
    expect(failed.textContent).toBe("1 failed");
    expect(failed.className).toContain("text-danger-300");
  });
});

describe("three or more consecutive calls of one tool fold into one row", () => {
  it("reads EVE sources Searched 3 times, counts three steps and expands into the calls", () => {
    render(<AgentSteps activity={[kb("a"), kb("b"), kb("c"), exec("d")]} live={false} answerStarted />);
    expect(screen.getByTestId("agent-steps-summary").textContent).toContain("4 steps");
    open();
    const [group, code] = topRows();
    expect(group.getAttribute("data-kind")).toBe("group");
    expect(within(group).getAllByTestId("agent-step-target")[0].textContent).toBe("EVE sources");
    expect(verb(group)).toBe("Searched");
    expect(within(group).getAllByTestId("agent-step-detail")[0].textContent).toBe("3 times");
    expect(verb(code)).toBe("Ran code");
    expect(within(group).queryAllByTestId("agent-step")).toHaveLength(0);
    fireEvent.click(within(group).getAllByTestId("agent-step-toggle")[0]);
    expect(within(group).getAllByTestId("agent-step")).toHaveLength(3);
  });

  it("leaves two calls as two rows", () => {
    render(<AgentSteps activity={[kb("a"), kb("b")]} live={false} answerStarted />);
    open();
    expect(topRows()).toHaveLength(2);
  });

  it("is running while any call runs and says how many failed once settled", () => {
    const { rerender } = render(
      <AgentSteps activity={[kb("a"), kb("b"), kb("c", { state: "running" })]} live answerStarted={false} agentic />,
    );
    expect(topRows()[0].getAttribute("data-status")).toBe("running");
    expect(verb(topRows()[0])).toBe("Searching");
    expect(within(topRows()[0]).getAllByTestId("agent-step-detail")[0].textContent).toBe("3 times");
    rerender(<AgentSteps activity={[kb("a"), kb("b", { status: "error" }), kb("c")]} live={false} answerStarted failed />);
    // Folded after the turn, a group with a failed call stays in sight with its count.
    expect(screen.getByTestId("agent-steps").getAttribute("data-state")).toBe("closed");
    expect(within(topRows()[0]).getByTestId("agent-step-failed").textContent).toBe("1 failed");
  });

  it("folds the same way from the stored trace as from the live frames", () => {
    const live = buildStepsFromActivity([kb("a"), kb("b"), kb("c")]);
    expect(live.rows).toHaveLength(1);
    expect(live.stepCount).toBe(3);
  });
});

describe("a subagent is one row", () => {
  const subagent = (o: Partial<ToolActivityEntry> = {}): ToolActivityEntry => ({
    label: "Calling tool",
    state: "running",
    id: "s",
    tool: "task",
    kind: "subagent",
    args: { subagent_type: "literature-review", description: "flood mapping accuracy" },
    subagentRunId: "r1",
    ...o,
  });
  const child = kb("k", { subagentRunId: "r1" });

  it("is open with its own steps while it runs", () => {
    render(<AgentSteps activity={[subagent(), child]} live answerStarted={false} agentic />);
    const row = topRows()[0];
    expect(verb(row)).toBe("Running subagent");
    expect(within(row).getAllByTestId("agent-step")).toHaveLength(1);
  });

  it("folds when it finishes and opens again when it fails", () => {
    const { rerender } = render(
      <AgentSteps activity={[subagent({ state: "done", durationMs: 9000 }), child]} live={false} answerStarted />,
    );
    open();
    const row = topRows()[0];
    expect(verb(row)).toBe("Ran subagent");
    expect(within(row).queryAllByTestId("agent-step")).toHaveLength(0);
    rerender(
      <AgentSteps activity={[subagent({ state: "done", status: "error" }), child]} live={false} answerStarted failed />,
    );
    expect(within(topRows()[0]).getAllByTestId("agent-step")).toHaveLength(1);
  });
});

describe("screen reader contract", () => {
  it("names each row with one sentence that states its status", () => {
    render(<AgentSteps activity={[kb("a"), exec("b", { status: "error", preview: "boom" })]} live={false} answerStarted failed />);
    open();
    const [search, code] = screen.getAllByTestId("agent-step-toggle");
    expect(search.getAttribute("aria-label")).toBe('Searched EVE sources for "query a", done in 2.1 seconds');
    expect(code.getAttribute("aria-label")).toBe("Failed to run code Python python a.py, failed");
  });

  it("marks the header busy while running and announces step changes and the summary, never the timer", () => {
    const { rerender } = render(<AgentSteps activity={[kb("a", { state: "running" })]} live answerStarted={false} agentic />);
    const header = screen.getByTestId("agent-steps-toggle");
    const region = screen.getByRole("status");
    expect(header.getAttribute("aria-busy")).toBe("true");
    expect(region.getAttribute("aria-atomic")).toBe("true");
    expect(region.textContent).toBe('Searching EVE sources for "query a", running');
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(region.textContent).toBe('Searching EVE sources for "query a", running');
    rerender(<AgentSteps activity={[kb("a")]} live answerStarted={false} agentic />);
    expect(screen.getByRole("status").textContent).toBe('Searched EVE sources for "query a", done in 2.1 seconds');
    rerender(<AgentSteps activity={[kb("a")]} live={false} answerStarted />);
    expect(screen.getByTestId("agent-steps-toggle").getAttribute("aria-busy")).toBe("false");
    expect(screen.getByRole("status").textContent).toMatch(/^Worked/);
  });
});
