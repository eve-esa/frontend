// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ToolActivityEntry } from "@/types";
import { buildStepsFromActivity, inputLines } from "@/utilities/agentSteps";
import { AgentSteps, StepResult } from "./AgentSteps";

/**
 * The clean preview (evidence/A1/clean-3-done-expanded.html,
 * clean-4-failed-stopped.html): the opened step reads its input as
 * `key: value` lines with the raw JSON only in Details; a finished subagent
 * folds behind "N steps" with a one-line conclusion; MCP rows carry a plug,
 * never a glyph that reads like the error cross.
 */

afterEach(cleanup);

const entry = (o: Partial<ToolActivityEntry>): ToolActivityEntry => ({ label: "Calling tool", state: "done", ...o });
const rowOf = (o: Partial<ToolActivityEntry>) => buildStepsFromActivity([entry(o)]).rows[0];

describe("inputLines", () => {
  it("prints up to three key: value lines and counts the rest", () => {
    expect(inputLines({ query: "Po delta flood", k: 10, public_collections: ["wiley", "esa"], year: null, filters: { a: 1 } })).toEqual({
      lines: [
        ["query", "Po delta flood"],
        ["k", "10"],
        ["public_collections", "wiley, esa"],
      ],
      more: 1,
    });
  });

  it("skips empty values and gives nothing for a non-object input", () => {
    expect(inputLines({ query: "q", private_collections: [], note: "" })).toEqual({ lines: [["query", "q"]], more: 0 });
    expect(inputLines("plain text")).toBeNull();
    expect(inputLines(["a"])).toBeNull();
    expect(inputLines({})).toBeNull();
  });
});

describe("the opened step input", () => {
  const mcp = rowOf({
    id: "m1",
    tool: "cdse_search_stac",
    server: "cdse",
    kind: "mcp",
    args: { collection: "sentinel-1-grd", bbox: [12.1, 44.7, 12.6, 45.1], limit: 4, datetime: "2024-10-18/2024-10-30" },
    preview: "4 scenes",
  });

  it("is key: value lines with the key muted, three at most, then N more", () => {
    render(<StepResult row={mcp} />);
    const input = screen.getByTestId("agent-step-input");
    expect(input.textContent).toBe("collection: sentinel-1-grd\nbbox: 12.1, 44.7, 12.6, 45.1\nlimit: 4\n1 more");
    const keys = within(input).getAllByTestId("agent-step-input-key");
    expect(keys.map((k) => k.textContent)).toEqual(["collection:", "bbox:", "limit:"]);
    expect(keys[0].className).toContain("text-primary-300");
    // No JSON punctuation in the readable box.
    expect(input.textContent).not.toMatch(/[{}"]/);
  });

  it("opens every input field from N more, then folds them again", () => {
    render(<StepResult row={mcp} />);
    const more = screen.getByTestId("agent-step-input-more");
    expect(more.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(more);
    const input = screen.getByTestId("agent-step-input");
    expect(more.getAttribute("aria-expanded")).toBe("true");
    expect(more.textContent).toBe("Show less");
    expect(within(input).getAllByTestId("agent-step-input-key").map((k) => k.textContent)).toEqual([
      "collection:",
      "bbox:",
      "limit:",
      "datetime:",
    ]);
    fireEvent.click(more);
    expect(input.textContent).toBe("collection: sentinel-1-grd\nbbox: 12.1, 44.7, 12.6, 45.1\nlimit: 4\n1 more");
  });

  it("keeps the raw JSON in Details only, folded by default, and copies the raw input", () => {
    render(<StepResult row={mcp} />);
    expect(screen.queryByTestId("agent-step-input-json")).toBeNull();
    const toggle = screen.getByTestId("agent-step-details-toggle");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    const json = screen.getByTestId("agent-step-input-json");
    expect(JSON.parse(json.textContent ?? "")).toEqual(mcp.input);
    expect(screen.getByTestId("agent-step-meta").textContent).toContain("cdse");
  });

  it("shows no Code or Output tabs", () => {
    render(<StepResult row={mcp} />);
    expect(screen.queryByRole("tab")).toBeNull();
    expect(screen.queryByRole("tablist")).toBeNull();
  });
});

describe("a finished subagent", () => {
  const subagent = (o: Partial<ToolActivityEntry> = {}): ToolActivityEntry =>
    entry({
      id: "s",
      tool: "task",
      kind: "subagent",
      args: { subagent_type: "literature-review", description: "Flood mapping accuracy, C-band SAR, river deltas" },
      subagentRunId: "r1",
      preview:
        "6 papers: 85 to 90 % overall accuracy on open floodwater in deltas, less under vegetation.\n\nDetails follow.",
      ...o,
    });
  const children = [
    entry({ id: "w", tool: "wiley_search_wiley_fulltext", server: "wiley", kind: "mcp", query: "SAR flood accuracy", subagentRunId: "r1" }),
    entry({ id: "k", tool: "eve_retrieval_retrieve", query: "C-band delta", subagentRunId: "r1" }),
  ];
  const openBlock = () => fireEvent.click(screen.getByTestId("agent-steps-toggle"));
  const topRow = () => screen.getAllByTestId("agent-step").filter((r) => !r.hasAttribute("data-nested"))[0];

  it("folds behind N steps with its own one-line conclusion", () => {
    render(<AgentSteps activity={[subagent(), ...children]} live={false} answerStarted />);
    openBlock();
    const row = topRow();
    const count = within(row).getByTestId("agent-step-children-count");
    expect(count.textContent).toBe("2 steps");
    expect(within(row).queryAllByTestId("agent-step")).toHaveLength(0);
    const conclusion = within(row).getByTestId("agent-step-conclusion");
    expect(conclusion.textContent).toBe(
      "6 papers: 85 to 90 % overall accuracy on open floodwater in deltas, less under vegetation.",
    );
    expect(conclusion.className).toContain("text-primary-300");
    expect(conclusion.className).toContain("truncate");
    // One click shows the nested steps.
    fireEvent.click(within(row).getByTestId("agent-step-toggle"));
    expect(within(row).getAllByTestId("agent-step")).toHaveLength(2);
  });

  it("says 1 step for one nested step and shows no count or conclusion while it runs", () => {
    const { rerender } = render(
      <AgentSteps activity={[subagent({ state: "running", preview: undefined }), children[0]]} live answerStarted={false} agentic />,
    );
    expect(within(topRow()).queryByTestId("agent-step-children-count")).toBeNull();
    expect(within(topRow()).queryByTestId("agent-step-conclusion")).toBeNull();
    rerender(<AgentSteps activity={[subagent(), children[0]]} live={false} answerStarted />);
    openBlock();
    expect(within(topRow()).getByTestId("agent-step-children-count").textContent).toBe("1 step");
  });
});

describe("the MCP kind icon", () => {
  it("is a plug, not the crossed screwdriver and wrench that reads like the error cross", () => {
    render(
      <AgentSteps
        activity={[entry({ id: "m", tool: "gdacs_search_events", server: "gdacs", kind: "mcp", query: "flood" })]}
        live
        answerStarted={false}
      />,
    );
    const icon = screen.getByTestId("agent-step-kind-icon");
    expect(icon.getAttribute("data-icon-kind")).toBe("mcp");
    expect(icon.getAttribute("data-icon")).toBe("plug");
    expect(icon.getAttribute("data-icon")).not.toBe("screwdriver-wrench");
  });
});
