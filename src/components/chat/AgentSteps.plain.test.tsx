// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ToolActivityEntry } from "@/types";
import { buildCollectionCatalog, summarizeRows, summaryText, buildStepsFromActivity } from "@/utilities/agentSteps";
import { stepLine, stepSentence } from "@/utilities/stepLabels";
import { AgentSteps } from "./AgentSteps";

/**
 * Decision 0007: steps name things the way the reader does. One count in the
 * header (steps, plus failures), "EVE sources" for the retrieval row, the
 * language for a code row, and no numbers in the retrieval output list.
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
  preview: docs(3),
  durationMs: 2100,
  requestCollections: { public_collections: ["wiley"], private_collections: [] },
};
const exec = (args: Record<string, unknown>): ToolActivityEntry => ({
  label: "Calling tool",
  state: "done",
  id: `e-${JSON.stringify(args).length}`,
  tool: "execute",
  kind: "builtin",
  args,
  preview: "ok\n[Command succeeded with exit code 0]",
  durationMs: 4800,
});
const failedExec: ToolActivityEntry = {
  ...exec({ command: "python a.py" }),
  id: "e-fail",
  status: "error",
  preview: "boom\n[Command failed with exit code 1]",
};

const words = (el: HTMLElement) => (el.textContent ?? "").replace(/\s+/g, " ").trim();
const rowOf = (el: HTMLElement) => within(el).getByTestId("agent-step-toggle");
const chipsOf = (row: HTMLElement) => within(row).getAllByTestId("agent-step-target").map((c) => c.textContent);

describe("the header counts steps only", () => {
  it("reads Worked, 2 steps with no tool count", () => {
    render(<AgentSteps activity={[kbDone, exec({ command: "python a.py" })]} live={false} answerStarted />);
    const summary = screen.getByTestId("agent-steps-summary");
    expect(words(summary)).toBe("Worked, 2 steps");
    expect(words(summary)).not.toMatch(/tools?\b/);
    expect(words(screen.getByTestId("agent-steps-announce"))).not.toMatch(/tools?\b/);
  });

  it("adds 1 failed in the danger token, still without tools", () => {
    render(<AgentSteps activity={[kbDone, failedExec]} live={false} answerStarted />);
    const summary = screen.getByTestId("agent-steps-summary");
    expect(words(summary)).toBe("Worked, 2 steps, 1 failed");
    expect(screen.getByTestId("agent-steps-failed").className).toContain("text-danger-300");
  });

  it("summaryText never names tools", () => {
    const view = buildStepsFromActivity([kbDone, exec({ code: "print(1)" })]);
    expect(summaryText(summarizeRows(view.rows, 6))).toBe("Worked for 6s, 2 steps");
    expect(summaryText(summarizeRows(view.rows.slice(0, 1), 14), { stopped: true, stoppedAfterS: 14 })).toBe(
      "Stopped after 14s, 1 step",
    );
  });
});

describe("the retrieval row says EVE sources", () => {
  it("expanded: the chip is EVE sources, the tool id stays in Details", () => {
    render(<AgentSteps activity={[kbDone]} live={false} answerStarted collections={catalog} />);
    fireEvent.click(screen.getByTestId("agent-steps-toggle"));
    const row = rowOf(screen.getByTestId("agent-step"));
    expect(chipsOf(row)).toEqual(["EVE sources"]);
    expect(words(row)).not.toContain("eve_retrieval");
    fireEvent.click(row);
    fireEvent.click(screen.getByTestId("agent-step-details-toggle"));
    expect(words(screen.getByTestId("agent-step-meta"))).toContain("eve_retrieval");
  });

  it("folded live: the header chip and its screen reader text say EVE sources", () => {
    const running: ToolActivityEntry = { ...kbDone, state: "running", preview: undefined, durationMs: undefined };
    render(<AgentSteps activity={[running]} live answerStarted={false} agentic collections={catalog} />);
    // The live block opens on its own; folded is the user's choice.
    fireEvent.click(screen.getByTestId("agent-steps-toggle"));
    const activity = screen.getByTestId("agent-steps-activity");
    expect(within(activity).getByTestId("agent-step-target").textContent).toBe("EVE sources");
    expect(words(activity)).toContain("Searching EVE sources");
  });

  it("the sentence for assistive tech uses the same name", () => {
    const [row] = buildStepsFromActivity([kbDone]).rows;
    expect(stepSentence(row, catalog)).toMatch(/^Searched EVE sources for "Sentinel-3 OLCI", done/);
  });
});

describe("a code row names its language", () => {
  const chipFor = (args: Record<string, unknown>) => {
    const [row] = buildStepsFromActivity([exec(args)]).rows;
    return stepLine(row).targets.map((t) => t.label);
  };

  it("Python for a python command or Python code", () => {
    expect(chipFor({ command: "python a.py" })).toEqual(["Python"]);
    expect(chipFor({ command: "python3 -c 'print(1)'" })).toEqual(["Python"]);
    expect(chipFor({ code: "import numpy as np\nprint(np.pi)" })).toEqual(["Python"]);
  });

  it("shell for any other command, never sandbox", () => {
    expect(chipFor({ command: "ls -la /data" })).toEqual(["shell"]);
    expect(chipFor({ command: "pip install rasterio" })).toEqual(["shell"]);
  });

  it("the rendered row shows the language chip and the first command line", () => {
    render(<AgentSteps activity={[exec({ command: "python a.py\necho done" })]} live={false} answerStarted />);
    fireEvent.click(screen.getByTestId("agent-steps-toggle"));
    const row = rowOf(screen.getByTestId("agent-step"));
    expect(chipsOf(row)).toEqual(["Python"]);
    expect(within(row).getByTestId("agent-step-detail").textContent).toBe("python a.py");
    expect(words(row)).not.toContain("sandbox");
  });
});

describe("the retrieval output list has no numbers", () => {
  it("lists titles as plain lines", () => {
    render(<AgentSteps activity={[kbDone]} live={false} answerStarted collections={catalog} />);
    fireEvent.click(screen.getByTestId("agent-steps-toggle"));
    fireEvent.click(rowOf(screen.getByTestId("agent-step")));
    const preview = screen.getByTestId("agent-step-output-preview");
    const lines = (preview.textContent ?? "").split("\n").filter(Boolean);
    expect(lines[0]).toBe("Paper 1 (2020)");
    for (const line of lines) expect(line).not.toMatch(/^\s*\d+[.)]\s/);
  });
});
