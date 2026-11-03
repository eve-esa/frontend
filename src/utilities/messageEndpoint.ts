export type MessageRequestMode = "stream" | "sync";

/**
 * Which backend pipeline answers a new chat turn. `agentic` runs the LangGraph
 * agent with MCP tools; `classic` runs retrieve-then-generate, which always
 * searches the knowledge base itself. FEATURE_AGENTIC_CHAT picks one.
 */
export type MessagePipeline = "agentic" | "classic";

export type MessageRequestTarget = {
  url: string;
  extraPayload: {
    public_mcp_servers?: string[];
    skills?: string[];
  };
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
 * `skills` is names only (utilities/skills.ts), the ones switched on in the
 * Toolkits panel. A non-empty list is sent as `skills` beside
 * `public_mcp_servers`. An empty list omits the field. The server keeps the
 * skills from the conversation's first turn, so a later toggle applies to
 * the next new conversation. File bodies are not part of this field.
 *
 * Classic: `stream_messages` or `messages`. `mcpServers` and `skills` are
 * ignored. The classic routes run no tools, so `public_mcp_servers` and
 * `skills` are never sent.
 */
export function resolveMessageEndpoint(
  conversationId: string | undefined,
  mcpServers: string[],
  skills: string[],
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

  const extraPayload: MessageRequestTarget["extraPayload"] = {};
  if (mcpServers.length > 0) extraPayload.public_mcp_servers = mcpServers;
  if (skills.length > 0) extraPayload.skills = skills;

  return {
    url: `${base}/${path}`,
    extraPayload,
  };
}
