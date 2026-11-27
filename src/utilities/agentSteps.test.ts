import { describe, expect, it } from "vitest";
import {
  artifactLinks,
  buildCollectionCatalog,
  classifyTool,
  currentActivity,
  documentCollection,
  middleTruncate,
  searchedCollections,
  sourceChips,
  groupSourceChips,
  summarizeRows,
  summaryText,
  rowsFromActivity,
  buildStepsFromActivity,
  buildStepsFromTrace,
  displayModel,
  stepServerAndTool,
} from "./agentSteps";
import type { ToolActivityEntry } from "@/types";

describe("classifyTool", () => {
  it("prefers the explicit kind and server of newer frames", () => {
    expect(classifyTool({ tool: "search", args: {}, kind: "mcp", server: "cdse" }).kind).toBe("mcp");
    expect(classifyTool({ tool: "x", args: {}, kind: "skill", skillName: "ndwi" }).title).toBe("Used skill ndwi");
  });

  it("infers skill, plan, subagent and MCP when the frame has no kind", () => {
    expect(classifyTool({ tool: "read_file", args: { file_path: "/skills/ndwi/SKILL.md" } }).kind).toBe("skill");
    expect(classifyTool({ tool: "read_file", args: { file_path: "/data/a.tif" } }).kind).toBe("builtin");
    expect(classifyTool({ tool: "write_todos", args: { todos: [{ content: "a", status: "completed" }] } }).plan).toEqual([
      { text: "a", status: "done" },
    ]);
    expect(classifyTool({ tool: "task", args: { subagent_type: "literature-review" } }).title).toBe(
      "Ran subagent literature-review",
    );
    const mcp = classifyTool({ tool: "gdacs_search_events", args: {} });
    expect(mcp).toMatchObject({ kind: "mcp", server: "gdacs", title: "Called gdacs search_events" });
  });
});

describe("summaryText", () => {
  it("reads Worked for 1m 32s, 5 steps", () => {
    const rows = rowsFromActivity(
      ["a_x", "a_x", "b_y", "a_x", "b_y"].map((tool) => ({ label: "", tool, state: "done" as const })),
    );
    expect(summaryText(summarizeRows(rows, 92))).toBe("Worked for 1m 32s, 5 steps");
  });

  it("drops the time when the trace has none", () => {
    const rows = rowsFromActivity([{ label: "", tool: "a_x", state: "done" }]);
    expect(summaryText(summarizeRows(rows, null))).toBe("Worked, 1 step");
  });
});

describe("artifactLinks", () => {
  it("reads the artifact markdown stubs once each, images and files", () => {
    expect(
      artifactLinks("![a.png](/artifacts/abc123) and [b.csv](/artifacts/def-456/) and ![a.png](/artifacts/abc123)"),
    ).toEqual([
      { href: "/artifacts/abc123", filename: "a.png" },
      { href: "/artifacts/def-456", filename: "b.csv" },
    ]);
    expect(artifactLinks("[x](/artifacts/abc/url)")).toEqual([]);
    expect(artifactLinks(null)).toEqual([]);
  });
});

describe("collections and live activity", () => {
  const catalog = buildCollectionCatalog([{ id: "wikipedia-512", name: "Wikipedia" }], ["mine-1"]);

  it("maps documents to public labels, My collections and conversation documents", () => {
    expect(documentCollection({ collection_name: "wikipedia-512" }, catalog)).toMatchObject({ label: "Wikipedia", internal: false });
    expect(documentCollection({ collection_name: "Wiley AI Gateway" }, catalog)).toMatchObject({ label: "Wiley AI Gateway" });
    expect(documentCollection({ collection_name: "Mine", payload: { collection_id: "mine-1" } }, catalog)).toMatchObject({
      label: "My collections",
      internal: true,
    });
    expect(documentCollection({ collection_name: "x", payload: { collection_id: "other" } }, catalog)).toMatchObject({
      label: "Conversation documents",
    });
    expect(documentCollection({ collection_name: "Attached documents" }, null)).toMatchObject({
      label: "Conversation documents",
    });
  });

  it("cuts a long file name in the middle and keeps the extension", () => {
    expect(middleTruncate("GeoAI_workshop_final_report.pdf")).toBe("GeoAI_workshop_fin…port.pdf");
    expect(middleTruncate("short.pdf")).toBe("short.pdf");
  });

  it("says Thinking… with nothing running", () => {
    expect(currentActivity([])).toBe("Thinking…");
    const rows = rowsFromActivity([{ label: "x", tool: "execute", state: "running" }]);
    expect(currentActivity(rows)).toBe("Running code…");
  });
});

describe("collection labels from args keys and document names", () => {
  // Live case: the retrieve args carry the key `wiley`, the documents the label.
  const wileyRows = (status: "running" | "done") =>
    rowsFromActivity([
      {
        id: "k",
        label: "",
        tool: "eve_retrieval_retrieve",
        state: status,
        args: { query: "flood", public_collections: ["wiley"] },
        ...(status === "done"
          ? {
              preview: JSON.stringify({
                retrieved_docs: [{ collection_name: "Wiley AI Gateway", metadata: { title: "Flood mapping with SAR" } }],
              }),
            }
          : {}),
      },
    ]);
  const catalog = buildCollectionCatalog([{ id: "Wiley AI Gateway", name: "Wiley AI Gateway" }], null);

  it("names Wiley AI Gateway once in the meta and the source group; the live header says EVE sources", () => {
    const [row] = wileyRows("done");
    expect(searchedCollections(row, catalog).map((c) => c.label)).toEqual(["Wiley AI Gateway"]);
    expect(groupSourceChips(sourceChips(row, catalog)).map((g) => g.collection?.label)).toEqual(["Wiley AI Gateway"]);
    expect(currentActivity(wileyRows("running"))).toBe("Searching EVE sources…");
  });

  it("matches id, name, alias and any case, and never names a collection twice without the catalog", () => {
    const withAlias = buildCollectionCatalog(
      [{ id: "esa-rag-scraped-qwen3-newpipeline", name: "esa-rag-scraped-qwen3-newpipeline", alias: "ESA EO Knowledge Base" }],
      null,
    );
    expect(documentCollection({ collection_name: "esa-rag-scraped-qwen3-newpipeline" }, withAlias)?.label).toBe(
      "ESA EO Knowledge Base",
    );
    expect(documentCollection({ collection_name: "esa eo knowledge base" }, withAlias)?.label).toBe("ESA EO Knowledge Base");
    const [row] = wileyRows("done");
    expect(searchedCollections(row, null).map((c) => c.label)).toEqual(["Wiley AI Gateway"]);
    expect(currentActivity(wileyRows("running"))).toBe("Searching EVE sources…");
  });
});

describe("Details server, tool and model", () => {
  const row = (o: Partial<ToolActivityEntry>) =>
    buildStepsFromActivity([{ label: "Calling tool", state: "done", ...o }]).rows[0];

  it("splits the MCP server from the tool name", () => {
    expect(stepServerAndTool(row({ tool: "cdse_search_stac", server: "cdse" }))).toEqual({ server: "cdse", tool: "search_stac" });
    expect(stepServerAndTool(row({ tool: "eve_retrieval_retrieve" }))).toEqual({ server: "eve_retrieval", tool: "retrieve" });
    expect(stepServerAndTool(row({ tool: "eve_retrieval_retrieve", kind: "mcp", server: "eve_retrieval" }))).toEqual({
      server: "eve_retrieval",
      tool: "retrieve",
    });
    expect(stepServerAndTool(row({ tool: "execute" }))).toEqual({ server: null, tool: "execute" });
  });

  it("prefers the app label over a raw endpoint name", () => {
    expect(displayModel("alias-eve", "EVE-Instruct (JSC)")).toBe("EVE-Instruct (JSC)");
    expect(displayModel("20 - EVE-Instruct - Expert", "EVE-Instruct (JSC)")).toBe("EVE-Instruct (JSC)");
    expect(displayModel("mistral-small-latest", "EVE-Instruct (JSC)")).toBe("mistral-small-latest");
    expect(displayModel("alias-eve", null)).toBe("alias-eve");
  });
});

describe("sourceChips links", () => {
  const rowWith = (url: string) =>
    buildStepsFromActivity([
      {
        label: "Calling tool",
        state: "done",
        id: "k1",
        tool: "eve_retrieval_retrieve",
        preview: JSON.stringify({ retrieved_docs: [{ title: "A paper", url }] }),
      },
    ]).rows[0];

  it.each(["javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "//evil.example/x"])(
    "drops a %s link and keeps the chip",
    (url) => {
      const [chip] = sourceChips(rowWith(url));
      expect(chip.title).toBe("A paper");
      expect(chip.url).toBeNull();
    },
  );

  it("keeps an https link", () => {
    expect(sourceChips(rowWith("https://example.org/a"))[0].url).toBe("https://example.org/a");
  });
});

describe("stopped run total", () => {
  const cut = (id: string, startedAt: string | undefined, durationMs: number) => ({
    id,
    name: "execute",
    args: {},
    step: { tool_call_id: id, kind: "builtin", status: "cancelled", duration_ms: durationMs, started_at: startedAt },
  });

  it("covers the cut call, not only the model node latency", () => {
    const view = buildStepsFromTrace(
      [{ role: "assistant", content: "", started_at_s: 0, latency_s: 3, tool_calls: [cut("a", undefined, 23030)] }] as never,
      { stopped: true },
    );
    expect(view.rows[0].durationS).toBeCloseTo(23.03);
    expect(view.totalS).toBeCloseTo(23.03);
  });

  it("spans from the first start to the last end of the steps", () => {
    const view = buildStepsFromTrace(
      [
        {
          role: "assistant",
          content: "",
          started_at_s: 0,
          latency_s: 1,
          tool_calls: [cut("a", "2026-11-13T10:00:00Z", 5000), cut("b", "2026-11-13T10:00:10Z", 4000)],
        },
      ] as never,
      { stopped: true },
    );
    expect(view.totalS).toBe(14);
    expect(summaryText(view, { stopped: true, stoppedAfterS: view.totalS })).toBe("Stopped after 14s, 2 steps");
  });
});

describe("live reasoning", () => {
  const thinking = (preview: string, state: ToolActivityEntry["state"]): ToolActivityEntry => ({
    label: state === "running" ? "Thinking…" : "Thought",
    state,
    kind: "reasoning",
    id: "reasoning-0",
    preview,
    startedAtMs: 0,
    ...(state === "done" ? { endedAtMs: 4_200 } : {}),
  });

  it("shows a running think that fills, then the duration once it closes", () => {
    const open = rowsFromActivity([thinking("hmm", "running")]);
    expect(open[0]).toMatchObject({
      kind: "reasoning",
      status: "running",
      title: "Thinking…",
      preview: "hmm",
    });
    expect(currentActivity(open)).toBe("Thinking…");

    const closed = rowsFromActivity([thinking("hmm", "done")]);
    expect(closed[0]).toMatchObject({ status: "done", title: "Thought for 4s", preview: "hmm" });
  });

  it("reads reasoning stored on the final answer", () => {
    const view = buildStepsFromTrace([
      {
        role: "assistant",
        content: "done",
        reasoning_content: "hmm",
        started_at_s: 0,
        latency_s: 3,
      },
    ]);
    expect(view.rows[0]).toMatchObject({ kind: "reasoning", preview: "hmm", title: "Thought for 3s" });
  });
});
