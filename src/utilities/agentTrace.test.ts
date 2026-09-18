import { describe, expect, it } from "vitest";
import type { AgenticTraceStep } from "@/types";
import {
  buildTimeline,
  formatDuration,
  isLegacyTrace,
  joinTextBlocks,
  normalizeTrace,
  pairToolCalls,
  parsePythonLiteral,
  parseToolContent,
  truncateForDisplay,
  truncateText,
  type ToolStepView,
} from "./agentTrace";

// Small synthetic traces shaped like the backend's, one per format.
const agentStep = (
  overrides: Partial<AgenticTraceStep> = {},
): AgenticTraceStep => ({
  node: "agent",
  role: "assistant",
  content: "",
  tool_calls: [{ name: "search_docs", args: { query: "sea ice", k: 2 }, id: "call-1" }],
  response_metadata: {
    finish_reason: "tool_calls",
    model_name: "test-model",
    model_provider: "openai",
  },
  usage_metadata: { input_tokens: 1200, output_tokens: 18, total_tokens: 1218 },
  id: "run-1",
  ...overrides,
});

const toolStep = (
  overrides: Partial<AgenticTraceStep> = {},
): AgenticTraceStep => ({
  node: "tools",
  role: "tool",
  name: "search_docs",
  content: '{"hits": [{"title": "Sea ice extent", "score": 0.91}]}',
  tool_call_id: "call-1",
  status: "success",
  id: "tool-1",
  ...overrides,
});

const answerStep = (
  overrides: Partial<AgenticTraceStep> = {},
): AgenticTraceStep => ({
  node: "agent",
  role: "assistant",
  content: "Sea ice extent is **shrinking**.",
  ...overrides,
});

const newTrace: AgenticTraceStep[] = [
  agentStep({ latency_s: 2, started_at_s: 0 }),
  toolStep({ latency_s: 1, started_at_s: 2 }),
  answerStep({ latency_s: 5, started_at_s: 3 }),
];

const legacyTrace: AgenticTraceStep[] = [
  agentStep({ latency_s: 0.00002 }),
  toolStep({
    latency_s: 0.000004,
    content:
      "[{'type': 'text', 'text': '{\"hits\": [{\"title\": \"Earth\\'s albedo\"}]}', 'id': 'lc_0001'}]",
  }),
  answerStep({ latency_s: 19.6 }),
];

describe("parsePythonLiteral", () => {
  it("decodes a single-quoted content block list with the extra id key", () => {
    const decoded = parsePythonLiteral(
      "[{'type': 'text', 'text': 'hello', 'id': 'lc_53aed482-7709'}]",
    );
    expect(decoded).toEqual({
      value: [{ type: "text", text: "hello", id: "lc_53aed482-7709" }],
    });
  });

  it("decodes double-quoted strings, which repr uses when the text has a quote", () => {
    expect(parsePythonLiteral(`["it's", 'say "hi"']`)).toEqual({
      value: ["it's", 'say "hi"'],
    });
  });

  it("decodes the escapes repr writes", () => {
    const decoded = parsePythonLiteral(
      String.raw`'a\'b \\ c\nd\te \x41 é \U0001F600 \101'`,
    );
    expect(decoded).toEqual({ value: "a'b \\ c\nd\te A é \u{1F600} A" });
  });

  it("keeps a JSON escape inside the text as JSON text", () => {
    // repr doubles the backslash of a JSON "°"; decoding restores it.
    const decoded = parsePythonLiteral(String.raw`'{"t": "5\\u00b0C"}'`);
    expect(decoded).toEqual({ value: '{"t": "5\\u00b0C"}' });
    expect(JSON.parse(decoded!.value as string)).toEqual({ t: "5°C" });
  });

  it("decodes nested structures, scalars and trailing commas", () => {
    expect(
      parsePythonLiteral(
        "{'a': [1, -2.5, 3e2, None, True, False], 'b': {'c': ()}, 'd': (1, 'x',), 7: 'seven',}",
      ),
    ).toEqual({
      value: {
        a: [1, -2.5, 300, null, true, false],
        b: { c: [] },
        d: [1, "x"],
        "7": "seven",
      },
    });
  });

  it("returns a literal None as a value, not as a failure", () => {
    expect(parsePythonLiteral("None")).toEqual({ value: null });
  });

  it("keeps a __proto__ key as data", () => {
    const decoded = parsePythonLiteral("{'__proto__': 1}");
    const value = decoded!.value as Record<string, unknown>;
    expect(Object.keys(value)).toEqual(["__proto__"]);
    expect(Object.getPrototypeOf(value)).toBe(Object.prototype);
  });

  it.each([
    ["an unterminated string", "['abc"],
    ["an unclosed list", "[1, 2"],
    ["trailing input", "[1] extra"],
    ["a missing comma", "[1 2]"],
    ["a bare identifier", "[Nonesuch]"],
    ["a bad hex escape", String.raw`'\xZZ'`],
    ["a list as a dict key", "{[1]: 2}"],
    ["a raw line break in a string", "'a\nb'"],
    ["empty input", ""],
  ])("returns null for %s", (_label, input) => {
    expect(parsePythonLiteral(input)).toBeNull();
  });
});

describe("joinTextBlocks", () => {
  it("joins the text blocks and skips the others", () => {
    expect(
      joinTextBlocks([
        { type: "text", text: "one" },
        { type: "image", data: "..." },
        { type: "text", text: "two" },
      ]),
    ).toBe("one\ntwo");
  });

  it("is null for anything that is not a block list", () => {
    expect(joinTextBlocks([{ title: "x" }])).toBeNull();
    expect(joinTextBlocks([{ type: "image" }])).toBeNull();
    expect(joinTextBlocks({ type: "text", text: "x" })).toBeNull();
    expect(joinTextBlocks([])).toBeNull();
  });
});

describe("parseToolContent", () => {
  it("parses new-format JSON content", () => {
    const output = parseToolContent('{"a": 1}');
    expect(output).toMatchObject({ kind: "json", value: { a: 1 } });
  });

  it("decodes a legacy Python repr and parses the JSON inside", () => {
    const output = parseToolContent(legacyTrace[1].content);
    expect(output).toMatchObject({
      kind: "json",
      value: { hits: [{ title: "Earth's albedo" }] },
    });
    if (output.kind === "json") {
      expect(JSON.parse(output.copyText)).toEqual(output.value);
    }
  });

  it("shows the decoded text of a legacy repr when it is not JSON", () => {
    expect(
      parseToolContent("[{'type': 'text', 'text': 'No results.', 'id': 'lc_1'}]"),
    ).toEqual({ kind: "text", text: "No results.", copyText: "No results." });
  });

  it("falls back to the raw string when the repr cannot be decoded", () => {
    const raw = "[{'type': 'text', 'text': 'cut off";
    expect(parseToolContent(raw)).toEqual({ kind: "text", text: raw, copyText: raw });
  });

  it("keeps plain text, including a bare number, as text", () => {
    expect(parseToolContent("Tool failed: timeout")).toMatchObject({ kind: "text" });
    expect(parseToolContent("42")).toMatchObject({ kind: "text", text: "42" });
  });

  it("is empty for missing or blank content", () => {
    expect(parseToolContent(undefined)).toEqual({ kind: "empty" });
    expect(parseToolContent("  ")).toEqual({ kind: "empty" });
  });
});

describe("pairToolCalls", () => {
  it("pairs by tool_call_id, whatever the order", () => {
    const steps: AgenticTraceStep[] = [
      agentStep({
        tool_calls: [
          { name: "a", args: { n: 1 }, id: "id-a" },
          { name: "b", args: { n: 2 }, id: "id-b" },
        ],
      }),
      toolStep({ name: "b", tool_call_id: "id-b" }),
      toolStep({ name: "a", tool_call_id: "id-a" }),
    ];
    const pairs = pairToolCalls(steps);
    expect(pairs.get(1)).toEqual({ name: "b", args: { n: 2 }, id: "id-b" });
    expect(pairs.get(2)).toEqual({ name: "a", args: { n: 1 }, id: "id-a" });
  });

  it("falls back to order, preferring the same tool name", () => {
    const steps: AgenticTraceStep[] = [
      agentStep({
        tool_calls: [
          { name: "a", args: { n: 1 } },
          { name: "b", args: { n: 2 } },
          { name: "a", args: { n: 3 } },
        ],
      }),
      toolStep({ name: "b", tool_call_id: undefined }),
      toolStep({ name: "a", tool_call_id: "unknown-id" }),
      toolStep({ name: "c", tool_call_id: undefined }),
    ];
    const pairs = pairToolCalls(steps);
    expect(pairs.get(1)?.args).toEqual({ n: 2 });
    expect(pairs.get(2)?.args).toEqual({ n: 1 });
    expect(pairs.get(3)?.args).toEqual({ n: 3 });
  });

  it("never pairs a tool step with a call made after it", () => {
    const steps: AgenticTraceStep[] = [
      toolStep({ tool_call_id: undefined }),
      agentStep({ tool_calls: [{ name: "search_docs", args: {} }] }),
    ];
    expect(pairToolCalls(steps).size).toBe(0);
  });
});

describe("isLegacyTrace", () => {
  it("is false when every step is timed", () => {
    expect(isLegacyTrace(newTrace)).toBe(false);
  });

  it("is true without started_at_s, or with a single untimed step", () => {
    expect(isLegacyTrace(legacyTrace)).toBe(true);
    expect(isLegacyTrace([newTrace[0], answerStep({ latency_s: 1 })])).toBe(true);
    expect(isLegacyTrace([])).toBe(true);
  });
});

describe("normalizeTrace", () => {
  it("builds agent, tool and answer views with durations on the new format", () => {
    const view = normalizeTrace(newTrace);
    expect(view.isLegacy).toBe(false);
    expect(view.totalS).toBe(8);
    expect(view.steps.map((step) => [step.kind, step.title, step.durationS])).toEqual([
      ["agent", "Planned next action", 2],
      ["tool", "search_docs", 1],
      ["answer", "Final answer", 5],
    ]);

    const agent = view.steps[0];
    expect(agent).toMatchObject({
      model: "test-model",
      finishReason: "tool_calls",
      inputTokens: 1200,
      outputTokens: 18,
    });

    const tool = view.steps[1] as ToolStepView;
    expect(tool.status).toBe("success");
    expect(tool.input).toEqual({ query: "sea ice", k: 2 });
    expect(tool.output).toMatchObject({ kind: "json" });
  });

  it("drops durations on a legacy trace but still decodes it", () => {
    const view = normalizeTrace(legacyTrace);
    expect(view.isLegacy).toBe(true);
    expect(view.totalS).toBeNull();
    expect(view.steps.every((step) => step.durationS === null)).toBe(true);
    const tool = view.steps[1] as ToolStepView;
    expect(tool.input).toEqual({ query: "sea ice", k: 2 });
    expect(tool.output).toMatchObject({
      kind: "json",
      value: { hits: [{ title: "Earth's albedo" }] },
    });
  });

  it("keeps unknown roles and odd entries as generic steps", () => {
    const view = normalizeTrace([
      { role: "system", node: "guard" },
      "not an object",
    ]);
    expect(view.steps.map((step) => [step.kind, step.kindLabel, step.title])).toEqual([
      ["other", "System", "guard"],
      ["other", "Step", "Unknown step"],
    ]);
  });
});

describe("buildTimeline", () => {
  it("places segments by start and sizes them by duration", () => {
    const timeline = buildTimeline(normalizeTrace(newTrace));
    expect(timeline?.totalS).toBe(8);
    expect(
      timeline?.segments.map((segment) => [
        segment.kind,
        segment.leftPct,
        segment.widthPct,
      ]),
    ).toEqual([
      ["agent", 0, 25],
      ["tool", 25, 12.5],
      ["answer", 37.5, 62.5],
    ]);
  });

  it("is null for a legacy trace or a trace with no elapsed time", () => {
    expect(buildTimeline(normalizeTrace(legacyTrace))).toBeNull();
    expect(
      buildTimeline(
        normalizeTrace([answerStep({ latency_s: 0, started_at_s: 0 })]),
      ),
    ).toBeNull();
  });
});

describe("display truncation", () => {
  it("cuts long strings and says how much was left out", () => {
    expect(truncateText("abcdef", 4)).toBe("abcd... (+2 chars)");
    expect(truncateText("abcd", 4)).toBe("abcd");
    expect(truncateText("x".repeat(1304), 300)).toBe(
      `${"x".repeat(300)}... (+1,004 chars)`,
    );
  });

  it("cuts every long string in a nested value and leaves the rest alone", () => {
    const value = { a: "123456", b: [{ c: "12" }, 7, null], d: true };
    expect(truncateForDisplay(value, 3)).toEqual({
      a: "123... (+3 chars)",
      b: [{ c: "12" }, 7, null],
      d: true,
    });
    // The original is untouched: the copy button copies it in full.
    expect(value.a).toBe("123456");
  });
});

describe("formatDuration", () => {
  it.each([
    [0.42, "420 ms"],
    [2.14, "2.14 s"],
    [12.345, "12.3 s"],
    [65.2, "1 min 05 s"],
    [119.7, "2 min 00 s"],
  ])("formats %s seconds as %s", (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });
});
