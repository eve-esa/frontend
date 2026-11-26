import type { Query } from "@tanstack/react-query";
import type { ChaMessageType, MessageType } from "@/types";

/** How often a conversation with a running turn is read again. */
export const CONVERSATION_POLL_MS = 5000;

/** Last row of a conversation, if any. */
export const lastRow = (
  conversation: ChaMessageType | undefined,
): MessageType | undefined => {
  const rows = conversation?.messages;
  return rows?.length ? rows[rows.length - 1] : undefined;
};

/** A row with output, a stop or an error: its turn is over. */
export const isSettledRow = (row: MessageType | undefined): boolean =>
  Boolean(row && (row.output || row.stopped || row.metadata?.error));

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
  const last = lastRow(conversation);
  if (!active || !last || last.id !== active || isSettledRow(last)) return null;
  return active;
};

/** `refetchInterval` of the conversation query: poll only while the last row
 * is the running turn. A settled row (output, a stop merged from this tab, an
 * error), a field that names another row or none ends the polling. */
export const conversationRefetchInterval = (
  query: Pick<Query<ChaMessageType>, "state">,
): number | false =>
  runningTurnId(query.state.data) ? CONVERSATION_POLL_MS : false;
