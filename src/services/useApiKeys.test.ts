import { MutationObserver, QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { CREATE_API_KEY_MUTATION_OPTIONS } from "./apiKeysMutationOptions";

/**
 * Exercises the secret-hygiene guarantee at the query-cache level: once the
 * create mutation settles and its one observer lets go of it, gcTime: 0
 * means the mutation (and the raw secret in its result) is gone from the
 * cache rather than lingering for React Query devtools or a later
 * `getAll()` to find.
 */
describe("CREATE_API_KEY_MUTATION_OPTIONS", () => {
  it("drops the settled mutation from the cache once reset", async () => {
    const queryClient = new QueryClient();
    const observer = new MutationObserver(queryClient, {
      ...CREATE_API_KEY_MUTATION_OPTIONS,
      mutationFn: () => Promise.resolve({ token: "eve_x" }),
    });

    await observer.mutate();
    observer.reset();

    // gcTime: 0 schedules the removal with setTimeout(fn, 0); give it a tick.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(queryClient.getMutationCache().getAll()).toEqual([]);
  });
});
