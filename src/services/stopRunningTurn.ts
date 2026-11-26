import type { QueryClient } from "@tanstack/react-query";
import type { ChaMessageType, MessageType } from "@/types";
import api from "./axios";
import { QUERY_KEYS } from "./keys";
import { stopConversation } from "./stopConversation";
import { isSettledRow } from "@/utilities/runningTurn";
import { rememberStoppedTurn } from "@/utilities/stoppedPartials";

// After a user stop, the backend persists the final state (stopped flag plus
// the partial output) only at the generation loop's next cooperative
// checkpoint, which can be seconds away mid tool call. Refetching before that
// would replace the visible partial with the mid-generation row (empty output,
// stopped unset) and paint the stop as an error. Poll the server directly,
// outside the cache, and reconcile once the truth exists (bounded, then
// reconcile regardless so the cache always converges).
export const reconcileAfterStop = async (
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

/** A stored row whose turn has not ended: no output, no stop, no error. */
export const isRunningRow = (row: MessageType): boolean =>
  Boolean(
    row.id &&
      !row.id.startsWith("temp-") &&
      !row.id.startsWith("srv-") &&
      !isSettledRow(row),
  );

/**
 * Stop for a turn this page does not stream (reloaded mid-turn). The stop is
 * filed by message id, so every later read of the conversation keeps the row
 * stopped (polls included) until the backend saves the stop, an error or an
 * answer. Then the backend Stop for this conversation, and the reconcile
 * read a normal Stop does. No stream to abort here.
 */
export const stopRunningTurn = async (
  queryClient: QueryClient,
  conversationId: string,
  index: number,
  messageId: string,
) => {
  rememberStoppedTurn(conversationId, index, messageId);
  queryClient.setQueryData<ChaMessageType>(
    [QUERY_KEYS.conversation, conversationId],
    (old) =>
      old?.messages?.length
        ? {
            ...old,
            messages: old.messages.map((m) =>
              m.id === messageId ? { ...m, stopped: true } : m,
            ),
          }
        : old,
  );
  try {
    await stopConversation({ conversationId });
  } catch (e) {
    console.error("Error stopping conversation", e);
  }
  void reconcileAfterStop(queryClient, conversationId);
};
