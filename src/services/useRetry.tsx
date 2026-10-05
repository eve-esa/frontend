import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import api from "./axios";
import type { ApiError, MessageType } from "@/types";
import { MUTATION_KEYS, QUERY_KEYS } from "./keys";
import { invalidateTokenUsage } from "./useTokenUsage";
import { RATE_LIMITED_CODE, busyRefusal } from "./serviceBusy";
import { handleApiError } from "@/utilities/helpers";

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

    onError: (error: unknown) => {
      // Without this a failed retry was silent: no toast, no state change,
      // just the same error card after the refetch. A rate limit refusal says
      // why in its own message, so the warm-up hint would mislead.
      if (busyRefusal(error)?.reason === RATE_LIMITED_CODE) {
        toast.error(handleApiError(error as ApiError));
        return;
      }
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
