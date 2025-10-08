import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MUTATION_KEYS, QUERY_KEYS } from "./keys";
import { toast } from "sonner";
import type { AdvancedSettingsValidation } from "@/components/chat/SettingsForm";
import api from "./axios";
import { postStream } from "./streaming";
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
    mutationFn: async ({ query, conversationId, settings }: SendRequestProps) => {
      const enableStreaming = (
        import.meta.env.VITE_ENABLE_STREAMING ?? "false"
      ) === "true";

       const payload = {
        query,
        ...settings,
        public_collections: JSON.parse(
          localStorage.getItem(LOCAL_STORAGE_PUBLIC_COLLECTIONS) ?? "[]"
        ),
      };

      try {
        if (!enableStreaming) {
          return sendRequest({ query, conversationId, settings });
        }

        const applyTokenToOptimisticMessage = (tokenChunk: string) => {
          queryClient.setQueryData<ChaMessageType>(
            [QUERY_KEYS.conversation, conversationId],
            (old) => {
              if (!old || !old.messages?.length) return old;
              const lastIndex = old.messages.length - 1;
              const last = old.messages[lastIndex];
              if (!last?.id?.startsWith("temp-")) return old;
              const updated = {
                ...last,
                output: (last.output || "") + tokenChunk,
              } as MessageType;
              const newMessages = [...old.messages];
              newMessages[lastIndex] = updated;
              return { ...old, messages: newMessages };
            }
          );
        };

        const setFinalAnswer = (answer: string) => {
          queryClient.setQueryData<ChaMessageType>(
            [QUERY_KEYS.conversation, conversationId],
            (old) => {
              if (!old || !old.messages?.length) return old;
              const lastIndex = old.messages.length - 1;
              const last = old.messages[lastIndex];
              if (!last?.id?.startsWith("temp-")) return old;
              const updated = { ...last, output: answer } as MessageType;
              const newMessages = [...old.messages];
              newMessages[lastIndex] = updated;
              return { ...old, messages: newMessages };
            }
          );
        };

        let finalAnswer: string | null = null;
        await postStream({
          url: `/conversations/${conversationId}/stream_messages`,
          payload,
          onEvent: (evt) => {
            if (
              (evt as any)?.type === "token" &&
              typeof (evt as any).content === "string"
            ) {
              applyTokenToOptimisticMessage((evt as any).content);
            } else if (
              (evt as any)?.type === "final" &&
              typeof (evt as any).answer === "string"
            ) {
              finalAnswer = (evt as any).answer;
              setFinalAnswer(finalAnswer ?? "");
            }
          },
        });

        // Build the final MessageType to return so onSuccess can replace temp message
        const now = new Date();
        const finalMessage: MessageType = {
          id: `srv-${now.getTime()}`,
          timestamp: now,
          conversation_id: conversationId || "",
          input: payload.query,
          output: finalAnswer || "",
          feedback: null,
          feedback_reason: null as any,
          documents: [],
          answer: finalAnswer || "",
          query: payload.query,
        } as unknown as MessageType;

        return finalMessage;
      } catch (e) {
        console.log("streaming error", e);
        return null as unknown as MessageType;
      }
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
            input: data.query || data.input || "",
            output: data.answer || data.output || "",
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
