import type { AgenticTraceStep } from "@/types";

/**
 * View model for the Agent trace panel. Everything the panel shows is derived
 * here, from the loosely typed `message.trace`, so the components only lay it
 * out.
 *
 * Two formats reach the frontend:
 * - new: every step has `started_at_s` (offset from the start of the
 *   generation) and a real `latency_s`; tool content is the tool result as a
 *   plain string.
 * - legacy (already persisted in every environment): no `started_at_s`, a
 *   `latency_s` that is wrong (near zero), and tool content stored as the
 *   Python repr of the MCP content blocks, e.g.
 *   `[{'type': 'text', 'text': '{"retrieved_docs": ...}', 'id': 'lc_...'}]`.
 *   Durations and the timeline are hidden for these.
 */

export type TraceStepKind = "agent" | "tool" | "answer" | "other";

export type ToolStatus = "success" | "error";

export type ToolOutput =
  | { kind: "empty" }
  | { kind: "json"; value: unknown; copyText: string }
  | { kind: "text"; text: string; copyText: string };

export type AgentToolCall = {
  name: string;
  args: unknown;
  id: string | null;
};

type TraceStepBase = {
  /** 0-based position in `message.trace`. */
  index: number;
  /** 1-based, what the panel shows as "Step N". */
  number: number;
  kindLabel: string;
  title: string;
  node: string | null;
  /** Seconds. Null on legacy traces, where the stored value is wrong. */
  durationS: number | null;
  /** Seconds from the start of the generation. Null on legacy traces. */
  startS: number | null;
  raw: AgenticTraceStep;
};

export type AgentStepView = TraceStepBase & {
  kind: "agent";
  content: string;
  toolCalls: AgentToolCall[];
  model: string | null;
  finishReason: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
};

export type ToolStepView = TraceStepBase & {
  kind: "tool";
  name: string;
  status: ToolStatus | null;
  toolCallId: string | null;
  /**
   * The arguments of the agent tool call this result answers. Tool steps do
   * not carry them: they are paired from the agent step by `tool_call_id`,
   * falling back to order. Undefined when no call matches.
   */
  input: unknown;
  output: ToolOutput;
};

export type AnswerStepView = TraceStepBase & {
  kind: "answer";
  content: string;
};

export type OtherStepView = TraceStepBase & { kind: "other" };

export type TraceStepView =
  | AgentStepView
  | ToolStepView
  | AnswerStepView
  | OtherStepView;

export type TraceView = {
  steps: TraceStepView[];
  /** True when the trace carries no usable timing (see the module comment). */
  isLegacy: boolean;
  /** End of the last step, in seconds. Null on legacy traces. */
  totalS: number | null;
};

export const TRACE_KIND_LABELS: Record<
  Exclude<TraceStepKind, "other">,
  string
> = {
  agent: "Agent",
  tool: "Tool",
  answer: "Answer",
};

// Strings longer than this are cut in the JSON tree: none of the tree
// viewers virtualise, and a single retrieval result holds tens of thousands
// of characters. The copy button still copies the full value.
export const DISPLAY_STRING_LIMIT = 300;
// Same idea for a tool output that is plain text rather than JSON.
export const DISPLAY_TEXT_LIMIT = 4000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isContainer = (value: unknown): value is object =>
  typeof value === "object" && value !== null;

const isFiniteNonNegative = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

const readString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() !== "" ? value : null;

const readNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

// ---------------------------------------------------------------------------
// Python literal decoder
// ---------------------------------------------------------------------------

const MAX_LITERAL_DEPTH = 256;

class PythonLiteralError extends Error {}

const isDigit = (ch: string | undefined): boolean =>
  ch !== undefined && ch >= "0" && ch <= "9";

const isIdentifierChar = (ch: string | undefined): boolean =>
  ch !== undefined && /[A-Za-z0-9_]/.test(ch);

const isHex = (text: string): boolean => /^[0-9a-fA-F]+$/.test(text);

const NUMBER_PATTERN = /[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/y;

const SIMPLE_ESCAPES: Record<string, string> = {
  "\\": "\\",
  "'": "'",
  '"': '"',
  n: "\n",
  r: "\r",
  t: "\t",
  a: "\x07",
  b: "\b",
  f: "\f",
  v: "\v",
};

/**
 * Decodes a Python literal as `repr()` writes it: lists, tuples (as arrays),
 * dicts, str (single or double quoted, with Python escapes), int, float,
 * None, True and False. Anything else, or trailing input, is malformed.
 *
 * Returns `{ value }` so a literal `None` (null) stays distinguishable from a
 * failed decode, which returns null.
 */
export const parsePythonLiteral = (
  input: string,
): { value: unknown } | null => {
  const text = input;
  let pos = 0;

  const fail = (): never => {
    throw new PythonLiteralError();
  };

  const skipWhitespace = () => {
    while (pos < text.length && /\s/.test(text[pos])) pos++;
  };

  const readHexEscape = (length: number): string => {
    const digits = text.slice(pos, pos + length);
    if (digits.length !== length || !isHex(digits)) fail();
    pos += length;
    const codePoint = parseInt(digits, 16);
    if (codePoint > 0x10ffff) fail();
    return String.fromCodePoint(codePoint);
  };

  const parseString = (): string => {
    const quote = text[pos];
    pos++;
    let result = "";
    let chunkStart = pos;

    while (pos < text.length) {
      const ch = text[pos];
      if (ch === quote) {
        result += text.slice(chunkStart, pos);
        pos++;
        return result;
      }
      // A raw line break cannot appear in a single-line Python string.
      if (ch === "\n" || ch === "\r") fail();
      if (ch !== "\\") {
        pos++;
        continue;
      }

      result += text.slice(chunkStart, pos);
      pos++;
      const escape = text[pos];
      if (escape === undefined) fail();
      pos++;

      if (Object.prototype.hasOwnProperty.call(SIMPLE_ESCAPES, escape)) {
        result += SIMPLE_ESCAPES[escape];
      } else if (escape === "x") {
        result += readHexEscape(2);
      } else if (escape === "u") {
        result += readHexEscape(4);
      } else if (escape === "U") {
        result += readHexEscape(8);
      } else if (escape >= "0" && escape <= "7") {
        let octal = escape;
        while (
          octal.length < 3 &&
          text[pos] !== undefined &&
          text[pos] >= "0" &&
          text[pos] <= "7"
        ) {
          octal += text[pos];
          pos++;
        }
        result += String.fromCharCode(parseInt(octal, 8));
      } else if (escape === "\n") {
        // Line continuation: both characters vanish.
      } else {
        // Python keeps unknown escapes as written, backslash included.
        result += `\\${escape}`;
      }
      chunkStart = pos;
    }

    return fail();
  };

  const parseNumber = (): number => {
    NUMBER_PATTERN.lastIndex = pos;
    const match = NUMBER_PATTERN.exec(text);
    if (!match || match[0] === "" || match[0] === "+" || match[0] === "-") {
      fail();
    }
    const literal = match![0];
    pos += literal.length;
    if (isIdentifierChar(text[pos])) fail();
    const value = Number(literal);
    if (!Number.isFinite(value)) fail();
    return value;
  };

  const parseKeyword = (): unknown => {
    for (const [word, value] of [
      ["None", null],
      ["True", true],
      ["False", false],
    ] as const) {
      if (text.startsWith(word, pos) && !isIdentifierChar(text[pos + word.length])) {
        pos += word.length;
        return value;
      }
    }
    return fail();
  };

  const parseSequence = (close: "]" | ")", depth: number): unknown[] => {
    pos++;
    const items: unknown[] = [];
    skipWhitespace();
    if (text[pos] === close) {
      pos++;
      return items;
    }
    for (;;) {
      items.push(parseValue(depth + 1));
      skipWhitespace();
      if (text[pos] === ",") {
        pos++;
        skipWhitespace();
        if (text[pos] === close) {
          pos++;
          return items;
        }
        continue;
      }
      if (text[pos] === close) {
        pos++;
        return items;
      }
      return fail();
    }
  };

  const toKey = (key: unknown): string => {
    if (typeof key === "string") return key;
    if (typeof key === "number") return String(key);
    // What json.dumps does with the other hashable scalars.
    if (key === null) return "null";
    if (key === true) return "true";
    if (key === false) return "false";
    return fail();
  };

  const parseDict = (depth: number): Record<string, unknown> => {
    pos++;
    const entries: [string, unknown][] = [];
    skipWhitespace();
    if (text[pos] === "}") {
      pos++;
      return {};
    }
    for (;;) {
      skipWhitespace();
      const keyStart = text[pos];
      if (keyStart === "[" || keyStart === "{" || keyStart === "(") fail();
      const key = toKey(parseValue(depth + 1));
      skipWhitespace();
      if (text[pos] !== ":") fail();
      pos++;
      entries.push([key, parseValue(depth + 1)]);
      skipWhitespace();
      if (text[pos] === ",") {
        pos++;
        skipWhitespace();
        if (text[pos] === "}") {
          pos++;
          break;
        }
        continue;
      }
      if (text[pos] === "}") {
        pos++;
        break;
      }
      fail();
    }
    // fromEntries defines own properties, so a "__proto__" key stays data.
    return Object.fromEntries(entries);
  };

  const parseValue = (depth: number): unknown => {
    if (depth > MAX_LITERAL_DEPTH) fail();
    skipWhitespace();
    const ch = text[pos];
    if (ch === "[") return parseSequence("]", depth);
    if (ch === "(") return parseSequence(")", depth);
    if (ch === "{") return parseDict(depth);
    if (ch === "'" || ch === '"') return parseString();
    if (ch === "-" || ch === "+" || ch === "." || isDigit(ch)) {
      return parseNumber();
    }
    return parseKeyword();
  };

  try {
    const value = parseValue(0);
    skipWhitespace();
    if (pos !== text.length) return null;
    return { value };
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------------------
// Tool output
// ---------------------------------------------------------------------------

/** JSON.parse, limited to objects and arrays: "42" stays text. */
export const tryParseJsonContainer = (
  text: string,
): { value: unknown } | null => {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null;
  try {
    const value: unknown = JSON.parse(trimmed);
    return isContainer(value) ? { value } : null;
  } catch {
    return null;
  }
};

/**
 * The text of an MCP content block list (`[{type: "text", text: ...}, ...]`),
 * joined, or null when the value is not such a list. Blocks of other types
 * are skipped; a list without any text block is not treated as one.
 */
export const joinTextBlocks = (value: unknown): string | null => {
  if (!Array.isArray(value) || value.length === 0) return null;
  if (!value.every((block) => isRecord(block) && typeof block.type === "string")) {
    return null;
  }
  const texts = (value as Record<string, unknown>[])
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text as string);
  return texts.length > 0 ? texts.join("\n") : null;
};

const jsonOutput = (value: unknown): ToolOutput => ({
  kind: "json",
  value,
  copyText: JSON.stringify(value, null, 2),
});

const textOutput = (text: string): ToolOutput => {
  if (text.trim() === "") return { kind: "empty" };
  const parsed = tryParseJsonContainer(text);
  if (parsed) return jsonOutput(parsed.value);
  return { kind: "text", text, copyText: text };
};

/**
 * Turns a tool step's `content` into something displayable: a JSON value
 * when the tool returned JSON, plain text otherwise. Legacy content (a
 * Python repr of content blocks) is decoded first; if it cannot be decoded
 * the raw string is shown as text.
 */
export const parseToolContent = (content: unknown): ToolOutput => {
  if (content === null || content === undefined) return { kind: "empty" };

  if (typeof content !== "string") {
    const blocksText = joinTextBlocks(content);
    if (blocksText !== null) return textOutput(blocksText);
    return isContainer(content)
      ? jsonOutput(content)
      : textOutput(String(content));
  }

  const trimmed = content.trim();
  if (trimmed === "") return { kind: "empty" };

  const decoded =
    tryParseJsonContainer(trimmed) ??
    (trimmed.startsWith("[") || trimmed.startsWith("{")
      ? parsePythonLiteral(trimmed)
      : null);

  if (decoded) {
    const blocksText = joinTextBlocks(decoded.value);
    if (blocksText !== null) return textOutput(blocksText);
    if (isContainer(decoded.value)) return jsonOutput(decoded.value);
  }

  return { kind: "text", text: content, copyText: content };
};

// ---------------------------------------------------------------------------
// Display truncation
// ---------------------------------------------------------------------------

const formatCount = (count: number): string => count.toLocaleString("en-US");

/** Cuts `text` to `limit` characters, saying how many were left out. */
export const truncateText = (text: string, limit: number): string =>
  text.length > limit
    ? `${text.slice(0, limit)}... (+${formatCount(text.length - limit)} chars)`
    : text;

/**
 * A copy of `value` with every string longer than `limit` cut, for display
 * only. Keys, numbers and structure are untouched.
 */
export const truncateForDisplay = (
  value: unknown,
  limit: number = DISPLAY_STRING_LIMIT,
): unknown => {
  if (typeof value === "string") return truncateText(value, limit);
  if (Array.isArray(value)) {
    return value.map((item) => truncateForDisplay(item, limit));
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        truncateForDisplay(item, limit),
      ]),
    );
  }
  return value;
};

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

const hasStepTiming = (step: unknown): boolean =>
  isRecord(step) &&
  isFiniteNonNegative(step.started_at_s) &&
  isFiniteNonNegative(step.latency_s);

/**
 * A trace is legacy unless every step carries `started_at_s` and `latency_s`:
 * a trace with even one untimed step cannot be laid out on a timeline.
 */
export const isLegacyTrace = (trace: readonly unknown[]): boolean =>
  trace.length === 0 || !trace.every(hasStepTiming);

const readToolCalls = (value: unknown): AgentToolCall[] =>
  Array.isArray(value)
    ? value.filter(isRecord).map((call) => ({
        name: readString(call.name) ?? "Unnamed tool",
        args: call.args,
        id: readString(call.id),
      }))
    : [];

const capitalize = (text: string): string =>
  text.charAt(0).toUpperCase() + text.slice(1);

type CallRef = { call: AgentToolCall; stepIndex: number; used: boolean };

/**
 * Pairs each tool step (by position in `steps`) with the agent tool call it
 * answers: by `tool_call_id` first, then, for the rest, the earliest unused
 * call made before the step, preferring one with the same tool name.
 */
export const pairToolCalls = (
  steps: readonly AgenticTraceStep[],
): Map<number, AgentToolCall> => {
  const calls: CallRef[] = [];
  steps.forEach((step, stepIndex) => {
    if (step.role !== "assistant") return;
    for (const call of readToolCalls(step.tool_calls)) {
      calls.push({ call, stepIndex, used: false });
    }
  });

  const pairs = new Map<number, AgentToolCall>();
  const unmatched: number[] = [];

  steps.forEach((step, stepIndex) => {
    if (step.role !== "tool") return;
    const id = readString(step.tool_call_id);
    const ref = id
      ? calls.find((candidate) => !candidate.used && candidate.call.id === id)
      : undefined;
    if (ref) {
      ref.used = true;
      pairs.set(stepIndex, ref.call);
    } else {
      unmatched.push(stepIndex);
    }
  });

  for (const stepIndex of unmatched) {
    const name = readString(steps[stepIndex].name);
    const earlier = calls.filter(
      (candidate) => !candidate.used && candidate.stepIndex < stepIndex,
    );
    const ref =
      earlier.find((candidate) => candidate.call.name === name) ?? earlier[0];
    if (ref) {
      ref.used = true;
      pairs.set(stepIndex, ref.call);
    }
  }

  return pairs;
};

const readStatus = (value: unknown): ToolStatus | null =>
  value === "success" || value === "error" ? value : null;

export const normalizeTrace = (
  trace: readonly unknown[] | null | undefined,
): TraceView => {
  const rawSteps: AgenticTraceStep[] = (trace ?? []).map((step) =>
    isRecord(step) ? (step as AgenticTraceStep) : { value: step },
  );
  const isLegacy = isLegacyTrace(rawSteps);
  const pairs = pairToolCalls(rawSteps);

  // The final answer is the last assistant step that requests no tools.
  let answerIndex = -1;
  rawSteps.forEach((step, index) => {
    if (step.role === "assistant" && readToolCalls(step.tool_calls).length === 0) {
      answerIndex = index;
    }
  });

  const steps = rawSteps.map((raw, index): TraceStepView => {
    const base = {
      index,
      number: index + 1,
      node: readString(raw.node),
      durationS: isLegacy ? null : (raw.latency_s as number),
      startS: isLegacy ? null : (raw.started_at_s as number),
      raw,
    };
    const content = typeof raw.content === "string" ? raw.content : "";

    if (raw.role === "tool") {
      const call = pairs.get(index);
      const name = readString(raw.name) ?? call?.name ?? "Tool";
      return {
        ...base,
        kind: "tool",
        kindLabel: TRACE_KIND_LABELS.tool,
        title: name,
        name,
        status: readStatus(raw.status),
        toolCallId: readString(raw.tool_call_id),
        input: call?.args,
        output: parseToolContent(raw.content),
      };
    }

    if (raw.role === "assistant") {
      const toolCalls = readToolCalls(raw.tool_calls);
      if (toolCalls.length === 0 && index === answerIndex) {
        return {
          ...base,
          kind: "answer",
          kindLabel: TRACE_KIND_LABELS.answer,
          title: "Final answer",
          content,
        };
      }
      const metadata = isRecord(raw.response_metadata)
        ? raw.response_metadata
        : {};
      const usage = isRecord(raw.usage_metadata) ? raw.usage_metadata : {};
      return {
        ...base,
        kind: "agent",
        kindLabel: TRACE_KIND_LABELS.agent,
        title: toolCalls.length > 0 ? "Planned next action" : "Agent message",
        content,
        toolCalls,
        model: readString(metadata.model_name),
        finishReason: readString(metadata.finish_reason),
        inputTokens: readNumber(usage.input_tokens),
        outputTokens: readNumber(usage.output_tokens),
      };
    }

    const role = readString(raw.role);
    return {
      ...base,
      kind: "other",
      kindLabel: role && role !== "unknown" ? capitalize(role) : "Step",
      title: readString(raw.name) ?? base.node ?? "Unknown step",
    };
  });

  const totalS = isLegacy
    ? null
    : steps.reduce(
        (end, step) =>
          Math.max(end, (step.startS ?? 0) + (step.durationS ?? 0)),
        0,
      );

  return { steps, isLegacy, totalS };
};

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

export type TimelineSegment = {
  index: number;
  number: number;
  kind: TraceStepKind;
  kindLabel: string;
  title: string;
  startS: number;
  durationS: number;
  /** Percent of the total, from the left edge. */
  leftPct: number;
  widthPct: number;
};

export type Timeline = {
  totalS: number;
  segments: TimelineSegment[];
};

/**
 * One segment per step, placed by `started_at_s` and sized by `latency_s`
 * over the end of the last step. Null for legacy traces, and for a trace
 * whose steps all took no time (nothing to scale against).
 */
export const buildTimeline = (view: TraceView): Timeline | null => {
  if (view.isLegacy || view.totalS === null || view.totalS <= 0) return null;
  const totalS = view.totalS;

  const segments = view.steps.map((step): TimelineSegment => {
    const startS = step.startS ?? 0;
    const durationS = step.durationS ?? 0;
    const leftPct = Math.min(100, (startS / totalS) * 100);
    const widthPct = Math.min(100 - leftPct, (durationS / totalS) * 100);
    return {
      index: step.index,
      number: step.number,
      kind: step.kind,
      kindLabel: step.kindLabel,
      title: step.title,
      startS,
      durationS,
      leftPct,
      widthPct,
    };
  });

  return { totalS, segments };
};

/** "420 ms", "2.14 s", "12.3 s", "1 min 05 s". */
export const formatDuration = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return "";
  if (seconds < 1) return `${Math.round(seconds * 1000)} ms`;
  if (seconds < 10) return `${seconds.toFixed(2)} s`;
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  const whole = Math.round(seconds);
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return `${minutes} min ${String(rest).padStart(2, "0")} s`;
};

export const formatTokenCount = (count: number): string => formatCount(count);
