import { describe, expect, it } from "vitest";
import type { ToolActivityEntry } from "@/types";
import { buildCollectionCatalog, buildStepsFromActivity } from "@/utilities/agentSteps";
import { activityVerbTarget, stepVerbTarget } from "./stepLabels";

const entry = (o: Partial<ToolActivityEntry>): ToolActivityEntry => ({ label: "Calling tool", state: "done", ...o });
const row = (o: Partial<ToolActivityEntry>) => buildStepsFromActivity([entry(o)]).rows[0];

describe("stepVerbTarget", () => {
  it("splits an MCP call into the verb and server and tool targets", () => {
    const split = stepVerbTarget(row({ tool: "gdacs_search_events", server: "gdacs" }));
    expect(split.verb).toBe("Called");
    expect(split.targets.map((t) => [t.kind, t.label])).toEqual([
      ["server", "gdacs"],
      ["tool", "search_events"],
    ]);
  });

  it("splits a skill read and keeps built-in verbs whole", () => {
    expect(stepVerbTarget(row({ tool: "read_file", args: { file_path: "/skills/ndvi/SKILL.md" } }))).toEqual({
      verb: "Used skill",
      targets: [{ label: "ndvi", kind: "skill" }],
    });
    expect(stepVerbTarget(row({ tool: "execute", args: { command: "ls" } }))).toEqual({ verb: "Ran code", targets: [] });
  });

  it("names the knowledge base without a chip when no collection is known", () => {
    expect(stepVerbTarget(row({ tool: "eve_retrieval_retrieve" })).verb).toBe("Searched the knowledge base");
  });
});

describe("activityVerbTarget", () => {
  it("is present tense for the running step and null between steps", () => {
    const rows = buildStepsFromActivity([entry({ id: "a", tool: "search", kind: "mcp", server: "cdse", state: "running" })]).rows;
    expect(activityVerbTarget(rows)).toEqual({ verb: "Calling", targets: [{ label: "cdse", kind: "server" }] });
    expect(activityVerbTarget(buildStepsFromActivity([entry({ tool: "ls" })]).rows)).toBeNull();
  });
});

describe("stepVerbTarget for a cut or unrun call", () => {
  const stopped = (o: Partial<ToolActivityEntry>) => row({ status: "cancelled", ...o });
  const notRun = (o: Partial<ToolActivityEntry>) => ({ ...row(o), status: "not_run" as const });

  it("says a Stop cut the call, in the present tense of what it was doing", () => {
    expect(stepVerbTarget(stopped({ tool: "execute", kind: "builtin" }))).toEqual({
      verb: "Stopped while running code",
      targets: [],
    });
    expect(stepVerbTarget(stopped({ tool: "eve_retrieval_retrieve" })).verb).toBe(
      "Stopped while searching the knowledge base",
    );
    const mcp = stepVerbTarget(stopped({ tool: "gdacs_search_events", server: "gdacs", kind: "mcp" }));
    expect(mcp.verb).toBe("Stopped while calling");
    expect(mcp.targets.map((t) => t.label)).toEqual(["gdacs", "search_events"]);
  });

  it("names a call that never ran as Not run with its tool", () => {
    expect(stepVerbTarget(notRun({ tool: "execute", kind: "builtin" }))).toEqual({
      verb: "Not run",
      targets: [{ label: "execute", kind: "tool" }],
    });
    const mcp = stepVerbTarget(notRun({ tool: "gdacs_search_events", server: "gdacs", kind: "mcp" }));
    expect(mcp.verb).toBe("Not run");
    expect(mcp.targets.map((t) => t.label)).toEqual(["gdacs", "search_events"]);
  });
});

describe("knowledge base target from the request", () => {
  const catalog = buildCollectionCatalog([{ id: "wiley", name: "Wiley AI Gateway" }], null);
  const kb = (o: Partial<ToolActivityEntry>) =>
    row({ tool: "eve_retrieval_retrieve", state: "running", args: { query: "Sentinel-3 OLCI" }, ...o });

  it("names the requested collection as a chip when the model sent none", () => {
    const live = kb({ requestCollections: { public_collections: ["wiley"], private_collections: [] } });
    expect(stepVerbTarget(live, catalog)).toEqual({
      verb: "Searching",
      targets: [{ label: "Wiley AI Gateway", kind: "collection", internal: false }],
    });
    expect(activityVerbTarget([live], catalog)?.targets.map((t) => t.label)).toEqual(["Wiley AI Gateway"]);
  });

  it("prefers the request over the model's own guess: the backend overrides it", () => {
    const live = kb({
      args: { query: "q", public_collections: ["something else"] },
      requestCollections: { public_collections: ["wiley"], private_collections: [] },
    });
    expect(stepVerbTarget(live, catalog).targets.map((t) => t.label)).toEqual(["Wiley AI Gateway"]);
  });

  it("falls back to the knowledge base when no collection is known", () => {
    expect(stepVerbTarget(kb({}), catalog)).toEqual({ verb: "Searching the knowledge base", targets: [] });
  });
});
