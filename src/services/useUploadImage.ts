import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { AxiosProgressEvent } from "axios";
import { MUTATION_KEYS } from "./keys";
import api from "./axios";
import { logError } from "./errorLogging";
import { invalidateStorageUsage } from "./useStorageUsage";
import type { ApiError, ImageUploadResponse } from "@/types";
import { handleApiError } from "@/utilities/helpers";
import {
  STORAGE_SETTINGS_PATH,
  isStorageQuotaError,
  storageSettingsLinkEnabled,
} from "@/utilities/storageQuota";

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
 *
 * A file that does not fit the user's storage (403 `storage_quota_exceeded`)
 * is toasted with the backend's message and not logged: it is the user's
 * state, not a fault.
 */
export const useUploadImage = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
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
      const message = handleApiError(error as ApiError);
      if (isStorageQuotaError(error)) {
        toast.error(
          message,
          storageSettingsLinkEnabled()
            ? {
                id: "storage-quota-exceeded",
                action: {
                  label: "Manage storage",
                  onClick: () => navigate(STORAGE_SETTINGS_PATH),
                },
              }
            : { id: "storage-quota-exceeded" },
        );
        return;
      }
      toast.error(message);
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
    onSettled: () => {
      void invalidateStorageUsage(queryClient);
    },
  });
};
