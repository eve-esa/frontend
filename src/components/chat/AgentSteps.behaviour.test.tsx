// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgenticTraceStep, MessageType, ToolActivityEntry } from "@/types";
import { blankBuildTimeEnv } from "@/test-utils/runtimeConfigStub";
import { AgentSteps, StepResult } from "./AgentSteps";
import { buildCollectionCatalog, buildStepsFromActivity } from "@/utilities/agentSteps";

/**
 * What the static markup tests cannot see: effects, the one second clock,
 * toggles, Stop, unmount, and the hand-over from the streamed turn to the
 * saved row. Fake timers drive the clock.
 */

const search: ToolActivityEntry = {
  label: "Calling tool",
  state: "done",
  id: "c1",
  tool: "eve_retrieval_retrieve",
  query: "Po delta flood",
  preview: JSON.stringify({ retrieved_docs: [{ title: "Floods in the Po delta", year: 2020 }] }),
};

const block = () => screen.getByTestId("agent-steps");
const clock = () => screen.getByTestId("agent-steps-clock").textContent;
const head = () => screen.getByTestId("agent-steps-summary-head").textContent;

type Props = Parameters<typeof AgentSteps>[0];
const base: Props = { activity: [], live: true, answerStarted: false, agentic: true };

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-13T10:00:00Z"));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("AgentSteps live behaviour", () => {
  it("ticks the header clock every second while the agent works", () => {
    render(<AgentSteps {...base} />);
    expect(screen.getByTestId("agent-steps-working").textContent).toBe("Working");
    expect(clock()).toBe("0:00");
    advance(3000);
    expect(clock()).toBe("0:03");
  });

  it("does not parse a step result again on a clock tick", () => {
    render(<AgentSteps {...base} activity={[search]} />);
    const parse = vi.spyOn(JSON, "parse");
    advance(5000);
    expect(clock()).toBe("0:05");
    expect(parse).not.toHaveBeenCalled();
  });

  it("announces the activity from a live region outside the toggle", () => {
    render(<AgentSteps {...base} />);
    const region = screen.getByRole("status");
    expect(region.textContent).toBe("Thinking…");
    const toggle = screen.getByTestId("agent-steps-toggle");
    expect(toggle.contains(region)).toBe(false);
    expect(toggle.getAttribute("aria-label")).toBe("Agent steps, working");
    // The spinner's own status role is hidden from assistive tech.
    expect(within(toggle).queryByRole("status")).toBeNull();
  });

  it("folds at the first answer token but keeps the clock until the stream ends", () => {
    const { rerender } = render(<AgentSteps {...base} activity={[search]} />);
    expect(block().getAttribute("data-state")).toBe("open");
    advance(4000);
    rerender(<AgentSteps {...base} activity={[search]} answerStarted />);
    expect(block().getAttribute("data-state")).toBe("closed");
    // The agent may keep working after interim text: no "Worked for" yet.
    expect(screen.queryByTestId("agent-steps-summary-head")).toBeNull();
    expect(clock()).toBe("0:04");
    advance(10_000);
    expect(clock()).toBe("0:14");
    rerender(<AgentSteps {...base} activity={[search]} live={false} answerStarted />);
    expect(screen.queryByTestId("agent-steps-clock")).toBeNull();
    expect(head()).toBe("Worked for 14s");
    advance(10_000);
    expect(head()).toBe("Worked for 14s");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps Working and a ticking clock when a new step runs after the first answer token", () => {
    const next: ToolActivityEntry = { ...search, id: "s2", state: "running" };
    const { rerender } = render(<AgentSteps {...base} activity={[{ ...search, state: "done" }]} />);
    advance(3000);
    rerender(<AgentSteps {...base} activity={[{ ...search, state: "done" }]} answerStarted />);
    rerender(<AgentSteps {...base} activity={[{ ...search, state: "done" }, next]} answerStarted />);
    expect(screen.queryByTestId("agent-steps-summary-head")).toBeNull();
    expect(clock()).toBe("0:03");
    advance(60_000);
    expect(clock()).toBe("1:03");
    // Open it: the header reads Working with the same clock.
    fireEvent.click(screen.getByTestId("agent-steps-toggle"));
    expect(screen.getByTestId("agent-steps-working").textContent).toBe("Working");
    expect(clock()).toBe("1:03");
  });

  it("freezes on Stop and folds to the Stopped header", () => {
    const { rerender } = render(<AgentSteps {...base} activity={[search]} />);
    advance(2000);
    rerender(<AgentSteps {...base} activity={[search]} stopped />);
    expect(head()).toBe("Stopped after 2s");
    expect(block().getAttribute("data-state")).toBe("closed");
    advance(5000);
    expect(head()).toBe("Stopped after 2s");
  });

  it("clears the interval on unmount", () => {
    const { unmount } = render(<AgentSteps {...base} />);
    const clear = vi.spyOn(window, "clearInterval");
    unmount();
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it("restarts the clock and the open state when a new run starts in the same slot (Retry)", () => {
    const { rerender } = render(<AgentSteps {...base} activity={[search]} />);
    // The user folds the block while the first run works; it stays folded after the failure.
    fireEvent.click(screen.getByTestId("agent-steps-toggle"));
    advance(7000);
    rerender(<AgentSteps {...base} activity={[search]} live={false} failed />);
    expect(block().getAttribute("data-state")).toBe("closed");
    advance(30_000);
    rerender(<AgentSteps {...base} activity={[]} />);
    expect(block().getAttribute("data-state")).toBe("open");
    expect(clock()).toBe("0:00");
    advance(2000);
    expect(clock()).toBe("0:02");
  });

  it("shows no Retry of its own on a failed turn", () => {
    render(<AgentSteps {...base} activity={[search]} live={false} answerStarted failed />);
    expect(screen.queryByTestId("agent-steps-retry")).toBeNull();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });

  it("names each step status for screen readers inside the row toggle", () => {
    render(
      <AgentSteps
        {...base}
        live={false}
        answerStarted
        failed
        activity={[search, { ...search, id: "c2", tool: "gdacs_search", server: "gdacs", status: "error", preview: "HTTP 502" }]}
      />,
    );
    // Folded after the turn: only the failed row in sight, named as failed.
    expect(screen.getAllByTestId("agent-step-toggle").map((r) => r.getAttribute("aria-label"))).toEqual([
      expect.stringMatching(/, failed$/),
    ]);
    fireEvent.click(screen.getByTestId("agent-steps-toggle"));
    const rows = screen.getAllByTestId("agent-step-toggle");
    expect(rows).toHaveLength(2);
    expect(rows[0].getAttribute("aria-label")).toMatch(/^Searched EVE sources for "Po delta flood", done$/);
    expect(rows[1].getAttribute("aria-label")).toMatch(/, failed$/);
  });
});

describe("StepResult output", () => {
  it("keeps HTML-like tool output as text", () => {
    const [row] = buildStepsFromActivity([
      { label: "Calling tool", state: "done", id: "x", tool: "fetch_page", preview: '<img src=x onerror="alert(1)"><b>bold</b>' },
    ]).rows;
    const { container } = render(<StepResult row={row} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
    expect(screen.getByTestId("agent-step-output-preview").textContent).toContain("<img src=x");
  });
});

// ---------------------------------------------------------------------------
// Hand-over: the streamed turn becomes the saved row, then the stored trace.
// ---------------------------------------------------------------------------

vi.mock("./MessageFooter", () => ({ MessageFooter: () => null }));
vi.mock("@/services/axios", () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

const turn = (overrides: Partial<MessageType>): MessageType =>
  ({
    id: "temp-1",
    conversation_id: "conv-1",
    input: "hello",
    output: "",
    feedback: null,
    timestamp: new Date(),
    documents: [],
    request_input: { llm_type: "main" },
    ...overrides,
  }) as MessageType;

const TRACE: AgenticTraceStep[] = [
  {
    role: "assistant",
    content: "",
    tool_calls: [{ name: "eve_retrieval_retrieve", args: { query: "Po delta flood" }, id: "c1" }],
    started_at_s: 0,
    latency_s: 1,
  },
  {
    role: "tool",
    name: "eve_retrieval_retrieve",
    tool_call_id: "c1",
    content: search.preview,
    started_at_s: 1,
    latency_s: 2,
  },
];

describe("Message hand-over with FEATURE_AGENT_STEPS on", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    delete (window as { __EVE_CONFIG__?: unknown }).__EVE_CONFIG__;
  });

  it("keeps the block mounted and its open state from the streamed turn to the saved trace", async () => {
    blankBuildTimeEnv();
    (window as { __EVE_CONFIG__?: Record<string, string> }).__EVE_CONFIG__ = {
      FEATURE_AGENTIC_CHAT: "true",
      FEATURE_AGENT_STEPS: "true",
    };
    const { Message } = await import("./Message");
    const { swapTempForSaved } = await import("@/utilities/savedTurn");

    const working = turn({ tool_activity: [search] });
    const { rerender } = render(<Message message={working} isSending isLastMessage />);
    expect(block().getAttribute("data-state")).toBe("open");
    // The answer tokens arrive; the smoothed stream reveals them over frames.
    const streamed = { ...working, output: "The Po delta flooded." };
    rerender(<Message message={streamed} isSending isLastMessage />);
    advance(3000);
    expect(block().getAttribute("data-state")).toBe("closed");
    fireEvent.click(screen.getByTestId("agent-steps-toggle"));
    expect(block().getAttribute("data-state")).toBe("open");
    const mounted = block();

    // onSuccess: the saved row replaces the temp row and keeps the activity.
    const [saved] = swapTempForSaved([streamed], turn({ id: "srv-1", output: "The Po delta flooded." }), true);
    expect(saved.tool_activity).toEqual([search]);
    rerender(<Message message={saved} isSending={false} isLastMessage />);
    expect(block()).toBe(mounted);
    expect(block().getAttribute("data-state")).toBe("open");
    expect(screen.getAllByTestId("agent-step")).toHaveLength(1);

    // The refetch: the persisted row with its trace and no activity.
    rerender(
      <Message
        message={turn({ id: "6a1b2c3d4e5f60718293a4b5", output: "The Po delta flooded.", trace: TRACE })}
        isSending={false}
        isLastMessage
      />,
    );
    expect(block()).toBe(mounted);
    expect(block().getAttribute("data-state")).toBe("open");
    // The fresh Message import is slow on a loaded machine.
  }, 20_000);

  it("keeps the saved row as it is with the flag off", async () => {
    const { swapTempForSaved } = await import("@/utilities/savedTurn");
    const [saved] = swapTempForSaved([turn({ tool_activity: [search] })], turn({ id: "srv-1" }), false);
    expect(saved.tool_activity).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Stop: the cut calls live on the stored trace only (contract 2.2 `stopped`).
// ---------------------------------------------------------------------------

const STOPPED_TRACE: AgenticTraceStep[] = [
  {
    role: "assistant",
    content: "",
    // The model node alone took 3 s; the cut call ran 23 s.
    started_at_s: 0,
    latency_s: 3,
    tool_calls: [
      {
        id: "call-1",
        name: "execute",
        args: { code: "print(1)" },
        step: {
          tool_call_id: "call-1",
          kind: "builtin",
          status: "cancelled",
          duration_ms: 23030,
          started_at: "2026-11-13T10:00:01Z",
          attempt: 1,
          model: "eve_jsc",
          model_name: "EVE-Instruct",
        },
      },
      {
        id: "call-2",
        name: "eve_retrieval_retrieve",
        args: { query: "flood" },
        step: { tool_call_id: "call-2", status: "not_run" },
      },
    ],
  } as unknown as AgenticTraceStep,
];

describe("AgentSteps after a Stop", () => {
  it("shows the cancelled and not run calls of a stopped trace, folded under a Stopped summary", () => {
    render(<AgentSteps trace={STOPPED_TRACE} live={false} answerStarted={false} stopped />);
    expect(head()).toBe("Stopped after 23s");
    expect(screen.getByTestId("agent-steps-summary").textContent).toContain("1 step");
    expect(block().getAttribute("data-state")).toBe("closed");
    expect(screen.queryByTestId("agent-step")).toBeNull();
    fireEvent.click(screen.getByTestId("agent-steps-toggle"));
    const rows = screen.getAllByTestId("agent-step");
    expect(rows.map((r) => r.getAttribute("data-status"))).toEqual(["stopped", "not_run"]);
    // The cut row keeps its verb with one muted "stopped"; the header owns the time.
    expect(within(rows[0]).getByTestId("agent-step-verb").textContent).toBe("Running code");
    expect(within(rows[0]).getByTestId("agent-step-stopped").textContent).toBe("stopped");
    expect(within(rows[1]).getByTestId("agent-step-not-run").textContent).toBe("not run");
    expect(within(rows[0]).getByTestId("agent-step-toggle").getAttribute("aria-label")).toMatch(/, stopped$/);
    expect(within(rows[1]).getByTestId("agent-step-toggle").getAttribute("aria-label")).toMatch(/, not run$/);
  });

  it("keeps the running row as stopped on a live Stop and after the stored row arrives", () => {
    const runningCall: ToolActivityEntry = {
      label: "Calling tool",
      state: "running",
      id: "call-1",
      tool: "execute",
      kind: "builtin",
    };
    const { rerender } = render(<AgentSteps {...base} activity={[runningCall]} />);
    advance(3000);
    rerender(<AgentSteps {...base} activity={[runningCall]} stopped />);
    expect(block().getAttribute("data-state")).toBe("closed");
    fireEvent.click(screen.getByTestId("agent-steps-toggle"));
    expect(screen.getByTestId("agent-step").getAttribute("data-status")).toBe("stopped");
    // The reconcile refetch: the stored row, its trace, no live activity.
    rerender(<AgentSteps trace={STOPPED_TRACE} activity={null} live={false} answerStarted={false} stopped />);
    expect(screen.getAllByTestId("agent-step")[0].getAttribute("data-status")).toBe("stopped");
  });

  it("renders the block above Generation stopped in a stored stopped message", async () => {
    blankBuildTimeEnv();
    (window as { __EVE_CONFIG__?: Record<string, string> }).__EVE_CONFIG__ = {
      FEATURE_AGENTIC_CHAT: "true",
      FEATURE_AGENT_STEPS: "true",
    };
    const { Message } = await import("./Message");
    render(
      <Message
        message={turn({ id: "6a1b2c3d4e5f60718293a4b6", stopped: true, output: "", trace: STOPPED_TRACE })}
        isSending={false}
        isLastMessage
      />,
    );
    fireEvent.click(screen.getByTestId("agent-steps-toggle"));
    expect(screen.getAllByTestId("agent-step")[0].getAttribute("data-status")).toBe("stopped");
    expect(screen.getByTestId("message-stopped")).toBeTruthy();
    vi.unstubAllEnvs();
    delete (window as { __EVE_CONFIG__?: unknown }).__EVE_CONFIG__;
  }, 20_000);
});

describe("AgentSteps live header", () => {
  const catalog = buildCollectionCatalog([{ id: "wiley", name: "Wiley AI Gateway" }], null);
  const kbRunning: ToolActivityEntry = {
    label: "Calling tool",
    state: "running",
    id: "k1",
    tool: "eve_retrieval_retrieve",
    query: "Sentinel-3 OLCI",
    args: { query: "Sentinel-3 OLCI" },
    requestCollections: { public_collections: ["wiley"], private_collections: [] },
  };

  it("says Working while open and leaves the current action to the rows", () => {
    render(<AgentSteps {...base} activity={[kbRunning]} collections={catalog} />);
    const toggle = screen.getByTestId("agent-steps-toggle");
    expect(screen.getByTestId("agent-steps-working").textContent).toBe("Working");
    // Working in the text tier, the clock muted (A1 1-live).
    expect(screen.getByTestId("agent-steps-clock").className).toContain("text-primary-300");
    expect(within(toggle).queryByTestId("agent-steps-activity")).toBeNull();
    expect(toggle.textContent).not.toContain("Searching");
    // The row carries the detail: the server chip, the verb, the query.
    const row = screen.getByTestId("agent-step");
    expect(within(row).getByTestId("agent-step-verb").textContent).toBe("Searching");
    expect(within(row).getAllByTestId("agent-step-target").map((t) => t.textContent)).toEqual(["EVE sources"]);
    expect(within(row).getByTestId("agent-step-detail").textContent).toBe('"Sentinel-3 OLCI"');
    // Screen readers still hear the action.
    expect(screen.getByRole("status").textContent).toBe('Searching EVE sources for "Sentinel-3 OLCI", running');
  });

  it("shows the current action with its chip once the user folds it while live", () => {
    render(<AgentSteps {...base} activity={[kbRunning]} collections={catalog} />);
    fireEvent.click(screen.getByTestId("agent-steps-toggle"));
    expect(block().getAttribute("data-state")).toBe("closed");
    expect(screen.queryByTestId("agent-steps-working")).toBeNull();
    const activity = screen.getByTestId("agent-steps-activity");
    // The running row's own verb and chip, verb first, worded the same as the row.
    expect(within(activity).getByTestId("agent-step-target").textContent).toBe("EVE sources");
    expect(activity.querySelector('[aria-hidden="true"]')?.textContent).toBe("SearchingEVE sources…");
    expect(clock()).toBe("0:00");
  });
});
