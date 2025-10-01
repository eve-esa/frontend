import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MUTATION_KEYS, QUERY_KEYS } from "./keys";
import api from "./axios";

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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.myCollections],
      });

      onSuccess?.();
    },
  });
};
