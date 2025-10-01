import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "./keys";
import type { ChaMessageType } from "@/types";
import api from "./axios";

export const getDocument = async (
  collectionId?: string,
  documentId?: string
): Promise<ChaMessageType> => {
  const { data } = await api.get(
    `/collections/${collectionId}/documents/${documentId}`
  );

  return data;
};

export const useGetDocument = ({
  collectionId,
  documentId,
  enabled,
}: {
  collectionId?: string;
  documentId?: string;
  enabled?: boolean;
}) => {
  return useQuery({
    queryKey: [QUERY_KEYS.getDocument, collectionId, documentId],
    queryFn: () => getDocument(collectionId, documentId),
    enabled,
  });
};
