import { MutationObserver, QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { CREATE_API_KEY_MUTATION_OPTIONS } from "./apiKeysMutationOptions";

/**
 * F1: Escape during a pending key creation unsubscribes the create mutation
 * (ApiKeysDialog's onEscapeKeyDown used to call goToList() unconditionally,
 * unmounting ApiKeyCreateForm, which tears down its MutationObserver). This
 * pins the exact @tanstack/react-query@5.102.8 behaviour the bug and the fix
 * both depend on: once an observer is unsubscribed, a per-call onSuccess
 * passed to mutate() never fires for that call, even though the mutation
 * itself still settles and the mutation cache still reflects it (hook-level
 * onSuccess/onSettled given at observer-creation time are a separate
 * subscription and are unaffected).
 *
 * There is no component-level regression test for the Escape key itself:
 * vitest here runs with environment "node" (see vitest.config.ts), so there
 * is no jsdom, no @testing-library/react and no key-event dispatch available,
 * and the handler lives on Radix's onEscapeKeyDown prop, which
 * renderToStaticMarkup (used elsewhere for these components, e.g.
 * ApiKeyRow.test.tsx) never invokes. This test is the closest reproduction
 * reachable in this env.
 */
describe("create API key mutation: unsubscribe mid-flight", () => {
  it("drops the per-call onSuccess once the observer unsubscribes, even though the mutation settles", async () => {
    const queryClient = new QueryClient();
    let resolveMutation: (value: { token: string }) => void;
    const pending = new Promise<{ token: string }>((resolve) => {
      resolveMutation = resolve;
    });

    const observer = new MutationObserver(queryClient, {
      ...CREATE_API_KEY_MUTATION_OPTIONS,
      mutationFn: () => pending,
    });

    // A no-op subscribe is required for the observer to actually run the
    // mutation, the same way React's useMutation subscribes on mount.
    const unsubscribe = observer.subscribe(() => undefined);

    let perCallFired = false;
    void observer.mutate(undefined, {
      onSuccess: () => {
        perCallFired = true;
      },
    });

    // Simulates ApiKeyCreateForm unmounting while the request is in flight,
    // which is what the unconditional goToList() on Escape used to trigger.
    unsubscribe();

    resolveMutation!({ token: "eve_secret_would_be_lost" });
    await pending;
    // Let the mutation's internal promise chain flush.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(perCallFired).toBe(false);
  });
});
