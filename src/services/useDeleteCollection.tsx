import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MUTATION_KEYS, QUERY_KEYS } from "./keys";
import api from "./axios";

const httpDeleteCollection = async (id: string | null) => {
  if (!id) return;
  const { data } = await api.delete(`/collections/${id}`);
  return data;
};

export const useDeleteCollection = (onSuccess: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: [MUTATION_KEYS.deleteCollection],
    mutationFn: (id: string | null) => {
      return httpDeleteCollection(id);
    },
    onError: (error) => {
      toast.error(error.message);
    },
    onSuccess: () => {
      onSuccess();
      toast.success("Collection deleted");
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.myCollections],
      });
    },
  });
};
