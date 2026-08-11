import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import api from "./axios";
import type { MessageType } from "@/types";
import { MUTATION_KEYS, QUERY_KEYS } from "./keys";
import { invalidateTokenUsage } from "./useTokenUsage";

type SendRequestProps = {
  message_id: string;
  conversationId?: string;
};

export const sendRequest = async ({
  message_id,
  conversationId,
}: SendRequestProps) => {
  const response = await api.post<MessageType>(
    `/conversations/${conversationId}/messages/${message_id}/retry`,
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

    onError: () => {
      // Without this a failed retry was silent: no toast, no state change,
      // just the same error card after the refetch.
      toast.error("Retry failed. The model may still be warming up.");
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.conversation, conversationId],
      });
      void invalidateTokenUsage(queryClient);
    },
  });
};
