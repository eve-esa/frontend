import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MUTATION_KEYS, QUERY_KEYS } from "./keys";
import api from "./axios";

const httpUpdateProfile = async ({
  first_name,
  last_name,
}: {
  first_name: string;
  last_name: string;
}) => {
  const url = `/users`;
  const { data } = await api.patch(url, { first_name, last_name });
  return data;
};

export const useUpdateProfile = (onSuccess?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: [MUTATION_KEYS.profile],
    mutationFn: ({
      first_name,
      last_name,
    }: {
      first_name: string;
      last_name: string;
    }) => {
      return httpUpdateProfile({ first_name, last_name });
    },
    onError: (error) => {
      toast.error(error.message);
    },
    onSuccess: () => {
      onSuccess?.();
      toast.success("Profile updated successfully");
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.profile],
      });
    },
  });
};
