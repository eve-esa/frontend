import { useRef } from "react";
import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { MUTATION_KEYS, QUERY_KEYS } from "./keys";
import { toast } from "sonner";
import type { AdvancedSettingsValidation } from "@/utilities/advancedSettingsSchema";
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
  peekSuppressToastFlag,
  peekWatchdogTimeoutFlag,
} from "./streaming";
import { handleApiError } from "@/utilities/helpers";
import { isCancellation, logError } from "./errorLogging";
import { invalidateTokenUsage } from "./useTokenUsage";
import {
  buildMessageRequest,
  mapCreateMessageResponse,
  mapToConversationMessage,
  updateLastTempMessage,
  type CreateMessageResponse,
} from "./agenticMessage";
import { getSelectedMcpServerNames } from "@/utilities/mcpServers";
import { applyToolCall, applyToolResult } from "@/utilities/toolActivity";
import type { MessagePipeline } from "@/utilities/messageEndpoint";
import { shouldToastStreamError } from "@/utilities/streamError";
import {
  forgetStoppedPartialsFrom,
  rememberStoppedPartial,
} from "@/utilities/stoppedPartials";
import {
  AGENTIC_CHAT_ENABLED,
  STREAMING_ENABLED,
  STREAM_STATUS_NOTICES_ENABLED,
} from "@/utilities/features";
import { shouldShowPreAnswerNotice } from "@/utilities/preAnswerNotices";
import { rememberTraceFromFinalEvent } from "@/observability/lastTrace";
import {
  clearBusyNotice,
  isServiceBusyError,
  setBusyNotice,
  withBusyRetry,
} from "./serviceBusy";

// FEATURE_AGENTIC_CHAT. The classic pipeline ignores the MCP selection, so it
// is read only for agentic turns.
const PIPELINE: MessagePipeline = AGENTIC_CHAT_ENABLED ? "agentic" : "classic";
const selectedMcpServers = () =>
  PIPELINE === "agentic" ? getSelectedMcpServerNames() : [];

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
  const { url, payload } = buildMessageRequest({
    conversationId,
    mode: "sync",
    pipeline: PIPELINE,
    mcpServers: selectedMcpServers(),
    query,
    settings,
    modelSelection,
    models,
    attachments,
  });
  const response = await api.post<CreateMessageResponse>(url, payload);
  return mapCreateMessageResponse(response.data);
};

// After a user stop, the backend persists the final state (stopped flag plus
// the partial output) only at the generation loop's next cooperative
// checkpoint, which can be seconds away mid tool call. Refetching before that
// would replace the visible partial with the mid-generation row (empty output,
// stopped unset) and paint the stop as an error. Poll the server directly,
// outside the cache, and reconcile once the truth exists (bounded, then
// reconcile regardless so the cache always converges).
const reconcileAfterStop = async (
  queryClient: QueryClient,
  conversationId: string,
) => {
  for (let attempt = 0; attempt < 6; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    try {
      const { data } = await api.get<ChaMessageType>(
        `/conversations/${conversationId}`,
      );
      const last = data.messages?.[data.messages.length - 1];
      if (last && (last.stopped || last.output)) break;
    } catch {
      break;
    }
  }
  queryClient.invalidateQueries({
    queryKey: [QUERY_KEYS.conversation, conversationId],
  });
};

export const useSendRequest = (conversationId?: string) => {
  const queryClient = useQueryClient();
  // Ref, not a plain let: the hook body re-runs on every render, and a
  // re-render between onError and onSettled would reset a local flag.
  const canceledRef = useRef(false);

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

      // Both pipelines stream the same SSE events (status, requery, token,
      // final, error), so one parser below serves both; tool_call and
      // tool_result only ever arrive on the agentic one.
      const { url: streamUrl, payload } = buildMessageRequest({
        conversationId,
        mode: "stream",
        pipeline: PIPELINE,
        mcpServers: selectedMcpServers(),
        query,
        settings,
        modelSelection,
        models: cachedModels,
        attachments,
      });

      // Everything the stream has painted into the bubble so far. Declared
      // outside the try so the catch can stamp it onto the outgoing error:
      // onError uses it to decide whether a failure toast would contradict a
      // partial answer the user is already reading.
      let streamedOutput = "";
      // An overloaded worker refuses before anything streams, so the start is
      // safe to repeat once (see withBusyRetry).
      const busyKey = conversationId ?? "";

      // Outside the try below: the blocking path never went through the
      // streaming error logging and must not start now.
      if (!STREAMING_ENABLED) {
        return withBusyRetry(busyKey, () =>
          sendRequest({
            query,
            conversationId,
            settings,
            modelSelection,
            models: cachedModels,
            attachments,
          }),
        );
      }

      try {
        const updateTemp = (updater: (msg: MessageType) => MessageType) =>
          updateLastTempMessage(queryClient, conversationId, updater);

        const addNotice = (notice: string) =>
          updateTemp((msg) => ({
            ...msg,
            pre_answer_notices: [...(msg.pre_answer_notices ?? []), notice],
          }));

        let finalAnswer: string | null = null;
        let finalArtifactIds: string[] | undefined;
        // Holder object rather than a plain let: the assignment happens inside
        // the onEvent closure, and control-flow narrowing would otherwise
        // collapse the variable to null after the await.
        const streamError: {
          current: { code?: string; message?: string } | null;
        } = { current: null };

        await withBusyRetry(busyKey, () => postStream({
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
              streamedOutput += content;
              updateTemp((msg) => ({
                ...msg,
                output: (msg.output || "") + content,
              }));
            } else if (type === "final" && typeof answer === "string") {
              finalAnswer = answer;
              streamedOutput = answer;
              const artifactIds = (evt as Record<string, unknown>)
                .artifact_ids;
              if (Array.isArray(artifactIds)) {
                finalArtifactIds = artifactIds as string[];
              }
              // Read only: a bug report filed after this answer points at
              // its backend trace.
              rememberTraceFromFinalEvent(conversationId, evt);
              updateTemp((msg) => ({ ...msg, output: answer }));
            } else if (
              typeof content === "string" &&
              shouldShowPreAnswerNotice(type, STREAM_STATUS_NOTICES_ENABLED)
            ) {
              addNotice(content);
            } else if (type === "tool_call") {
              // Agentic pipeline is invoking an MCP tool: feed the structured
              // activity list that drives the tool activity bar. No content
              // gate: newer backends may carry only the structured fields.
              updateTemp((msg) => ({
                ...msg,
                tool_activity: applyToolCall(
                  msg.tool_activity,
                  evt as Record<string, unknown>,
                  selectedMcpServers(),
                ),
              }));
            } else if (type === "tool_result") {
              updateTemp((msg) => ({
                ...msg,
                tool_activity: applyToolResult(
                  msg.tool_activity,
                  evt as Record<string, unknown>,
                ),
              }));
            }
          },
        }));

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
          // The model the request named, not the stored selection: on the
          // classic pipeline a custom selection is replaced before sending.
          request_input: {
            llm_type: payload.llm_type ?? null,
            custom_model_id: payload.custom_model_id ?? null,
          },
          attachments,
          artifact_ids: finalArtifactIds,
        });
      } catch (e) {
        // Expected overload outcome, handled in onError: not an error to log.
        if (isServiceBusyError(e)) throw e;
        if (e && typeof e === "object") {
          // Structural check instead of instanceof: a cancellation can be a
          // DOMException, whose Error lineage varies by browser.
          (e as { streamedOutput?: string }).streamedOutput = streamedOutput;
        }
        // A user Stop is not an error. Skip the log only on that positive
        // signal: the watchdog aborts with the same CanceledError, and a hung
        // stream or any other abort source is still logged.
        if (
          isCancellation(e) &&
          peekSuppressToastFlag() &&
          !peekWatchdogTimeoutFlag()
        ) {
          throw e;
        }
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
      // A new send replaces the "still busy" notice of the previous one.
      clearBusyNotice(conversationId);
      await queryClient.cancelQueries({
        queryKey: [QUERY_KEYS.conversation, conversationId],
      });

      const previousData = queryClient.getQueryData<ChaMessageType>([
        QUERY_KEYS.conversation,
        conversationId,
      ]);

      // The new turn takes the position a stopped turn that never came back
      // would have been repaired at. Saved rows only: a stopped temp row can
      // still sit in the cache when the user sends again before the settle
      // refetch lands, and it is not a turn the server returned.
      if (conversationId) {
        forgetStoppedPartialsFrom(
          conversationId,
          (previousData?.messages ?? []).filter(
            (msg: MessageType) => !msg.id?.startsWith("temp-"),
          ).length,
        );
      }

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
    onError: (error: ApiError, variables: SendRequestProps) => {
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

      if (isServiceBusyError(error)) {
        // The backend refused before persisting anything: drop the optimistic
        // turn and hand the text back to the composer instead of painting a
        // failed message. No toast: the composer notice says what happened.
        queryClient.setQueryData<ChaMessageType>(
          [QUERY_KEYS.conversation, conversationId],
          (oldData) =>
            oldData
              ? {
                  ...oldData,
                  messages: (oldData.messages ?? []).filter(
                    (msg: MessageType) => !msg.id?.startsWith("temp-"),
                  ),
                }
              : oldData,
        );
        setBusyNotice({
          conversationId: conversationId ?? "",
          phase: error.canceled ? "canceled" : "stopped",
          ...(error.reason ? { reason: error.reason } : {}),
          draft: variables
            ? { text: variables.query, attachments: variables.attachments }
            : null,
        });
        return;
      }
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

      const streamedOutput =
        (error as Error & { streamedOutput?: string }).streamedOutput ?? "";

      if (isCanceled) {
        canceledRef.current = true;
        // Remember what the aborted stream had painted, keyed by the position
        // the turn occupies, even when that is nothing yet (a stop before the
        // first token). The refetch that follows this handler brings back the
        // mid-generation row (output "", stopped unset), which would replace
        // the visible partial with nothing and paint the turn as failed; the
        // conversation queryFn puts the stop back until the backend has
        // persisted its own copy.
        if (conversationId) {
          const cached = queryClient.getQueryData<ChaMessageType>([
            QUERY_KEYS.conversation,
            conversationId,
          ]);
          const lastIndex = (cached?.messages?.length ?? 0) - 1;
          // Same guard updateLastTempMessage uses: only the optimistic row
          // marks the turn that was streaming, and its position is the one the
          // persisted row will take.
          // An empty stop is remembered only for a user Stop: a dropped
          // connection (ECONNABORTED, "aborted") with nothing painted is a
          // failure, and the persisted error must reach the bubble.
          if (
            cached?.messages?.[lastIndex]?.id?.startsWith("temp-") &&
            (userSuppressed || streamedOutput.trim())
          ) {
            rememberStoppedPartial(conversationId, lastIndex, streamedOutput);
          }
        }
        updateLastTempMessage(queryClient, conversationId, (message) => ({
          ...message,
          stopped: true,
        }));
        return;
      }

      if (!shouldToastStreamError(streamedOutput)) {
        // The stream died after painting a visible partial answer: a red
        // toast beside it would contradict what the user is reading. End the
        // turn quietly (the error is already in logError) and let onSettled's
        // refetch bring the persisted truth, partial plus metadata.error.
        console.error("Streaming error (toast suppressed, partial answer visible):", error);
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
      void invalidateTokenUsage(queryClient);
      // A stop must still reconcile (the old skip left the temp message
      // frozen forever), but only once the backend has persisted the stop:
      // see reconcileAfterStop.
      if (canceledRef.current && conversationId) {
        canceledRef.current = false;
        void reconcileAfterStop(queryClient, conversationId);
        return;
      }
      canceledRef.current = false;
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.conversation, conversationId],
      });
    },
  });
};
