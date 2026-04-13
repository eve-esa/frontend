import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import api from "./axios";
import { MUTATION_KEYS } from "./keys";
import { routes } from "@/utilities/routes";
import type { ApiError } from "@/types";
import { handleApiError } from "@/utilities/helpers";

export type VerifyPayload = {
  email: string;
  activation_code: string;
};

const httpVerify = async (payload: VerifyPayload) => {
  const { data } = await api.post<Record<string, unknown>>("/verify", payload);
  return data;
};

export const useVerify = () => {
  const navigate = useNavigate();

  return useMutation({
    mutationKey: [MUTATION_KEYS.verify],
    mutationFn: httpVerify,
    onSuccess: () => {
      toast.success("Your account has been verified. You can log in now.");
      void navigate(routes.LOGIN.path);
    },
    onError: (error: ApiError) => {
      toast.error(handleApiError(error));
    },
  });
};
