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
  // persisted row in that same position. Used only until messageId is known.
  index: number;
  output: string;
  // Persisted id of the stopped turn, from the Stop response. Once set it is
  // the only key: a position can be taken by a later turn when this one is
  // missing from a response, and that turn must not inherit the stop.
  messageId?: string;
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
    const at = partial.messageId
      ? (merged ?? []).findIndex((row) => row?.id === partial.messageId)
      : partial.index;
    const row = at >= 0 ? merged?.[at] : undefined;
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
    // A stop before the first token has no text to restore: once the server
    // row carries the stop itself, or the failure that ended the turn instead
    // (the Stop raced the cancel mapping), there is nothing left to repair, and
    // keeping it would hide that failure and its Retry.
    if (!partial.output && (row.stopped || row.metadata?.error)) continue;

    merged = merged === messages ? [...messages] : merged;
    merged[at] = {
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
// Stop response ids that arrived before the abort was filed, by conversation
// and position: rememberStoppedPartial binds them when it files that turn.
let pendingIds: Readonly<Record<string, Readonly<Record<number, string>>>> = {};

const takePendingId = (conversationId: string, index: number) => {
  const ids = pendingIds[conversationId];
  const messageId = ids?.[index];
  if (messageId === undefined) return undefined;
  const rest = { ...ids };
  delete rest[index];
  pendingIds = { ...pendingIds, [conversationId]: rest };
  return messageId;
};

/**
 * Records what the aborted stream had painted, so the next conversation
 * response can be repaired. A stop before the first token is remembered too,
 * with no text: the mid-generation row the refetch brings back (output "",
 * stopped unset) would otherwise render as a failed turn.
 */
export const rememberStoppedPartial = (
  conversationId: string,
  index: number,
  output: string,
) => {
  if (index < 0) return;
  const others = (store[conversationId] ?? []).filter(
    (partial) => partial.index !== index,
  );
  const messageId = takePendingId(conversationId, index);
  store = {
    ...store,
    [conversationId]: [
      ...others,
      {
        index,
        output: output.trim() ? output : "",
        ...(messageId ? { messageId } : {}),
      },
    ],
  };
};

/**
 * Binds the persisted id the Stop response returned to the turn the Stop was
 * clicked for, by the position that turn had when the Stop was clicked, so
 * later merges find it by id. Neither a slow response nor another pending stop
 * can move the id onto a different turn. When the response wins the race with
 * the abort, the id waits for rememberStoppedPartial to file that position.
 */
export const rememberStoppedMessageId = (
  conversationId: string,
  index: number,
  messageId: string,
) => {
  if (index < 0) return;
  const entries = store[conversationId] ?? [];
  const entry = entries.find((partial) => partial.index === index);
  if (!entry) {
    pendingIds = {
      ...pendingIds,
      [conversationId]: { ...pendingIds[conversationId], [index]: messageId },
    };
    return;
  }
  if (entry.messageId) return;
  store = {
    ...store,
    [conversationId]: entries.map((partial) =>
      partial === entry ? { ...partial, messageId } : partial,
    ),
  };
};

/**
 * Drops the position-keyed stops at or past `index` when a new turn takes that
 * position: their turn never came back, and the new one must not inherit the
 * stop. Entries bound to an id are kept, they cannot move.
 */
export const forgetStoppedPartialsFrom = (
  conversationId: string,
  index: number,
) => {
  const ids = pendingIds[conversationId];
  if (ids) {
    const kept = Object.fromEntries(
      Object.entries(ids).filter(([at]) => Number(at) < index),
    );
    pendingIds = { ...pendingIds, [conversationId]: kept };
  }
  const entries = store[conversationId];
  if (!entries?.length) return;
  store = withPending(
    store,
    conversationId,
    entries.filter((partial) => partial.messageId || partial.index < index),
  );
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
