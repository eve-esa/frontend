import type { ToolActivityEntry } from "@/types";

// Reducers for the per-turn MCP tool activity list. Events arrive from both
// old backends (bare `content` string) and new ones (structured `tool`,
// `label`, `query` fields), so every field is narrowed from unknown instead of
// trusted. Both functions are pure: callers get a new array, never a mutation.

const asString = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

// Tool names are "<server>_<tool>" and server names may contain "_" too, so
// the longest selected server that prefixes the tool wins. A tool from no
// selected server shows its full name.
export function mcpServerForTool(tool: string, serverNames: string[]): string {
  let match: string | undefined;
  for (const name of serverNames) {
    if (
      (tool === name || tool.startsWith(name + "_")) &&
      name.length > (match?.length ?? 0)
    ) {
      match = name;
    }
  }
  return match ?? tool;
}

const asNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

// Copies the optional frame fields that are present, and only those, so an
// entry from an old backend keeps exactly its old shape.
function optionalFields(evt: Record<string, unknown>): Partial<ToolActivityEntry> {
  const out: Partial<ToolActivityEntry> = {};
  // tool_call_id is the step id (stable across retries); id is the model's.
  const id = asString(evt.tool_call_id) ?? asString(evt.id);
  if (id) out.id = id;
  const retryOf = asString(evt.retry_of);
  if (retryOf) out.retryOf = retryOf;
  const errorCode = asString(evt.error_code);
  if (errorCode) out.errorCode = errorCode;
  const model = asString(evt.model);
  if (model) out.model = model;
  if (evt.args_truncated === true) out.argsTruncated = true;
  const subagentName = asString(evt.subagent_name);
  if (subagentName) out.subagentName = subagentName;
  const kind = asString(evt.kind);
  if (kind) out.kind = kind;
  const tier = asString(evt.tier);
  if (tier) out.tier = tier;
  const durationMs = asNumber(evt.duration_ms);
  if (durationMs !== undefined) out.durationMs = durationMs;
  const attempt = asNumber(evt.attempt);
  if (attempt !== undefined) out.attempt = attempt;
  const skillName = asString(evt.skill_name);
  if (skillName) out.skillName = skillName;
  const modelFallback = asString(evt.model_fallback);
  if (modelFallback) out.modelFallback = modelFallback;
  const subagentRunId = asString(evt.subagent_run_id);
  if (subagentRunId) out.subagentRunId = subagentRunId;
  return out;
}

export function applyToolCall(
  activity: ToolActivityEntry[] | undefined,
  evt: Record<string, unknown>,
  serverNames: string[] = [],
  nowMs?: number,
  requestCollections?: ToolActivityEntry["requestCollections"],
): ToolActivityEntry[] {
  const tool = asString(evt.tool);
  const frameServer = asString(evt.server);
  const entry: ToolActivityEntry = {
    label: asString(evt.label) ?? asString(evt.content) ?? "Calling tool",
    tool,
    query: asString(evt.query),
    server: frameServer ?? (tool ? mcpServerForTool(tool, serverNames) : undefined),
    state: "running",
    ...optionalFields(evt),
  };
  if (evt.args !== undefined && evt.args !== null) entry.args = evt.args;
  if (nowMs !== undefined) entry.startedAtMs = nowMs;
  if (requestCollections) entry.requestCollections = requestCollections;
  return [...(activity ?? []), entry];
}

const truncate = (s: string, max: number) =>
  s.length > max ? s.slice(0, max) + "…" : s;

// Chip text: "Calling MCP server: <server>[: <query>]". Old backends send no
// tool name, so their label is kept without its "Calling " prefix.
export function toolChipText(entry: ToolActivityEntry): string {
  const head = entry.server
    ? `Calling MCP server: ${entry.server}`
    : entry.label.replace(/^Calling\s+/i, "");
  return entry.query ? `${head}: ${truncate(entry.query, 40)}` : head;
}

export function applyToolResult(
  activity: ToolActivityEntry[] | undefined,
  evt: Record<string, unknown>,
  nowMs?: number,
): ToolActivityEntry[] {
  const entries = activity ?? [];
  const tool = asString(evt.tool);
  const id = asString(evt.tool_call_id) ?? asString(evt.id);

  // Prefer the first running entry for the named tool; a result whose tool is
  // absent (old backend) or unmatched still completes the oldest running
  // entry, so a name mismatch can't leave a chip spinning forever.
  // A result that names its call id completes that call first.
  let index = id
    ? entries.findIndex((e) => e.state === "running" && e.id === id)
    : -1;
  if (index === -1 && tool) {
    index = entries.findIndex((e) => e.state === "running" && e.tool === tool);
  }
  if (index === -1) {
    index = entries.findIndex((e) => e.state === "running");
  }
  if (index === -1) return entries;

  const preview = asString(evt.preview) ?? asString(evt.content);
  const status =
    evt.status === "error" || evt.status === "timeout"
      ? evt.status
      : evt.status === "ok" || evt.status === "success"
        ? "ok"
        : undefined;
  return entries.map((entry, i) => {
    if (i !== index) return entry;
    const done: ToolActivityEntry = { ...entry, state: "done", ...optionalFields(evt) };
    if (entry.id && !done.id) done.id = entry.id;
    if (preview) done.preview = preview;
    if (status) done.status = status;
    if (nowMs !== undefined) done.endedAtMs = nowMs;
    return done;
  });
}

/** A `model_fallback` frame becomes its own small entry, already done. */
export function applyModelFallback(
  activity: ToolActivityEntry[] | undefined,
  evt: Record<string, unknown>,
): ToolActivityEntry[] {
  const entries = activity ?? [];
  const to = asString(evt.to);
  if (!to) return entries;
  const entry: ToolActivityEntry = {
    label: `Switched to ${to}`,
    state: "done",
    kind: "model_fallback",
    id: `model-fallback-${entries.length}`,
    modelTo: to,
  };
  const from = asString(evt.from);
  if (from) entry.modelFrom = from;
  const reason = asString(evt.reason);
  if (reason) entry.fallbackReason = reason;
  return [...entries, entry];
}

/** `stopped.cancelled_tool_calls`: the named running calls end as cancelled. */
export function applyCancelledCalls(
  activity: ToolActivityEntry[] | undefined,
  evt: Record<string, unknown>,
): ToolActivityEntry[] {
  const entries = activity ?? [];
  const cancelled = Array.isArray(evt.cancelled_tool_calls) ? evt.cancelled_tool_calls : [];
  const byId = new Map<string, Record<string, unknown>>();
  for (const c of cancelled) {
    if (c && typeof c === "object") {
      const id = asString((c as Record<string, unknown>).tool_call_id);
      if (id) byId.set(id, c as Record<string, unknown>);
    }
  }
  if (byId.size === 0) return entries;
  return entries.map((entry) => {
    const hit = entry.id && entry.state === "running" ? byId.get(entry.id) : undefined;
    if (!hit) return entry;
    const done: ToolActivityEntry = { ...entry, state: "done", status: "cancelled" };
    const ms = asNumber(hit.duration_ms);
    if (ms !== undefined) done.durationMs = ms;
    return done;
  });
}
