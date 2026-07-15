import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "./axios";
import { MUTATION_KEYS, QUERY_KEYS } from "./keys";
import type { ApiError, CustomModel } from "@/types";
import { handleApiError } from "@/utilities/helpers";

export type CreateCustomModelInput = {
  display_name: string;
  provider_id: string;
  catalog_model_id: string;
  api_key: string;
};

export type UpdateCustomModelInput = {
  id: string;
  display_name?: string;
  catalog_model_id?: string;
  api_key?: string;
};

const createCustomModel = async (
  payload: CreateCustomModelInput,
): Promise<CustomModel> => {
  const { data } = await api.post<CustomModel>("/users/custom-models", payload);
  return data;
};

const updateCustomModel = async ({
  id,
  ...payload
}: UpdateCustomModelInput): Promise<CustomModel> => {
  const { data } = await api.patch<CustomModel>(
    `/users/custom-models/${id}`,
    payload,
  );
  return data;
};

const deleteCustomModel = async (id: string): Promise<void> => {
  await api.delete(`/users/custom-models/${id}`);
};

export const useCreateCustomModel = (onSuccess?: () => void) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: [MUTATION_KEYS.customModels, "create"],
    mutationFn: createCustomModel,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.models] });
      toast.success("Custom model added");
      onSuccess?.();
    },
    onError: (error: ApiError) => {
      toast.error(handleApiError(error));
    },
  });
};

export const useUpdateCustomModel = (onSuccess?: () => void) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: [MUTATION_KEYS.customModels, "update"],
    mutationFn: updateCustomModel,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.models] });
      toast.success("Custom model updated");
      onSuccess?.();
    },
    onError: (error: ApiError) => {
      toast.error(handleApiError(error));
    },
  });
};

export const useDeleteCustomModel = (onSuccess?: () => void) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: [MUTATION_KEYS.customModels, "delete"],
    mutationFn: deleteCustomModel,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.models] });
      toast.success("Custom model removed");
      onSuccess?.();
    },
    onError: (error: ApiError) => {
      toast.error(handleApiError(error));
    },
  });
};
