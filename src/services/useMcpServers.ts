import { useQuery } from "@tanstack/react-query";
import api from "./axios";
import { QUERY_KEYS } from "./keys";
import type { Meta } from "@/types";

export type MCPServerPublic = {
  id: string | null;
  timestamp: string;
  name: string;
  provider: string | null;
  description: string | null;
  type: string;
  enabled: boolean;
  environment: string[] | null;
  config: {
    transport: string | null;
    url: string | null;
  };
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type McpServersResponse = {
  data: MCPServerPublic[];
  meta: Meta;
};

// Servers are registered by an admin, so a single page comfortably covers
// the expected list size without needing infinite pagination here.
const MCP_SERVERS_LIMIT = 100;

const getMcpServers = async (): Promise<McpServersResponse> => {
  const params = new URLSearchParams({
    limit: MCP_SERVERS_LIMIT.toString(),
    page: "1",
  });
  const { data } = await api.get<McpServersResponse>(
    `/mcp-servers?${params.toString()}`,
  );
  return data;
};

export const useMcpServers = () => {
  return useQuery({
    queryKey: [QUERY_KEYS.mcpServers],
    queryFn: getMcpServers,
    staleTime: 60 * 1000,
  });
};
