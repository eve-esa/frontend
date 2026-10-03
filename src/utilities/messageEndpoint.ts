export type MessageRequestMode = "stream" | "sync";

/**
 * Which backend pipeline answers a new chat turn. `agentic` runs the LangGraph
 * agent with MCP tools; `classic` runs retrieve-then-generate, which always
 * searches the knowledge base itself. FEATURE_AGENTIC_CHAT picks one.
 */
export type MessagePipeline = "agentic" | "classic";

export type MessageRequestTarget = {
  url: string;
  extraPayload: { public_mcp_servers?: string[] };
};

/**
 * Resolve the backend endpoint a chat message should hit, and any extra
 * payload fields it needs.
 *
 * Agentic: `mcpServers` only controls `public_mcp_servers`, and it carries
 * eve_retrieval by default (utilities/mcpServers.ts). An empty list means the
 * user switched everything off: the field is omitted, the graph runs with zero
 * tools and does not retrieve. FEATURE_TOOLKITS gates the Toolkits sidebar, not
 * this URL.
 *
 * Classic: `stream_messages` or `messages`, and `mcpServers` is ignored. The
 * classic routes run no tools, so `public_mcp_servers` is never sent.
 */
export function resolveMessageEndpoint(
  conversationId: string | undefined,
  mcpServers: string[],
  mode: MessageRequestMode,
  pipeline: MessagePipeline,
): MessageRequestTarget {
  const base = `/conversations/${conversationId}`;

  if (pipeline === "classic") {
    return {
      url: `${base}/${mode === "stream" ? "stream_messages" : "messages"}`,
      extraPayload: {},
    };
  }

  const path =
    mode === "stream" ? "stream-generate-agentic" : "generate-agentic";

  return {
    url: `${base}/${path}`,
    extraPayload:
      mcpServers.length > 0 ? { public_mcp_servers: mcpServers } : {},
  };
}
