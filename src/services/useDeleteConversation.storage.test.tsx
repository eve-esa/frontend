// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { blankBuildTimeEnv } from "@/test-utils/runtimeConfigStub";
import { QUERY_KEYS } from "./keys";

const del = vi.hoisted(() => vi.fn());
vi.mock("./axios", () => ({ default: { delete: del } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const withFlags = (config: Record<string, string>) => {
  blankBuildTimeEnv();
  (window as unknown as { __EVE_CONFIG__: Record<string, string> }).__EVE_CONFIG__ =
    config;
};

afterEach(() => {
  delete (window as unknown as { __EVE_CONFIG__?: unknown }).__EVE_CONFIG__;
  vi.unstubAllEnvs();
});

describe("useDeleteConversation storage usage", () => {
  it("invalidates storage usage after a successful delete when the flag is on", async () => {
    del.mockResolvedValue({ data: {} });
    withFlags({ FEATURE_STORAGE_QUOTA: "true" });
    const { useDeleteConversation } = await import("./useDeleteConversation");
    const client = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const spy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useDeleteConversation(vi.fn(), false), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });
    await act(async () => {
      await result.current.mutateAsync("c1");
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: [QUERY_KEYS.storageUsage] });
    expect(del).toHaveBeenCalledWith("/conversations/c1");
  });
});