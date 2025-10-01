import { useMutation } from "@tanstack/react-query";
import {
  LOCAL_STORAGE_ACCESS_TOKEN,
  LOCAL_STORAGE_REFRESH_TOKEN,
} from "@/utilities/localStorage";
import { useNavigate } from "react-router";
import { AxiosError } from "axios";
import { z } from "zod";
import { routes } from "@/utilities/routes";
import { MUTATION_KEYS } from "./keys";
import { toast } from "sonner";
import api from "./axios";

export const signupSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type SignupPayloadType = z.infer<typeof signupSchema>;

const httpSignup = async (values: SignupPayloadType) => {
  const url = "/auth/login";
  const { data } = await api.post(url, values);
  return data;
};

export const useSignup = () => {
  const navigate = useNavigate();

  return useMutation({
    mutationKey: [MUTATION_KEYS.signup],
    mutationFn: httpSignup,
    onSuccess: (data) => {
      toast.success("Signup successful");
      localStorage.setItem(LOCAL_STORAGE_ACCESS_TOKEN, data.accessToken);
      localStorage.setItem(LOCAL_STORAGE_REFRESH_TOKEN, data.refreshToken);
      void navigate(routes.CHAT.path);
    },
    onError: (error: AxiosError) => {
      toast.error(error?.message);
    },
  });
};
