import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AgenticTraceStep } from "@/types";
import { normalizeTrace, type TraceStepView } from "@/utilities/agentTrace";
import { TraceStepCard } from "./TraceStepCard";

/**
 * renderToStaticMarkup, like ApiKeyRow.test.tsx: vitest runs in a Node
 * environment with no DOM. Effects do not run, which is fine here: what is
 * checked is the markup a card starts with.
 */
const longText = "x".repeat(450);

const trace: AgenticTraceStep[] = [
  {
    node: "agent",
    role: "assistant",
    content: "",
    tool_calls: [{ name: "search_docs", args: { query: "sea ice" }, id: "call-1" }],
    latency_s: 2,
    started_at_s: 0,
  },
  {
    node: "tools",
    role: "tool",
    name: "search_docs",
    content: JSON.stringify({ hits: [{ title: "Sea ice", text: longText }] }),
    tool_call_id: "call-1",
    status: "error",
    latency_s: 1.27,
    started_at_s: 2,
  },
];

const noop = () => undefined;

const render = (step: TraceStepView, open = true) =>
  renderToStaticMarkup(
    <ol>
      <TraceStepCard step={step} open={open} onOpenChange={noop} />
    </ol>,
  );

describe("TraceStepCard", () => {
  const view = normalizeTrace(trace);
  const toolStep = view.steps[1];

  it("shows the header of a tool step: number, kind, title, status, duration", () => {
    const html = render(toolStep);
    expect(html).toContain("Step 2");
    expect(html).toContain(">Tool<");
    expect(html).toContain("search_docs");
    expect(html).toContain("Error");
    expect(html).toContain("1.27 s");
  });

  it("shows the paired input and a copyable output", () => {
    const html = render(toolStep);
    expect(html).toContain('aria-label="Tool input"');
    expect(html).toContain("sea ice");
    expect(html).toContain('aria-label="Copy input"');
    expect(html).toContain('aria-label="Copy output"');
  });

  it("starts the output collapsed below the top level", () => {
    const html = render(toolStep);
    expect(html).toContain('aria-label="Tool output"');
    expect(html).toContain("hits");
    // The hit itself is behind a collapsed node, so its text is not rendered.
    expect(html).not.toContain("Sea ice");
  });

  it("renders only the header while closed", () => {
    const html = render(toolStep, false);
    expect(html).toContain("search_docs");
    expect(html).not.toContain('aria-label="Tool output"');
  });

  it("shows no duration on a legacy trace", () => {
    const legacy = normalizeTrace(
      trace.map((step) => ({ ...step, started_at_s: undefined })),
    );
    expect(render(legacy.steps[1])).not.toContain("1.27 s");
  });
});
