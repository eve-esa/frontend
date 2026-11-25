import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import api from "./axios";
import { QUERY_KEYS } from "./keys";
import type { FileListing, Sandbox } from "@/types";

/**
 * The conversation's sandbox and files (backend `FEATURE_SANDBOX_API`). A debugging view, so
 * every read is fresh and a failure is shown rather than retried.
 */
const FRESH = { staleTime: 0, retry: false, refetchOnWindowFocus: false } as const;

export const sandboxUrl = (conversationId: string) =>
  `/conversations/${conversationId}/sandbox`;

export const sandboxFilesUrl = (conversationId: string) =>
  `/conversations/${conversationId}/sandbox/files`;

export const conversationFilesUrl = (conversationId: string) =>
  `/conversations/${conversationId}/files`;

/** Download URL of one saved file; each segment is encoded, the slashes are kept. */
export const conversationFileUrl = (conversationId: string, path: string) =>
  `${conversationFilesUrl(conversationId)}/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;

/** HTTP status of a failed request, undefined for a network error or a non-axios one. */
export const errorStatus = (error: unknown): number | undefined =>
  isAxiosError(error) ? error.response?.status : undefined;

export const useSandbox = (conversationId: string | undefined) =>
  useQuery({
    queryKey: [QUERY_KEYS.sandbox, conversationId],
    queryFn: async () => {
      const { data } = await api.get<Sandbox>(sandboxUrl(conversationId!));
      return data;
    },
    enabled: Boolean(conversationId),
    ...FRESH,
  });

/** Live tree. Only asked when there is a sandbox: otherwise the answer is a known 404. */
export const useSandboxFiles = (conversationId: string | undefined, enabled: boolean) =>
  useQuery({
    queryKey: [QUERY_KEYS.sandboxFiles, conversationId],
    queryFn: async () => {
      const { data } = await api.get<FileListing>(sandboxFilesUrl(conversationId!));
      return data;
    },
    enabled: Boolean(conversationId) && enabled,
    ...FRESH,
  });

/** One saved text file, read only while `enabled` (a tool result offloaded to S3). */
export const useConversationFileText = (
  conversationId: string | null | undefined,
  path: string | null,
  enabled: boolean,
) =>
  useQuery({
    queryKey: [QUERY_KEYS.conversationFiles, conversationId, path],
    queryFn: async () => {
      const { data } = await api.get<string>(conversationFileUrl(conversationId!, path!), {
        responseType: "text",
      });
      return data;
    },
    enabled: Boolean(conversationId && path) && enabled,
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
  });

export const useConversationFiles = (conversationId: string | undefined) =>
  useQuery({
    queryKey: [QUERY_KEYS.conversationFiles, conversationId],
    queryFn: async () => {
      const { data } = await api.get<FileListing>(conversationFilesUrl(conversationId!));
      return data;
    },
    enabled: Boolean(conversationId),
    ...FRESH,
  });
