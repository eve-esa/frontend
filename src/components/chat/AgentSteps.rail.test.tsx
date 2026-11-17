// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ToolActivityEntry } from "@/types";
import { AgentSteps } from "./AgentSteps";

/**
 * The rail of the steps block belongs to the rows, not to the list: the line
 * runs between the icons on it and stops at the last one (a running or failed
 * row used to leave a stub of line below its icon). jsdom loads no stylesheet,
 * so the contract is read from the classes: every row paints a full-height
 * segment, and a row with a mark on the rail starts its segment at the mark
 * centre when it is the first row and ends it there when it is the last. The
 * measured geometry in a real browser is in the PR evidence.
 */

afterEach(cleanup);

const SEGMENT = ["before:absolute", "before:w-px", "before:bg-primary-400", "before:left-[calc(-0.875rem-1px)]", "before:inset-y-0"];
const STARTS_AT_MARK = "first:before:top-[14px]";
const ENDS_AT_MARK = "last:before:bottom-[calc(100%-14px)]";

const call = (o: Partial<ToolActivityEntry>): ToolActivityEntry => ({ label: "Calling tool", state: "done", ...o });
const search = (id: string, o: Partial<ToolActivityEntry> = {}) =>
  call({ id, tool: "eve_retrieval_retrieve", query: "Po delta flood", preview: "10 documents", ...o });

const openBlock = () => {
  const toggle = screen.getByTestId("agent-steps-toggle");
  if (toggle.getAttribute("aria-expanded") !== "true") fireEvent.click(toggle);
};

const rows = () => screen.getAllByTestId("agent-step");
const classes = (el: HTMLElement) => el.className.split(/\s+/);

describe("the steps rail", () => {
  it("is drawn by the rows: the list has no border and every row paints a full height segment", () => {
    render(
      <AgentSteps
        activity={[search("c1"), search("c2"), call({ id: "c3", tool: "gdacs_search_events", server: "gdacs", state: "running" })]}
        live
        answerStarted={false}
      />,
    );
    const items = rows();
    expect(items).toHaveLength(3);
    const list = items[0].parentElement as HTMLElement;
    expect(list.tagName).toBe("UL");
    expect(classes(list)).not.toContain("border-l");
    for (const row of items) for (const name of SEGMENT) expect(classes(row)).toContain(name);
  });

  it("ends at the spinner while the agent works, and keeps the done rows' line whole", () => {
    render(
      <AgentSteps
        activity={[search("c1"), call({ id: "c2", tool: "gdacs_search_events", server: "gdacs", state: "running" })]}
        live
        answerStarted={false}
      />,
    );
    const [first, last] = rows();
    expect(last.getAttribute("data-status")).toBe("running");
    expect(classes(last)).toContain(ENDS_AT_MARK);
    // The first row has no mark: its line starts at the top of the block and runs on into the next row.
    expect(first.getAttribute("data-status")).toBe("done");
    expect(classes(first)).not.toContain(STARTS_AT_MARK);
    expect(classes(first)).not.toContain(ENDS_AT_MARK);
  });

  it("draws no line at all for a lone running row: its segment starts and ends at the spinner", () => {
    render(
      <AgentSteps
        activity={[call({ id: "c1", tool: "eve_retrieval_retrieve", query: "Po delta", state: "running" })]}
        live
        answerStarted={false}
      />,
    );
    const [only] = rows();
    expect(only.getAttribute("data-status")).toBe("running");
    expect(classes(only)).toContain(STARTS_AT_MARK);
    expect(classes(only)).toContain(ENDS_AT_MARK);
  });

  it("starts at the first icon when the first row is marked", () => {
    render(
      <AgentSteps
        activity={[call({ id: "c1", tool: "wiley_search", server: "wiley", state: "running" }), search("c2")]}
        live
        answerStarted={false}
      />,
    );
    const [first, last] = rows();
    // A marked row carries both variants; the first-child and last-child
    // selectors pick the one that applies, so what matters is its position.
    expect(classes(first)).toContain(STARTS_AT_MARK);
    expect(first.parentElement?.firstElementChild).toBe(first);
    expect(first.parentElement?.lastElementChild).not.toBe(first);
    // A done last row has no icon on the rail: its line runs the whole row.
    expect(last.getAttribute("data-status")).toBe("done");
    expect(classes(last)).not.toContain(STARTS_AT_MARK);
    expect(classes(last)).not.toContain(ENDS_AT_MARK);
  });

  it("ends at the stop mark after a Stop", () => {
    render(
      <AgentSteps
        activity={[search("c1"), call({ id: "c2", tool: "python", kind: "builtin", state: "running" })]}
        live={false}
        answerStarted={false}
        stopped
      />,
    );
    openBlock();
    const last = rows()[rows().length - 1];
    expect(last.getAttribute("data-status")).toBe("stopped");
    expect(classes(last)).toContain(ENDS_AT_MARK);
  });

  it("ends at the model switch mark, which is a mark on the rail too", () => {
    render(
      <AgentSteps
        activity={[
          search("c1"),
          call({ id: "m1", label: "Switched to fallback", kind: "model_fallback", modelFrom: "main", modelTo: "fallback" }),
        ]}
        live={false}
        answerStarted
      />,
    );
    openBlock();
    const last = rows()[rows().length - 1];
    expect(last.getAttribute("data-kind")).toBe("fallback");
    expect(classes(last)).toContain(ENDS_AT_MARK);
    expect(classes(last)).toContain(STARTS_AT_MARK);
  });

  it("keeps the whole line of a finished block: no mark on the rail, nothing to stop at", () => {
    render(<AgentSteps activity={[search("c1"), search("c2")]} live={false} answerStarted />);
    openBlock();
    const items = rows();
    expect(items.map((r) => r.getAttribute("data-status"))).toEqual(["done", "done"]);
    for (const row of items) {
      expect(classes(row)).not.toContain(STARTS_AT_MARK);
      expect(classes(row)).not.toContain(ENDS_AT_MARK);
      for (const name of SEGMENT) expect(classes(row)).toContain(name);
    }
  });

  it("ends a failed row at its cross, with the failed rows still in sight under a folded header", () => {
    render(
      <AgentSteps
        activity={[call({ id: "c1", tool: "wiley_search_wiley_fulltext", server: "wiley", query: "NDWI", state: "done", status: "error", errorCode: "timeout" })]}
        live={false}
        answerStarted
      />,
    );
    const failedList = screen.getByTestId("agent-steps-failed-rows");
    const [row] = Array.from(failedList.querySelectorAll<HTMLElement>('[data-testid="agent-step"]'));
    expect(row.getAttribute("data-status")).toBe("error");
    expect(classes(failedList)).not.toContain("border-l");
    expect(classes(row)).toContain(STARTS_AT_MARK);
    expect(classes(row)).toContain(ENDS_AT_MARK);
  });
});
