import type { ImageAttachment } from "@/types";
import type { SentDocuments } from "@/services/useConversationDocuments";

// Draft persisted by ChatEmpty in localStorage while a new conversation is being
// created, then replayed by Chat once the conversation id exists. Serialized as
// JSON so it can carry image attachments alongside the text.
export type DraftNewConversation = {
  input: string;
  attachments?: ImageAttachment[];
  /** Documents already uploaded to the new conversation, still processing. */
  sentDocuments?: SentDocuments;
};

export const serializeDraftNewConversation = (
  draft: DraftNewConversation,
): string => JSON.stringify(draft);

/**
 * Parses a stored draft. Backward compatible with the previous format where the
 * draft was the plain input string (not JSON).
 */
export const parseDraftNewConversation = (
  raw: string,
): DraftNewConversation => {
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof parsed.input === "string"
    ) {
      return {
        input: parsed.input,
        attachments: Array.isArray(parsed.attachments)
          ? parsed.attachments
          : undefined,
        sentDocuments:
          parsed.sentDocuments &&
          typeof parsed.sentDocuments.jobId === "string" &&
          Array.isArray(parsed.sentDocuments.documents)
            ? parsed.sentDocuments
            : undefined,
      };
    }
  } catch {
    // Legacy plain-string draft — fall through.
  }
  return { input: raw };
};
