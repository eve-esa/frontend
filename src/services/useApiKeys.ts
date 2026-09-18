import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "./axios";
import { MUTATION_KEYS, QUERY_KEYS } from "./keys";
import { CREATE_API_KEY_MUTATION_OPTIONS } from "./apiKeysMutationOptions";
import { parseLimitHeader } from "@/utilities/apiKeys";
import type { ApiError, ApiKey, CreateApiKeyBody, CreatedApiKey } from "@/types";

export type ApiKeysList = {
  keys: ApiKey[];
  limit: number;
};

const fetchApiKeys = async (): Promise<ApiKeysList> => {
  const response = await api.get<ApiKey[]>("/users/api-keys");
  return {
    keys: response.data,
    // Axios normalizes response header names to lowercase.
    limit: parseLimitHeader(response.headers["x-api-key-limit"]),
  };
};

const createApiKey = async (body: CreateApiKeyBody): Promise<CreatedApiKey> => {
  const { data } = await api.post<CreatedApiKey>("/users/api-keys", body);
  return data;
};

const deleteApiKey = async (id: string): Promise<void> => {
  await api.delete(`/users/api-keys/${id}`);
};

/**
 * Revoked keys are hidden server side by default, so this list is exactly
 * "keys that could still work" and needs no client-side filtering.
 *
 * `enabled` gates the request on the dialog being open: the sidebar mounts
 * this hook whenever the flag is on, and without `enabled` every page load
 * would fire GET /users/api-keys before anyone clicked the entry.
 *
 * `staleTime: 0` so every opening refetches: keys are also created, used and
 * revoked from a terminal, and the global 5 minute staleTime would show a
 * list without them (and with a stale "last used") until a reload.
 */
export const useListApiKeys = (enabled: boolean) =>
  useQuery({
    queryKey: [QUERY_KEYS.apiKeys],
    queryFn: fetchApiKeys,
    enabled,
    staleTime: 0,
  });

export const useCreateApiKey = () => {
  const queryClient = useQueryClient();
  return useMutation<CreatedApiKey, ApiError, CreateApiKeyBody>({
    ...CREATE_API_KEY_MUTATION_OPTIONS,
    mutationFn: createApiKey,
    onSuccess: () => {
      // Never the key itself, only that one now exists.
      toast.success("API key created");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.apiKeys] });
    },
  });
};

export const useDeleteApiKey = () => {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationKey: [MUTATION_KEYS.apiKeys, "delete"],
    mutationFn: deleteApiKey,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.apiKeys] });
    },
  });
};
