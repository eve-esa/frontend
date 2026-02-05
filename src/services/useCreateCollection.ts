import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MUTATION_KEYS, QUERY_KEYS } from "./keys";
import api from "./axios";
import { logError } from "./errorLogging";

export const httpCreateCollection = async (name: string) => {
  const { data } = await api.post("/collections", { name });
  return data;
};

export const useCreateCollection = (onSuccess?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: [MUTATION_KEYS.createCollection],
    mutationFn: (name: string) => {
      return httpCreateCollection(name);
    },
    onError: (error) => {
      toast.error(error.message);
      logError({
        error_message: error.message,
        error_stack: error.stack,
        error_type: "CreateCollectionError",
        url: window.location.href,
        user_agent: navigator.userAgent,
        component: "useCreateCollection",
        description: "Error creating collection",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.myCollections],
      });

      onSuccess?.();
    },
  });
};
