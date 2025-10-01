import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { MUTATION_KEYS } from "./keys";
import { toast } from "sonner";
import api from "./axios";
import type { ApiError } from "@/types";
import { handleApiError } from "@/utilities/helpers";

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

type ForgotPasswordPayloadType = z.infer<typeof forgotPasswordSchema>;

const httpForgotPassword = async (values: ForgotPasswordPayloadType) => {
  const url = "/forgot-password/code";
  const { data } = await api.post(url, values);
  return data;
};

export const useForgotPassword = () => {
  return useMutation({
    mutationKey: [MUTATION_KEYS.forgotPassword],
    mutationFn: httpForgotPassword,
    onSuccess: () => {
      toast.success("Email sent successfully");
    },
    onError: (error: ApiError) => {
      const errorMessage = handleApiError(error);
      toast.error(errorMessage);
    },
  });
};
