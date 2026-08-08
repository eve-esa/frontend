import { QUERY_KEYS } from "./keys";
import { useInfiniteQuery } from "@tanstack/react-query";
import api from "./axios";
import type { Meta } from "@/types";
import { nextPageParam } from "@/utilities/pagination";

export type CollectionType = {
  id: string;
  name: string;
  timestamp: string;
  user_id: string;
};

export type MyCollectionsResponse = {
  data: CollectionType[];
  meta: Meta;
};

export type GetMyCollectionsParamsProps = {
  limit?: number;
  page?: string;
};

const getMyCollections = async ({
  limit = 20,
  page = "1",
}: GetMyCollectionsParamsProps): Promise<MyCollectionsResponse> => {
  const params = new URLSearchParams({
    limit: limit.toString(),
    page,
  });

  const { data } = await api.get(`/collections?${params.toString()}`);
  return data;
};

export const useGetMyCollections = ({
  limit = 20,
  enabled,
}: Omit<GetMyCollectionsParamsProps, "page"> & { enabled?: boolean }) => {
  return useInfiniteQuery({
    queryKey: [QUERY_KEYS.myCollections, limit],
    queryFn: ({ pageParam }) =>
      getMyCollections({
        limit,
        page: pageParam.toString(),
      }),
    initialPageParam: 1,
    getNextPageParam: nextPageParam,
    enabled,
  });
};
