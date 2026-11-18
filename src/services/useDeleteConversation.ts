import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MUTATION_KEYS, QUERY_KEYS } from "./keys";
import api from "./axios";
import type { ApiError } from "@/types";
import { handleApiError } from "@/utilities/helpers";

const CONVERSATION_DELETE_INCOMPLETE = "conversation_delete_incomplete";

export const DELETE_INCOMPLETE_MESSAGE =
  "Some files could not be deleted. Try again.";

type DeleteConversationError = {
  message: string;
  retryable: boolean;
};

/**
 * Maps a failed conversation delete to toast copy. The backend answers 503
 * with `detail.code = "conversation_delete_incomplete"` when some files could
 * not be erased: the conversation is kept and a second delete finishes the
 * job, so that case offers a retry. Every other error goes through the shared
 * API error reader, never the raw axios text.
 */
export const describeDeleteConversationError = (
  error: unknown
): DeleteConversationError => {
  const apiError = error as ApiError | null | undefined;
  const detail = apiError?.response?.data?.detail as
    | { code?: unknown }
    | undefined;
  if (
    detail &&
    typeof detail === "object" &&
    detail.code === CONVERSATION_DELETE_INCOMPLETE
  ) {
    return { message: DELETE_INCOMPLETE_MESSAGE, retryable: true };
  }
  return { message: handleApiError(apiError as ApiError), retryable: false };
};

const httpDeleteConversation = async (id: string | null) => {
  if (!id) return;
  const { data } = await api.delete(`/conversations/${id}`);
  return data;
};

export const useDeleteConversation = (
  onSuccess: () => void,
  showToast = true
) => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationKey: [MUTATION_KEYS.deleteConversation],
    mutationFn: (id: string | null) => {
      return httpDeleteConversation(id);
    },
    onError: (error, id) => {
      const { message, retryable } = describeDeleteConversationError(error);
      toast.error(
        message,
        retryable
          ? {
              id: `conversation-delete-${id ?? ""}`,
              action: {
                label: "Retry",
                onClick: () => mutation.mutate(id),
              },
            }
          : undefined
      );
    },
    onSuccess: () => {
      onSuccess();
      if (showToast) {
        toast.success("Conversation deleted");
      }
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.conversationsList],
      });
    },
  });

  return mutation;
};
