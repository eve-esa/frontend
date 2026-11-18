// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ToolActivityEntry } from "@/types";
import { AgentSteps } from "./AgentSteps";

/** What a sighted user reads on a row: screen reader only spans left out. */
const visible = (el: HTMLElement) => {
  const copy = el.cloneNode(true) as HTMLElement;
  copy.querySelectorAll(".sr-only").forEach((n) => n.remove());
  return (copy.textContent ?? "").replace(/\s+/g, " ").trim();
};

/** The block folds once the turn ends: open it to read the rows. */
const open = () => fireEvent.click(screen.getByTestId("agent-steps-toggle"));

const builtin = (tool: string, args: Record<string, unknown>): ToolActivityEntry => ({
  label: "Calling tool",
  state: "done",
  id: `b-${tool}`,
  tool,
  kind: "builtin",
  args,
  preview: "ok",
  durationMs: 900,
});

afterEach(cleanup);

describe("a row parts its verb from what follows", () => {
  it.each([
    ["write_file", { file_path: "workspace/count.py", content: "print(1)" }, "Wrote workspace/count.py"],
    ["read_file", { file_path: "workspace/count.py" }, "Read workspace/count.py"],
    ["edit_file", { file_path: "workspace/count.py", old_string: "a", new_string: "b" }, "Edited workspace/count.py"],
  ])("%s", (tool, args, expected) => {
    render(<AgentSteps activity={[builtin(tool, args)]} live={false} answerStarted />);
    open();
    const title = screen.getByTestId("agent-step-title");
    expect(visible(title)).toBe(expected);
    // The space sits outside the verb's nowrap box, where it is not collapsed.
    const head = within(title).getByTestId("agent-step-head");
    expect(head.nextSibling?.textContent).toBe(" ");
    expect(head.nextSibling).toBe(within(title).getByTestId("agent-step-detail").previousSibling);
  });

  it("keeps one gap, not two, when the row has a chip", () => {
    const search: ToolActivityEntry = {
      label: "Calling tool",
      state: "done",
      id: "s1",
      tool: "eve_retrieval_retrieve",
      query: "Po delta",
      durationMs: 1200,
    };
    render(<AgentSteps activity={[search]} live={false} answerStarted />);
    open();
    const title = screen.getByTestId("agent-step-title");
    expect(visible(title)).toBe('Searched EVE sources"Po delta"');
  });
});
