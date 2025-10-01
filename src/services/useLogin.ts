import { useMutation } from "@tanstack/react-query";
import {
  LOCAL_STORAGE_ACCESS_TOKEN,
  LOCAL_STORAGE_REFRESH_TOKEN,
  LOCAL_STORAGE_LOGIN_EMAIL,
} from "@/utilities/localStorage";
import { useNavigate } from "react-router";
import { z } from "zod";
import { routes } from "@/utilities/routes";
import { MUTATION_KEYS } from "./keys";
import { toast } from "sonner";
import api from "./axios";
import type { ApiError } from "@/types";
import { handleApiError } from "@/utilities/helpers";

export const loginSchema = z.object({
  email: z.string(),
  password: z.string(),
});

type LoginPayloadType = z.infer<typeof loginSchema>;

type LoginResponseType = {
  access_token: string;
  refresh_token: string;
};

const httpLogin = async (
  values: LoginPayloadType
): Promise<LoginResponseType> => {
  const { data } = await api.post<LoginResponseType>("/login", values);
  return data;
};

export const useLogin = () => {
  const navigate = useNavigate();

  return useMutation({
    mutationKey: [MUTATION_KEYS.login],
    mutationFn: httpLogin,
    onSuccess: (data) => {
      localStorage.setItem(LOCAL_STORAGE_ACCESS_TOKEN, data.access_token);
      localStorage.setItem(LOCAL_STORAGE_REFRESH_TOKEN, data.refresh_token);
      // Clear stored email after successful login
      localStorage.removeItem(LOCAL_STORAGE_LOGIN_EMAIL);
      navigate(routes.EMPTY_CHAT.path);
    },
    onError: (error: ApiError) => {
      const errorMessage = handleApiError(error);
      toast.error(errorMessage);
    },
  });
};
