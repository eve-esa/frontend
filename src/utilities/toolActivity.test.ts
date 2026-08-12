import { describe, expect, it } from "vitest";
import { applyToolCall, applyToolResult } from "./toolActivity";
import type { ToolActivityEntry } from "@/types";

describe("applyToolCall", () => {
  it("appends a running entry with the structured fields", () => {
    expect(
      applyToolCall(undefined, {
        type: "tool_call",
        tool: "dummy_get_text_summary",
        label: "Calling dummy get text summary",
        query: "solar wind",
      }),
    ).toEqual([
      {
        label: "Calling dummy get text summary",
        tool: "dummy_get_text_summary",
        query: "solar wind",
        state: "running",
      },
    ]);
  });

  it("falls back to content, then to a generic label, on old backends", () => {
    const fromContent = applyToolCall([], {
      type: "tool_call",
      content: "Calling tool effis_compute_metrics",
    });
    expect(fromContent[0].label).toBe("Calling tool effis_compute_metrics");
    expect(fromContent[0].tool).toBeUndefined();
    expect(fromContent[0].query).toBeUndefined();

    expect(applyToolCall([], { type: "tool_call" })[0].label).toBe(
      "Calling tool",
    );
  });

  it("does not mutate the previous activity array", () => {
    const before: ToolActivityEntry[] = [
      { label: "Calling a", tool: "a", state: "running" },
    ];
    const after = applyToolCall(before, { type: "tool_call", tool: "b" });
    expect(before).toHaveLength(1);
    expect(after).toHaveLength(2);
    expect(after).not.toBe(before);
  });
});

describe("applyToolResult", () => {
  it("completes the matching entry when two different tools run", () => {
    let activity = applyToolCall(undefined, { tool: "search", label: "a" });
    activity = applyToolCall(activity, { tool: "summarize", label: "b" });

    const after = applyToolResult(activity, { tool: "summarize" });
    expect(after.map((e) => [e.tool, e.state])).toEqual([
      ["search", "running"],
      ["summarize", "done"],
    ]);
    // The input array and its entries are left untouched.
    expect(activity[1].state).toBe("running");
  });

  it("completes the oldest running entry when the result has no tool", () => {
    let activity = applyToolCall(undefined, { tool: "search", label: "a" });
    activity = applyToolCall(activity, { tool: "summarize", label: "b" });

    const after = applyToolResult(activity, { status: "ok" });
    expect(after.map((e) => e.state)).toEqual(["done", "running"]);
  });

  it("is a no-op when nothing is running", () => {
    expect(applyToolResult(undefined, { tool: "search" })).toEqual([]);

    const settled: ToolActivityEntry[] = [
      { label: "a", tool: "search", state: "done" },
    ];
    expect(applyToolResult(settled, { tool: "search" })).toBe(settled);
  });

  it("completes repeated calls to the same tool in order", () => {
    let activity = applyToolCall(undefined, { tool: "search", query: "one" });
    activity = applyToolCall(activity, { tool: "search", query: "two" });

    activity = applyToolResult(activity, { tool: "search" });
    expect(activity.map((e) => [e.query, e.state])).toEqual([
      ["one", "done"],
      ["two", "running"],
    ]);

    activity = applyToolResult(activity, { tool: "search" });
    expect(activity.map((e) => e.state)).toEqual(["done", "done"]);
  });
});
