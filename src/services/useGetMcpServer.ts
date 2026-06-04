import { QUERY_KEYS } from "./keys";
import { useQuery } from "@tanstack/react-query";
import api from "./axios";
import type { McpServerPublic } from "./useGetMcpServers";

export type McpTool = {
  name?: string;
  description?: string;
};

export type McpServerDetail = McpServerPublic & {
  tools: McpTool[];
};

const getMcpServer = async (serverId: string): Promise<McpServerDetail> => {
  const { data } = await api.get(`/mcp-servers/${serverId}`);
  return data;
};

export const useGetMcpServer = (
  serverId: string | null | undefined,
  enabled: boolean
) => {
  return useQuery({
    queryKey: [QUERY_KEYS.mcpServer, serverId],
    queryFn: () => getMcpServer(serverId!),
    enabled: enabled && !!serverId,
  });
};
