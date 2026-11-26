import { QUERY_KEYS } from "./keys";
import { useInfiniteQuery } from "@tanstack/react-query";
import api from "./axios";
import type { Meta } from "@/types";
import { nextPageParam } from "@/utilities/pagination";

export type McpServerAuthor = {
  name: string;
  given_names: string | null;
  family_names: string | null;
  alias: string | null;
  github_url: string | null;
  affiliation: string | null;
  orcid: string | null;
  website: string | null;
};

export type McpPreferredCitation = {
  title: string;
  authors: string[];
  year: string | null;
  doi: string | null;
  url: string | null;
};

/**
 * Citation for one server, from GET /mcp-servers and GET /mcp-servers/{id}.
 * Null means this server has no citation.
 */
export type McpServerAttribution = {
  title: string;
  abstract: string | null;
  authors: McpServerAuthor[];
  license: string | null;
  repository_url: string | null;
  preferred_citation: McpPreferredCitation | null;
};

export type ToolkitCredentialField = {
  name: string;
  label: string;
  /** A secret field is entered masked and never shown again, only its hint. */
  secret: boolean;
  help_text: string | null;
};

/**
 * The credential form a toolkit declares and the state of the caller's own
 * credentials for it, from GET /mcp-servers and PUT /mcp-servers/{id}/credentials.
 * Values are never returned: `hints` holds the last characters of what was
 * saved, keyed by field name.
 */
export type ToolkitUserCredentials = {
  fields: ToolkitCredentialField[];
  /** True when a tool call without the user's credentials is refused. */
  required: boolean;
  help_url: string | null;
  configured: boolean;
  hints: Record<string, string>;
  verified_at: string | null;
  updated_at: string | null;
};

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
  attribution: McpServerAttribution | null;
  /**
   * Null unless the backend flag is on and the toolkit accepts the user's own
   * credentials. Optional so a response from a backend without the field still fits.
   */
  user_credentials?: ToolkitUserCredentials | null;
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
