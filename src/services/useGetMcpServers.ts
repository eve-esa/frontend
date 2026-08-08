import { QUERY_KEYS } from "./keys";
import { useInfiniteQuery } from "@tanstack/react-query";
import api from "./axios";
import type { Meta } from "@/types";
import { nextPageParam } from "@/utilities/pagination";

export type McpServerPublic = {
  id: string | null;
  timestamp: string;
  name: string;
  provider: string | null;
  description: string | null;
  type: string;
  enabled: boolean;
  environment: string[] | null;
  config: {
    transport: "streamable_http" | "stdio" | null;
    url: string | null;
  };
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type McpServersResponse = {
  data: McpServerPublic[];
  meta: Meta;
};

export type GetMcpServersParams = {
  limit?: number;
  page?: string;
};

const getMcpServers = async ({
  limit = 20,
  page = "1",
}: GetMcpServersParams): Promise<McpServersResponse> => {
  const params = new URLSearchParams({
    limit: limit.toString(),
    page,
  });

  const { data } = await api.get(`/mcp-servers?${params.toString()}`);
  return data;
};

export const useGetMcpServers = ({
  limit = 20,
}: Omit<GetMcpServersParams, "page"> = {}) => {
  return useInfiniteQuery({
    queryKey: [QUERY_KEYS.mcpServers, limit],
    queryFn: ({ pageParam }) =>
      getMcpServers({
        limit,
        page: pageParam.toString(),
      }),
    initialPageParam: 1,
    getNextPageParam: nextPageParam,
  });
};
