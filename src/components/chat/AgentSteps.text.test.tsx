// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AgenticTraceStep, MessageType, ToolActivityEntry } from "@/types";
import { blankBuildTimeEnv } from "@/test-utils/runtimeConfigStub";
import { buildCollectionCatalog } from "@/utilities/agentSteps";
import { highlightJson } from "@/utilities/codeTokens";
import { AgentSteps } from "./AgentSteps";

/**
 * The text rules of the block (A1 acceptance, Text 1 to 4, decision 0003):
 * every word once, a row reads verb, target chip, muted detail; a finished row
 * carries no status mark and no duration.
 */

vi.mock("./MessageFooter", () => ({ MessageFooter: () => null }));
vi.mock("@/services/axios", () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

const catalog = buildCollectionCatalog([{ id: "wiley", name: "Wiley AI Gateway" }], null);
const docs = (n: number) =>
  JSON.stringify({ retrieved_docs: Array.from({ length: n }, (_, i) => ({ title: `Paper ${i + 1}`, year: 2020 + i })) });

const kbDone: ToolActivityEntry = {
  label: "Calling tool",
  state: "done",
  id: "k1",
  tool: "eve_retrieval_retrieve",
  query: "Sentinel-3 OLCI",
  args: { query: "Sentinel-3 OLCI", k: 10 },
  preview: docs(5),
  durationMs: 2100,
};
const execDone: ToolActivityEntry = {
  label: "Calling tool",
  state: "done",
  id: "e1",
  tool: "execute",
  kind: "builtin",
  args: { command: "python -c 'print(3**50)'" },
  preview: "717897987691852588770249\n[Command succeeded with exit code 0]",
  durationMs: 4800,
};
const mcpDone: ToolActivityEntry = {
  label: "Calling tool",
  state: "done",
  id: "m1",
  tool: "gdacs_search_events",
  server: "gdacs",
  kind: "mcp",
  query: "flood Italy",
  durationMs: 1400,
};

const rowTitle = (row: HTMLElement) => within(row).getByTestId("agent-step-toggle");
const words = (el: HTMLElement) => (el.textContent ?? "").replace(/\s+/g, " ").trim();
/** Text a sighted user reads: screen reader only spans left out. */
const visibleWords = (el: HTMLElement) => {
  const copy = el.cloneNode(true) as HTMLElement;
  copy.querySelectorAll(".sr-only").forEach((n) => n.remove());
  return words(copy);
};

describe("a row is verb, target chip, muted detail", () => {
  it("knowledge base: EVE sources as the chip, Searched and the query; the collections on the meta line", () => {
    render(
      <AgentSteps
        activity={[{ ...kbDone, requestCollections: { public_collections: ["wiley"], private_collections: [] } }]}
        live={false}
        answerStarted
        collections={catalog}
      />,
    );
    fireEvent.click(screen.getByTestId("agent-steps-toggle"));
    const row = rowTitle(screen.getByTestId("agent-step"));
    const chips = within(row).getAllByTestId("agent-step-target");
    // Stable live, after the result and after a reload.
    expect(chips.map((c) => c.textContent)).toEqual(["EVE sources"]);
    expect(within(row).getByTestId("agent-step-verb").textContent).toBe("Searched");
    expect(within(row).getByTestId("agent-step-detail").textContent).toBe('"Sentinel-3 OLCI"');
    // The verb comes first, then the chip.
    expect(within(row).getByTestId("agent-step-head").textContent).toMatch(/^Searched\s*EVE sources/);
    fireEvent.click(row);
    fireEvent.click(screen.getByTestId("agent-step-details-toggle"));
    expect(within(screen.getByTestId("agent-step-meta")).getByText("Wiley AI Gateway")).toBeTruthy();
  });

  it("knowledge base: never the wording the knowledge base next to the chip", () => {
    render(<AgentSteps activity={[kbDone]} live={false} answerStarted />);
    fireEvent.click(screen.getByTestId("agent-steps-toggle"));
    const row = rowTitle(screen.getByTestId("agent-step"));
    expect(within(row).getAllByTestId("agent-step-target").map((c) => c.textContent)).toEqual(["EVE sources"]);
    expect(words(row)).not.toContain("the knowledge base");
  });

  it("code: the language chip, Ran code and the command", () => {
    render(<AgentSteps activity={[execDone]} live={false} answerStarted />);
    fireEvent.click(screen.getByTestId("agent-steps-toggle"));
    const row = rowTitle(screen.getByTestId("agent-step"));
    expect(within(row).getAllByTestId("agent-step-target").map((c) => c.textContent)).toEqual(["Python"]);
    expect(within(row).getByTestId("agent-step-verb").textContent).toBe("Ran code");
    expect(within(row).getByTestId("agent-step-detail").textContent).toBe("python -c 'print(3**50)'");
  });

  it("MCP: Called, the tool chip, the server muted and the query", () => {
    render(<AgentSteps activity={[mcpDone]} live={false} answerStarted />);
    fireEvent.click(screen.getByTestId("agent-steps-toggle"));
    const row = rowTitle(screen.getByTestId("agent-step"));
    expect(within(row).getAllByTestId("agent-step-target").map((c) => c.textContent)).toEqual(["search_events"]);
    expect(within(row).getByTestId("agent-step-verb").textContent).toBe("Called");
    expect(within(row).getByTestId("agent-step-server").textContent).toBe("in gdacs");
    expect(within(row).getByTestId("agent-step-detail").textContent).toBe('"flood Italy"');
  });

  it("shows no duration, no mark and no status word on a finished row", () => {
    render(<AgentSteps activity={[kbDone, execDone]} live={false} answerStarted />);
    fireEvent.click(screen.getByTestId("agent-steps-toggle"));
    const [kb] = screen.getAllByTestId("agent-step");
    expect(within(kb).queryByTestId("agent-step-duration")).toBeNull();
    expect(within(kb).queryByTestId("agent-step-mark")).toBeNull();
    expect(visibleWords(rowTitle(kb))).not.toMatch(/\b(done|ok|success)\b/i);
  });
});

describe("the header says each thing once", () => {
  it("done: Worked for, then the counts, all muted, no bold", () => {
    render(<AgentSteps activity={[kbDone, execDone]} live={false} answerStarted />);
    const summary = screen.getByTestId("agent-steps-summary");
    // No wall clock without a live run or a trace: "Worked" alone.
    expect(words(summary)).toBe("Worked, 2 steps");
    expect(summary.querySelector(".font-semibold")).toBeNull();
  });

  it("stopped: a stop icon and Stopped after once; the cut row keeps its verb with one muted stopped", () => {
    const running: ToolActivityEntry = { label: "Calling tool", state: "running", id: "e2", tool: "execute", kind: "builtin", args: { command: "python s.py" } };
    render(<AgentSteps activity={[running]} live={false} answerStarted={false} stopped />);
    expect(screen.getByTestId("agent-steps-stop-icon")).toBeTruthy();
    const block = screen.getByTestId("agent-steps");
    // Folded after the Stop: the header says it once; open, the row adds its one word.
    expect((visibleWords(block).match(/stopped/gi) ?? []).length).toBe(1);
    fireEvent.click(screen.getByTestId("agent-steps-toggle"));
    expect((visibleWords(block).match(/stopped/gi) ?? []).length).toBe(2); // the header, the row's word
    const row = screen.getByTestId("agent-step");
    expect(within(row).getByTestId("agent-step-verb").textContent).toBe("Running code");
    expect(within(row).getByTestId("agent-step-stopped").textContent).toBe("stopped");
  });

  it("a failed row says failed once, then the reason on its error line", () => {
    const failed: ToolActivityEntry = { ...mcpDone, status: "error", preview: "HTTP 502 from gdacs" };
    render(<AgentSteps activity={[failed]} live={false} answerStarted failed />);
    const row = screen.getByTestId("agent-step");
    expect(within(row).getByTestId("agent-step-error").textContent).toBe("HTTP 502 from gdacs");
    // The verb says it once ("Failed to call"), never "error".
    expect(within(row).getByTestId("agent-step-verb").textContent).toBe("Failed to call");
    expect((visibleWords(rowTitle(row)).match(/\bfailed\b/gi) ?? []).length).toBe(1);
    expect(visibleWords(rowTitle(row))).not.toMatch(/\berror\b/i);
  });
});

describe("the opened step", () => {
  it("shows the input as key: value lines, the documents with N more, the meta line and raw JSON in Details", () => {
    render(<AgentSteps activity={[kbDone]} live={false} answerStarted />);
    fireEvent.click(screen.getByTestId("agent-steps-toggle"));
    fireEvent.click(screen.getByTestId("agent-step-toggle"));
    const detail = screen.getByTestId("agent-step-detail-panel");
    const input = within(detail).getByTestId("agent-step-input");
    expect(input.textContent).toBe("query: Sentinel-3 OLCI\nk: 10");
    expect(input.querySelector('[data-token="key"]')).toBeNull();
    const output = within(detail).getByTestId("agent-step-output");
    expect(words(output)).toBe("Paper 1 (2020) Paper 2 (2021) Paper 3 (2022) 2 more");
    // Details, folded by default: the meta line and the raw JSON.
    expect(within(detail).queryByTestId("agent-step-meta")).toBeNull();
    fireEvent.click(within(detail).getByTestId("agent-step-details-toggle"));
    const meta = [...within(detail).getByTestId("agent-step-meta").children].map((item) =>
      [...item.children].map((part) => part.textContent).join(" "),
    );
    expect(meta).toEqual(["Server eve_retrieval", "Tool retrieve", "Result 5 documents"]);
    const json = within(detail).getByTestId("agent-step-input-json");
    expect(json.querySelector('[data-token="key"]')?.textContent).toBe('"query"');
  });
});

describe("Generation stopped under the block", () => {
  const STOPPED_TRACE: AgenticTraceStep[] = [
    {
      role: "assistant",
      content: "",
      tool_calls: [{ id: "c", name: "execute", args: {}, step: { tool_call_id: "c", status: "cancelled", duration_ms: 3000 } }],
    } as unknown as AgenticTraceStep,
  ];
  const stoppedTurn = {
    id: "6a1b2c3d4e5f60718293a4b7",
    conversation_id: "conv-1",
    input: "hi",
    output: "",
    feedback: null,
    timestamp: new Date(),
    documents: [],
    request_input: { llm_type: "main" },
    stopped: true,
    trace: STOPPED_TRACE,
  } as unknown as MessageType;

  const load = async (agentSteps: boolean) => {
    blankBuildTimeEnv();
    (window as { __EVE_CONFIG__?: Record<string, string> }).__EVE_CONFIG__ = {
      FEATURE_AGENTIC_CHAT: "true",
      FEATURE_AGENT_STEPS: agentSteps ? "true" : "false",
    };
    return (await import("./Message")).Message;
  };

  it("is read to screen readers only when the steps block shows (flag on)", async () => {
    const Message = await load(true);
    render(<Message message={stoppedTurn} isSending={false} isLastMessage />);
    expect(screen.getByTestId("agent-steps")).toBeTruthy();
    expect(screen.getByTestId("message-stopped").className).toContain("sr-only");
  }, 20_000);

  it("stays visible with the flag off", async () => {
    const Message = await load(false);
    render(<Message message={stoppedTurn} isSending={false} isLastMessage />);
    expect(screen.queryByTestId("agent-steps")).toBeNull();
    expect(screen.getByTestId("message-stopped").className).not.toContain("sr-only");
  }, 20_000);
});

describe("highlightJson", () => {
  it("marks keys, strings, numbers, booleans and null, and never loses text", () => {
    const text = JSON.stringify({ query: "a", k: 10, on: true, none: null }, null, 2);
    const tokens = highlightJson(text);
    expect(tokens.map((t) => t.text).join("")).toBe(text);
    expect(tokens.filter((t) => t.kind !== "plain").map((t) => [t.kind, t.text])).toEqual([
      ["key", '"query"'],
      ["string", '"a"'],
      ["key", '"k"'],
      ["number", "10"],
      ["key", '"on"'],
      ["boolean", "true"],
      ["key", '"none"'],
      ["null", "null"],
    ]);
  });
});

describe("a command that exits non-zero is a failed step", () => {
  const failedRun: ToolActivityEntry = {
    label: "Calling tool",
    state: "done",
    id: "x1",
    tool: "execute",
    kind: "builtin",
    args: { command: 'python -c "import nonexistent"' },
    preview:
      "Traceback (most recent call last):\nModuleNotFoundError: No module named 'nonexistent'\n[Command failed with exit code 1]",
    durationMs: 900,
  };

  it("shows the error mark, the failure in the verb, the output and the exit code, folded under the header", () => {
    render(<AgentSteps activity={[failedRun]} live={false} answerStarted />);
    expect(screen.getByTestId("agent-steps").getAttribute("data-state")).toBe("closed");
    const row = screen.getByTestId("agent-step");
    expect(row.getAttribute("data-status")).toBe("error");
    expect(within(row).getByTestId("agent-step-mark").getAttribute("data-mark")).toBe("error");
    expect(within(row).getByTestId("agent-step-verb").textContent).toBe("Failed to run code");
    expect(within(row).queryByTestId("agent-step-failed")).toBeNull();
    expect(within(row).getByTestId("agent-step-sandbox-output").textContent).toContain("No module named 'nonexistent'");
    expect(within(row).getByTestId("agent-step-exit").textContent).toBe("exit 1");
    // The output is the error: no second copy of it on an error line.
    expect(within(row).queryByTestId("agent-step-error")).toBeNull();
    expect(screen.getByTestId("agent-steps-failed").textContent).toBe("1 failed");
  });
});

describe("the turn surface card", () => {
  const turn = {
    id: "6a1b2c3d4e5f60718293a4b8",
    conversation_id: "conv-1",
    input: "hi",
    output: "An answer.",
    feedback: null,
    timestamp: new Date(),
    documents: [],
    request_input: { llm_type: "main" },
  } as unknown as MessageType;

  const bubble = async (agentSteps: boolean) => {
    blankBuildTimeEnv();
    (window as { __EVE_CONFIG__?: Record<string, string> }).__EVE_CONFIG__ = {
      FEATURE_AGENT_STEPS: agentSteps ? "true" : "false",
    };
    const { Message } = await import("./Message");
    render(<Message message={turn} isSending={false} isLastMessage />);
    return screen.getByTestId("message-assistant-surface");
  };

  it("with the flag on: the preview card, a darker surface with radius and inner padding", async () => {
    const card = await bubble(true);
    expect(card.className.split(" ")).toEqual(
      expect.arrayContaining(["bg-primary-600", "in-data-[theme=light]:bg-natural-900", "rounded-tl-[20px]", "rounded-br-[20px]", "px-4", "pb-4"]),
    );
  }, 20_000);

  it("with the flag off: the classes of main, unchanged", async () => {
    const card = await bubble(false);
    expect(card.className).toBe(
      "bg-natural-900 in-data-[theme=light]:bg-(--color-chat-ground) rounded-tl-[20px] rounded-br-[20px] pb-4 pt-0 relative",
    );
    expect((card.firstElementChild as HTMLElement).className).toBe("md:pt-8 pt-4 px-[1px]");
  }, 20_000);
});

describe("phone width (390 px)", () => {
  it("keeps the verb and the chip together, the detail wraps after them", () => {
    render(<AgentSteps activity={[kbDone]} live={false} answerStarted />);
    fireEvent.click(screen.getByTestId("agent-steps-toggle"));
    const head = screen.getByTestId("agent-step-head");
    expect(head.className).toContain("whitespace-nowrap");
    expect(within(head).getByTestId("agent-step-target").textContent).toBe("EVE sources");
    expect(within(head).getByTestId("agent-step-verb").textContent).toBe("Searched");
    expect(within(head).queryByTestId("agent-step-detail")).toBeNull();
  });

  it("gives the header and every row toggle a 44 px hit area without growing the row", () => {
    render(<AgentSteps activity={[kbDone]} live={false} answerStarted />);
    const header = screen.getByTestId("agent-steps-toggle");
    expect(header.className).toContain("max-sm:before:-inset-y-2");
    fireEvent.click(header);
    const row = screen.getByTestId("agent-step-toggle");
    expect(row.className).toContain("max-sm:before:-inset-y-2.5");
    expect(row.className).toContain("min-h-6");
  });
});

describe("sandbox streams in the terminal box", () => {
  it("drops the stderr and stdout wrappers, collapses blank lines, tints stderr, keeps the exit badge", () => {
    const entry: ToolActivityEntry = {
      label: "Calling tool",
      state: "done",
      id: "s1",
      tool: "execute",
      kind: "builtin",
      args: { command: "python x.py" },
      preview:
        "<stdout>partial\n</stdout>\n<stderr>Traceback (most recent call last):\n\n  File \"<string>\", line 1, in <module>\n\nModuleNotFoundError: No module named 'nonexistent'</stderr>\n[Command failed with exit code 1]",
    };
    render(<AgentSteps activity={[entry]} live={false} answerStarted />);
    const out = screen.getByTestId("agent-step-sandbox-output");
    expect(out.textContent).not.toMatch(/<\/?(stderr|stdout)>/);
    expect(out.textContent).not.toMatch(/\n\s*\n/);
    expect(out.textContent).toContain("partial");
    expect(out.textContent).toContain('File "<string>", line 1, in <module>');
    const err = within(out).getByTestId("agent-step-stderr");
    expect(err.className).toContain("text-danger-300");
    expect(err.textContent).toContain("ModuleNotFoundError");
    expect(screen.getByTestId("agent-step-exit").textContent).toBe("exit 1");
  });
});
