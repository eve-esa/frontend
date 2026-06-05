import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MUTATION_KEYS, QUERY_KEYS } from "./keys";
import { toast } from "sonner";
import type { AdvancedSettingsValidation } from "@/components/chat/SettingsForm";
import type { LLMType } from "@/types";
import api from "./axios";
import { postStream, consumeSuppressToastFlag } from "./streaming";
import type { ApiError, AgenticTraceStep, ChaMessageType, MessageType } from "@/types";
import { handleApiError } from "@/utilities/helpers";
import { logError } from "./errorLogging";
import { invalidateTokenUsage } from "./useTokenUsage";
import {
  buildGenerationPayload,
  handleAgenticStreamEvent,
  mapCreateMessageResponse,
  mapToConversationMessage,
  updateLastTempMessage,
  type CreateMessageResponse,
} from "./agenticMessage";

type SendRequestProps = {
  query: string;
  conversationId?: string;
  settings: AdvancedSettingsValidation;
  llm_type?: LLMType;
};

export const sendRequest = async ({
  query,
  conversationId,
  settings,
  llm_type,
}: SendRequestProps) => {
  const response = await api.post<CreateMessageResponse>(
    `/conversations/${conversationId}/generate-agentic`,
    buildGenerationPayload({ query, settings, llm_type }),
  );
  return mapCreateMessageResponse(response.data);
};

export const useSendRequest = (conversationId?: string) => {
  const queryClient = useQueryClient();
  let lastWasCanceled = false;

  return useMutation({
    mutationKey: [MUTATION_KEYS.sendRequest, conversationId],
    mutationFn: async ({
      query,
      conversationId,
      settings,
      llm_type,
    }: SendRequestProps) => {
      const enableStreaming =
        (import.meta.env.VITE_ENABLE_STREAMING ?? "false") === "true";
      const payload = buildGenerationPayload({ query, settings, llm_type });

      try {
        if (!enableStreaming) {
          return sendRequest({ query, conversationId, settings, llm_type });
        }

        const updateTemp = (updater: (message: MessageType) => MessageType) =>
          updateLastTempMessage(queryClient, conversationId, updater);

        let finalAnswer: string | null = null;
        let finalTrace: AgenticTraceStep[] | null = null;

        await postStream({
          url: `/conversations/${conversationId}/stream-generate-agentic`,
          payload,
          onEvent: (evt) =>
            handleAgenticStreamEvent(evt, {
              onToken: (token) =>
                updateTemp((message) => ({
                  ...message,
                  output: (message.output || "") + token,
                })),
              onFinal: (answer, trace) => {
                finalAnswer = answer;
                finalTrace = trace;
                updateTemp((message) => ({
                  ...message,
                  output: answer,
                  trace: trace ?? message.trace ?? null,
                }));
              },
              onNotice: (notice) =>
                updateTemp((message) => ({
                  ...message,
                  pre_answer_notices: [
                    ...(message.pre_answer_notices ?? []),
                    notice,
                  ],
                })),
              onTraceStep: (step) =>
                updateTemp((message) => ({
                  ...message,
                  trace: [...(message.trace ?? []), step],
                })),
            }),
        });

        const now = new Date();
        return mapToConversationMessage({
          id: `srv-${now.getTime()}`,
          timestamp: now,
          conversation_id: conversationId || "",
          input: payload.query,
          output: finalAnswer || "",
          feedback: null,
          documents: [],
          answer: finalAnswer || "",
          query: payload.query,
          trace: finalTrace,
          request_input: { llm_type: llm_type ?? null },
        });
      } catch (e) {
        console.error("streaming error", e);
        logError({
          error_message: String(e || "Unknown error"),
          error_stack: new Error().stack,
          error_type: "StreamError",
          url: window.location.href,
          user_agent: navigator.userAgent,
          component: "useSendRequest",
          description: `stream error in useSendRequest: ${String(e)}`,
        });
        throw e;
      }
    },
    onMutate: async (newMessage: SendRequestProps) => {
      await queryClient.cancelQueries({
        queryKey: [QUERY_KEYS.conversation, conversationId],
      });

      const previousData = queryClient.getQueryData<ChaMessageType>([
        QUERY_KEYS.conversation,
        conversationId,
      ]);

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
        trace: [],
      };

      if (previousData) {
        queryClient.setQueryData([QUERY_KEYS.conversation, conversationId], {
          ...previousData,
          messages: [...(previousData.messages ?? []), optimisticMessage],
        });
      } else {
        queryClient.setQueryData([QUERY_KEYS.conversation, conversationId], {
          id: conversationId,
          user_id: "",
          name: "",
          timestamp: new Date().toISOString(),
          messages: [optimisticMessage],
        });
      }

      return { previousData };
    },
    onError: (error: ApiError, _, context) => {
      const code = (error as any)?.code;
      const name = (error as any)?.name;
      const msg = String((error as any)?.message || "").toLowerCase();
      const isCanceled =
        consumeSuppressToastFlag() ||
        name === "CanceledError" ||
        code === "ERR_CANCELED" ||
        code === "ECONNABORTED" ||
        msg.includes("canceled") ||
        msg.includes("cancelled") ||
        msg.includes("aborted");

      if (isCanceled) {
        lastWasCanceled = true;
        updateLastTempMessage(queryClient, conversationId, (message) => ({
          ...message,
          stopped: true,
        }));
        return;
      }

      const errorMessage = handleApiError(error);
      console.error("Streaming error:", error);
      toast.error(errorMessage);
      if (context?.previousData) {
        queryClient.setQueryData(
          [QUERY_KEYS.conversation, conversationId],
          context.previousData,
        );
      } else {
        queryClient.removeQueries({
          queryKey: [QUERY_KEYS.conversation, conversationId],
        });
      }
    },
    onSuccess: (data: MessageType) => {
      queryClient.setQueryData<ChaMessageType>(
        [QUERY_KEYS.conversation, conversationId],
        (oldData) => {
          if (!oldData) return undefined;

          const filteredMessages = (oldData.messages ?? []).filter(
            (msg: MessageType) => !msg.id?.startsWith("temp-"),
          );

          return {
            ...oldData,
            messages: [...filteredMessages, mapToConversationMessage(data)],
          };
        },
      );
    },
    onSettled: () => {
      if (lastWasCanceled) {
        lastWasCanceled = false;
        return;
      }
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.conversation, conversationId],
      });
      void invalidateTokenUsage(queryClient);
    },
  });
};
