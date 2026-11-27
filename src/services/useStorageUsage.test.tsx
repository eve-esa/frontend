// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { blankBuildTimeEnv } from "@/test-utils/runtimeConfigStub";
import { QUERY_KEYS } from "./keys";

const get = vi.hoisted(() => vi.fn());
vi.mock("./axios", () => ({ default: { get } }));

const usage = {
  unlimited: false,
  rate_limit_group: "free",
  used_bytes: 10,
  max_bytes: 20,
  remaining_bytes: 10,
  used_ratio: 0.5,
  used_gb: 0,
  max_gb: 0,
};

const wrap = (client: QueryClient) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };

const withFlags = (config: Record<string, string>) => {
  blankBuildTimeEnv();
  (window as unknown as { __EVE_CONFIG__: Record<string, string> }).__EVE_CONFIG__ =
    config;
};

afterEach(() => {
  delete (window as unknown as { __EVE_CONFIG__?: unknown }).__EVE_CONFIG__;
  vi.unstubAllEnvs();
});

describe("useStorageUsage", () => {
  it("makes no request when the flag is off", async () => {
    withFlags({});
    get.mockReset();
    const { useStorageUsage } = await import("./useStorageUsage");
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    renderHook(() => useStorageUsage(), { wrapper: wrap(client) });
    await act(async () => {
      await Promise.resolve();
    });
    expect(get).not.toHaveBeenCalled();
  });

  it("calls /users/me/storage-usage when the flag is on", async () => {
    withFlags({ FEATURE_STORAGE_QUOTA: "true" });
    get.mockReset();
    get.mockResolvedValue({ data: usage });
    const { useStorageUsage } = await import("./useStorageUsage");
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result } = renderHook(() => useStorageUsage(), {
      wrapper: wrap(client),
    });
    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(get).toHaveBeenCalledWith("/users/me/storage-usage");
    expect(result.current.data).toEqual(usage);
  });

  it("invalidates only when the flag is on", async () => {
    withFlags({});
    const off = await import("./useStorageUsage");
    const client = new QueryClient();
    const spy = vi.spyOn(client, "invalidateQueries");
    await off.invalidateStorageUsage(client);
    expect(spy).not.toHaveBeenCalled();

    withFlags({ FEATURE_STORAGE_QUOTA: "true" });
    const on = await import("./useStorageUsage");
    await on.invalidateStorageUsage(client);
    expect(spy).toHaveBeenCalledWith({ queryKey: [QUERY_KEYS.storageUsage] });
  });
});