import { useInfiniteQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "./keys";
import z from "zod";
import api from "./axios";
import type { Meta } from "@/types";

export const DocumentSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  chunk_count: z.number(),
  collection_id: z.string(),
  file_size: z.number(),
  file_type: z.string(),
  filename: z.string(),
  source_url: z.string(),
  timestamp: z.string(),
  user_id: z.string(),
});
export type DocumentType = z.infer<typeof DocumentSchema>;

export type PublicCollectionsResponse = {
  data: DocumentType[];
  meta: Meta;
};

export type GetDocumentsParamsProps = {
  limit?: number;
  page?: number;
};

export const getDocuments = async ({
  collectionId,
  limit = 15,
  page = 1,
}: {
  collectionId: string;
  limit?: number;
  page?: number;
}): Promise<PublicCollectionsResponse> => {
  const params = new URLSearchParams({
    limit: limit.toString(),
    page: page.toString(),
  });

  const response = await api.get(
    `/collections/${collectionId}/documents?${params.toString()}`
  );
  const data = await response.data;
  return data;
};

export const useGetDocuments = ({
  limit = 20,
  collectionId,
  enabled,
}: {
  limit?: number;
  collectionId: string;
  enabled?: boolean;
}) => {
  return useInfiniteQuery({
    queryKey: [QUERY_KEYS.documents, limit, collectionId],
    queryFn: ({ pageParam }) =>
      getDocuments({
        limit,
        page: pageParam,
        collectionId,
      }),
    initialPageParam: 1,
    getNextPageParam: ({ meta: { total_pages, current_page } }) =>
      current_page < total_pages ? current_page + 1 : undefined,
    enabled,
  });
};
