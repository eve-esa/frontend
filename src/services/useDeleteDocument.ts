import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MUTATION_KEYS, QUERY_KEYS } from "./keys";
import api from "./axios";

const httpDeleteDocument = async (
  collectionId: string | null,
  documentId: string | null
) => {
  if (!collectionId || !documentId) return;
  const { data } = await api.delete(
    `/collections/${collectionId}/documents/${documentId}`
  );
  return data;
};

export const useDeleteDocument = (onSuccess: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: [MUTATION_KEYS.deleteDocument],
    mutationFn: ({
      collectionId,
      documentId,
    }: {
      collectionId: string | null;
      documentId: string | null;
    }) => {
      return httpDeleteDocument(collectionId, documentId);
    },
    onError: (error) => {
      toast.error(error.message);
    },
    onSuccess: () => {
      onSuccess();
      toast.success("Document deleted");
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.documents],
      });
    },
  });
};
