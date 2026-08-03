import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MUTATION_KEYS, QUERY_KEYS } from "./keys";
import api from "./axios";

const httpDeleteImage = async (imageId: string) => {
  const { data } = await api.delete(`/artifacts/${imageId}`);
  return data;
};

export const useDeleteImage = (onSuccess?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: [MUTATION_KEYS.deleteImage],
    mutationFn: (imageId: string) => httpDeleteImage(imageId),
    onError: (error) => {
      toast.error(error.message);
    },
    onSuccess: () => {
      onSuccess?.();
      toast.success("Image deleted");
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.myImages],
      });
    },
  });
};
