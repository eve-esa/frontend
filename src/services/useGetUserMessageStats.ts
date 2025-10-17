import { useQuery } from "@tanstack/react-query";
import api from "./axios";
import { QUERY_KEYS } from "./keys";

export type UserMessageStats = {
  message_count: number;
  input_characters: number;
  output_characters: number;
  total_characters: number;
};

export const httpGetUserMessageStats = async (): Promise<UserMessageStats> => {
  const { data } = await api.get(`/conversations/messages/me/stats`);
  return data;
};

export const useGetUserMessageStats = (enabled: boolean = true) => {
  return useQuery({
    queryKey: [QUERY_KEYS.userMessageStats],
    queryFn: () => httpGetUserMessageStats(),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
};


