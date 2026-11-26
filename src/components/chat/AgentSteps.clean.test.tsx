// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolActivityEntry } from "@/types";
import { AgentSteps } from "./AgentSteps";

/**
 * Decision 0003: no per-row duration and no check on finished rows; a status
 * mark only for running, failed, stopped and not run; the header carries the
 * total; the block folds when the turn ends unless the user toggled it.
 */

const search: ToolActivityEntry = {
  label: "Calling tool",
  state: "done",
  id: "k1",
  tool: "eve_retrieval_retrieve",
  query: "Po delta flood",
  preview: JSON.stringify({ retrieved_docs: [{ title: "Floods in the Po delta", year: 2020 }] }),
  durationMs: 2100,
};
const running: ToolActivityEntry = { ...search, id: "k2", state: "running", preview: undefined, durationMs: undefined };
const mcp: ToolActivityEntry = {
  label: "Calling tool",
  state: "done",
  id: "m1",
  tool: "cdse_search_stac",
  server: "cdse",
  kind: "mcp",
  query: "Sentinel-2 Po",
  durationMs: 1400,
};
const exec = (preview: string): ToolActivityEntry => ({
  label: "Calling tool",
  state: "done",
  id: "e1",
  tool: "execute",
  kind: "builtin",
  args: { code: "print(3**50)" },
  preview,
  durationMs: 900,
});

type Props = Parameters<typeof AgentSteps>[0];
const live: Props = { activity: [search], live: true, answerStarted: false, agentic: true };
const block = () => screen.getByTestId("agent-steps");
const head = () => screen.getByTestId("agent-steps-summary-head").textContent;
const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });
/** Text a sighted user reads: screen reader only spans left out. */
const visible = (el: HTMLElement) => {
  const copy = el.cloneNode(true) as HTMLElement;
  copy.querySelectorAll(".sr-only").forEach((n) => n.remove());
  return (copy.textContent ?? "").replace(/\s+/g, " ").trim();
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-13T10:00:00Z"));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("finished rows carry no duration and no check", () => {
  it("shows no duration text, no duration bar and no status mark on a done row", () => {
    render(<AgentSteps activity={[search, mcp]} live={false} answerStarted />);
    fireEvent.click(screen.getByTestId("agent-steps-toggle"));
    for (const row of screen.getAllByTestId("agent-step")) {
      expect(within(row).queryByTestId("agent-step-duration")).toBeNull();
      expect(within(row).queryByTestId("agent-step-duration-bar")).toBeNull();
      expect(within(row).queryByTestId("agent-step-mark")).toBeNull();
      expect(visible(within(row).getByTestId("agent-step-toggle"))).not.toMatch(/\d(\.\d)? ?s\b/);
    }
  });

  it("marks running, failed and stopped rows, each with its own mark", () => {
    const failed: ToolActivityEntry = { ...mcp, id: "f1", status: "error", preview: "boom" };
    render(<AgentSteps {...live} activity={[failed, running]} />);
    const rows = screen.getAllByTestId("agent-step");
    expect(within(rows[0]).getByTestId("agent-step-mark").getAttribute("data-mark")).toBe("error");
    expect(within(rows[1]).getByTestId("agent-step-mark").getAttribute("data-mark")).toBe("running");
    cleanup();
    render(<AgentSteps {...live} activity={[running]} stopped />);
    fireEvent.click(screen.getByTestId("agent-steps-toggle"));
    expect(screen.getByTestId("agent-step-mark").getAttribute("data-mark")).toBe("stopped");
  });
});

describe("rows read verb, chip, muted detail", () => {
  it("puts the verb first, the tool as a borderless chip and the server as muted secondary text", () => {
    render(<AgentSteps activity={[mcp]} live={false} answerStarted />);
    fireEvent.click(screen.getByTestId("agent-steps-toggle"));
    const row = screen.getByTestId("agent-step");
    expect(visible(within(row).getByTestId("agent-step-toggle"))).toMatch(/^Called search_stac/);
    const chip = within(row).getByTestId("agent-step-target");
    expect(chip.textContent).toBe("search_stac");
    expect(chip.className).not.toMatch(/\bborder\b/);
    expect(within(row).getByTestId("agent-step-server").textContent).toBe("in cdse");
  });

  it("draws one muted icon per kind", () => {
    render(<AgentSteps activity={[search, mcp, exec("ok")]} live={false} answerStarted />);
    fireEvent.click(screen.getByTestId("agent-steps-toggle"));
    const icons = screen.getAllByTestId("agent-step-kind-icon");
    expect(icons.map((i) => i.getAttribute("data-icon-kind"))).toEqual(["knowledge-base", "mcp", "code"]);
    for (const icon of icons) expect(icon.getAttribute("class")).toContain("text-primary-300");
  });
});

describe("header copy per state", () => {
  it("reads Working with a live timer, then Worked for Ns", () => {
    const { rerender } = render(<AgentSteps {...live} />);
    expect(screen.getByTestId("agent-steps-working").textContent).toBe("Working");
    expect(screen.getByTestId("agent-steps-clock")).toBeTruthy();
    advance(18_000);
    // The first answer token does not end the run: still working.
    rerender(<AgentSteps {...live} answerStarted />);
    expect(screen.queryByTestId("agent-steps-summary-head")).toBeNull();
    expect(screen.getByTestId("agent-steps-clock")).toBeTruthy();
    rerender(<AgentSteps {...live} live={false} answerStarted />);
    expect(head()).toBe("Worked for 18s");
  });

  it("reads Stopped after Ns on a Stop", () => {
    const { rerender } = render(<AgentSteps {...live} activity={[running]} />);
    advance(14_000);
    rerender(<AgentSteps {...live} activity={[running]} stopped />);
    expect(head()).toBe("Stopped after 14s");
  });

  it("adds N failed in the danger token", () => {
    const failed: ToolActivityEntry = { ...mcp, status: "error", preview: "boom" };
    render(<AgentSteps activity={[search, failed]} live={false} answerStarted />);
    expect(screen.getByTestId("agent-steps-failed").textContent).toBe("1 failed");
    expect(screen.getByTestId("agent-steps-failed").className).toContain("text-danger-300");
  });
});

describe("code box", () => {
  it("hides the exit code when it is 0 and shows exit N otherwise", () => {
    render(<AgentSteps activity={[exec("717\n[Command succeeded with exit code 0]")]} live={false} answerStarted />);
    fireEvent.click(screen.getByTestId("agent-steps-toggle"));
    expect(screen.queryByTestId("agent-step-exit")).toBeNull();
    cleanup();
    render(<AgentSteps activity={[exec("Traceback\n[Command failed with exit code 2]")]} live={false} answerStarted />);
    fireEvent.click(screen.getByTestId("agent-steps-toggle"));
    expect(screen.getByTestId("agent-step-exit").textContent).toBe("exit 2");
  });

  it("caps the output at 256px with a copy button inside and no $ prefix", () => {
    render(<AgentSteps activity={[exec("717")]} live={false} answerStarted />);
    fireEvent.click(screen.getByTestId("agent-steps-toggle"));
    const out = screen.getByTestId("agent-step-sandbox-output");
    expect(out.className).toContain("max-h-64");
    expect(out.className).toContain("font-mono");
    expect(out.className).toContain("text-[12px]");
    expect(screen.getByTestId("agent-step-copy-output")).toBeTruthy();
    expect(out.textContent?.startsWith("$")).toBe(false);
  });
});

describe("auto fold", () => {
  it("folds when the agent work ends", () => {
    const { rerender } = render(<AgentSteps {...live} />);
    expect(block().getAttribute("data-state")).toBe("open");
    rerender(<AgentSteps {...live} answerStarted />);
    expect(block().getAttribute("data-state")).toBe("closed");
  });

  it("folds after a Stop and after a failure too", () => {
    const { rerender } = render(<AgentSteps {...live} activity={[running]} />);
    rerender(<AgentSteps {...live} activity={[running]} stopped />);
    expect(block().getAttribute("data-state")).toBe("closed");
    cleanup();
    const failed: ToolActivityEntry = { ...mcp, status: "error", preview: "boom" };
    const second = render(<AgentSteps {...live} activity={[failed]} />);
    second.rerender(<AgentSteps {...live} activity={[failed]} live={false} failed />);
    expect(block().getAttribute("data-state")).toBe("closed");
  });

  it("keeps the user's choice when they toggled it during the turn", () => {
    const { rerender } = render(<AgentSteps {...live} />);
    fireEvent.click(screen.getByTestId("agent-steps-toggle"));
    fireEvent.click(screen.getByTestId("agent-steps-toggle"));
    expect(block().getAttribute("data-state")).toBe("open");
    rerender(<AgentSteps {...live} answerStarted />);
    expect(block().getAttribute("data-state")).toBe("open");
  });

  it("stays folded on reload, also for a failed or stopped run", () => {
    const failed: ToolActivityEntry = { ...mcp, status: "error", preview: "boom" };
    render(<AgentSteps activity={[search, failed]} live={false} answerStarted />);
    expect(block().getAttribute("data-state")).toBe("closed");
    cleanup();
    render(<AgentSteps activity={[running]} live={false} answerStarted={false} stopped />);
    expect(block().getAttribute("data-state")).toBe("closed");
  });
});
