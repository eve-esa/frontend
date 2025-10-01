import { QUERY_KEYS } from "./keys";
import { useInfiniteQuery } from "@tanstack/react-query";
import api from "./axios";
import type { Meta } from "@/types";

export type SharedCollectionType = {
  id: string;
  name: string;
  timestamp: string;
  user_id: string | null;
  description: string;
  embeddings_model: string;
};

export type SharedCollectionsResponse = {
  data: SharedCollectionType[];
  meta: Meta;
};

export type GetSharedCollectionsParamsProps = {
  limit?: number;
  page?: string;
};

const getPublicCollections = async ({
  limit = 20,
  page = "1",
}: GetSharedCollectionsParamsProps): Promise<SharedCollectionsResponse> => {
  const params = new URLSearchParams({
    limit: limit.toString(),
    page,
  });

  const { data } = await api.get(`/collections/public?${params.toString()}`);
  return data;
};

export const useGetSharedCollection = ({
  limit = 20,
}: Omit<GetSharedCollectionsParamsProps, "page"> = {}) => {
  return useInfiniteQuery({
    queryKey: [QUERY_KEYS.publicCollections, limit],
    queryFn: ({ pageParam }) =>
      getPublicCollections({
        limit,
        page: pageParam.toString(),
      }),
    initialPageParam: 1,
    getNextPageParam: ({ meta: { total_pages, current_page } }) =>
      current_page < total_pages ? current_page + 1 : undefined,
  });
};
