import type { ToolActivityEntry } from "@/types";

// Reducers for the per-turn MCP tool activity list. Events arrive from both
// old backends (bare `content` string) and new ones (structured `tool`,
// `label`, `query` fields), so every field is narrowed from unknown instead of
// trusted. Both functions are pure: callers get a new array, never a mutation.

const asString = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

export function applyToolCall(
  activity: ToolActivityEntry[] | undefined,
  evt: Record<string, unknown>,
): ToolActivityEntry[] {
  return [
    ...(activity ?? []),
    {
      label: asString(evt.label) ?? asString(evt.content) ?? "Calling tool",
      tool: asString(evt.tool),
      query: asString(evt.query),
      state: "running",
    },
  ];
}

export function applyToolResult(
  activity: ToolActivityEntry[] | undefined,
  evt: Record<string, unknown>,
): ToolActivityEntry[] {
  const entries = activity ?? [];
  const tool = asString(evt.tool);

  // Prefer the first running entry for the named tool; a result whose tool is
  // absent (old backend) or unmatched still completes the oldest running
  // entry, so a name mismatch can't leave a chip spinning forever.
  let index = tool
    ? entries.findIndex((e) => e.state === "running" && e.tool === tool)
    : -1;
  if (index === -1) {
    index = entries.findIndex((e) => e.state === "running");
  }
  if (index === -1) return entries;

  return entries.map((entry, i) =>
    i === index ? { ...entry, state: "done" } : entry,
  );
}
