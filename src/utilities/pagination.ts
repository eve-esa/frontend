import type { Meta } from "@/types";

/**
 * The `getNextPageParam` of every paginated query.
 *
 * Two things this fixes, both observed rather than imagined.
 *
 * It **guards the page**. Every call site used to destructure `({ meta: { total_pages,
 * current_page } })` directly, so a page that arrived undefined — one failed request, a backend
 * restarting, a malformed response — threw a TypeError out of React Query and into React
 * Router's default error boundary, blanking the whole route. A transient API hiccup should cost
 * you the next page, not the screen. Returning undefined here means "no more pages", which is
 * the honest answer when we cannot tell.
 *
 * It **asks `has_next`** instead of comparing counters. The API already computes it, and the
 * comparisons had drifted apart: five call sites used `current_page < total_pages` while
 * `useGetConversationsList` used `current_page !== total_pages`. On an empty list the backend
 * returns `current_page: 1, total_pages: 0`, so `1 !== 0` held and it asked for page 2, and 3,
 * and so on — an unbounded fetch loop for any user with no conversations.
 */
export const nextPageParam = (
  lastPage: { meta?: Meta } | undefined
): number | undefined =>
  lastPage?.meta?.has_next ? lastPage.meta.current_page + 1 : undefined;

/**
 * Same rule, for the one query whose page parameter is a string rather than a number.
 */
export const nextPageParamAsString = (
  lastPage: { meta?: Meta } | undefined
): string | undefined => {
  const next = nextPageParam(lastPage);
  return next === undefined ? undefined : `${next}`;
};
