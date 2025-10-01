import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { z } from "zod";
import { MUTATION_KEYS } from "./keys";
import { toast } from "sonner";
import api from "./axios";
import { useNavigate } from "react-router-dom";
import { routes } from "@/utilities/routes";

export const resetPasswordSchema = z.object({
  new_password: z.string(),
  confirm_password: z.string(),
  code: z.string(),
});

type ResetPasswordPayloadType = z.infer<typeof resetPasswordSchema>;

const httpResetPassword = async (values: ResetPasswordPayloadType) => {
  const url = "/forgot-password/confirm";
  const { data } = await api.post(url, { ...values });
  return data;
};

export const useResetPassword = () => {
  const navigate = useNavigate();

  return useMutation({
    mutationKey: [MUTATION_KEYS.resetPassword],
    mutationFn: httpResetPassword,
    onSuccess: () => {
      toast.success("Password reset successful");
      navigate(routes.LOGIN.path);
    },
    onError: (error: AxiosError) => {
      toast.error(error?.message);
    },
  });
};
