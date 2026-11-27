import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import api from "./axios";
import { QUERY_KEYS } from "./keys";
import { STORAGE_QUOTA_ENABLED } from "@/utilities/features";

/**
 * `GET /users/me/storage-usage`. Bytes are exact; `used_gb` and `max_gb` are GiB rounded to two
 * decimals. A plan with no cap answers `unlimited: true` and null cap fields.
 */
export type StorageUsageResponse = {
  unlimited: boolean;
  rate_limit_group: string;
  used_bytes: number;
  max_bytes: number | null;
  remaining_bytes: number | null;
  used_ratio: number | null;
  used_gb: number;
  max_gb: number | null;
};

export const httpGetStorageUsage = async (): Promise<StorageUsageResponse> => {
  const { data } = await api.get<StorageUsageResponse>(`/users/me/storage-usage`);
  return data;
};

export const useStorageUsage = () => {
  return useQuery({
    queryKey: [QUERY_KEYS.storageUsage],
    queryFn: () => httpGetStorageUsage(),
    enabled: STORAGE_QUOTA_ENABLED,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });
};

/** List this user's objects and return the counter after the difference is applied. */
export const httpRecountStorageUsage = async (): Promise<StorageUsageResponse> => {
  const { data } = await api.post<StorageUsageResponse>(`/users/me/storage-usage/recount`);
  return data;
};

/** Replaces the cached usage with the recounted numbers. */
export const useRecountStorageUsage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => httpRecountStorageUsage(),
    onSuccess: (data) => {
      queryClient.setQueryData([QUERY_KEYS.storageUsage], data);
    },
  });
};

/** No-op with the flag off, so a backend without the endpoint never sees the call. */
export function invalidateStorageUsage(queryClient: QueryClient) {
  if (!STORAGE_QUOTA_ENABLED) return Promise.resolve();
  return queryClient.invalidateQueries({
    queryKey: [QUERY_KEYS.storageUsage],
  });
}
