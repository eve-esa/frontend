import { describe, expect, it } from "vitest";
import { enabledToolkits, shouldShowToolkitsEntry } from "./toolkits";
import type { McpServersResponse } from "@/services/useGetMcpServers";

const server = (name: string, enabled: boolean) =>
  ({
    id: name,
    timestamp: "",
    name,
    provider: null,
    description: null,
    type: "mcp",
    enabled,
    environment: null,
    config: { transport: "streamable_http" as const, url: null },
    created_at: "",
    updated_at: "",
    deleted_at: null,
  });

const page = (...servers: ReturnType<typeof server>[]): McpServersResponse => ({
  data: servers,
  meta: {
    current_page: 1,
    has_next: false,
    total_count: servers.length,
    total_pages: 1,
  },
});

describe("enabledToolkits", () => {
  it("returns nothing before the first page has loaded", () => {
    expect(enabledToolkits(undefined)).toEqual([]);
  });

  it("flattens every loaded page", () => {
    const result = enabledToolkits([
      page(server("effis", true)),
      page(server("geocode", true)),
    ]);
    expect(result.map((s) => s.name)).toEqual(["effis", "geocode"]);
  });

  it("drops disabled servers, so a catalog of only disabled ones reads as empty", () => {
    const result = enabledToolkits([
      page(server("retired", false), server("effis", true)),
    ]);
    expect(result.map((s) => s.name)).toEqual(["effis"]);
  });
});

describe("shouldShowToolkitsEntry", () => {
  it("hides the entry while the catalog is still loading", () => {
    // Showing first and hiding a moment later flickers on every page load in
    // production, which is precisely the environment with an empty catalog.
    expect(
      shouldShowToolkitsEntry({ isPending: true, isError: false, enabledCount: 0 })
    ).toBe(false);
  });

  it("hides the entry when the catalog came back empty", () => {
    expect(
      shouldShowToolkitsEntry({ isPending: false, isError: false, enabledCount: 0 })
    ).toBe(false);
  });

  it("shows the entry as soon as one enabled toolkit exists", () => {
    expect(
      shouldShowToolkitsEntry({ isPending: false, isError: false, enabledCount: 1 })
    ).toBe(true);
  });

  it("SHOWS the entry when the request failed, because that is not an empty catalog", () => {
    // The whole point of the change is to hide a feature that has nothing to
    // offer, not to hide a broken API. A failed request that silently removed
    // the entry would be indistinguishable from a deliberate configuration.
    expect(
      shouldShowToolkitsEntry({ isPending: false, isError: true, enabledCount: 0 })
    ).toBe(true);
  });

  it("shows the entry on error even while a retry is pending", () => {
    expect(
      shouldShowToolkitsEntry({ isPending: true, isError: true, enabledCount: 0 })
    ).toBe(true);
  });
});
