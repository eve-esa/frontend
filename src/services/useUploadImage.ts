import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import type { AxiosProgressEvent } from "axios";
import { MUTATION_KEYS } from "./keys";
import api from "./axios";
import { logError } from "./errorLogging";
import type { ImageUploadResponse } from "@/types";

const httpUploadImage = async (
  file: File,
  onUploadProgress?: (event: AxiosProgressEvent) => void,
): Promise<ImageUploadResponse> => {
  const formData = new FormData();
  formData.append("file", file);

  const { data } = await api.post<ImageUploadResponse>("/artifacts", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
    onUploadProgress,
  });
  return data;
};

/**
 * Uploads a single image to POST /artifacts (multipart field "file"). Success is
 * surfaced visually by the attachment preview, so — unlike `useUploadDocument`
 * — no success toast is fired; only failures are toasted and logged. Exposes
 * axios `onUploadProgress` so callers can drive per-item progress UI.
 */
export const useUploadImage = () => {
  return useMutation({
    mutationKey: [MUTATION_KEYS.uploadImage],
    mutationFn: ({
      file,
      onUploadProgress,
    }: {
      file: File;
      onUploadProgress?: (event: AxiosProgressEvent) => void;
    }) => httpUploadImage(file, onUploadProgress),
    onError: (error) => {
      toast.error(error.message);
      logError({
        error_message: error.message,
        error_stack: error.stack,
        error_type: "UploadImageError",
        url: window.location.href,
        user_agent: navigator.userAgent,
        component: "useUploadImage",
        description: "Error uploading image",
      });
    },
  });
};
