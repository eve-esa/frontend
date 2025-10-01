import { useEffect } from "react";
import { toast } from "sonner";
import type { ApiError } from "@/types";
import { handleApiError } from "@/utilities/helpers";

export const useApiError = (error: Error | ApiError | null) => {
  useEffect(() => {
    if (error) {
      const errorMessage = handleApiError(error as ApiError);
      toast.error(errorMessage);
    }
  }, [error]);
};
