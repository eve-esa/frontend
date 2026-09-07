/**
 * Whether a streamed pre-answer event should turn into a notice.
 *
 * Pulled out of `useSendRequest.ts` so the decision can be tested without a React render:
 * `requery` ("Searched for: ...") always shows, `status` ("Retrieving relevant documents",
 * "Thinking") shows only when `STREAM_STATUS_NOTICES_ENABLED` says so, and every other event
 * type is not a notice at all.
 */
export const shouldShowPreAnswerNotice = (
  type: unknown,
  statusNoticesEnabled: boolean
): boolean => {
  if (type === "requery") {
    return true;
  }
  if (type === "status") {
    return statusNoticesEnabled;
  }
  return false;
};
