import { useInfiniteQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "./keys";
import api from "./axios";
import type { ImageAsset, Meta } from "@/types";

export type MyImagesResponse = {
  data: ImageAsset[];
  meta: Meta;
};

export type GetMyImagesParamsProps = {
  limit?: number;
  page?: string;
};

const getMyImages = async ({
  limit = 24,
  page = "1",
}: GetMyImagesParamsProps): Promise<MyImagesResponse> => {
  const params = new URLSearchParams({
    limit: limit.toString(),
    page,
  });

  const { data } = await api.get(`/artifacts?${params.toString()}`);
  return data;
};

export const useGetMyImages = ({
  limit = 24,
}: Omit<GetMyImagesParamsProps, "page"> = {}) => {
  return useInfiniteQuery({
    queryKey: [QUERY_KEYS.myImages, limit],
    queryFn: ({ pageParam }) =>
      getMyImages({
        limit,
        page: pageParam.toString(),
      }),
    initialPageParam: 1,
    getNextPageParam: ({ meta: { total_pages, current_page } }) =>
      current_page < total_pages ? current_page + 1 : undefined,
  });
};
