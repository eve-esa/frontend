import {
  LOCAL_STORAGE_ACCESS_TOKEN,
  LOCAL_STORAGE_REFRESH_TOKEN,
} from "@/utilities/localStorage";
import { routes } from "@/utilities/routes";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";

export const httpLogout = async () => {
  await localStorage.removeItem(LOCAL_STORAGE_ACCESS_TOKEN);
  await localStorage.removeItem(LOCAL_STORAGE_REFRESH_TOKEN);
};

export const useLogout = (onSuccess?: () => void) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: httpLogout,
    onSuccess: () => {
      queryClient.clear();
      localStorage.removeItem(LOCAL_STORAGE_ACCESS_TOKEN);
      localStorage.removeItem(LOCAL_STORAGE_REFRESH_TOKEN);
      onSuccess?.();
      void navigate(routes.LOGIN.path);
    },
  });
};
