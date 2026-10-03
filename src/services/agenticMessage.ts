import type { QueryClient } from "@tanstack/react-query";
import type { AdvancedSettingsValidation } from "@/utilities/advancedSettingsSchema";
import type {
  AgenticTraceStep,
  ChaMessageType,
  ImageAttachment,
  MessageType,
  ModelListResponse,
  ModelSelection,
} from "@/types";
import { QUERY_KEYS } from "./keys";
import { getMessageCollectionPayload } from "@/utilities/collections";
import {
  getStoredModelSelection,
  modelSelectionToPayload,
  reconcileModelSelection,
} from "@/utilities/modelSelection";
import {
  resolveMessageEndpoint,
  type MessagePipeline,
  type MessageRequestMode,
} from "@/utilities/messageEndpoint";

export type CreateMessageResponse = {
  id: string;
  query: string;
  answer: string;
  documents: MessageType["documents"];
  use_rag: boolean;
  conversation_id: string;
  trace?: AgenticTraceStep[] | null;
  metadata?: MessageType["metadata"];
  request_input?: MessageType["request_input"];
  attachments?: MessageType["attachments"];
  artifact_ids?: MessageType["artifact_ids"];
};

type GenerationInput = {
  query: string;
  settings: AdvancedSettingsValidation;
  modelSelection?: ModelSelection;
  models?: ModelListResponse;
};

export const buildGenerationPayload = ({
  query,
  settings,
  modelSelection,
  models,
}: GenerationInput) => {
  const selection = reconcileModelSelection(
    modelSelection ?? getStoredModelSelection(models),
    models,
  );
  const modelFields = modelSelectionToPayload(selection, models);

  // Shared by both pipelines: the classic and agentic routes take the same
  // GenerationRequest. What differs (URL, `public_mcp_servers`) is added by
  // buildMessageRequest below.
  return {
    query,
    ...settings,
    ...modelFields,
    ...getMessageCollectionPayload(),
  };
};

type MessageRequestInput = GenerationInput & {
  conversationId: string | undefined;
  mode: MessageRequestMode;
  pipeline: MessagePipeline;
  mcpServers: string[];
  attachments?: ImageAttachment[];
};

/**
 * The URL and body of a new chat turn, for either pipeline and either mode. The
 * one place both send paths in useSendRequest.ts build their request, so the
 * streaming and the blocking request cannot drift apart.
 */
export const buildMessageRequest = ({
  conversationId,
  mode,
  pipeline,
  mcpServers,
  attachments,
  ...generation
}: MessageRequestInput) => {
  const { url, extraPayload } = resolveMessageEndpoint(
    conversationId,
    mcpServers,
    mode,
    pipeline,
  );
  return {
    url,
    payload: {
      ...buildGenerationPayload(generation),
      ...(attachments?.length
        ? { artifact_ids: attachments.map((a) => a.id) }
        : {}),
      ...extraPayload,
    },
  };
};

export const mapCreateMessageResponse = (
  data: CreateMessageResponse,
): MessageType =>
  ({
    id: data.id,
    conversation_id: data.conversation_id,
    input: data.query,
    query: data.query,
    output: data.answer,
    answer: data.answer,
    documents: data.documents ?? [],
    trace: data.trace ?? null,
    metadata: data.metadata,
    request_input: data.request_input,
    // Carried over as-is: the sync path doesn't rebuild attachments, it just
    // reports back what the backend persisted for this message.
    attachments: data.attachments,
    artifact_ids: data.artifact_ids,
    feedback: null,
    timestamp: new Date(),
  }) as MessageType;

export const mapToConversationMessage = (
  data: Pick<
    MessageType,
    | "id"
    | "conversation_id"
    | "input"
    | "output"
    | "documents"
    | "trace"
    | "metadata"
    | "request_input"
    | "attachments"
    | "artifact_ids"
  > & {
    query?: string;
    answer?: string;
    timestamp?: Date;
    feedback?: MessageType["feedback"];
  },
): MessageType =>
  ({
    id: data.id,
    conversation_id: data.conversation_id,
    input: data.query || data.input || "",
    output: data.answer || data.output || "",
    feedback: data.feedback ?? null,
    timestamp: data.timestamp ?? new Date(),
    documents: data.documents ?? [],
    trace: data.trace ?? null,
    metadata: data.metadata,
    request_input: data.request_input,
    // Explicitly carried over: this rebuilds the message from scratch and
    // would otherwise drop them, making chat images vanish between send and
    // the refetch that follows onSettled.
    attachments: data.attachments,
    artifact_ids: data.artifact_ids,
  }) as MessageType;

export const updateLastTempMessage = (
  queryClient: QueryClient,
  conversationId: string | undefined,
  updater: (message: MessageType) => MessageType,
) => {
  queryClient.setQueryData<ChaMessageType>(
    [QUERY_KEYS.conversation, conversationId],
    (old) => {
      if (!old?.messages?.length) return old;

      const lastIndex = old.messages.length - 1;
      const last = old.messages[lastIndex];
      if (!last?.id?.startsWith("temp-")) return old;

      const newMessages = [...old.messages];
      newMessages[lastIndex] = updater(last as MessageType);
      return { ...old, messages: newMessages };
    },
  );
};
