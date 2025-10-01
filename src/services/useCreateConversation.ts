import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MUTATION_KEYS, QUERY_KEYS } from "./keys";
import api from "./axios";

export const httpCreateConversation = async (name: string) => {
  const { data } = await api.post("/conversations", { name });
  return data;
};

export const useCreateConversation = (
  onSuccess?: (conversationId: string) => void
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: [MUTATION_KEYS.conversation],
    mutationFn: (name: string) => {
      return httpCreateConversation(name);
    },
    onError: (error) => {
      toast.error(error.message);
    },
    onSuccess: (data) => {
      onSuccess?.(data.id);

      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.conversationsList],
      });
    },
  });
};
