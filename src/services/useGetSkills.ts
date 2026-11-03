import { QUERY_KEYS } from "./keys";
import { useInfiniteQuery } from "@tanstack/react-query";
import api from "./axios";
import type { Meta } from "@/types";
import { nextPageParam } from "@/utilities/pagination";

// One file in a skill folder. `path` is relative to that folder. `size` is
// the byte length. This object has no body; nothing here fetches one.
export type SkillFile = {
  path: string;
  size: number;
};

export type SkillPublic = {
  id: string | null;
  timestamp: string;
  name: string;
  description: string;
  enabled: boolean;
  requires_mcp_servers: string[];
  files: SkillFile[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type SkillsResponse = {
  data: SkillPublic[];
  meta: Meta;
};

export type GetSkillsParams = {
  limit?: number;
  page?: string;
};

// Same page shape as GET /mcp-servers. Disabled rows are included. The
// server already hides other users' skills and soft-deleted ones.
export const getSkills = async ({
  limit = 20,
  page = "1",
}: GetSkillsParams): Promise<SkillsResponse> => {
  const params = new URLSearchParams({
    limit: limit.toString(),
    page,
  });

  const { data } = await api.get(`/skills?${params.toString()}`);
  return data;
};

export const useGetSkills = ({
  limit = 20,
}: Omit<GetSkillsParams, "page"> = {}) => {
  return useInfiniteQuery({
    queryKey: [QUERY_KEYS.skills, limit],
    queryFn: ({ pageParam }) =>
      getSkills({
        limit,
        page: pageParam.toString(),
      }),
    initialPageParam: 1,
    getNextPageParam: nextPageParam,
  });
};
