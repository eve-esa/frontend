import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MUTATION_KEYS, QUERY_KEYS } from "./keys";
import { toast } from "sonner";
import type { AdvancedSettingsValidation } from "@/components/chat/SettingsForm";
import type { ModelListResponse, ModelSelection } from "@/types";
import api from "./axios";
import { postStream, consumeSuppressToastFlag } from "./streaming";
import type { ApiError, ChaMessageType, MessageType } from "@/types";
import { handleApiError } from "@/utilities/helpers";
import { logError } from "./errorLogging";
import { invalidateTokenUsage } from "./useTokenUsage";
import {
  buildGenerationPayload,
  mapCreateMessageResponse,
  mapToConversationMessage,
  updateLastTempMessage,
  type CreateMessageResponse,
} from "./agenticMessage";
import {
  getStoredModelSelection,
  modelSelectionToPayload,
  reconcileModelSelection,
} from "@/utilities/modelSelection";

type SendRequestProps = {
  query: string;
  conversationId?: string;
  settings: AdvancedSettingsValidation;
  modelSelection?: ModelSelection;
  models?: ModelListResponse;
};

export const sendRequest = async ({
  query,
  conversationId,
  settings,
  modelSelection,
  models,
}: SendRequestProps) => {
  const response = await api.post<CreateMessageResponse>(
    `/conversations/${conversationId}/stream-generate-agentic`,
    buildGenerationPayload({
      query,
      settings,
      modelSelection,
      models,
    }),
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
      modelSelection,
      models,
    }: SendRequestProps) => {
      const enableStreaming =
        (import.meta.env.VITE_ENABLE_STREAMING ?? "false") === "true";
      const cachedModels =
        models ??
        queryClient.getQueryData<ModelListResponse>([QUERY_KEYS.models]);
      const payload = buildGenerationPayload({
        query,
        settings,
        modelSelection,
        models: cachedModels,
      });

      try {
        if (!enableStreaming) {
          return sendRequest({
            query,
            conversationId,
            settings,
            modelSelection,
            models: cachedModels,
          });
        }

        const updateTemp = (updater: (msg: MessageType) => MessageType) =>
          updateLastTempMessage(queryClient, conversationId, updater);

        const addNotice = (notice: string) =>
          updateTemp((msg) => ({
            ...msg,
            pre_answer_notices: [...(msg.pre_answer_notices ?? []), notice],
          }));

        const truncate = (s: string, max: number) =>
          s.length > max ? s.slice(0, max) + "…" : s;

        let finalAnswer: string | null = null;

        await postStream({
          url: `/conversations/${conversationId}/stream-generate-agentic`,
          payload,
          onEvent: (evt) => {
            const { type, content, answer } = evt as Record<string, unknown>;

            if (type === "token" && typeof content === "string") {
              updateTemp((msg) => ({
                ...msg,
                output: (msg.output || "") + content,
              }));
            } else if (type === "final" && typeof answer === "string") {
              finalAnswer = answer;
              updateTemp((msg) => ({ ...msg, output: answer }));
            } else if (
              (type === "status" || type === "requery") &&
              typeof content === "string"
            ) {
              addNotice(content);
            } else if (type === "tool_call" && typeof content === "string") {
              addNotice(`${truncate(content, 100)}`);
            } else if (type === "tool_result" && typeof content === "string") {
              addNotice(`${truncate(content, 100)}`);
            }
          },
        });

        const now = new Date();
        const payloadFields = modelSelectionToPayload(
          reconcileModelSelection(
            modelSelection ?? getStoredModelSelection(cachedModels),
            cachedModels,
          ),
          cachedModels,
        );
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
          request_input: {
            llm_type: payloadFields.llm_type ?? null,
            custom_model_id: payloadFields.custom_model_id ?? null,
          },
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
