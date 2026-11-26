import type { Query } from "@tanstack/react-query";
import type { ChaMessageType } from "@/types";

/** How often a conversation with a running turn is read again. */
export const CONVERSATION_POLL_MS = 5000;

/**
 * Id of the last assistant row while the backend still generates it, else null.
 *
 * A reload closes the stream client but not the turn: the backend keeps going
 * and saves the answer when it ends, so the row read in between has no output
 * and no error. `active_message_id` is how the backend says "not failed, not
 * stopped, still running". Older backends do not send it, which reads as null.
 * A row that already has output, a stop or an error is settled whatever the
 * field says.
 */
export const runningTurnId = (
  conversation: ChaMessageType | undefined,
): string | null => {
  const active = conversation?.active_message_id;
  const rows = conversation?.messages;
  const last = rows?.length ? rows[rows.length - 1] : undefined;
  if (!active || !last || last.id !== active) return null;
  if (last.output || last.stopped || last.metadata?.error) return null;
  return active;
};

/** `refetchInterval` of the conversation query: poll while a turn is active. */
export const conversationRefetchInterval = (
  query: Pick<Query<ChaMessageType>, "state">,
): number | false =>
  query.state.data?.active_message_id ? CONVERSATION_POLL_MS : false;
