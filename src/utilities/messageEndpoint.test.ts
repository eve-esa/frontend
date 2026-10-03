import { describe, expect, it } from "vitest";
import { resolveMessageEndpoint } from "./messageEndpoint";

describe("resolveMessageEndpoint, agentic pipeline", () => {
  it("targets the agentic streaming endpoint when no MCP server is selected", () => {
    expect(resolveMessageEndpoint("conv-1", [], "stream", "agentic")).toEqual({
      url: "/conversations/conv-1/stream-generate-agentic",
      extraPayload: {},
    });
  });

  it("targets the agentic non-streaming endpoint when no MCP server is selected", () => {
    expect(resolveMessageEndpoint("conv-1", [], "sync", "agentic")).toEqual({
      url: "/conversations/conv-1/generate-agentic",
      extraPayload: {},
    });
  });

  it("targets the agentic streaming endpoint and attaches server names when selected", () => {
    expect(
      resolveMessageEndpoint("conv-1", ["weather", "search"], "stream", "agentic"),
    ).toEqual({
      url: "/conversations/conv-1/stream-generate-agentic",
      extraPayload: { public_mcp_servers: ["weather", "search"] },
    });
  });

  it("targets the agentic non-streaming endpoint and attaches server names when selected", () => {
    expect(
      resolveMessageEndpoint("conv-1", ["weather"], "sync", "agentic"),
    ).toEqual({
      url: "/conversations/conv-1/generate-agentic",
      extraPayload: { public_mcp_servers: ["weather"] },
    });
  });

  it("keeps working without a conversation id (new conversation flow)", () => {
    expect(resolveMessageEndpoint(undefined, [], "stream", "agentic")).toEqual({
      url: "/conversations/undefined/stream-generate-agentic",
      extraPayload: {},
    });
  });
});

describe("resolveMessageEndpoint, classic pipeline", () => {
  it("targets the classic streaming endpoint", () => {
    expect(resolveMessageEndpoint("conv-1", [], "stream", "classic")).toEqual({
      url: "/conversations/conv-1/stream_messages",
      extraPayload: {},
    });
  });

  it("targets the classic non-streaming endpoint", () => {
    expect(resolveMessageEndpoint("conv-1", [], "sync", "classic")).toEqual({
      url: "/conversations/conv-1/messages",
      extraPayload: {},
    });
  });

  it("never sends public_mcp_servers, even with servers selected", () => {
    expect(
      resolveMessageEndpoint("conv-1", ["eve_retrieval", "weather"], "stream", "classic"),
    ).toEqual({
      url: "/conversations/conv-1/stream_messages",
      extraPayload: {},
    });
    expect(
      resolveMessageEndpoint("conv-1", ["eve_retrieval"], "sync", "classic"),
    ).toEqual({
      url: "/conversations/conv-1/messages",
      extraPayload: {},
    });
  });
});
