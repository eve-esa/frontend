import { useEffect, useState } from "react";
import type { ChaMessageType } from "@/types";
import { isSettledRow, lastRow, runningTurnId } from "@/utilities/runningTurn";

/** How long the saved row may lag behind the backend dropping the active id. */
export const SETTLE_REFETCH_MS = 2000;

type Tracked = {
  conversationId: string | undefined;
  /** The turn last seen running. */
  lastRunningId: string | null;
  /** The turn whose field turned null before its row was saved. */
  endedId: string | null;
};

/**
 * Id of the turn to show as running after a reload, else null.
 *
 * It follows `active_message_id` (see `runningTurnId`). When the field turns
 * null while the row still has no output, no stop and no error, the answer is
 * most likely being written: the saved row can lag a few ms behind the null.
 * The turn then keeps showing as running, the conversation is read once more
 * after `SETTLE_REFETCH_MS`, and only after that read may the stored row
 * render as it is (the error state included).
 *
 * The hand-over is worked out during render, so no frame shows the error
 * state between the null field and the wait. `refresh` reads the conversation
 * again and resolves when the read is done.
 */
export const useRunningTurn = (
  data: ChaMessageType | undefined,
  conversationId: string | undefined,
  refresh: () => Promise<unknown>,
): string | null => {
  const running = runningTurnId(data);
  const [tracked, setTracked] = useState<Tracked>({
    conversationId,
    lastRunningId: running,
    endedId: null,
  });

  let next = tracked;
  if (tracked.conversationId !== conversationId) {
    next = { conversationId, lastRunningId: running, endedId: null };
  } else if (running) {
    if (tracked.lastRunningId !== running || tracked.endedId) {
      next = { conversationId, lastRunningId: running, endedId: null };
    }
  } else if (tracked.lastRunningId) {
    const row = lastRow(data);
    const unsaved = row?.id === tracked.lastRunningId && !isSettledRow(row);
    next = {
      conversationId,
      lastRunningId: null,
      endedId: unsaved ? tracked.lastRunningId : null,
    };
  }
  if (next !== tracked) setTracked(next);

  const { endedId } = next;
  useEffect(() => {
    if (!endedId) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void Promise.resolve(refresh())
        .catch(() => undefined)
        .finally(() => {
          if (cancelled) return;
          setTracked((current) =>
            current.endedId === endedId ? { ...current, endedId: null } : current,
          );
        });
    }, SETTLE_REFETCH_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // refresh is left out on purpose: a new function each render must not
    // restart the wait.
  }, [endedId, conversationId]);

  if (running) return running;
  // A row that got its output, stop or error while waiting is settled.
  const row = lastRow(data);
  return endedId && row?.id === endedId && !isSettledRow(row) ? endedId : null;
};
