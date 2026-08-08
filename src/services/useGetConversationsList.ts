import { useInfiniteQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "./keys";
import api from "./axios";
import type { Meta } from "@/types";
import { nextPageParamAsString } from "@/utilities/pagination";

export type SingleConversation = {
  id: string;
  name: string;
};

export type ConversationsResponse = {
  data: SingleConversation[];
  meta: Meta;
};

export type GetConversationsParamsProps = {
  limit?: number;
  page?: string;
  search?: string;
};

export const getConversationsList = async ({
  limit = 15,
  page = "1",
}: GetConversationsParamsProps): Promise<ConversationsResponse> => {
  const params = new URLSearchParams({
    limit: limit.toString(),
    page,
  });

  const { data } = await api.get(`/conversations?${params.toString()}`);
  return data;
};

export const useGetConversationsList = ({
  limit = 20,
}: Omit<GetConversationsParamsProps, "page"> = {}) => {
  return useInfiniteQuery({
    queryKey: [QUERY_KEYS.conversationsList, limit],
    queryFn: ({ pageParam }) =>
      getConversationsList({
        limit,
        page: pageParam,
      }),
    initialPageParam: "1",
    getNextPageParam: nextPageParamAsString,
  });
};
