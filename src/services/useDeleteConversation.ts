import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MUTATION_KEYS, QUERY_KEYS } from "./keys";
import api from "./axios";

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

  return useMutation({
    mutationKey: [MUTATION_KEYS.deleteConversation],
    mutationFn: (id: string | null) => {
      return httpDeleteConversation(id);
    },
    onError: (error) => {
      toast.error(error.message);
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
};
