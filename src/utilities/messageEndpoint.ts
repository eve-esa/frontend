export type MessageRequestMode = "stream" | "sync";

export type MessageRequestTarget = {
  url: string;
  extraPayload: { public_mcp_servers?: string[] };
};

/**
 * Resolve which backend endpoint a chat message should hit, and the extra
 * payload fields it needs, based on the set of MCP servers the user enabled.
 *
 * With an empty `mcpServers` selection this resolves to the classic RAG
 * endpoints, so behaviour stays byte-identical to the pre-MCP implementation.
 * With one or more servers selected, it targets the agentic pipeline and
 * attaches `public_mcp_servers` to the payload.
 */
export function resolveMessageEndpoint(
  conversationId: string | undefined,
  mcpServers: string[],
  mode: MessageRequestMode,
): MessageRequestTarget {
  const isAgentic = mcpServers.length > 0;
  const base = `/conversations/${conversationId}`;
  const path = isAgentic
    ? mode === "stream"
      ? "stream-generate-agentic"
      : "generate-agentic"
    : mode === "stream"
      ? "stream_messages"
      : "messages";

  return {
    url: `${base}/${path}`,
    extraPayload: isAgentic ? { public_mcp_servers: mcpServers } : {},
  };
}
