import { useMutation, useQueryClient } from "@tanstack/react-query";

import api from "./axios";
import type { MessageType } from "@/types";
import { MUTATION_KEYS, QUERY_KEYS } from "./keys";

type SendRequestProps = {
  message_id: string;
  conversationId?: string;
};

export const sendRequest = async ({
  message_id,
  conversationId,
}: SendRequestProps) => {
  const response = await api.post<MessageType>(
    `/conversations/${conversationId}/messages/${message_id}/retry`
  );
  return response.data;
};

export const useRetry = ({ conversationId }: SendRequestProps) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: [MUTATION_KEYS.sendRequest, conversationId],
    mutationFn: ({ message_id, conversationId }: SendRequestProps) => {
      return sendRequest({ message_id, conversationId });
    },

    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.conversation, conversationId],
      });
    },
  });
};
