import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "./keys";
import type { ChaMessageType } from "@/types";
import api from "./axios";
import { applyStoppedPartial } from "@/utilities/stoppedPartials";

export const getConversation = async (
  conversationId?: string
): Promise<ChaMessageType> => {
  const { data } = await api.get<ChaMessageType>(
    `/conversations/${conversationId}`
  );

  // A turn the user stopped can come back mid-generation, with the output the
  // backend has not persisted yet. Repairing it here, and not at the mutation
  // settle, is what covers every refetch path: see utilities/stoppedPartials.
  return applyStoppedPartial(data, conversationId);
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
