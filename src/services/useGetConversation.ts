import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "./keys";
import type { ChaMessageType } from "@/types";
import api from "./axios";

export const getConversation = async (
  conversationId?: string
): Promise<ChaMessageType> => {
  const { data } = await api.get(`/conversations/${conversationId}`);

  return data;
};

export const useGetConversation = ({
  conversationId,
  enabled,
}: {
  conversationId?: string;
  enabled?: boolean;
}) => {
  return useQuery({
    queryKey: [QUERY_KEYS.conversation, conversationId],
    queryFn: () => getConversation(conversationId),
    enabled,
  });
};
