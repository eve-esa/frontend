// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.fn();
vi.mock("./axios", () => ({ default: { get: (...args: unknown[]) => get(...args) } }));

import { useGetConversation } from "./useGetConversation";

const body = (active: string | null | undefined) => ({
  data: {
    id: "c1",
    messages: [{ id: "m1", conversation_id: "c1", input: "q", output: "" }],
    ...(active === undefined ? {} : { active_message_id: active }),
  },
});

const wrap = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
};

const tick = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

beforeEach(() => {
  vi.useFakeTimers();
  get.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("conversation polling while a turn runs", () => {
  it("refetches every 5 s while active_message_id is set, then stops when it turns null", async () => {
    get
      .mockResolvedValueOnce(body("m1"))
      .mockResolvedValueOnce(body("m1"))
      .mockResolvedValue(body(null));
    renderHook(() => useGetConversation({ conversationId: "c1", enabled: true }), {
      wrapper: wrap(),
    });
    await tick(0);
    expect(get).toHaveBeenCalledTimes(1);
    await tick(4900);
    expect(get).toHaveBeenCalledTimes(1);
    await tick(200);
    expect(get).toHaveBeenCalledTimes(2);
    await tick(5000);
    expect(get).toHaveBeenCalledTimes(3);
    // Null now: no more requests.
    await tick(30_000);
    expect(get).toHaveBeenCalledTimes(3);
  });

  it("never polls when the field is absent", async () => {
    get.mockResolvedValue(body(undefined));
    renderHook(() => useGetConversation({ conversationId: "c1", enabled: true }), {
      wrapper: wrap(),
    });
    await tick(0);
    await tick(30_000);
    expect(get).toHaveBeenCalledTimes(1);
  });
});
