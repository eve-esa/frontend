import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { applyToolCall } from "@/utilities/toolActivity";
import { ToolActivityBar } from "./ToolActivityBar";

const SELECTED = ["eve_retrieval", "geocode"];

const chipFor = (evt: Record<string, unknown>, serverNames = SELECTED) =>
  renderToStaticMarkup(
    <ToolActivityBar activity={applyToolCall(undefined, evt, serverNames)} />,
  );

describe("ToolActivityBar", () => {
  it("names the MCP server and the query", () => {
    const html = chipFor({
      tool: "eve_retrieval_retrieve",
      label: "Calling eve retrieval retrieve",
      query: "Doppler effect",
    });
    expect(html).toContain('data-testid="tool-chip"');
    expect(html).toContain("Calling MCP server: eve_retrieval: Doppler effect");
  });

  it("resolves a server whose tools carry more underscores", () => {
    const html = chipFor({ tool: "geocode_geocode_place", query: "Rome" });
    expect(html).toContain("Calling MCP server: geocode: Rome");
  });

  it("drops the query part when there is none", () => {
    const html = chipFor({ tool: "eve_retrieval_retrieve" });
    expect(html).toContain("<span>Calling MCP server: eve_retrieval</span>");
  });

  it("shows the tool name when no selected server matches", () => {
    const html = chipFor({ tool: "serpapi_search_google", query: "weather" });
    expect(html).toContain(
      "Calling MCP server: serpapi_search_google: weather",
    );
  });

  it("keeps the label of an old backend that sends no tool name", () => {
    const html = chipFor({ content: "Calling tool effis_compute_metrics" });
    expect(html).toContain("<span>tool effis_compute_metrics</span>");
  });

  it("truncates a long query to 40 characters", () => {
    const html = chipFor({
      tool: "eve_retrieval_retrieve",
      query: "a".repeat(50),
    });
    expect(html).toContain(`eve_retrieval: ${"a".repeat(40)}…</span>`);
  });
});
