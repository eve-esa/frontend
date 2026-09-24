import type { MessageType } from "@/types";
import { REPORT_BUG_ENABLED } from "@/utilities/features";
import { isPersistedId, type BugReportTarget } from "@/services/useReportBug";
import { ChatHeader } from "./ChatHeader";
import { ConversationReportBug } from "./ConversationReportBug";

/**
 * What a report from the conversation header is about: this conversation and
 * its last answer the backend knows by id. An optimistic "temp-" or "srv-"
 * turn is skipped, since its id means nothing to the backend.
 */
export const lastAnswerTarget = (
  conversationId: string | undefined,
  messages: MessageType[] | undefined,
): BugReportTarget => {
  const persisted = (messages ?? []).filter((m) => isPersistedId(m?.id));
  const last = persisted[persisted.length - 1];
  return {
    conversationId: conversationId || undefined,
    messageId: last?.id,
    traceId: last?.trace_id ?? undefined,
  };
};

type ConversationHeaderProps = {
  conversationId?: string;
  messages?: MessageType[];
};

/** The header above the messages of a conversation. */
export const ConversationHeader = ({
  conversationId,
  messages,
}: ConversationHeaderProps) => (
  <ChatHeader
    actions={
      REPORT_BUG_ENABLED ? (
        <ConversationReportBug
          {...lastAnswerTarget(conversationId, messages)}
        />
      ) : undefined
    }
  />
);
