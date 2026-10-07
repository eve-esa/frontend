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

export function applyToolCall(
  activity: ToolActivityEntry[] | undefined,
  evt: Record<string, unknown>,
  serverNames: string[] = [],
): ToolActivityEntry[] {
  const tool = asString(evt.tool);
  return [
    ...(activity ?? []),
    {
      label: asString(evt.label) ?? asString(evt.content) ?? "Calling tool",
      tool,
      query: asString(evt.query),
      server: tool ? mcpServerForTool(tool, serverNames) : undefined,
      state: "running",
    },
  ];
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
