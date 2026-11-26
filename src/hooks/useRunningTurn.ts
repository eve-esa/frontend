import { useEffect, useRef, useState } from "react";
import type { ChaMessageType } from "@/types";
import { runningTurnId } from "@/utilities/runningTurn";

/** How long the saved row may lag behind the backend dropping the active id. */
export const SETTLE_REFETCH_MS = 2000;

/**
 * Id of the turn to show as running after a reload, else null.
 *
 * It follows `active_message_id` (see `runningTurnId`). When the field turns
 * null while the row still has no output, no stop and no error, the answer is
 * most likely being written: the saved row can lag a few ms behind the null.
 * The turn then keeps showing as running, the conversation is read once more
 * after 2 s, and only after that read may the stored row render as it is
 * (the error state included).
 */
export const useRunningTurn = (
  data: ChaMessageType | undefined,
  refetch: () => Promise<unknown>,
): string | null => {
  const running = runningTurnId(data);
  const [settling, setSettling] = useState<string | null>(null);
  const previous = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  useEffect(() => {
    if (running) {
      previous.current = running;
      return;
    }
    const was = previous.current;
    previous.current = null;
    if (!was) return;
    const rows = data?.messages;
    const row = rows?.length ? rows[rows.length - 1] : undefined;
    if (!row || row.id !== was || row.output || row.stopped || row.metadata?.error) {
      return;
    }
    setSettling(was);
    timer.current = setTimeout(() => {
      timer.current = null;
      void Promise.resolve(refetchRef.current()).finally(() => setSettling(null));
    }, SETTLE_REFETCH_MS);
  }, [data, running]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  if (running) return running;
  // A row that got its output, stop or error while waiting is settled.
  return settling && runningTurnId(data ? { ...data, active_message_id: settling } : data);
};
