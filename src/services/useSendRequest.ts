import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MUTATION_KEYS, QUERY_KEYS } from "./keys";
import { toast } from "sonner";
import type { AdvancedSettingsValidation } from "@/components/chat/SettingsForm";
import type {
  ApiError,
  ChaMessageType,
  ImageAttachment,
  MessageType,
  ModelListResponse,
  ModelSelection,
} from "@/types";
import api from "./axios";
import {
  postStream,
  consumeSuppressToastFlag,
  consumeWatchdogTimeoutFlag,
} from "./streaming";
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
import { getSelectedMcpServerNames } from "@/utilities/mcpServers";
import { resolveMessageEndpoint } from "@/utilities/messageEndpoint";
import { STREAMING_ENABLED } from "@/utilities/features";

type SendRequestProps = {
  query: string;
  conversationId?: string;
  settings: AdvancedSettingsValidation;
  modelSelection?: ModelSelection;
  models?: ModelListResponse;
  attachments?: ImageAttachment[];
};

export const sendRequest = async ({
  query,
  conversationId,
  settings,
  modelSelection,
  models,
  attachments,
}: SendRequestProps) => {
  // Which endpoint this hits (classic RAG vs agentic) is driven entirely by
  // the MCP server selection: empty selection keeps the classic path
  // byte-identical, one or more servers switches to the agentic pipeline.
  const mcpServers = getSelectedMcpServerNames();
  const { url, extraPayload } = resolveMessageEndpoint(
    conversationId,
    mcpServers,
    "sync",
  );
  const response = await api.post<CreateMessageResponse>(url, {
    ...buildGenerationPayload({ query, settings, modelSelection, models }),
    ...(attachments?.length
      ? { artifact_ids: attachments.map((a) => a.id) }
      : {}),
    ...extraPayload,
  });
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
      attachments,
    }: SendRequestProps) => {
      const cachedModels =
        models ??
        queryClient.getQueryData<ModelListResponse>([QUERY_KEYS.models]);

      const mcpServers = getSelectedMcpServerNames();
      const { url: streamUrl, extraPayload: mcpPayload } =
        resolveMessageEndpoint(conversationId, mcpServers, "stream");

      const payload = {
        ...buildGenerationPayload({
          query,
          settings,
          modelSelection,
          models: cachedModels,
        }),
        ...(attachments?.length
          ? { artifact_ids: attachments.map((a) => a.id) }
          : {}),
        ...mcpPayload,
      };

      try {
        if (!STREAMING_ENABLED) {
          return sendRequest({
            query,
            conversationId,
            settings,
            modelSelection,
            models: cachedModels,
            attachments,
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
        let finalArtifactIds: string[] | undefined;
        // Holder object rather than a plain let: the assignment happens inside
        // the onEvent closure, and control-flow narrowing would otherwise
        // collapse the variable to null after the await.
        const streamError: {
          current: { code?: string; message?: string } | null;
        } = { current: null };

        await postStream({
          url: streamUrl,
          payload,
          onEvent: (evt) => {
            const { type, content, answer } = evt as Record<string, unknown>;

            if (type === "error") {
              // Terminal event: the backend persists the failure and closes
              // the stream right after. Captured here, thrown after postStream
              // so the mutation rejects instead of resolving into an empty
              // answer indistinguishable from success.
              const { code, message } = evt as Record<string, unknown>;
              streamError.current = {
                code: typeof code === "string" ? code : undefined,
                message:
                  typeof message === "string"
                    ? message
                    : typeof content === "string"
                      ? content
                      : undefined,
              };
            } else if (type === "token" && typeof content === "string") {
              updateTemp((msg) => ({
                ...msg,
                output: (msg.output || "") + content,
              }));
            } else if (type === "final" && typeof answer === "string") {
              finalAnswer = answer;
              const artifactIds = (evt as Record<string, unknown>)
                .artifact_ids;
              if (Array.isArray(artifactIds)) {
                finalArtifactIds = artifactIds as string[];
              }
              updateTemp((msg) => ({ ...msg, output: answer }));
            } else if (
              (type === "status" || type === "requery") &&
              typeof content === "string"
            ) {
              addNotice(content);
            } else if (type === "tool_call" && typeof content === "string") {
              // Agentic pipeline is invoking an MCP tool; reuse the same
              // in-stream status mechanism as "status"/"requery" notices.
              addNotice(`${truncate(content, 100)}`);
            } else if (type === "tool_result" && typeof content === "string") {
              addNotice(`${truncate(content, 100)}`);
            }
          },
        });

        if (streamError.current && finalAnswer === null) {
          const err = new Error(
            streamError.current.message || "Generation failed",
          );
          err.name = "GenerationError";
          (err as Error & { generationCode?: string }).generationCode =
            streamError.current.code;
          throw err;
        }

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
          attachments,
          artifact_ids: finalArtifactIds,
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
        attachments: newMessage.attachments,
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
    onError: (error: ApiError) => {
      // AxiosError carries code/name/message, but a cancellation can also
      // surface as a bare DOMException, so read the three fields structurally
      // rather than asserting either shape.
      const { code, name, message } = error as {
        code?: string;
        name?: string;
        message?: string;
      };
      // Both flags are consumed unconditionally: short-circuiting past the
      // suppress flag would leak it into the next send's classification. The
      // watchdog wins because its abort raises the same CanceledError as a
      // user stop, and a hung stream must be treated as a failure, not filed
      // as "user pressed stop" with the refetch skipped.
      const watchdogTimedOut = consumeWatchdogTimeoutFlag();
      const userSuppressed = consumeSuppressToastFlag();
      const msg = String(message || "").toLowerCase();
      const isCanceled =
        !watchdogTimedOut &&
        (userSuppressed ||
          name === "CanceledError" ||
          code === "ERR_CANCELED" ||
          code === "ECONNABORTED" ||
          msg.includes("canceled") ||
          msg.includes("cancelled") ||
          msg.includes("aborted"));

      if (isCanceled) {
        lastWasCanceled = true;
        updateLastTempMessage(queryClient, conversationId, (message) => ({
          ...message,
          stopped: true,
        }));
        return;
      }

      const generationCode = (error as Error & { generationCode?: string })
        .generationCode;
      const errorMessage =
        watchdogTimedOut || generationCode === "timeout"
          ? "The model did not answer in time. It may be warming up: retry in a moment."
          : name === "GenerationError"
            ? "Generation failed. Retry in a moment."
            : handleApiError(error);
      console.error("Streaming error:", error);
      toast.error(errorMessage);
      // No cache rollback: removing the failed turn would hide what happened.
      // onSettled invalidates the conversation, and the refetch brings in the
      // persisted failure state (output "" plus metadata.error) that drives
      // the inline error text and the Retry affordance.
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
