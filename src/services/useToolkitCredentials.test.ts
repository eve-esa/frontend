import { beforeEach, describe, expect, it, vi } from "vitest";
import { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { MutationObserver, QueryClient } from "@tanstack/react-query";

const mocks = vi.hoisted(() => ({ put: vi.fn(), delete: vi.fn() }));

vi.mock("@/services/axios", () => ({
  default: { put: mocks.put, delete: mocks.delete },
}));

import {
  toolkitCredentialErrorMessage,
  useDeleteToolkitCredentials,
  useSaveToolkitCredentials,
} from "./useToolkitCredentials";
import { QUERY_KEYS } from "./keys";

const SECRET = "s3cr3t-value-123";

const httpError = (
  status: number,
  data: unknown,
  body?: string,
): AxiosError => {
  const config = { data: body } as InternalAxiosRequestConfig;
  return new AxiosError("Request failed", "ERR_BAD_REQUEST", config, {}, {
    status,
    statusText: "",
    headers: {},
    config,
    data,
  });
};

describe("toolkitCredentialErrorMessage", () => {
  it("names a rejection by the provider", () => {
    const error = httpError(422, { detail: { code: "credentials_rejected" } });
    expect(toolkitCredentialErrorMessage(error)).toBe(
      "The provider rejected these credentials. Check them and try again.",
    );
  });

  it("names an unreachable provider", () => {
    const error = httpError(503, {
      detail: { code: "credentials_check_unavailable" },
    });
    expect(toolkitCredentialErrorMessage(error)).toBe(
      "Couldn't reach the provider to check these credentials. Try again in a moment.",
    );
  });

  it("shows the message of an invalid value", () => {
    const error = httpError(422, {
      detail: {
        code: "credentials_invalid",
        message: "Client ID must not contain spaces.",
        field: "client_id",
      },
    });
    expect(toolkitCredentialErrorMessage(error)).toBe(
      "Client ID must not contain spaces.",
    );
  });

  it("falls back when an invalid value carries no message", () => {
    const error = httpError(422, { detail: { code: "credentials_invalid" } });
    expect(toolkitCredentialErrorMessage(error)).toBe(
      "Couldn't save the credentials. Try again.",
    );
  });

  it("asks to wait after a 429", () => {
    expect(toolkitCredentialErrorMessage(httpError(429, {}))).toBe(
      "Too many attempts. Try again in a minute.",
    );
  });

  it("uses the generic text for anything else", () => {
    expect(toolkitCredentialErrorMessage(httpError(500, "oops"))).toBe(
      "Couldn't save the credentials. Try again.",
    );
    expect(toolkitCredentialErrorMessage(httpError(404, { detail: "Not Found" }))).toBe(
      "Couldn't save the credentials. Try again.",
    );
    expect(toolkitCredentialErrorMessage(new Error("network"))).toBe(
      "Couldn't save the credentials. Try again.",
    );
    expect(toolkitCredentialErrorMessage(undefined)).toBe(
      "Couldn't save the credentials. Try again.",
    );
  });
});

// The hooks are `useMutation` with fixed options. `useMutation` is replaced by
// an identity function so a MutationObserver on a real client can run the exact
// options without a DOM.
const runWith = (
  options: unknown,
  client: QueryClient,
  variables: unknown,
): Promise<unknown> =>
  new MutationObserver(client, options as never).mutate(variables as never);

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQueryClient: () => testClient,
    useMutation: (options: unknown) => options,
  };
});

let testClient: QueryClient;

describe("toolkit credential mutations", () => {
  beforeEach(() => {
    testClient = new QueryClient();
    mocks.put.mockReset();
    mocks.delete.mockReset();
  });

  it("PUTs the values and refreshes the server list", async () => {
    const saved = { configured: true };
    mocks.put.mockResolvedValue({ data: saved });
    const spy = vi.spyOn(testClient, "invalidateQueries");

    const result = await runWith(useSaveToolkitCredentials(), testClient, {
      serverId: "abc 1",
      values: { client_id: "id", client_secret: SECRET },
    });

    expect(result).toBe(saved);
    expect(mocks.put).toHaveBeenCalledWith("/mcp-servers/abc%201/credentials", {
      values: { client_id: "id", client_secret: SECRET },
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: [QUERY_KEYS.mcpServers] });
  });

  it("keeps no secret in the mutation cache", () => {
    // gcTime 0 removes a settled mutation, and the variables it holds, once
    // nothing observes it.
    const save = useSaveToolkitCredentials() as unknown as { gcTime: number };
    const remove = useDeleteToolkitCredentials() as unknown as {
      gcTime: number;
    };
    expect(save.gcTime).toBe(0);
    expect(remove.gcTime).toBe(0);
  });

  it("drops the request body from a failed save", async () => {
    const body = JSON.stringify({ values: { client_secret: SECRET } });
    const error = httpError(
      422,
      { detail: { code: "credentials_rejected" } },
      body,
    );
    mocks.put.mockRejectedValue(error);
    const spy = vi.spyOn(testClient, "invalidateQueries");

    const options = useSaveToolkitCredentials();
    const failure = await runWith(options, testClient, {
      serverId: "abc",
      values: { client_secret: SECRET },
    }).catch((e: unknown) => e);

    expect(failure).toBe(error);
    expect((failure as AxiosError).config?.data).toBeUndefined();
    expect(JSON.stringify(failure)).not.toContain(SECRET);
    expect(spy).toHaveBeenCalled();
  });

  it("DELETEs and refreshes the server list", async () => {
    mocks.delete.mockResolvedValue({});
    const spy = vi.spyOn(testClient, "invalidateQueries");

    await runWith(useDeleteToolkitCredentials(), testClient, "abc");

    expect(mocks.delete).toHaveBeenCalledWith("/mcp-servers/abc/credentials");
    expect(spy).toHaveBeenCalledWith({ queryKey: [QUERY_KEYS.mcpServers] });
  });
});
