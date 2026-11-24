import { isAxiosError } from "axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "./axios";
import { MUTATION_KEYS, QUERY_KEYS } from "./keys";
import type { ToolkitUserCredentials } from "./useGetMcpServers";
import type { ApiError } from "@/types";

export type SaveToolkitCredentialsVariables = {
  serverId: string;
  /** Field name to value, as the toolkit's `user_credentials.fields` declare them. */
  values: Record<string, string>;
};

/**
 * An axios error keeps the request it failed on, and `config.data` is that
 * request's JSON body: here the credentials the user typed. Anything that
 * serialises the error (`JSON.stringify` calls `toJSON`, which includes
 * `config`), logs it or sends it to `/log-error` or the browser telemetry
 * would carry them. Dropping the body here covers every consumer at once.
 */
const withoutRequestBody = (error: unknown): never => {
  if (isAxiosError(error) && error.config) {
    error.config.data = undefined;
  }
  throw error;
};

const saveCredentials = async ({
  serverId,
  values,
}: SaveToolkitCredentialsVariables): Promise<ToolkitUserCredentials> => {
  try {
    const { data } = await api.put<ToolkitUserCredentials>(
      `/mcp-servers/${encodeURIComponent(serverId)}/credentials`,
      { values },
    );
    return data;
  } catch (error) {
    return withoutRequestBody(error);
  }
};

const deleteCredentials = async (serverId: string): Promise<void> => {
  await api.delete(`/mcp-servers/${encodeURIComponent(serverId)}/credentials`);
};

/**
 * The server list carries `user_credentials`, so a save or a removal makes it
 * stale. Invalidated on settle, failures included: a refused save leaves the
 * row as it was and a refetch costs nothing.
 */
const useInvalidateMcpServers = () => {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.mcpServers] });
};

/**
 * `gcTime: 0` drops the settled mutation from the cache as soon as nothing
 * observes it, so the submitted secret (`mutation.state.variables`) does not
 * outlive the form.
 */
export const useSaveToolkitCredentials = () => {
  const invalidate = useInvalidateMcpServers();
  return useMutation<
    ToolkitUserCredentials,
    ApiError,
    SaveToolkitCredentialsVariables
  >({
    mutationKey: [MUTATION_KEYS.toolkitCredentials, "save"],
    mutationFn: saveCredentials,
    gcTime: 0,
    onSettled: () => {
      void invalidate();
    },
  });
};

export const useDeleteToolkitCredentials = () => {
  const invalidate = useInvalidateMcpServers();
  return useMutation<void, ApiError, string>({
    mutationKey: [MUTATION_KEYS.toolkitCredentials, "delete"],
    mutationFn: deleteCredentials,
    gcTime: 0,
    onSettled: () => {
      void invalidate();
    },
  });
};

type CredentialErrorBody = {
  detail?: { code?: string; message?: string; field?: string } | string;
};

/** What to tell the user about a failed save. Never echoes a submitted value. */
export const toolkitCredentialErrorMessage = (error: unknown): string => {
  const response = isAxiosError<CredentialErrorBody>(error)
    ? error.response
    : undefined;
  const detail = response?.data?.detail;
  const code = typeof detail === "object" ? detail?.code : undefined;

  if (code === "credentials_rejected") {
    return "The provider rejected these credentials. Check them and try again.";
  }
  if (code === "credentials_check_unavailable") {
    return "Couldn't reach the provider to check these credentials. Try again in a moment.";
  }
  if (code === "credentials_invalid" && typeof detail === "object" && detail.message) {
    return detail.message;
  }
  if (response?.status === 429) {
    return "Too many attempts. Try again in a minute.";
  }
  return "Couldn't save the credentials. Try again.";
};
