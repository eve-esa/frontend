import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MUTATION_KEYS, QUERY_KEYS } from "./keys";
import api from "./axios";
import type { ApiError } from "@/types";
import { handleApiError } from "@/utilities/helpers";

const httpRenameConversation = async (id: string | null, newName: string) => {
  if (!id) return;
  const url = `/conversations/${id}`;
  const { data } = await api.patch(url, { name: newName });
  return data;
};

export const useRenameConversation = (onSuccess: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: [MUTATION_KEYS.renameConversation],
    mutationFn: ({ id, newName }: { id: string; newName: string }) => {
      return httpRenameConversation(id, newName);
    },
    onError: (error: ApiError) => {
      onSuccess();

      const errorMessage = handleApiError(error);
      toast.error(errorMessage);
    },
    onSuccess: () => {
      onSuccess();
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.conversationsList],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.conversation],
      });
    },
  });
};
