import { useQuery, type QueryClient } from "@tanstack/react-query";
import api from "./axios";
import { QUERY_KEYS } from "./keys";

export type TokenUsageResponse = {
  unlimited: boolean;
  rate_limit_group: string;
  used_tokens: number;
  max_tokens: number | null;
  remaining_tokens: number | null;
  used_ratio: number | null;
  remaining_ratio: number | null;
  period_start: string | null;
  period_end: string | null;
};

export const httpGetTokenUsage = async (): Promise<TokenUsageResponse> => {
  const { data } = await api.get<TokenUsageResponse>(`/users/me/token-usage`);
  return data;
};

export const useTokenUsage = () => {
  return useQuery({
    queryKey: [QUERY_KEYS.tokenUsage],
    queryFn: () => httpGetTokenUsage(),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });
};

export function prefetchTokenUsage(queryClient: QueryClient) {
  return queryClient.prefetchQuery({
    queryKey: [QUERY_KEYS.tokenUsage],
    queryFn: httpGetTokenUsage,
  });
}

export function invalidateTokenUsage(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    queryKey: [QUERY_KEYS.tokenUsage],
  });
}
