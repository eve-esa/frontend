import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { QUERY_KEYS } from "./keys";
import api from "./axios";

const THIRTY_MINUTES = 1000 * 60 * 30;

// A plain `<img src>` cannot send the JWT, so images served by our backend are
// fetched through the authenticated axios instance and exposed as object URLs.
// Object URLs must be revoked once no longer referenced or they leak memory, so
// we subscribe to the query cache (once per client) and revoke the URL whenever
// its blob query is garbage-collected.
const subscribedClients = new WeakSet<QueryClient>();

const ensureRevokeSubscription = (queryClient: QueryClient) => {
  if (subscribedClients.has(queryClient)) return;
  subscribedClients.add(queryClient);
  queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== "removed") return;
    const key = event.query.queryKey;
    if (Array.isArray(key) && key[0] === QUERY_KEYS.imageBlob) {
      const url = event.query.state.data;
      if (typeof url === "string" && url.startsWith("blob:")) {
        URL.revokeObjectURL(url);
      }
    }
  });
};

/**
 * Fetches `src` from our backend as an authenticated blob and returns a cached
 * object URL usable as an `<img src>`. The URL is revoked automatically when the
 * query is evicted from the cache.
 */
export const useImageBlob = (src: string, enabled = true) => {
  const queryClient = useQueryClient();
  ensureRevokeSubscription(queryClient);

  return useQuery({
    queryKey: [QUERY_KEYS.imageBlob, src],
    queryFn: async () => {
      const { data } = await api.get<Blob>(src, { responseType: "blob" });
      return URL.createObjectURL(data);
    },
    enabled: enabled && Boolean(src),
    staleTime: Infinity,
    gcTime: THIRTY_MINUTES,
    retry: 1,
  });
};
