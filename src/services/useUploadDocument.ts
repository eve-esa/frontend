import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MUTATION_KEYS } from "./keys";
import api from "./axios";
import { logError } from "./errorLogging";

const httpUploadDocument = async (file: File[], collectionId: string) => {
  const url = `/collections/${collectionId}/documents`;

  // Create FormData and append all required fields
  const formData = new FormData();

  // Append each file
  file.forEach((f) => formData.append("files", f));

  // Append embeddings model
  formData.append("embeddings_model", "nasa-impact/nasa-smd-ibm-v0.1");

  // Append metadata_names for each file separately (matching backend format)
  file.forEach((f) => formData.append("metadata_names", f.name));

  const { data } = await api.post(url, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return data;
};

export const useUploadDocument = (onSuccess?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: [MUTATION_KEYS.uploadDocument],
    mutationFn: ({
      file,
      collectionId,
    }: {
      file: File[];
      collectionId: string;
    }) => httpUploadDocument(file, collectionId),
    onError: (error) => {
      toast.error(error.message);
      logError({
        error_message: error.message,
        error_stack: error.stack,
        error_type: "UploadDocumentError",
        url: window.location.href,
        user_agent: navigator.userAgent,
        component: "useUploadDocument",
        description: "Error uploading document",
      });
    },
    onSuccess: () => {
      onSuccess?.();
      toast.success("Document uploaded");
      queryClient.invalidateQueries({
        queryKey: [MUTATION_KEYS.documents],
      });
    },
  });
};
