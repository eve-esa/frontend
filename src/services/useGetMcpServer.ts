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
  /**
   * Why tool discovery failed, or null when it succeeded (backend #147).
   *
   * When this is set, `tools` is empty because the server could not be queried,
   * NOT because it exposes nothing. The two must never render the same way.
   */
  tools_error?: string | null;
};

type UseGetMcpServerOptions = {
  enabled?: boolean;
};

const getMcpServer = async (serverId: string): Promise<McpServerDetail> => {
  const { data } = await api.get(`/mcp-servers/${serverId}`);
  return data;
};

export const useGetMcpServer = (
  serverId: string | null | undefined,
  { enabled = false }: UseGetMcpServerOptions = {}
) => {
  return useQuery({
    queryKey: [QUERY_KEYS.mcpServer, serverId],
    queryFn: () => getMcpServer(serverId!),
    enabled: enabled && !!serverId,
  });
};
