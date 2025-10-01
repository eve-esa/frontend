import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MUTATION_KEYS, QUERY_KEYS } from "./keys";
import { toast } from "sonner";
import type { AdvancedSettingsValidation } from "@/components/chat/SettingsForm";
import api from "./axios";
import type { ApiError, ChaMessageType, MessageType } from "@/types";
import { handleApiError } from "@/utilities/helpers";
import { LOCAL_STORAGE_PUBLIC_COLLECTIONS } from "@/utilities/localStorage";

type SendRequestProps = {
  query: string;
  conversationId?: string;
  settings: AdvancedSettingsValidation;
};

export const sendRequest = async ({
  query,
  conversationId,
  settings,
}: SendRequestProps) => {
  const response = await api.post<MessageType>(
    `/conversations/${conversationId}/messages`,
    {
      query,
      ...settings,
      public_collections: JSON.parse(
        localStorage.getItem(LOCAL_STORAGE_PUBLIC_COLLECTIONS) ?? "[]"
      ),
    }
  );
  return response.data;
};

export const useSendRequest = (conversationId?: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: [MUTATION_KEYS.sendRequest, conversationId],
    mutationFn: ({ query, conversationId, settings }: SendRequestProps) => {
      return sendRequest({ query, conversationId, settings });
    },
    onMutate: async (newMessage: SendRequestProps) => {
      //OPTIMISTIC UPDATE
      // Cancel any outgoing refetches
      // (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({
        queryKey: [QUERY_KEYS.conversation, conversationId],
      });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData<ChaMessageType>([
        QUERY_KEYS.conversation,
        conversationId,
      ]);

      // Add temporary message to messages array optimistically
      const optimisticMessage = {
        id: `temp-${Date.now()}`,
        timestamp: new Date().toISOString(),
        conversation_id: conversationId,
        input: newMessage.query,
        output: "",
        feedback: null,
        feedback_reason: null,
        documents: [],
        use_rag: false,
        metadata: {},
      };

      if (previousData) {
        queryClient.setQueryData([QUERY_KEYS.conversation, conversationId], {
          ...previousData,
          messages: [...(previousData.messages ?? []), optimisticMessage],
        });
      } else {
        // Initialize conversation data with this optimistic message for new conversation
        queryClient.setQueryData([QUERY_KEYS.conversation, conversationId], {
          id: conversationId,
          user_id: "", // Default or empty string, adjust if needed
          name: "",
          timestamp: new Date().toISOString(),
          messages: [optimisticMessage],
        });
      }

      return { previousData };
    },
    onError: (error: ApiError, _, context) => {
      // Remove the optimistic message by restoring previous data
      const errorMessage = handleApiError(error);

      if (error.code === "ECONNABORTED") {
        queryClient.invalidateQueries({
          queryKey: [QUERY_KEYS.conversationsList],
        });
      } else {
        console.error("Other error:", error);
      }

      toast.error(errorMessage);
      if (context?.previousData) {
        queryClient.setQueryData(
          [QUERY_KEYS.conversation, conversationId],
          context.previousData
        );
      } else {
        queryClient.removeQueries({
          queryKey: [QUERY_KEYS.conversation, conversationId],
        });
      }
    },
    onSuccess: (data: MessageType) => {
      // Replace temp message with real message in messages array
      // If the mutation fails,
      // use the context returned from onMutate to roll back
      queryClient.setQueryData<ChaMessageType>(
        [QUERY_KEYS.conversation, conversationId],
        (oldData) => {
          if (!oldData) return undefined;

          const filteredMessages = (oldData.messages ?? []).filter(
            (msg: MessageType) => !msg.id?.startsWith("temp-")
          );

          const newMessage = {
            id: data.id,
            timestamp: new Date(),
            conversation_id: data.conversation_id,
            input: data.query || "",
            output: data.answer || "",
            feedback: null,
            documents: data.documents ?? [],
          };

          return {
            ...oldData,
            messages: [...filteredMessages, newMessage],
          };
        }
      );
    },
    onSettled: () => {
      // Always refetch after error or success:
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.conversation, conversationId],
      });
    },
  });
};
