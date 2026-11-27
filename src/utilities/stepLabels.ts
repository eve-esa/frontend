import {
  EVE_SOURCES_LABEL,
  activityOf,
  isKnowledgeBaseTool,
  isSandboxStep,
  sandboxCode,
  sandboxLanguage,
  latestRunningRow,
  searchedCollections,
  shortToolName,
  type AgentStepRow,
  type CollectionCatalog,
} from "@/utilities/agentSteps";

/** One target of a step: what the verb acted on (collection, server, tool, skill). */
export type StepTarget = { label: string; kind: "collection" | "server" | "tool" | "skill" | "subagent"; internal?: boolean };

/** A step label split for display: the verb as text, the targets as chips. */
export type VerbTarget = { verb: string; targets: StepTarget[] };

const toolTarget = (tool: string | null): StepTarget[] => (tool ? [{ label: tool, kind: "tool" }] : []);

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

/** One row in the present tense, targets as chips: "Running code", "Calling" gdacs search_events. */
const presentVerbTarget = (row: AgentStepRow, catalog?: CollectionCatalog | null): VerbTarget => {
  if (isKnowledgeBaseTool(row.tool, row.server)) return stepVerbTarget({ ...row, status: "running" }, catalog);
  const done = stepVerbTarget({ ...row, status: "done" }, catalog);
  if (row.kind === "mcp") return { verb: "Calling", targets: done.targets };
  if (row.kind === "skill" && row.skillName) return { verb: "Reading skill", targets: done.targets };
  if (row.kind === "subagent" && done.targets.length) return { verb: "Running subagent", targets: done.targets };
  if (done.verb === "Used tool") return { verb: "Running", targets: done.targets };
  return { verb: activityOf(row), targets: [] };
};

/**
 * The verb and targets of a row: past tense once finished, present while it
 * runs; a call a Stop cut reads "Stopped while running code", one that never
 * ran "Not run" with its targets (the tool when it has none).
 */
export const stepVerbTarget = (row: AgentStepRow, catalog?: CollectionCatalog | null): VerbTarget => {
  if (row.status === "stopped") {
    const present = presentVerbTarget(row, catalog);
    return { verb: `Stopped while ${lowerFirst(present.verb)}`, targets: present.targets };
  }
  if (row.status === "not_run") {
    const done = stepVerbTarget({ ...row, status: "done" }, catalog);
    return { verb: "Not run", targets: done.targets.length ? done.targets : toolTarget(row.tool) };
  }
  if (isKnowledgeBaseTool(row.tool, row.server)) {
    const collections = searchedCollections(row, catalog ?? null);
    const verb = row.status === "running" ? "Searching" : "Searched";
    if (collections.length === 0) return { verb: `${verb} the knowledge base`, targets: [] };
    return {
      verb,
      targets: collections.map((c) => ({ label: c.label, kind: "collection", internal: c.internal })),
    };
  }
  if (row.kind === "mcp") {
    const targets: StepTarget[] = [];
    if (row.server) targets.push({ label: row.server, kind: "server" });
    targets.push(...toolTarget(shortToolName(row.tool, row.server) || null));
    return { verb: "Called", targets };
  }
  if (row.kind === "skill" && row.skillName) {
    return { verb: "Used skill", targets: [{ label: row.skillName, kind: "skill" }] };
  }
  if (row.kind === "subagent") {
    const name = row.title.replace(/^Ran subagent\s*/, "");
    return name ? { verb: "Ran subagent", targets: [{ label: name, kind: "subagent" }] } : { verb: row.title, targets: [] };
  }
  const used = /^Used tool (.+)$/.exec(row.title);
  if (used) return { verb: "Used tool", targets: [{ label: used[1], kind: "tool" }] };
  return { verb: row.title, targets: [] };
};

/** The live header split the same way: present tense, no ellipsis; null
 * when no step runs (the header then reads "Thinking…" or "Summarizing…"). */
export const activityVerbTarget = (
  rows: readonly AgentStepRow[],
  catalog?: CollectionCatalog | null,
): VerbTarget | null => {
  const row = latestRunningRow(rows);
  if (!row || row.kind === "reasoning") return null;
  if (isKnowledgeBaseTool(row.tool, row.server)) return stepVerbTarget({ ...row, status: "running" }, catalog);
  if (row.kind === "mcp") return { verb: "Calling", targets: row.server ? [{ label: row.server, kind: "server" }] : [] };
  if (row.kind === "skill" && row.skillName) return { verb: "Reading skill", targets: [{ label: row.skillName, kind: "skill" }] };
  if (row.kind === "subagent") {
    const split = stepVerbTarget(row, catalog);
    return split.targets.length ? { verb: "Running subagent", targets: split.targets } : null;
  }
  const split = stepVerbTarget(row, catalog);
  if (split.verb === "Used tool") return { verb: "Running", targets: split.targets };
  return null;
};

/**
 * One row of the block (decision 0003, shadcn Trace and LibreChat rows):
 * the verb first, its tense showing the status ("Searching" live,
 * "Searched" done, "Failed to search" failed), then the target as a chip,
 * the MCP server as muted secondary text ("in cdse"), then the muted detail
 * (the query, the first code line).
 */
export type StepLine = {
  targets: StepTarget[];
  verb: string;
  detail: string | null;
  /** Kept for the callers: every row now reads verb first. */
  verbFirst: boolean;
  /** Muted secondary text after the chip: the MCP server, "in cdse". */
  secondary: string | null;
  /** True on a failed row: the verb says it, in the danger token. */
  failed: boolean;
};

const quoted = (text: string | null): string | null => (text ? `"${text}"` : null);
const firstLine = (text: string | null, max = 80): string | null => {
  const line = text?.split("\n").find((l) => l.trim() !== "")?.trim() ?? null;
  return line && line.length > max ? `${line.slice(0, max - 1)}…` : line;
};

const line = (
  targets: StepTarget[],
  verb: string,
  detail: string | null,
  failed: boolean,
  secondary: string | null = null,
): StepLine => ({ targets, verb, detail, verbFirst: true, secondary, failed });

export const stepLine = (row: AgentStepRow, catalog?: CollectionCatalog | null): StepLine => {
  const present = row.status === "running" || row.status === "stopped";
  const failed = row.status === "error";
  if (row.kind === "reasoning") {
    return line([], present ? "Thinking" : row.title, null, false);
  }
  if (row.kind === "group" && row.children.length > 0) {
    // "Searched EVE sources 3 times": the calls' own verb and chip, in the
    // group's tense, and the count as the detail.
    const call = stepLine({ ...row.children[0], status: row.status }, catalog);
    return line(call.targets, call.verb, `${row.children.length} times`, call.failed, call.secondary);
  }
  if (isKnowledgeBaseTool(row.tool, row.server)) {
    // One name, as the preview: the same chip live, after the result and
    // after a reload (the collections, which change between those three, and
    // the tool id are on the step's meta line).
    return line(
      [{ label: EVE_SOURCES_LABEL, kind: "server" }],
      failed ? "Failed to search" : present ? "Searching" : "Searched",
      quoted(row.query),
      failed,
    );
  }
  if (isSandboxStep(row)) {
    // The language as the chip (decision 0007), never the sandbox id.
    return line(
      [{ label: sandboxLanguage(row.input), kind: "tool" }],
      failed ? "Failed to run code" : present ? "Running code" : "Ran code",
      firstLine(sandboxCode(row.input)),
      failed,
    );
  }
  if (row.kind === "mcp") {
    const tool = shortToolName(row.tool, row.server) || null;
    return line(
      toolTarget(tool),
      failed ? "Failed to call" : present ? "Calling" : "Called",
      quoted(row.query),
      failed,
      row.server ? `in ${row.server}` : null,
    );
  }
  if (row.kind === "skill" && row.skillName) {
    return line(
      [{ label: row.skillName, kind: "skill" }],
      failed ? "Failed to read skill" : present ? "Reading skill" : "Used skill",
      null,
      failed,
    );
  }
  if (row.kind === "subagent") {
    const name = row.title.replace(/^Ran subagent\s*/, "");
    return line(
      name ? [{ label: name, kind: "subagent" }] : [],
      failed ? "Failed to run subagent" : present ? "Running subagent" : "Ran subagent",
      quoted(row.query),
      failed,
    );
  }
  const used = /^Used tool (.+)$/.exec(row.title);
  if (used) {
    return line(
      [{ label: used[1], kind: "tool" }],
      failed ? "Failed to run" : present ? "Running" : "Used tool",
      null,
      failed,
    );
  }
  const verb = present && (row.kind === "builtin" || row.kind === "other") ? activityOf(row) : row.title;
  return line([], verb, row.kind === "builtin" ? firstLine(row.query) : null, failed);
};

const STATUS_PHRASE: Record<AgentStepRow["status"], string> = {
  running: "running",
  done: "done",
  error: "failed",
  stopped: "stopped",
  not_run: "not run",
};

/** Seconds read aloud: "2.1 seconds", "1 second". */
const spokenSeconds = (seconds: number): string => {
  const value = seconds < 10 ? Number(seconds.toFixed(1)) : Math.round(seconds);
  return `${value} ${value === 1 ? "second" : "seconds"}`;
};

/**
 * One sentence per row for assistive tech, verb first and the status last
 * (pattern after shadcn/ui Trace: the title is the accessible name and states
 * the status; no code copied): `Searched EVE sources for "Po delta", done
 * in 2.1 seconds`, `Ran code Python python a.py, failed`.
 */
export const stepSentence = (row: AgentStepRow, catalog?: CollectionCatalog | null): string => {
  const split = stepLine(row, catalog);
  const targets = split.targets.map((t) => t.label).join(", ");
  const head = [split.verb, targets, split.secondary].filter(Boolean).join(" ");
  // "for" before a search query only; a command, a tool or a path follows as is.
  const forQuery = isKnowledgeBaseTool(row.tool, row.server) && row.kind !== "group";
  const detail = split.detail ? (forQuery ? ` for ${split.detail}` : ` ${split.detail}`) : "";
  const failed = row.kind === "group" ? row.children.filter((c) => c.status === "error").length : 0;
  const status =
    failed > 0 && row.status !== "running"
      ? `${failed} failed`
      : row.status === "done" && row.durationS !== null
        ? `done in ${spokenSeconds(row.durationS)}`
        : STATUS_PHRASE[row.status];
  return `${head}${detail}, ${status}`;
};
