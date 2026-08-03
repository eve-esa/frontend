import { describe, expect, it } from "vitest";
import { resolveMessageEndpoint } from "./messageEndpoint";

describe("resolveMessageEndpoint", () => {
  it("targets the classic streaming endpoint when no MCP server is selected", () => {
    expect(resolveMessageEndpoint("conv-1", [], "stream")).toEqual({
      url: "/conversations/conv-1/stream_messages",
      extraPayload: {},
    });
  });

  it("targets the classic non-streaming endpoint when no MCP server is selected", () => {
    expect(resolveMessageEndpoint("conv-1", [], "sync")).toEqual({
      url: "/conversations/conv-1/messages",
      extraPayload: {},
    });
  });

  it("targets the agentic streaming endpoint and attaches server names when selected", () => {
    expect(
      resolveMessageEndpoint("conv-1", ["weather", "search"], "stream"),
    ).toEqual({
      url: "/conversations/conv-1/stream-generate-agentic",
      extraPayload: { public_mcp_servers: ["weather", "search"] },
    });
  });

  it("targets the agentic non-streaming endpoint and attaches server names when selected", () => {
    expect(resolveMessageEndpoint("conv-1", ["weather"], "sync")).toEqual({
      url: "/conversations/conv-1/generate-agentic",
      extraPayload: { public_mcp_servers: ["weather"] },
    });
  });

  it("keeps working without a conversation id (new conversation flow)", () => {
    expect(resolveMessageEndpoint(undefined, [], "stream")).toEqual({
      url: "/conversations/undefined/stream_messages",
      extraPayload: {},
    });
  });
});
