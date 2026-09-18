import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildTimeline, normalizeTrace } from "@/utilities/agentTrace";
import { TraceTimeline } from "./TraceTimeline";

const timeline = buildTimeline(
  normalizeTrace([
    {
      role: "assistant",
      tool_calls: [{ name: "search_docs", args: {}, id: "c1" }],
      latency_s: 2,
      started_at_s: 0,
    },
    {
      role: "tool",
      name: "search_docs",
      content: "ok",
      tool_call_id: "c1",
      latency_s: 1,
      started_at_s: 2,
    },
    { role: "assistant", content: "Done.", latency_s: 5, started_at_s: 3 },
  ]),
)!;

const render = () =>
  renderToStaticMarkup(
    <TraceTimeline timeline={timeline} onSelectStep={() => undefined} />,
  );

describe("TraceTimeline", () => {
  it("labels every segment with its step, kind, title and duration", () => {
    const html = render();
    expect(html).toContain('aria-label="Step 1, Agent, Planned next action, 2.00 s"');
    expect(html).toContain('aria-label="Step 2, Tool, search_docs, 1.00 s"');
    expect(html).toContain('aria-label="Step 3, Answer, Final answer, 5.00 s"');
    expect(html).toContain('aria-label="Timeline, 8.00 s in total"');
  });

  it("places segments proportionally", () => {
    const html = render();
    expect(html).toContain("left:25%;width:12.5%");
    expect(html).toContain("left:37.5%;width:62.5%");
  });

  it("has a legend with the kinds present", () => {
    const html = render();
    for (const label of ["Agent", "Tool", "Answer"]) {
      expect(html).toContain(label);
    }
    expect(html).not.toContain(">Other<");
  });
});
