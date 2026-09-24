/**
 * The last backend trace id seen per conversation, kept in memory only.
 *
 * The backend puts the OpenTelemetry trace id of a generation on the SSE
 * `final` event. A bug report filed right after a bad answer should point at
 * that trace, so the stream handler records it here and the report reads it
 * back. Nothing is persisted: a reload starts empty, and the report then falls
 * back to the trace id stored on the message itself.
 */

/** W3C trace id: 32 lowercase hex characters, not all zero. */
const TRACE_ID_PATTERN = /^(?!0{32})[0-9a-f]{32}$/;

/** Bound on the conversations remembered, so a long session cannot grow it. */
export const MAX_REMEMBERED_CONVERSATIONS = 50;

const byConversation = new Map<string, string>();
let latest: string | undefined;

export const isTraceId = (value: unknown): value is string =>
  typeof value === "string" && TRACE_ID_PATTERN.test(value);

/**
 * Remembers `traceId` as the latest trace of `conversationId`. Anything that
 * is not a valid trace id is ignored, so telemetry being off on the backend
 * (trace_id null) leaves the previous value in place.
 */
export const rememberTraceId = (
  conversationId: string | undefined,
  traceId: unknown,
): void => {
  if (!isTraceId(traceId)) return;
  latest = traceId;
  if (!conversationId) return;
  // Delete first so the entry moves to the end: Map keeps insertion order,
  // which makes the oldest conversation the first one to evict.
  byConversation.delete(conversationId);
  byConversation.set(conversationId, traceId);
  while (byConversation.size > MAX_REMEMBERED_CONVERSATIONS) {
    const oldest = byConversation.keys().next().value;
    if (oldest === undefined) break;
    byConversation.delete(oldest);
  }
};

/**
 * Reads `trace_id` from an SSE `final` event and remembers it. Only reads the
 * event, never changes it.
 */
export const rememberTraceFromFinalEvent = (
  conversationId: string | undefined,
  event: unknown,
): void => {
  if (!event || typeof event !== "object") return;
  rememberTraceId(
    conversationId,
    (event as { trace_id?: unknown }).trace_id,
  );
};

/**
 * The last trace id of `conversationId`, or of any conversation when no id is
 * given (a report filed outside a chat, for example from the error page).
 */
export const getLastTraceId = (conversationId?: string): string | undefined =>
  conversationId ? byConversation.get(conversationId) : latest;

/** Forgets everything. For tests. */
export const clearLastTraces = (): void => {
  byConversation.clear();
  latest = undefined;
};
