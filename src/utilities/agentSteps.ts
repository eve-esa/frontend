import type { ToolActivityEntry } from "@/types";
import {
  normalizeTrace,
  parseToolContent,
  type AgentStepView,
  type ToolOutput,
  type TraceStepView,
} from "./agentTrace";

/**
 * View model of the inline agent steps block. Two sources map onto the same
 * rows: the live `tool_activity` of the streaming turn and the persisted
 * `message.trace`. Newer backends send `kind`, `server`, `tier`, `status`,
 * `duration_ms`, `attempt`, `skill_name`, `model_fallback` and
 * `subagent_run_id`; each is read when present and inferred when absent.
 */

export type AgentStepKind =
  | "builtin"
  | "mcp"
  | "skill"
  | "subagent"
  | "plan"
  | "reasoning"
  | "model_switch"
  | "artifact"
  | "agent"
  /** Three or more consecutive calls of one tool folded into one row. */
  | "group"
  | "other";

/** `stopped`: cut by a Stop (`cancelled`); `not_run`: asked for, never run (contract 2.2). */
export type AgentStepStatus = "running" | "done" | "error" | "stopped" | "not_run";

export type PlanItem = { text: string; status: "done" | "running" | "todo" };

export type AgentStepRow = {
  key: string;
  kind: AgentStepKind;
  status: AgentStepStatus;
  /** Tool name as the model called it, when the row is a tool call. */
  tool: string | null;
  title: string;
  query: string | null;
  server: string | null;
  tier: string | null;
  skillName: string | null;
  attempt: number | null;
  durationS: number | null;
  /** Short readable result (disclosure level 2). */
  preview: string | null;
  input: unknown;
  output: ToolOutput | null;
  /** True when the result was offloaded to a file and only a pointer is here. */
  offloaded: boolean;
  /** Model, tokens and finish reason of the agent step that asked for it. */
  requestedBy: AgentStepView | null;
  plan: PlanItem[] | null;
  children: AgentStepRow[];
  /** Step id this call retries (backend `retry_of`). */
  retryOf: string | null;
  errorCode: string | null;
  /** Model switch rows: `model_fallback {from, to, reason}`. */
  modelFrom: string | null;
  modelTo: string | null;
  /** Earlier failed attempts of this step, oldest first (retry grouping). */
  attempts: AgentStepRow[];
  /** The trace step this row came from, for the full JSON in Details. */
  raw: unknown;
};

export type AgentStepsView = {
  rows: AgentStepRow[];
  stepCount: number;
  toolCount: number;
  failedCount: number;
  /** Earlier failed attempts folded into a row. */
  retryCount: number;
  switchCount: number;
  /** Seconds, or null when no trustworthy timing exists (legacy traces). */
  totalS: number | null;
};

// Tools the deep agent ships with: the verb names the kind, never a server tile.
const BUILTIN_LABELS: Record<string, string> = {
  read_file: "Read",
  write_file: "Wrote",
  edit_file: "Edited",
  ls: "Listed",
  glob: "Searched files",
  grep: "Searched text",
  execute: "Ran code",
  display: "Showed a file",
  history_search: "Searched your earlier chats",
  eve_retrieval_retrieve: "Searched the knowledge base",
  retrieve: "Searched the knowledge base",
};

const KNOWLEDGE_BASE_TOOLS: ReadonlySet<string> = new Set(["eve_retrieval_retrieve", "retrieve"]);

/** The retrieval step's one name, live, folded and expanded (decision 0007);
 * the tool and server ids stay in the Details panel. */
export const EVE_SOURCES_LABEL = "EVE sources";

/** The EVE knowledge base: a built-in row ("Searched ..."), never a server tile. */
export const isKnowledgeBaseTool = (tool: string | null, server?: string | null): boolean =>
  (tool !== null && KNOWLEDGE_BASE_TOOLS.has(tool)) || server === "eve_retrieval";

const SKILL_PATH = /\/skills\/([^/]+)\/SKILL\.md$/;
const OFFLOAD_PATH = /\/large_tool_results\//;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const str = (value: unknown): string | null =>
  typeof value === "string" && value.trim() !== "" ? value : null;

const num = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const argString = (args: unknown, ...keys: string[]): string | null => {
  if (!isRecord(args)) return null;
  for (const key of keys) {
    const value = str(args[key]);
    if (value) return value;
  }
  return null;
};

export const skillNameFromArgs = (tool: string | null, args: unknown): string | null => {
  if (tool !== "read_file") return null;
  const path = argString(args, "file_path", "path");
  return path?.match(SKILL_PATH)?.[1] ?? null;
};

const readPlan = (args: unknown): PlanItem[] | null => {
  if (!isRecord(args) || !Array.isArray(args.todos)) return null;
  return args.todos
    .filter(isRecord)
    .map((todo) => ({
      text: str(todo.content) ?? str(todo.text) ?? "",
      status:
        todo.status === "completed" || todo.status === "done"
          ? "done"
          : todo.status === "in_progress" || todo.status === "running"
            ? "running"
            : "todo",
    }));
};

/** The tool name without its `<server>_` prefix: `cdse_search_stac` on
 * `cdse` is `search_stac`. */
export const shortToolName = (tool: string | null, server: string | null): string | null =>
  tool && server && tool.startsWith(server + "_") ? tool.slice(server.length + 1) : tool;

/**
 * The MCP server and the bare tool name for the Details line: the row's
 * server, else the server the frame or trace step named (the knowledge base
 * row drops it from its look), else the `eve_retrieval_` prefix. Built-in
 * tools have no server.
 */
export const stepServerAndTool = (row: AgentStepRow): { server: string | null; tool: string | null } => {
  const raw = isRecord(row.raw) ? row.raw : {};
  const nested = isRecord(raw.step) ? raw.step : {};
  const named = str(raw.server) ?? str(nested.server);
  const server =
    row.server ??
    (named && named !== row.tool ? named : null) ??
    (row.tool?.startsWith("eve_retrieval_") ? "eve_retrieval" : null);
  return { server, tool: shortToolName(row.tool, server) };
};

// Raw endpoint names a person cannot read: Blablador aliases and numbered names.
const RAW_MODEL_NAME = /^(alias-|\d+ - )/;

/** The model of a step: the app's label for the model that answered when the
 * step only carries a raw endpoint name, else the name as recorded. */
export const displayModel = (model: string | null, answeredLabel: string | null): string | null =>
  model && answeredLabel && RAW_MODEL_NAME.test(model) ? answeredLabel : model;

type Classified = Pick<
  AgentStepRow,
  "kind" | "title" | "server" | "skillName" | "plan" | "query"
>;

/**
 * Decides the look of a tool row: explicit `kind` first, then inference
 * (skill from a SKILL.md read, plan from write_todos, subagent from task,
 * MCP from a server name or a `<server>_<tool>` prefix).
 */
export const classifyTool = (input: {
  tool: string | null;
  args: unknown;
  kind?: string | null;
  server?: string | null;
  skillName?: string | null;
  query?: string | null;
  label?: string | null;
}): Classified => {
  const tool = input.tool;
  const query =
    input.query ?? argString(input.args, "query", "description", "q") ?? null;
  const skillName = input.skillName ?? skillNameFromArgs(tool, input.args);
  if (input.kind === "skill" || skillName) {
    const name = skillName ?? tool ?? "skill";
    return { kind: "skill", title: `Used skill ${name}`, server: null, skillName: name, plan: null, query: null };
  }
  if (input.kind === "plan" || tool === "write_todos") {
    return { kind: "plan", title: "Plan", server: null, skillName: null, plan: readPlan(input.args) ?? [], query: null };
  }
  if (input.kind === "subagent" || tool === "task") {
    const name = argString(input.args, "subagent_type", "name") ?? "agent";
    return { kind: "subagent", title: `Ran subagent ${name}`, server: null, skillName: null, plan: null, query };
  }
  if (isKnowledgeBaseTool(tool, input.server)) {
    return { kind: "builtin", title: BUILTIN_LABELS.eve_retrieval_retrieve, server: null, skillName: null, plan: null, query };
  }
  const isBuiltin =
    input.kind === "builtin" ||
    (input.kind !== "mcp" && tool !== null && Object.prototype.hasOwnProperty.call(BUILTIN_LABELS, tool));
  if (isBuiltin) {
    const title =
      (tool && Object.prototype.hasOwnProperty.call(BUILTIN_LABELS, tool) ? BUILTIN_LABELS[tool] : null) ??
      input.label ??
      (tool ? `Used tool ${tool}` : "Tool");
    const path = argString(input.args, "file_path", "path");
    return { kind: "builtin", title, server: null, skillName: null, plan: null, query: query ?? path };
  }
  let server = input.server && input.server !== tool ? input.server : null;
  if (!server && tool && tool.includes("_")) server = tool.slice(0, tool.indexOf("_"));
  if (input.kind === "mcp" || server) {
    const short = shortToolName(tool, server);
    const title = ["Called", server, short].filter(Boolean).join(" ");
    return { kind: "mcp", title, server, skillName: null, plan: null, query };
  }
  return {
    kind: "builtin",
    title: input.label ?? (tool ? `Used tool ${tool}` : "Tool"),
    server: null,
    skillName: null,
    plan: null,
    query,
  };
};

const emptyRow = (key: string): Omit<AgentStepRow, keyof Classified> => ({
  key,
  status: "done",
  tool: null,
  tier: null,
  attempt: null,
  durationS: null,
  preview: null,
  input: undefined,
  output: null,
  offloaded: false,
  requestedBy: null,
  children: [],
  retryOf: null,
  errorCode: null,
  modelFrom: null,
  modelTo: null,
  attempts: [],
  raw: null,
});

const switchTitle = (to: string, reason: string | null) =>
  `Switched to ${to}${reason ? `: ${REASON_TEXT[reason] ?? reason.replace(/_/g, " ")}` : ""}`;

const REASON_TEXT: Record<string, string> = {
  circuit_open: "model busy",
  agent_error: "model error",
};

const isOffloaded = (text: string | null): boolean =>
  Boolean(text && OFFLOAD_PATH.test(text));

/**
 * Folds the attempts of one step into one row: a call that names `retry_of`
 * (or reuses a step id already shown) replaces the earlier row and keeps it,
 * oldest first, in `attempts`.
 */
export const groupRetries = (rows: readonly AgentStepRow[]): AgentStepRow[] => {
  const out: AgentStepRow[] = [];
  const byKey = new Map<string, number>();
  for (const original of rows) {
    const row = original.children.length
      ? { ...original, children: groupRetries(original.children) }
      : original;
    const target = row.retryOf ?? (row.kind !== "model_switch" && byKey.has(row.key) ? row.key : null);
    const index = target !== null ? byKey.get(target) : undefined;
    if (index !== undefined) {
      const prev = out[index];
      out[index] = { ...row, key: prev.key, attempts: [...prev.attempts, { ...prev, attempts: [] }] };
      continue;
    }
    byKey.set(row.key, out.length);
    out.push(row);
  }
  return out;
};

// ---------------------------------------------------------------------------
// Live frames
// ---------------------------------------------------------------------------

export const rowsFromActivity = (
  activity: readonly ToolActivityEntry[],
  opts: { stopped?: boolean } = {},
): AgentStepRow[] => {
  const rows: AgentStepRow[] = [];
  const subagents = new Map<string, AgentStepRow>();
  activity.forEach((entry, index) => {
    if (entry.kind === "model_fallback") {
      rows.push({
        ...emptyRow(entry.id ?? `live-switch-${index}`),
        kind: "model_switch",
        title: switchTitle(entry.modelTo ?? "another model", entry.fallbackReason ?? null),
        server: null,
        skillName: null,
        plan: null,
        query: null,
        modelFrom: entry.modelFrom ?? null,
        modelTo: entry.modelTo ?? null,
        raw: entry,
      });
      return;
    }
    const classified = classifyTool({
      tool: entry.tool ?? null,
      args: entry.args,
      kind: entry.kind,
      server: entry.server,
      skillName: entry.skillName,
      query: entry.query,
      label: entry.label.replace(/^Calling\s+/i, ""),
    });
    const status: AgentStepStatus =
      entry.state === "running"
        ? opts.stopped
          ? "stopped"
          : "running"
        : entry.status === "error" || entry.status === "timeout"
          ? "error"
          : entry.status === "cancelled"
            ? "stopped"
            : "done";
    const durationS =
      entry.durationMs !== undefined
        ? entry.durationMs / 1000
        : entry.startedAtMs !== undefined && entry.endedAtMs !== undefined
          ? Math.max(0, (entry.endedAtMs - entry.startedAtMs) / 1000)
          : null;
    const preview = entry.preview ?? null;
    const row: AgentStepRow = {
      ...emptyRow(entry.id ?? `live-${index}`),
      ...classified,
      status,
      tool: entry.tool ?? null,
      tier: entry.tier ?? null,
      attempt: entry.attempt ?? null,
      durationS,
      preview,
      input: entry.args,
      output: preview ? parseToolContent(preview) : null,
      offloaded: isOffloaded(preview),
      retryOf: entry.retryOf ?? null,
      errorCode: entry.errorCode ?? (entry.status === "timeout" ? "timeout" : null),
      raw: entry,
    };
    if (entry.modelFallback) {
      rows.push({
        ...emptyRow(`${row.key}-switch`),
        kind: "model_switch",
        title: `Switched to ${entry.modelFallback}`,
        server: null,
        skillName: null,
        plan: null,
        query: null,
      });
    }
    const parent = entry.subagentRunId ? subagents.get(entry.subagentRunId) : undefined;
    if (parent && row.kind !== "subagent") {
      parent.children.push(row);
      return;
    }
    if (row.kind === "subagent" && entry.subagentRunId) subagents.set(entry.subagentRunId, row);
    if (row.kind === "plan") {
      // Each write_todos replaces the list: keep one plan row, the latest.
      const existing = rows.findIndex((r) => r.kind === "plan");
      if (existing !== -1) {
        rows[existing] = row;
        return;
      }
    }
    rows.push(row);
  });
  return groupRetries(rows);
};

// ---------------------------------------------------------------------------
// Persisted trace
// ---------------------------------------------------------------------------

const readReasoning = (step: AgentStepView): string | null => {
  const raw = step.raw as Record<string, unknown>;
  const kwargs = isRecord(raw.additional_kwargs) ? raw.additional_kwargs : {};
  return str(raw.reasoning) ?? str(raw.reasoning_content) ?? str(kwargs.reasoning_content);
};

export const rowsFromTrace = (
  steps: readonly TraceStepView[],
  opts: { stopped?: boolean } = {},
): AgentStepRow[] => {
  const rows: AgentStepRow[] = [];
  const requester = new Map<string, AgentStepView>();
  let lastAgent: AgentStepView | null = null;
  const subagents = new Map<string, AgentStepRow>();

  const callMeta = new Map<string, Record<string, unknown>>();
  // Calls a Stop cut, or that never ran, have no tool step: the agent step's
  // `tool_calls[].step` is all the stored trace keeps of them (contract 2.2).
  const pending = new Map<string, { at: number; call: Record<string, unknown>; by: AgentStepView }>();

  for (const step of steps) {
    const entry = step.raw as Record<string, unknown>;
    // Newer backends put the step fields under `step`; older ones had none.
    const raw: Record<string, unknown> = isRecord(entry.step) ? { ...entry, ...entry.step } : entry;
    if (step.kind === "agent") {
      lastAgent = step;
      step.toolCalls.forEach((call) => call.id && requester.set(call.id, step));
      if (Array.isArray(entry.tool_calls)) {
        for (const call of entry.tool_calls) {
          if (isRecord(call) && typeof call.id === "string" && isRecord(call.step)) {
            callMeta.set(call.id, call.step);
            pending.set(call.id, { at: rows.length, call, by: step });
          }
        }
      }
      const reasoning = readReasoning(step);
      if (reasoning) {
        rows.push({
          ...emptyRow(`r-${step.index}`),
          kind: "reasoning",
          title: step.durationS !== null ? `Thought for ${Math.max(1, Math.round(step.durationS))}s` : "Thought",
          server: null,
          skillName: null,
          plan: null,
          query: null,
          preview: reasoning,
          durationS: step.durationS,
          raw: step.raw,
        });
      }
      const fallback = str(raw.model_fallback);
      if (fallback) {
        rows.push({
          ...emptyRow(`m-${step.index}`),
          kind: "model_switch",
          title: `Switched to ${fallback}`,
          server: null,
          skillName: null,
          plan: null,
          query: null,
          raw: step.raw,
        });
      }
      // A model message that requests nothing and is not the answer keeps
      // its own row, so nothing the sidebar shows is lost.
      if (step.toolCalls.length === 0 && step.content.trim() !== "") {
        rows.push({
          ...emptyRow(`a-${step.index}`),
          kind: "agent",
          title: "Agent message",
          server: null,
          skillName: null,
          plan: null,
          query: null,
          preview: step.content,
          durationS: step.durationS,
          requestedBy: step,
          raw: step.raw,
        });
      }
      continue;
    }
    if (step.kind === "answer") continue;
    if (step.kind === "other") {
      const kind = str(raw.kind);
      rows.push({
        ...emptyRow(`o-${step.index}`),
        kind: kind === "artifact" ? "artifact" : "other",
        title: kind === "artifact" ? `Artifact ${str(raw.name) ?? ""}`.trim() : step.title,
        server: null,
        skillName: null,
        plan: null,
        query: null,
        durationS: step.durationS,
        raw: step.raw,
      });
      continue;
    }
    // Tool step.
    if (step.toolCallId) pending.delete(step.toolCallId);
    const by = (step.toolCallId && requester.get(step.toolCallId)) || lastAgent;
    const call = (step.toolCallId && callMeta.get(step.toolCallId)) || {};
    const meta: Record<string, unknown> = { ...call, ...raw };
    const classified = classifyTool({
      tool: step.name,
      args: step.input,
      kind: str(meta.kind),
      server: str(meta.server),
      skillName: str(meta.skill_name),
    });
    const rawStatus = str(meta.status);
    const status: AgentStepStatus =
      step.status === "error" || rawStatus === "error" || rawStatus === "timeout"
        ? "error"
        : rawStatus === "cancelled"
          ? "stopped"
          : rawStatus === "not_run"
            ? "not_run"
            : rawStatus === "running"
              ? opts.stopped
                ? "stopped"
                : "running"
              : "done";
    const durationMs = num(meta.duration_ms);
    const text =
      step.output.kind === "text"
        ? step.output.text
        : step.output.kind === "json"
          ? step.output.copyText
          : null;
    const row: AgentStepRow = {
      ...emptyRow(str(meta.tool_call_id) ?? step.toolCallId ?? `t-${step.index}`),
      ...classified,
      status,
      tool: step.name,
      tier: str(meta.tier),
      attempt: num(meta.attempt),
      retryOf: str(meta.retry_of),
      errorCode: str(meta.error_code) ?? (rawStatus === "timeout" ? "timeout" : null),
      durationS: durationMs !== null ? durationMs / 1000 : step.durationS,
      preview: text ? text.slice(0, 280) : null,
      input: step.inputRecorded ? step.input : undefined,
      output: step.output,
      offloaded: isOffloaded(text) || Boolean(meta.offloaded),
      requestedBy: by,
      raw: step.raw,
    };
    const runId = str(meta.subagent_run_id);
    const parent = runId ? subagents.get(runId) : undefined;
    if (parent && row.kind !== "subagent") {
      parent.children.push(row);
      continue;
    }
    if (row.kind === "subagent" && runId) subagents.set(runId, row);
    if (row.kind === "plan") {
      const existing = rows.findIndex((r) => r.kind === "plan");
      if (existing !== -1) {
        rows[existing] = row;
        continue;
      }
    }
    rows.push(row);
  }
  // Latest first, so each splice leaves the earlier positions in place.
  [...pending.entries()].reverse().forEach(([id, { at, call, by }]) => {
    const row = cutCallRow(id, call, by, opts);
    if (row) rows.splice(Math.min(at, rows.length), 0, row);
  });
  return groupRetries(rows);
};

/** A call with no tool step: a row only when its step says what became of it. */
const cutCallRow = (
  id: string,
  call: Record<string, unknown>,
  by: AgentStepView,
  opts: { stopped?: boolean },
): AgentStepRow | null => {
  const meta = isRecord(call.step) ? call.step : {};
  const rawStatus = str(meta.status);
  const status: AgentStepStatus | null =
    rawStatus === "cancelled"
      ? "stopped"
      : rawStatus === "not_run"
        ? "not_run"
        : rawStatus === "running" && opts.stopped
          ? "stopped"
          : null;
  if (status === null) return null;
  const tool = str(call.name);
  const durationMs = num(meta.duration_ms);
  return {
    ...emptyRow(id),
    ...classifyTool({
      tool,
      args: call.args,
      kind: str(meta.kind),
      server: str(meta.server),
      skillName: str(meta.skill_name),
    }),
    status,
    tool,
    tier: str(meta.tier),
    attempt: num(meta.attempt),
    retryOf: str(meta.retry_of),
    errorCode: str(meta.error_code),
    durationS: status === "stopped" && durationMs !== null ? durationMs / 1000 : null,
    input: call.args,
    requestedBy: by,
    raw: call,
  };
};

const TOOL_KINDS: ReadonlySet<AgentStepKind> = new Set(["builtin", "mcp", "skill", "subagent"]);
// Not steps in the summary count: the plan, the model's thinking and its
// messages (only the stored trace has those, so counting them would change
// the summary at the hand-over), a switch.
const UNCOUNTED_KINDS: ReadonlySet<AgentStepKind> = new Set(["plan", "reasoning", "agent", "model_switch"]);

const FOLD_KINDS: ReadonlySet<AgentStepKind> = new Set(["builtin", "mcp"]);
const MIN_FOLD = 3;

/** The server and tool a call is folded by. */
const foldKey = (row: AgentStepRow): string | null =>
  FOLD_KINDS.has(row.kind) && row.tool ? `${stepServerAndTool(row).server ?? ""}:${row.tool}` : null;

/**
 * Three or more consecutive calls of the same tool on the same server become
 * one `group` row whose children are the calls (pattern after assistant-ui
 * ToolGroup and Claude Code "Called slack 3 times"; no code copied). Running
 * while any call runs, stopped when one was cut; failures are counted from
 * the children. Applied to live and stored rows alike, so the hand-over and a
 * reload fold the same way.
 */
/**
 * A sandbox command that exited non-zero failed, whatever the tool status
 * says (the tool ran; the code did not): the exit footer of its output
 * decides. Applied to live and stored rows alike.
 */
export const markFailedCommands = (rows: readonly AgentStepRow[]): AgentStepRow[] =>
  rows.map((row) => {
    const children = row.children.length ? markFailedCommands(row.children) : row.children;
    if (row.tool !== "execute" || row.status !== "done") return children === row.children ? row : { ...row, children };
    const text = resultText(row);
    const exit = text ? /\[Command failed with exit code (-?\d+)\]\s*$/.exec(text) : null;
    if (!exit || Number(exit[1]) === 0) return children === row.children ? row : { ...row, children };
    return { ...row, children, status: "error", errorCode: row.errorCode ?? "exit_code" };
  });

export const foldRepeatedCalls = (rows: readonly AgentStepRow[]): AgentStepRow[] => {
  const out: AgentStepRow[] = [];
  let i = 0;
  while (i < rows.length) {
    const key = foldKey(rows[i]);
    let j = i + 1;
    while (key && j < rows.length && foldKey(rows[j]) === key) j += 1;
    if (key && j - i >= MIN_FOLD) {
      const calls = rows.slice(i, j);
      const timed = calls.filter((c) => c.durationS !== null);
      out.push({
        ...calls[0],
        key: `g-${calls[0].key}`,
        kind: "group",
        status: calls.some((c) => c.status === "running")
          ? "running"
          : calls.some((c) => c.status === "stopped")
            ? "stopped"
            : "done",
        query: null,
        preview: null,
        output: null,
        attempts: [],
        durationS: timed.length ? timed.reduce((sum, c) => sum + (c.durationS ?? 0), 0) : null,
        children: calls,
        raw: calls[0].raw,
      });
    } else {
      out.push(rows[i]);
      j = i + 1;
    }
    i = j;
  }
  return out;
};

export const summarizeRows = (rows: readonly AgentStepRow[], totalS: number | null): AgentStepsView => {
  const tools = new Set<string>();
  let failed = 0;
  let retries = 0;
  const visit = (row: AgentStepRow) => {
    if (TOOL_KINDS.has(row.kind) && row.tool) tools.add(row.tool);
    if (row.status === "error") failed += 1;
    retries += row.attempts.length;
    row.children.forEach(visit);
  };
  rows.forEach(visit);
  return {
    rows: [...rows],
    // A call that never ran is shown, not counted; a folded group counts its calls.
    stepCount: rows.reduce(
      (n, r) =>
        r.kind === "group"
          ? n + r.children.filter((c) => c.status !== "not_run").length
          : n + (!UNCOUNTED_KINDS.has(r.kind) && r.status !== "not_run" ? 1 : 0),
      0,
    ),
    toolCount: tools.size,
    failedCount: failed,
    retryCount: retries,
    switchCount: rows.filter((r) => r.kind === "model_switch").length,
    totalS,
  };
};

/** Epoch ms of a step's `started_at` (on the row's raw entry or its `step`). */
const startedAtMs = (raw: unknown): number | null => {
  if (!isRecord(raw)) return null;
  const meta = isRecord(raw.step) ? raw.step : raw;
  const value = str(meta.started_at);
  const ms = value ? Date.parse(value) : NaN;
  return Number.isFinite(ms) ? ms : null;
};

/**
 * Length of a stopped run. The trace timing covers the model nodes only, and
 * a Stop cuts the call that was running, so the total is the widest of: the
 * trace span, the first start to the last end of the timed steps, the
 * longest step. The header can never read less than a row.
 */
const stoppedTotalS = (rows: readonly AgentStepRow[], traceTotalS: number | null): number | null => {
  let first: number | null = null;
  let last: number | null = null;
  let longest = 0;
  for (const row of rows) {
    if (row.durationS === null) continue;
    longest = Math.max(longest, row.durationS);
    const start = startedAtMs(row.raw);
    if (start === null) continue;
    first = first === null ? start : Math.min(first, start);
    last = Math.max(last ?? start, start + row.durationS * 1000);
  }
  const span = first !== null && last !== null ? (last - first) / 1000 : 0;
  const total = Math.max(traceTotalS ?? 0, span, longest);
  return total > 0 ? total : null;
};

export const buildStepsFromTrace = (
  trace: readonly unknown[] | null | undefined,
  opts: { stopped?: boolean } = {},
): AgentStepsView => {
  const view = normalizeTrace(trace);
  const rows = rowsFromTrace(view.steps, opts);
  return summarizeRows(
    foldRepeatedCalls(markFailedCommands(rows)),
    opts.stopped ? stoppedTotalS(rows, view.totalS) : view.totalS,
  );
};

export const buildStepsFromActivity = (
  activity: readonly ToolActivityEntry[] | null | undefined,
  opts: { stopped?: boolean; totalS?: number | null } = {},
): AgentStepsView =>
  summarizeRows(foldRepeatedCalls(markFailedCommands(rowsFromActivity(activity ?? [], opts))), opts.totalS ?? null);

/** A step duration as the A1 preview shows it: "640 ms", "2.1 s", "1m 32s". */
export const formatStepDuration = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return "";
  if (seconds < 1) return `${Math.round(seconds * 1000)} ms`;
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  return formatElapsed(seconds);
};

/** Whether the block has rows to show for this turn (the Message reads it to
 * keep one "stopped" on screen). */
export const hasAgentStepRows = (
  activity: readonly ToolActivityEntry[] | null | undefined,
  trace: readonly unknown[] | null | undefined,
  stopped: boolean,
): boolean =>
  buildStepsFromTrace(trace, { stopped }).rows.length > 0 ||
  buildStepsFromActivity(activity, { stopped }).rows.length > 0;

/** "32s", "1m 32s". */
export const formatElapsed = (seconds: number): string => {
  const whole = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return minutes > 0 ? `${minutes}m ${rest}s` : `${rest}s`;
};

/** Live header clock: "0:42". */
export const formatClock = (seconds: number): string => {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

type SummaryOpts = { stoppedAfterS?: number | null; stopped?: boolean };

/**
 * The collapsed header in two parts: the head ("Worked for 1m 32s",
 * "Stopped after 4s") and the counts ("5 steps", plus retries, switches and
 * failures; decision 0007: one count, no tool count). The header sets the
 * failures in the danger token and the rest muted.
 */
export const summaryParts = (view: AgentStepsView, opts: SummaryOpts = {}): { head: string; rest: string } => {
  const parts = [plural(view.stepCount, "step", "steps")];
  if (view.retryCount > 0) parts.push(plural(view.retryCount, "retry", "retries"));
  if (view.switchCount > 0) parts.push(plural(view.switchCount, "model switch", "model switches"));
  if (view.failedCount > 0) parts.push(`${view.failedCount} failed`);
  const rest = parts.join(", ");
  if (opts.stopped) {
    const time = opts.stoppedAfterS != null ? ` after ${formatElapsed(opts.stoppedAfterS)}` : "";
    return { head: `Stopped${time}`, rest };
  }
  const head = view.totalS !== null && view.totalS > 0 ? `Worked for ${formatElapsed(view.totalS)}` : "Worked";
  return { head, rest };
};

/** "Worked for 1m 32s, 5 steps" (plus ", 1 failed"). */
export const summaryText = (view: AgentStepsView, opts: SummaryOpts = {}): string => {
  const { head, rest } = summaryParts(view, opts);
  return `${head}, ${rest}`;
};

// ---------------------------------------------------------------------------
// Renderer inputs
// ---------------------------------------------------------------------------

/** One input value as plain text: arrays joined with commas, objects as
 * compact JSON, long values cut (the raw JSON stays in Details). */
const inputValueText = (value: unknown, max = 160): string => {
  const text = Array.isArray(value)
    ? value.map((item) => (typeof item === "object" && item !== null ? JSON.stringify(item) : String(item))).join(", ")
    : typeof value === "object" && value !== null
      ? JSON.stringify(value)
      : String(value);
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

const isEmptyInput = (value: unknown): boolean =>
  value === null ||
  value === undefined ||
  value === "" ||
  (Array.isArray(value) && value.length === 0) ||
  (isRecord(value) && Object.keys(value).length === 0);

/**
 * A tool input as the clean preview reads it: up to three `key: value` lines
 * (empty values left out) and how many keys did not fit; null when the input
 * is not an object with something to show.
 */
export const inputLines = (
  input: unknown,
  max = 3,
): { lines: [string, string][]; more: number } | null => {
  if (!isRecord(input)) return null;
  const entries = Object.entries(input).filter(([, value]) => !isEmptyInput(value));
  if (entries.length === 0) return null;
  return {
    lines: entries.slice(0, max).map(([key, value]) => [key, inputValueText(value)]),
    more: Math.max(0, entries.length - max),
  };
};

/** Full result text when stored, else the live preview. */
export const resultText = (row: AgentStepRow): string | null => {
  if (row.output?.kind === "text") return row.output.text;
  if (row.output?.kind === "json") return row.output.copyText;
  return row.preview;
};

/** Code the sandbox ran, from the `execute` arguments. */
export const sandboxCode = (args: unknown): string | null =>
  argString(args, "code", "command", "script", "source");

export type ArtifactLink = { href: string; filename: string };

const ARTIFACT_MD = /!?\[([^\]]*)\]\((\/artifacts\/[\w-]+)\/?\)/g;

/** Files a result names as saved: the `/artifacts/<id>` markdown stub the
 * artifact interceptor returns (sandbox `display`, MCP files). */
export const artifactLinks = (text: string | null): ArtifactLink[] => {
  if (!text) return [];
  const seen = new Set<string>();
  const links: ArtifactLink[] = [];
  for (const match of text.matchAll(ARTIFACT_MD)) {
    const href = match[2];
    if (seen.has(href)) continue;
    seen.add(href);
    links.push({ href, filename: match[1].trim() || "file" });
  }
  return links;
};

export const isSandboxStep = (row: AgentStepRow): boolean => row.tool === "execute";

const PYTHON_COMMAND = /^\s*(?:\S*\/)?(?:python3?(?:\.\d+)?|ipython3?|uv run (?:--\S+ )*python3?)(?:\s|$)/;

/**
 * The language a sandbox step ran, as its row chip (decision 0007): `Python`
 * when the input is Python code (a `code` argument, or a declared language)
 * or the command runs python, `shell` for any other command.
 */
export const sandboxLanguage = (args: unknown): "Python" | "shell" => {
  if (isRecord(args)) {
    const declared = str(args.language) ?? str(args.lang);
    if (declared) return /^py/i.test(declared) ? "Python" : "shell";
    if (str(args.code)) return "Python";
  }
  const command = isRecord(args) ? (str(args.command) ?? str(args.script) ?? str(args.source)) : str(args);
  return command && PYTHON_COMMAND.test(command) ? "Python" : "shell";
};

export type SourceChip = {
  title: string;
  year: number | null;
  collection: string | null;
  url: string | null;
  /** Where the document came from, for grouping; null when the result names none. */
  collectionRef: CollectionRef | null;
  /** Set on the user's own documents (My collections, conversation documents). */
  file: { name: string; type: string | null; collectionId: string | null } | null;
};

const pick = (record: unknown, ...keys: string[]): unknown => {
  if (!isRecord(record)) return undefined;
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null && record[key] !== "") return record[key];
  }
  return undefined;
};

const yearOf = (value: unknown): number | null => {
  const n = typeof value === "string" ? Number.parseInt(value, 10) : value;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null;
};

const documentList = (value: unknown): unknown[] | null => {
  if (Array.isArray(value)) return value;
  if (!isRecord(value)) return null;
  for (const key of ["retrieved_docs", "documents", "results", "sources"]) {
    if (Array.isArray(value[key])) return value[key] as unknown[];
  }
  return null;
};

// One parse per row: the rows are rebuilt only when the activity or the
// trace changes, and several renderers read the same result.
const parsedResults = new WeakMap<AgentStepRow, unknown>();

const parseResult = (row: AgentStepRow): unknown => {
  if (row.output?.kind === "json") return row.output.value;
  const text = resultText(row);
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

const resultValue = (row: AgentStepRow): unknown => {
  if (!parsedResults.has(row)) parsedResults.set(row, parseResult(row));
  return parsedResults.get(row);
};

/** Sources a knowledge base result lists: title, year, collection, link.
 * Reads the `/retrieve` shape (`retrieved_docs`) and the common variants;
 * documents without a title are skipped; one chip per title. */
export const sourceChips = (row: AgentStepRow, catalog?: CollectionCatalog | null): SourceChip[] => {
  const docs = documentList(resultValue(row)) ?? [];
  const seen = new Set<string>();
  const chips: SourceChip[] = [];
  for (const doc of docs) {
    const payload = pick(doc, "payload");
    const metadata = pick(doc, "metadata") ?? pick(payload, "metadata");
    const extra = pick(metadata, "additionalMetadata");
    const collectionRef = documentCollection(doc, catalog);
    // Uploads carry no title: the file name names them.
    const fileName = collectionRef?.internal
      ? str(pick(metadata, "filename") ?? pick(metadata, "source_name") ?? pick(payload, "filename"))
      : null;
    const title =
      fileName ??
      str(pick(doc, "title") ?? pick(payload, "title") ?? pick(metadata, "title") ?? pick(extra, "title"));
    if (!title || seen.has(title)) continue;
    seen.add(title);
    const url = str(
      pick(doc, "url") ?? pick(payload, "url") ?? pick(metadata, "url") ?? pick(extra, "link") ??
        (collectionRef?.internal ? pick(metadata, "source") : undefined),
    );
    const fileType = str(pick(metadata, "file_type"));
    chips.push({
      title,
      year: yearOf(pick(doc, "year") ?? pick(metadata, "year") ?? pick(payload, "year")),
      collection: str(pick(doc, "collection_name", "collection")),
      url: url && /^https?:\/\//.test(url) ? url : null,
      collectionRef,
      file: collectionRef?.internal
        ? {
            name: title,
            type: fileType ?? title.match(/\.([A-Za-z0-9]{1,6})$/)?.[1]?.toLowerCase() ?? null,
            collectionId: str(pick(payload, "collection_id") ?? pick(doc, "collection_id")),
          }
        : null,
    });
  }
  return chips;
};

// ---------------------------------------------------------------------------
// Live activity (block header while the agent works)
// ---------------------------------------------------------------------------

const ACTIVE_BUILTIN: Record<string, string> = {
  read_file: "Reading a file",
  write_file: "Writing a file",
  edit_file: "Editing a file",
  ls: "Listing files",
  glob: "Searching files",
  grep: "Searching text",
  execute: "Running code",
  display: "Showing a file",
  history_search: "Searching your earlier chats",
};

/** The latest step still running, children included, or null. */
export const latestRunningRow = (rows: readonly AgentStepRow[]): AgentStepRow | null => {
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const row = rows[i];
    const child = latestRunningRow(row.children);
    if (child) return child;
    if (row.status === "running") return row;
  }
  return null;
};

/** What one running step is doing, in the present tense, without the ellipsis. */
export const activityOf = (row: AgentStepRow): string => {
  // One name for the retrieval step live, folded and expanded (decision 0007);
  // the collections it searched are on the step's meta line.
  if (isKnowledgeBaseTool(row.tool, row.server)) return `Searching ${EVE_SOURCES_LABEL}`;
  if (row.kind === "skill") return `Reading skill ${row.skillName ?? row.title}`;
  if (row.kind === "plan") return "Planning";
  if (row.kind === "subagent") return row.title.replace(/^Ran /, "Running ");
  if (row.kind === "mcp") return `Calling ${row.server ?? row.title}`;
  if (row.tool && Object.prototype.hasOwnProperty.call(ACTIVE_BUILTIN, row.tool)) return ACTIVE_BUILTIN[row.tool];
  return `Running ${row.tool ?? row.title}`;
};

/**
 * The block header while the agent works: "Thinking…" before any step and
 * between steps, the latest running step otherwise; history compression wins
 * when nothing runs.
 */
export const currentActivity = (
  rows: readonly AgentStepRow[],
  opts: { summarizing?: boolean } = {},
): string => {
  const running = latestRunningRow(rows);
  if (running) return `${activityOf(running)}…`;
  if (opts.summarizing) return "Summarizing earlier messages…";
  return "Thinking…";
};

// ---------------------------------------------------------------------------
// Collections a knowledge base search covered
// ---------------------------------------------------------------------------

/** Labels the app knows for collection ids: `GET /collections/public` (id is
 * the Qdrant name, name the alias) and the ids of the user's My collections. */
export type CollectionCatalog = {
  /** Exact id, name and alias to the display label. */
  publicLabels: ReadonlyMap<string, string>;
  /** One entry per public collection: its label and the word forms it answers to. */
  publicEntries: readonly { label: string; forms: readonly string[][] }[];
  /** Every My collections id, or null while the list is incomplete. */
  mine: ReadonlySet<string> | null;
};

export const MY_COLLECTIONS_LABEL = "My collections";
export const CONVERSATION_DOCUMENTS_LABEL = "Conversation documents";
// Backend `services/conversation_documents.py` CONVERSATION_COLLECTION_NAME:
// the display name retrieval gives the documents attached to a conversation.
const CONVERSATION_COLLECTION_NAME = "Attached documents";

export type CollectionRef = {
  key: string;
  label: string;
  /** The user's own documents: My collections or the conversation's. */
  internal: boolean;
};

/** "Wiley AI Gateway", "wiley_ai-gateway" and "WILEY AI gateway" all read
 * ["wiley", "ai", "gateway"]. */
const collectionWords = (value: string): string[] =>
  value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/** `words` is `of`, or its leading words ("wiley" for "Wiley AI Gateway"). */
const leadingWords = (words: readonly string[], of: readonly string[]): boolean =>
  words.length > 0 && words.length <= of.length && words.every((w, i) => w === of[i]);

const sameWords = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && leadingWords(a, b);

/** Fallback label for a key the catalog does not know: "esa_docs" reads "Esa Docs". */
export const titleCaseCollection = (key: string): string => {
  const words = key.split(/[\s_-]+/).filter(Boolean);
  return words.length ? words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") : key;
};

export const buildCollectionCatalog = (
  publicCollections: readonly { id: string; name: string; alias?: string | null }[],
  mine: readonly string[] | null,
): CollectionCatalog => {
  const publicLabels = new Map<string, string>();
  const publicEntries: { label: string; forms: string[][] }[] = [];
  for (const c of publicCollections) {
    const label = c.alias || c.name;
    const keys = [c.id, c.name, c.alias].filter((k): k is string => !!k);
    keys.forEach((k) => publicLabels.set(k, label));
    publicEntries.push({ label, forms: keys.map(collectionWords).filter((f) => f.length > 0) });
  }
  return { publicLabels, publicEntries, mine: mine ? new Set(mine) : null };
};

/**
 * Display label for a public collection key: the exact id, name or alias, then
 * the same words in any case or separator, then the one collection whose
 * label starts with those words (`wiley` is Wiley AI Gateway). Null when the
 * catalog does not know it, or when the leading words fit more than one.
 */
const catalogLabel = (key: string, catalog?: CollectionCatalog | null): string | null => {
  if (!catalog) return null;
  const exact = catalog.publicLabels.get(key);
  if (exact) return exact;
  const words = collectionWords(key);
  if (!words.length) return null;
  const same = catalog.publicEntries.find((e) => e.forms.some((f) => sameWords(words, f)));
  if (same) return same.label;
  const leading = catalog.publicEntries.filter((e) => e.forms.some((f) => leadingWords(words, f)));
  return leading.length === 1 ? leading[0].label : null;
};

const MY_REF: CollectionRef = { key: "internal:mine", label: MY_COLLECTIONS_LABEL, internal: true };
const CONVERSATION_REF: CollectionRef = {
  key: "internal:conversation",
  label: CONVERSATION_DOCUMENTS_LABEL,
  internal: true,
};

/** A public collection by its human label; the key folds case and separators
 * so the same label from two spellings is one entry. */
const publicRef = (name: string, catalog?: CollectionCatalog | null): CollectionRef => {
  const label = catalogLabel(name, catalog) ?? (/[A-Z\s]/.test(name) ? name : titleCaseCollection(name));
  return { key: `public:${collectionWords(label).join(" ")}`, label, internal: false };
};

/**
 * One entry per collection: a label the catalog does not know whose words
 * lead another one's ("Wiley" from an unknown `wiley` key and "Wiley AI
 * Gateway" from its documents) folds into the longer label, at the first
 * one's position. Two catalog collections never fold.
 */
const foldPublicRefs = (refs: CollectionRef[], catalog?: CollectionCatalog | null): CollectionRef[] => {
  const known = new Set(catalog?.publicEntries.map((e) => e.label) ?? []);
  const out: CollectionRef[] = [];
  for (const ref of refs) {
    if (ref.internal) {
      out.push(ref);
      continue;
    }
    const words = collectionWords(ref.label);
    const i = out.findIndex((o) => {
      if (o.internal) return false;
      const other = collectionWords(o.label);
      if (words.length === other.length) return false;
      const shorter = words.length < other.length ? ref.label : o.label;
      return !known.has(shorter) && (leadingWords(words, other) || leadingWords(other, words));
    });
    if (i < 0) out.push(ref);
    else if (words.length > collectionWords(out[i].label).length) out[i] = ref;
  }
  return out;
};

const privateRef = (collectionId: string | null, catalog?: CollectionCatalog | null): CollectionRef =>
  collectionId && catalog?.mine && !catalog.mine.has(collectionId) ? CONVERSATION_REF : MY_REF;

const stringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.trim() !== "") : [];

/** The collection one retrieved document came from. */
export const documentCollection = (doc: unknown, catalog?: CollectionCatalog | null): CollectionRef | null => {
  const payload = pick(doc, "payload");
  const metadata = pick(doc, "metadata") ?? pick(payload, "metadata");
  const name = str(pick(doc, "collection_name", "collection") ?? pick(metadata, "collection_name"));
  if (name === CONVERSATION_COLLECTION_NAME) return CONVERSATION_REF;
  const collectionId = str(pick(payload, "collection_id") ?? pick(doc, "collection_id"));
  if (collectionId || str(pick(metadata, "document_id"))) return privateRef(collectionId, catalog);
  return name ? publicRef(name, catalog) : null;
};

/**
 * Which collections a knowledge base call searched: the ids in its arguments
 * (`public_collections`, `private_collections`), then any other collection
 * its documents came from. One entry per label, in that order.
 */
export const searchedCollections = (row: AgentStepRow, catalog?: CollectionCatalog | null): CollectionRef[] => {
  const refs: CollectionRef[] = [];
  const seen = new Set<string>();
  const add = (ref: CollectionRef | null) => {
    if (!ref || seen.has(ref.key)) return;
    seen.add(ref.key);
    refs.push(ref);
  };
  // The request's selection first: the backend forces it on the call over the
  // model's own arguments. Only live rows carry it; the model's arguments are
  // the fallback.
  const sent = isRecord(row.raw) && isRecord(row.raw.requestCollections) ? row.raw.requestCollections : null;
  const args = isRecord(row.input) ? row.input : {};
  const pub = sent ? stringList(sent.public_collections) : [];
  const priv = sent ? stringList(sent.private_collections) : [];
  const from = pub.length || priv.length ? { public_collections: pub, private_collections: priv } : args;
  stringList(from.public_collections).forEach((name) => add(publicRef(name, catalog)));
  stringList(from.private_collections).forEach((id) => add(privateRef(id, catalog)));
  (documentList(resultValue(row)) ?? []).forEach((doc) => add(documentCollection(doc, catalog)));
  return foldPublicRefs(refs, catalog);
};

/** "GeoAI_workshop_fin…port.pdf": the start, the end and the extension. */
export const middleTruncate = (name: string, max = 27): string => {
  if (name.length <= max) return name;
  const ext = name.match(/\.[A-Za-z0-9]{1,6}$/)?.[0] ?? "";
  const tail = 4;
  const head = Math.max(1, max - 1 - tail - ext.length);
  const base = name.slice(0, name.length - ext.length);
  return `${base.slice(0, head)}…${base.slice(-tail)}${ext}`;
};

export type SourceGroup = { collection: CollectionRef | null; chips: SourceChip[] };

/** Chips grouped by collection, groups in first-seen order. */
export const groupSourceChips = (chips: readonly SourceChip[]): SourceGroup[] => {
  const groups: SourceGroup[] = [];
  const byKey = new Map<string, SourceGroup>();
  for (const chip of chips) {
    const key = chip.collectionRef?.key ?? "";
    let group = byKey.get(key);
    if (!group) {
      group = { collection: chip.collectionRef, chips: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    group.chips.push(chip);
  }
  return groups;
};

/** Epoch ms of the send, read from the optimistic message id (`temp-<ms>`);
 * null for a saved or streamed-back id. */
export const sendTimeFromId = (id: string | null | undefined): number | null => {
  const match = id ? /^temp-(\d{10,})$/.exec(id) : null;
  return match ? Number(match[1]) : null;
};
