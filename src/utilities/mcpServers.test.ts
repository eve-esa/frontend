import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installMemoryLocalStorage } from "@/test-utils/memoryLocalStorage";
import { stubRuntimeConfig } from "@/test-utils/runtimeConfigStub";
import { LOCAL_STORAGE_MCP_SERVERS } from "./localStorage";

const loadMcpServers = (toolkits: "true" | "false") => {
  stubRuntimeConfig({ FEATURE_TOOLKITS: toolkits });
  installMemoryLocalStorage();
  return import("./mcpServers");
};

const seed = (value: unknown) =>
  localStorage.setItem(LOCAL_STORAGE_MCP_SERVERS, JSON.stringify(value));

beforeEach(() => {
  installMemoryLocalStorage();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("getSelectedMcpServerNames with toolkits on", () => {
  it("returns the stored names", async () => {
    const { getSelectedMcpServerNames } = await loadMcpServers("true");
    seed(["weather", "search"]);

    expect(getSelectedMcpServerNames()).toEqual(["weather", "search"]);
  });

  it("returns [] on a missing key, a non-array and invalid JSON", async () => {
    const { getSelectedMcpServerNames } = await loadMcpServers("true");

    expect(getSelectedMcpServerNames()).toEqual([]);
    seed({ weather: true });
    expect(getSelectedMcpServerNames()).toEqual([]);
    localStorage.setItem(LOCAL_STORAGE_MCP_SERVERS, "{not json");
    expect(getSelectedMcpServerNames()).toEqual([]);
  });
});

describe("getSelectedMcpServerNames with toolkits off", () => {
  it("returns [], which is what keeps a message on the classic endpoint", async () => {
    const { getSelectedMcpServerNames } = await loadMcpServers("false");
    seed(["weather"]);

    expect(getSelectedMcpServerNames()).toEqual([]);
  });

  it("leaves the stored selection alone, so flipping the flag back restores it", async () => {
    const { getSelectedMcpServerNames } = await loadMcpServers("false");
    seed(["weather"]);

    getSelectedMcpServerNames();

    expect(localStorage.getItem(LOCAL_STORAGE_MCP_SERVERS)).toBe(
      JSON.stringify(["weather"]),
    );
  });
});
