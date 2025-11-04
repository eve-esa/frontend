import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { MUTATION_KEYS } from "./keys";
import api from "./axios";

export type SourceLogParams = {
  conversationId?: string;
  messageId?: string;
  source_id?: string | number;
  source_url: string;
  source_title?: string;
  source_collection_name?: string;
};

export const httpLogSourceClick = async ({
  conversationId,
  messageId,
  source_id,
  source_url,
  source_title,
  source_collection_name,
}: SourceLogParams) => {
  if (!conversationId || !messageId) return;
  await api.post(
    `/conversations/${conversationId}/messages/${messageId}/source_logs`,
    {
      source_id,
      source_url,
      source_title,
      source_collection_name,
    }
  );
};

export const useLogSourceClick = () => {
  return useMutation({
    mutationKey: [MUTATION_KEYS.sourceLog],
    mutationFn: (params: SourceLogParams) => httpLogSourceClick(params),
    onError: (error: any) => {
      toast.error(error?.message ?? "Failed to log source click");
    },
  });
};
