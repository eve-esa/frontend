import { MUTATION_KEYS } from "./keys";

/**
 * The create mutation's cache options, isolated in their own axios-free
 * module (`keys.ts` is a plain object, nothing else) so a test can exercise
 * the exact secret-hygiene wiring, gcTime: 0 dropping the mutation from the
 * cache the instant nothing observes it, without needing a browser-shaped
 * environment for axios and the OIDC user manager `useApiKeys.ts` pulls in.
 *
 * The response carries the raw secret once. gcTime: 0 means the settled
 * mutation (and the secret inside `mutation.data`) is gone from
 * `queryClient.getMutationCache()` as soon as the last observer drops it, so
 * nothing outside the reveal view's own state can read it back.
 */
export const CREATE_API_KEY_MUTATION_OPTIONS = {
  mutationKey: [MUTATION_KEYS.apiKeys, "create"],
  gcTime: 0,
} as const;
