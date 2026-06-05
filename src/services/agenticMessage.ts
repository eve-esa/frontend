import type { QueryClient } from "@tanstack/react-query";
import type { AdvancedSettingsValidation } from "@/components/chat/SettingsForm";
import type { AgenticTraceStep, ChaMessageType, LLMType, MessageType } from "@/types";
import { LOCAL_STORAGE_PUBLIC_COLLECTIONS } from "@/utilities/localStorage";
import { QUERY_KEYS } from "./keys";
import type { StreamEvent } from "./streaming";

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
};

type GenerationInput = {
  query: string;
  settings: AdvancedSettingsValidation;
  llm_type?: LLMType;
};

export const buildGenerationPayload = ({
  query,
  settings,
  llm_type,
}: GenerationInput) => ({
  query,
  ...settings,
  ...(llm_type ? { llm_type } : {}),
  public_collections: JSON.parse(
    localStorage.getItem(LOCAL_STORAGE_PUBLIC_COLLECTIONS) ?? "[]",
  ),
});

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

type AgenticStreamHandlers = {
  onToken: (token: string) => void;
  onFinal: (answer: string, trace: AgenticTraceStep[] | null) => void;
  onNotice: (notice: string) => void;
  onTraceStep: (step: AgenticTraceStep) => void;
};

export const handleAgenticStreamEvent = (
  evt: StreamEvent,
  handlers: AgenticStreamHandlers,
) => {
  const event = evt as Record<string, unknown>;
  const type = event.type;

  if (type === "token" && typeof event.content === "string") {
    handlers.onToken(event.content);
    return;
  }

  if (type === "final" && typeof event.answer === "string") {
    handlers.onFinal(
      event.answer,
      Array.isArray(event.trace) ? (event.trace as AgenticTraceStep[]) : null,
    );
    return;
  }

  if (type === "tool_call" || type === "tool_result") {
    handlers.onTraceStep(event as AgenticTraceStep);
    return;
  }

  if (
    (type === "status" || type === "requery") &&
    typeof event.content === "string"
  ) {
    handlers.onNotice(event.content);
  }
};
