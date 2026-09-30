export type MessageRequestMode = "stream" | "sync";

export type MessageRequestTarget = {
  url: string;
  extraPayload: { public_mcp_servers?: string[] };
};

/**
 * Resolve the agentic backend endpoint a chat message should hit, and any extra
 * payload fields it needs.
 *
 * Every new send uses the agentic pipeline, whether or not MCP servers are
 * selected. `mcpServers` only controls `public_mcp_servers`, and it carries
 * eve_retrieval by default (utilities/mcpServers.ts). An empty list means the
 * user switched everything off: the field is omitted, the graph runs with zero
 * tools and does not retrieve. FEATURE_TOOLKITS gates the Toolkits sidebar, not
 * this URL.
 */
export function resolveMessageEndpoint(
  conversationId: string | undefined,
  mcpServers: string[],
  mode: MessageRequestMode,
): MessageRequestTarget {
  const base = `/conversations/${conversationId}`;
  const path =
    mode === "stream" ? "stream-generate-agentic" : "generate-agentic";

  return {
    url: `${base}/${path}`,
    extraPayload:
      mcpServers.length > 0 ? { public_mcp_servers: mcpServers } : {},
  };
}
