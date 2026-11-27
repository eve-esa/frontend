import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// The markdown renderer is lazy: static markup would only reach its skeleton.
vi.mock("@/components/ui/LazySmartText", () => ({
  default: ({ text }: { text: string }) => <div data-testid="smart-text">{text}</div>,
}));
import type { AgenticTraceStep, ToolActivityEntry } from "@/types";
import { buildCollectionCatalog, buildStepsFromActivity } from "@/utilities/agentSteps";
import { AgentSteps, ExitBadge, HighlightedCode, StepResult, resolveBlockOpen } from "./AgentSteps";

const running = (o: Partial<ToolActivityEntry>): ToolActivityEntry => ({
  label: "Calling tool",
  state: "running",
  ...o,
});
const done = (o: Partial<ToolActivityEntry>): ToolActivityEntry => ({
  label: "Calling tool",
  state: "done",
  ...o,
});

const ACTIVITY: ToolActivityEntry[] = [
  done({ id: "c1", tool: "eve_retrieval_retrieve", query: "Po delta flood", preview: "10 documents" }),
  running({ id: "c2", tool: "gdacs_search_events", server: "gdacs", tier: "community", query: "flood Italy" }),
];

/** Visible text with tags as word breaks: a verb and its target chips read as words. */
const words = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const targets = (html: string) =>
  [...html.matchAll(/data-testid="agent-step-target"[^>]*>([^<]*)</g)].map((m) => m[1]);

const blockState = (html: string) =>
  html.match(/data-testid="agent-steps" data-state="(open|closed)"/)?.[1];

describe("AgentSteps block", () => {
  it("is open with the live header and every row while the agent works", () => {
    const html = renderToStaticMarkup(
      <AgentSteps activity={ACTIVITY} live answerStarted={false} />,
    );
    expect(blockState(html)).toBe("open");
    // The open header says Working; the live region names the running step.
    expect(html).toMatch(/data-testid="agent-steps-working"[^>]*>Working</);
    expect(activityText(html)).toBe("Calling search_events in gdacs &quot;flood Italy&quot;, running");
    expect(html.match(/data-testid="agent-step"/g)).toHaveLength(2);
    expect(html).toContain('data-status="running"');
  });

  it("collapses to the summary line once the final answer starts", () => {
    const finished = ACTIVITY.map((e) => ({ ...e, state: "done" as const }));
    const html = renderToStaticMarkup(
      <AgentSteps activity={finished} live={false} answerStarted />,
    );
    expect(blockState(html)).toBe("closed");
    expect(html).toContain("2 steps");
    expect(html).not.toContain('data-testid="agent-step"');
  });

  it("folds after a failed step, the failed row and its error stay under the header", () => {
    const trace: AgenticTraceStep[] = [
      {
        role: "assistant",
        content: "",
        tool_calls: [{ name: "wiley_search_wiley_fulltext", args: { query: "NDWI" }, id: "w1" }],
        started_at_s: 0,
        latency_s: 1,
      },
      {
        role: "tool",
        name: "wiley_search_wiley_fulltext",
        tool_call_id: "w1",
        status: "error",
        content: "Timed out after 30 s",
        started_at_s: 1,
        latency_s: 30,
      },
    ];
    const html = renderToStaticMarkup(
      <AgentSteps trace={trace} live={false} answerStarted />,
    );
    expect(blockState(html)).toBe("closed");
    expect(html).toContain("1 failed");
    expect(html).toContain('data-testid="agent-steps-failed-rows"');
    expect(html).toContain('data-status="error"');
    expect(html).toContain('data-testid="agent-step-error"');
    expect(html).toContain("Timed out after 30 s");
  });

  it("folds after a Stop under a Stopped header; open, the running step is marked stopped", () => {
    const html = renderToStaticMarkup(
      <AgentSteps activity={ACTIVITY} live={false} answerStarted stopped />,
    );
    expect(blockState(html)).toBe("closed");
    expect(html).toContain("Stopped");
    // The rows are one click away: the stopped row is in the view the block opens to.
    const rows = buildStepsFromActivity(ACTIVITY, { stopped: true }).rows;
    expect(rows.map((r) => r.status)).toEqual(["done", "stopped"]);
  });

  it("shows a SKILL.md read as Used skill <name>", () => {
    const html = renderToStaticMarkup(
      <AgentSteps
        activity={[done({ tool: "read_file", args: { file_path: "/skills/flood-mapping/SKILL.md" } })]}
        live
        answerStarted={false}
      />,
    );
    expect(html).toContain('data-kind="skill"');
    expect(words(html)).toContain("Used skill flood-mapping");
    expect(html).toContain('data-target-kind="skill"');
  });

  it("renders a sandbox step as folded code, the output and the saved file chip", () => {
    const rows = buildStepsFromActivity([
      done({ id: "e1", tool: "execute", args: { command: "python plot.py\necho ok" }, preview: "ok\n[Command succeeded with exit code 0]" }),
      done({ id: "d1", tool: "display", args: { path: "plot.png" }, preview: "![plot.png](/artifacts/6a1b2c3d4e)" }),
    ]).rows;
    // Under the row: the output box, no badge for exit 0, no exit line.
    const block = renderToStaticMarkup(
      <AgentSteps activity={rows.map((r) => r.raw as ToolActivityEntry)} live answerStarted={false} />,
    );
    expect(block).toMatch(/data-testid="agent-step-sandbox-output"[^>]*><span>ok<\/span><\/pre>/);
    expect(block).not.toContain('data-exit-code="0"');
    expect(block).not.toContain("exit code 0");
    // Opened: the code as the Input, highlighted; the saved file as a chip.
    const opened = rows.map((row) => renderToStaticMarkup(<StepResult row={row} />)).join("");
    expect(opened).toMatch(/data-testid="agent-step-input"[^>]*>python plot.py\necho ok<\/pre>/);
    expect(opened).toContain('data-testid="agent-step-artifact" data-href="/artifacts/6a1b2c3d4e"');
    expect(opened).toContain("plot.png");
  });

  it("folds a retried step into one row with 2 attempts and the first error", () => {
    const html = renderToStaticMarkup(
      <AgentSteps
        activity={[
          done({ id: "s1", tool: "search_fires", kind: "mcp", server: "effis", status: "timeout", errorCode: "timeout", attempt: 1 }),
          done({ id: "s1", tool: "search_fires", kind: "mcp", server: "effis", status: "ok", attempt: 2, retryOf: "s1", preview: "3 fires" }),
        ]}
        live={false}
        answerStarted
      />,
    );
    expect(html).toContain("1 step, 1 retry");
    const live = renderToStaticMarkup(
      <AgentSteps
        activity={[
          done({ id: "s1", tool: "search_fires", kind: "mcp", server: "effis", status: "timeout", errorCode: "timeout", attempt: 1 }),
          done({ id: "s1", tool: "search_fires", kind: "mcp", server: "effis", status: "error", attempt: 2, retryOf: "s1", preview: "HTTP 502" }),
        ]}
        live={false}
        answerStarted
        failed
      />,
    );
    expect(live.match(/data-testid="agent-step"/g)).toHaveLength(1);
    expect(live).toContain('data-testid="agent-step-attempts" data-attempts="2"');
    expect(live).toContain('data-testid="agent-step-attempt-error"');
    expect(live).toContain("timed out");
    // One Retry per failed turn: ErrorMessage's, under the list.
    expect(live).not.toContain('data-testid="agent-steps-retry"');
  });

  it("shows a model_fallback frame as its own small step", () => {
    const html = renderToStaticMarkup(
      <AgentSteps
        activity={[
          done({ id: "m1", label: "Switched to fallback", kind: "model_fallback", modelFrom: "main", modelTo: "fallback", fallbackReason: "circuit_open" }),
          done({ id: "c1", tool: "eve_retrieval_retrieve" }),
        ]}
        live
        answerStarted={false}
      />,
    );
    expect(html).toContain('data-kind="fallback" data-status="done" data-model-from="main" data-model-to="fallback"');
    expect(html).toContain("Switched to fallback: model busy");
    expect(html).not.toContain('data-testid="agent-steps-retry"');
  });

});

// A successful run as the enriched backend frames persist it (feat/agent-step-frames):
// a knowledge base search that found documents, then a sandbox `execute`.
const KB_DOCS = JSON.stringify({
  retrieved_docs: [
    { collection_name: "Wiley AI Gateway", metadata: { title: "OLCI turbidity", year: 2020 }, text: "..." },
  ],
});
const enrichedTrace = (execStatus: "ok" | "error"): AgenticTraceStep[] =>
  [
    {
      node: "model", role: "assistant", content: "", started_at_s: 0, latency_s: 1.357,
      tool_calls: [{
        name: "eve_retrieval_retrieve", args: { query: "Sentinel-3 OLCI" }, id: "k1",
        step: { tool_call_id: "k1", kind: "mcp", server: "eve_retrieval", attempt: 1 },
      }],
    },
    {
      node: "tools", role: "tool", name: "eve_retrieval_retrieve", tool_call_id: "k1", status: "success",
      content: KB_DOCS, started_at_s: 1.357, latency_s: 7.936,
      step: { tool_call_id: "k1", status: "ok", kind: "mcp", server: "eve_retrieval", attempt: 1, duration_ms: 7936 },
    },
    {
      node: "model", role: "assistant", content: "", started_at_s: 9.292, latency_s: 2.823,
      tool_calls: [{
        name: "execute", args: { command: 'python -c "print(3**50)"' }, id: "x1",
        step: { tool_call_id: "x1", kind: "builtin", server: null, attempt: 1 },
      }],
    },
    {
      node: "tools", role: "tool", name: "execute", tool_call_id: "x1",
      status: execStatus === "ok" ? "success" : "error",
      content: execStatus === "ok" ? "717897987691852588770249\n\n[Command succeeded with exit code 0]" : "Sandbox unavailable",
      started_at_s: 12.115, latency_s: 0.284,
      step: {
        tool_call_id: "x1", status: execStatus, kind: "builtin", server: null, attempt: 1, duration_ms: 284,
        ...(execStatus === "error" ? { error_code: "tool_error" } : {}),
      },
    },
    { node: "model", role: "assistant", content: "Sentinel-3 OLCI ... 3**50 = 717897987691852588770249.", started_at_s: 12.399, latency_s: 3.893 },
  ] as unknown as AgenticTraceStep[];

const rowStates = (html: string) =>
  [...html.matchAll(/<li[^>]*data-testid="agent-step"[^>]*>/g)].map((m) => ({
    tool: m[0].match(/data-tool="([^"]+)"/)?.[1],
    state: m[0].match(/data-state="(open|closed)"/)?.[1],
  }));

describe("AgentSteps collapse on a successful run with the enriched frames", () => {
  it("keeps every step collapsed while the agent works, renderers included", () => {
    const activity: ToolActivityEntry[] = [
      done({ id: "k1", tool: "eve_retrieval_retrieve", kind: "mcp", server: "eve_retrieval", status: "ok", durationMs: 7936, preview: KB_DOCS }),
      done({ id: "x1", tool: "execute", kind: "builtin", status: "ok", durationMs: 284, args: { command: "python a.py" }, preview: "ok" }),
    ];
    const html = renderToStaticMarkup(<AgentSteps activity={activity} live answerStarted={false} />);
    expect(blockState(html)).toBe("open");
    expect(rowStates(html)).toEqual([
      { tool: "eve_retrieval_retrieve", state: "closed" },
      { tool: "execute", state: "closed" },
    ]);
    expect(html).not.toContain('data-testid="agent-step-sources"');
    expect(html).not.toContain('data-testid="agent-step-sandbox"');
  });

  it("is collapsed once the answer is there, from the persisted trace", () => {
    const html = renderToStaticMarkup(
      <AgentSteps trace={enrichedTrace("ok")} live={false} answerStarted />,
    );
    expect(blockState(html)).toBe("closed");
    expect(html.replace(/<[^>]+>/g, "")).toContain("Worked for 16s, 2 steps");
    expect(html).not.toContain('data-testid="agent-step"');
  });

  it("folds after a failed step, only the failed code row in sight with its output", () => {
    const html = renderToStaticMarkup(
      <AgentSteps trace={enrichedTrace("error")} live={false} answerStarted failed />,
    );
    expect(blockState(html)).toBe("closed");
    expect(rowStates(html)).toEqual([{ tool: "execute", state: "closed" }]);
    // A failed sandbox step says it in its verb and shows its output as the error.
    expect(html).toMatch(/data-testid="agent-step-verb"[^>]*>Failed to run code</);
    expect(html).toContain('data-testid="agent-step-sandbox-output"');
  });
});

describe("resolveBlockOpen", () => {
  it("follows the automatic state when the user has not toggled", () => {
    expect(resolveBlockOpen(null, true)).toBe(true);
    expect(resolveBlockOpen(null, false)).toBe(false);
  });

  it("keeps a user toggle only until the automatic state changes", () => {
    // Peeked (closed then reopened) while working: the answer start still folds it.
    const peek = { open: true, autoOpen: true };
    expect(resolveBlockOpen(peek, true)).toBe(true);
    expect(resolveBlockOpen(peek, false)).toBe(false);
    // Opened after the run: stays open while nothing else changes.
    expect(resolveBlockOpen({ open: true, autoOpen: false }, false)).toBe(true);
  });
});

/** The current action as the live region announces it. While the block is
 * open the header itself only says "Working" (the rows carry the action). */
const activityText = (html: string) => html.match(/data-testid="agent-steps-announce"[^>]*>([^<]*)</)?.[1];

describe("AgentSteps header, one status line", () => {
  it("shows Thinking… with the timer on a live agentic turn before any step", () => {
    const html = renderToStaticMarkup(<AgentSteps activity={[]} live answerStarted={false} agentic />);
    expect(html).toContain('data-testid="agent-steps"');
    expect(activityText(html)).toBe("Thinking…");
    expect(html).toMatch(/data-testid="agent-steps-working"[^>]*>Working</);
    expect(html).toContain("0:00");
    expect(html).not.toContain('data-testid="agent-step"');
  });

  it("renders nothing without steps when the turn is not agentic", () => {
    expect(renderToStaticMarkup(<AgentSteps activity={[]} live answerStarted={false} />)).toBe("");
  });

  it("names the latest open step", () => {
    const header = (entry: Partial<ToolActivityEntry>) =>
      activityText(
        renderToStaticMarkup(
          <AgentSteps
            activity={[done({ id: "a", tool: "ls" }), running({ id: "b", ...entry })]}
            live
            answerStarted={false}
            agentic
            collections={buildCollectionCatalog([{ id: "Wiley AI Gateway", name: "Wiley AI Gateway" }], null)}
          />,
        ),
      );
    expect(header({ tool: "eve_retrieval_retrieve", args: { public_collections: ["Wiley AI Gateway"] } })).toBe(
      "Searching EVE sources, running",
    );
    expect(header({ tool: "execute", args: { command: "python a.py" } })).toBe("Running code Python python a.py, running");
    expect(header({ tool: "search", kind: "mcp", server: "cdse" })).toBe("Calling search in cdse, running");
    expect(header({ tool: "read_file", args: { file_path: "/skills/ndvi-helper/SKILL.md" } })).toBe(
      "Reading skill ndvi-helper, running",
    );
  });

  it("announces the step that ended between steps and the summary at the end", () => {
    const finished = [done({ id: "a", tool: "execute", durationMs: 1000 })];
    expect(activityText(renderToStaticMarkup(<AgentSteps activity={finished} live answerStarted={false} agentic />))).toBe(
      "Ran code shell, done in 1 second",
    );
    const end = renderToStaticMarkup(<AgentSteps activity={finished} live={false} answerStarted agentic />);
    expect(end).not.toContain('data-testid="agent-steps-working"');
    expect(activityText(end)).toBe("Worked, 1 step");
    expect(end).toContain("1 step");
  });

  it("keeps Working in the text tier and mutes the live timer", () => {
    const html = renderToStaticMarkup(<AgentSteps activity={[]} live answerStarted={false} agentic />);
    const clock = html.match(/<span[^>]*data-testid="agent-steps-clock"[^>]*>/)?.[0] ?? "";
    expect(clock).toContain("text-primary-300");
    expect(html).toMatch(/data-testid="agent-steps-toggle"[^>]*class="[^"]*text-natural-50/);
  });

  it("shows the history compression when nothing runs", () => {
    const html = renderToStaticMarkup(<AgentSteps activity={[]} live answerStarted={false} agentic summarizing />);
    expect(activityText(html)).toBe("Summarizing earlier messages…");
  });
});

// A turn that searched Wiley and one of the user's own collections.
const MIXED_DOCS = {
  retrieved_docs: [
    { collection_name: "Wiley AI Gateway", metadata: { title: "Flood mapping with SAR", year: 2021 } },
    { collection_name: "qwen-512-filtered", payload: { title: "Sentinel-1 flood extent", url: "https://example.org/s1" } },
    {
      collection_name: "Field reports",
      payload: { collection_id: "c-mine" },
      metadata: { filename: "GeoAI_workshop_final_report.pdf", file_type: "pdf", document_id: "d1" },
    },
  ],
};

const kbRow = (output: unknown) =>
  buildStepsFromActivity([
    done({
      id: "k",
      tool: "eve_retrieval_retrieve",
      query: "flood",
      args: { query: "flood", public_collections: ["Wiley AI Gateway", "qwen-512-filtered"], private_collections: ["c-mine"] },
      preview: JSON.stringify(output),
    }),
  ]).rows[0];

describe("knowledge base row names what it searched", () => {
  const catalog = buildCollectionCatalog(
    [
      { id: "Wiley AI Gateway", name: "Wiley AI Gateway" },
      { id: "qwen-512-filtered", name: "EVE papers" },
    ],
    ["c-mine"],
  );

  // Live before the answer keeps the block open so the rows render in static markup.
  it("reads Searched Wiley AI Gateway, EVE papers, My collections", () => {
    const row = kbRow(MIXED_DOCS);
    const block = renderToStaticMarkup(
      <AgentSteps
        activity={[row.raw as ToolActivityEntry]}
        live
        answerStarted={false}
        collections={catalog}
      />,
    );
    // The row: the server chip and the verb; the collections on the opened step's meta line.
    expect(targets(block)).toEqual(["EVE sources"]);
    expect(block).toMatch(/data-testid="agent-step-verb"[^>]*>Searched</);
    const opened = renderToStaticMarkup(<StepResult row={kbRow(MIXED_DOCS)} detailsOpen />);
    // Without the block catalog the raw names are title-cased.
    expect(words(opened)).toContain("Collections Wiley AI Gateway, Qwen 512 Filtered, My collections");
  });

});

describe("verb plus target", () => {
  it("keeps the open live header free of the row's verb and chips, the full line for screen readers", () => {
    // Folded while live, the header shows the verb and chip (AgentSteps.behaviour.test.tsx).
    const html = renderToStaticMarkup(
      <AgentSteps
        activity={[running({ id: "b", tool: "search", kind: "mcp", server: "cdse" })]}
        live
        answerStarted={false}
      />,
    );
    const header = html.match(/data-testid="agent-steps-toggle"[^]*?<\/button>/)?.[0] ?? "";
    expect(header).toContain(">Working<");
    expect(targets(header)).toEqual([]);
    expect(activityText(html)).toBe("Calling search in cdse, running");
  });

  it("gives code its language chip and its verb", () => {
    const html = renderToStaticMarkup(
      <AgentSteps activity={[done({ id: "e", tool: "execute", args: { command: "ls" } })]} live answerStarted={false} />,
    );
    expect(targets(html)).toEqual(["shell"]);
    expect(html).toMatch(/data-testid="agent-step-verb"[^>]*>Ran code</);
  });
});

describe("reasoning row", () => {
  it("shows the whole think as text, not as tool input and output", () => {
    const think = Array.from({ length: 30 }, (_, i) => `step ${i} ${"x".repeat(200)}`).join("\n");
    const html = renderToStaticMarkup(
      <AgentSteps
        activity={[running({ id: "reasoning-0", kind: "reasoning", label: "Thinking…", preview: think, startedAtMs: 0 })]}
        live
        answerStarted={false}
      />,
    );
    expect(html).toContain('data-testid="agent-step-reasoning"');
    expect(html).toContain("step 29");
    expect(html).toContain("x".repeat(200));
    expect(html).not.toContain('data-testid="agent-step-detail-panel"');
    expect(html).not.toContain('data-testid="agent-step-detail"');
  });
});

describe("no per-row duration (decision 0003)", () => {
  it("draws no duration and no bar on a finished row, even with a measured time", () => {
    const html = renderToStaticMarkup(
      <AgentSteps
        activity={[done({ id: "g", tool: "gdacs_search_events", server: "gdacs", kind: "mcp", durationMs: 2000 })]}
        live
        answerStarted={false}
      />,
    );
    expect(html).toContain('data-testid="agent-step"');
    expect(html).not.toContain('data-testid="agent-step-duration"');
    expect(html).not.toContain("data-share");
    expect(html).not.toContain('data-testid="agent-step-mark"');
  });
});

describe("sandbox terminal", () => {
  const sandbox = (command: string, preview: string, status?: string) =>
    renderToStaticMarkup(
      <AgentSteps
        activity={[done({ id: "e", tool: "execute", args: { command }, preview, status } as never)]}
        live
        answerStarted={false}
      />,
    );

  it("drops the exit line and shows no badge when the code succeeded", () => {
    const html = sandbox("print(1)", "1\n\n[Command succeeded with exit code 0]");
    expect(html).not.toContain("data-exit-code");
    expect(html).toMatch(/data-testid="agent-step-sandbox-output"[^>]*><span>1<\/span><\/pre>/);
  });

  it("uses the danger token for a non-zero exit", () => {
    const html = sandbox("exit(2)", "boom\n[Command failed with exit code 2]");
    expect(html).toMatch(/data-exit-code="2"[^>]*class="[^"]*text-danger-300/);
  });

  it("highlights the code with the JSON tokens", () => {
    const html = renderToStaticMarkup(<HighlightedCode code={'import os  # x\nprint("a", 3)'} />);
    expect(html).toContain('<span data-token="keyword" class="text-json-boolean">import</span>');
    expect(html).toContain('<span data-token="comment" class="italic text-json-null"># x</span>');
    expect(html).toContain('<span data-token="string" class="text-json-string">&quot;a&quot;</span>');
    expect(html).toContain('<span data-token="number" class="text-json-number">3</span>');
  });

  it("renders the badge only for a non-zero exit", () => {
    expect(renderToStaticMarkup(<ExitBadge code={1} />)).toContain(">exit 1<");
    expect(renderToStaticMarkup(<ExitBadge code={0} />)).toBe("");
  });
});
