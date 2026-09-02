import type { ChaMessageType } from "@/types";

// A user stop aborts the client stream before the backend has persisted the
// turn. The mutation rejects, the conversation query is re-enabled at settle
// and refetches immediately, and the row that comes back is the
// mid-generation one (output "", stopped unset). That row replaces the
// optimistic temp row, the smoothing hook wipes the bubble when its source
// shrinks, and the partial answer the user was reading disappears. The
// reconcile invalidate cannot prevent it: it can only ever fire after that
// refetch, and a disabled query ignores an invalidate anyway.
//
// So the streamed text is remembered when the stop is classified, and merged
// back inside the conversation queryFn. The queryFn is the one place every
// refetch goes through (the re-enable refetch, the reconcile invalidate, a
// window focus, a later navigation), which a setQueryData at settle time is
// not: the next refetch overwrites it.

export type StoppedPartial = {
  // Position of the stopped turn in the conversation's message list. The
  // optimistic row is always the last one, and the backend appends the
  // persisted row in that same position.
  index: number;
  output: string;
};

// One list per conversation, not one entry: until the backend has persisted
// its own copy (which without a shared cancel channel it may never do for a
// turn stopped on another worker), every stopped turn in the conversation
// still needs repairing, so a second stop must not evict the first.
export type StoppedPartials = Readonly<
  Record<string, readonly StoppedPartial[]>
>;

export type StoppedPartialMerge = {
  data: ChaMessageType;
  // The store as it should be after this response. Returned rather than
  // mutated so the whole decision, merge and forget, stays in one pure
  // function that a node test can drive.
  partials: StoppedPartials;
};

const withPending = (
  partials: StoppedPartials,
  conversationId: string,
  pending: StoppedPartial[],
): StoppedPartials => {
  const next: Record<string, readonly StoppedPartial[]> = { ...partials };
  if (pending.length) {
    next[conversationId] = pending;
  } else {
    delete next[conversationId];
  }
  return next;
};

/**
 * Puts the remembered stop partials back into a conversation response whose
 * rows for those turns are still empty, and drops each memory once its server
 * row carries the persisted output.
 */
export const mergeStoppedPartial = (
  data: ChaMessageType,
  partials: StoppedPartials,
  conversationId?: string,
): StoppedPartialMerge => {
  const remembered = conversationId ? partials[conversationId] : undefined;
  if (!conversationId || !remembered?.length) return { data, partials };

  const messages = data?.messages;
  const pending: StoppedPartial[] = [];
  let merged = messages;

  for (const partial of remembered) {
    const row = merged?.[partial.index];
    // The turn is not in the response yet: the backend creates the row when
    // it persists the answer, and until then there is nothing to merge into.
    // Keep the memory, a later refetch is where it belongs.
    if (!row) {
      pending.push(partial);
      continue;
    }

    const persisted = typeof row.output === "string" ? row.output.trim() : "";
    // The server row carries the partial now (the backend persists it on both
    // the cooperative and the hard cancel path), so the memory is spent.
    if (persisted) continue;

    merged = merged === messages ? [...messages] : merged;
    merged[partial.index] = {
      ...row,
      output: partial.output,
      stopped: true,
    };
    pending.push(partial);
  }

  return {
    data: merged === messages ? data : { ...data, messages: merged },
    partials: withPending(partials, conversationId, pending),
  };
};

let store: StoppedPartials = {};

/**
 * Records what the aborted stream had painted, so the next conversation
 * response can be repaired. Whitespace-only output is not worth remembering:
 * there is nothing on screen to lose.
 */
export const rememberStoppedPartial = (
  conversationId: string,
  index: number,
  output: string,
) => {
  if (index < 0 || !output.trim()) return;
  const others = (store[conversationId] ?? []).filter(
    (partial) => partial.index !== index,
  );
  store = { ...store, [conversationId]: [...others, { index, output }] };
};

/** Merges the remembered partials, if any, into a conversation response. */
export const applyStoppedPartial = (
  data: ChaMessageType,
  conversationId?: string,
): ChaMessageType => {
  const { data: merged, partials } = mergeStoppedPartial(
    data,
    store,
    conversationId,
  );
  store = partials;
  return merged;
};
