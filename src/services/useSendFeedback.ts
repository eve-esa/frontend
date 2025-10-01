import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { MUTATION_KEYS } from "./keys";
import z from "zod";
import api from "./axios";

export enum FeedbackEnum {
  GOOD = "positive",
  BAD = "negative",
}

export const FeedbackSchema = z.object({
  messageId: z.string(),
  conversationId: z.string().optional(),
  feedback: z.nativeEnum(FeedbackEnum).optional(),
  was_copied: z.boolean().optional(),
  feedback_reason: z.string().optional(),
});

export type FeedbackType = z.infer<typeof FeedbackSchema>;

export const httpSendFeedback = async ({
  feedback,
  conversationId,
  messageId,
  was_copied,
  feedback_reason,
}: FeedbackType) => {
  await api.patch(`/conversations/${conversationId}/messages/${messageId}`, {
    feedback,
    was_copied,
    feedback_reason,
  });
};

export const useSendFeedback = (onSuccess?: () => void) => {
  return useMutation({
    mutationKey: [MUTATION_KEYS.feedback],
    mutationFn: (params: FeedbackType) => {
      return httpSendFeedback(params);
    },
    onError: (error) => {
      toast.error(error.message);
    },
    onSuccess: () => {
      onSuccess?.();
    },
  });
};
