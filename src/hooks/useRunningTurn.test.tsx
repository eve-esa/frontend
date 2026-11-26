// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChaMessageType, MessageType } from "@/types";
import { useRunningTurn } from "./useRunningTurn";

const ID = "6afdf506a1b2c3d4e5f60718";

const conv = (
  active: string | null | undefined,
  rowOverrides: Partial<MessageType> = {},
): ChaMessageType =>
  ({
    id: "c1",
    name: "n",
    timestamp: new Date(),
    user_id: "u",
    ...(active === undefined ? {} : { active_message_id: active }),
    messages: [{ id: ID, conversation_id: "c1", input: "q", output: "", ...rowOverrides }],
  }) as unknown as ChaMessageType;

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const mount = (initial: ChaMessageType | undefined) => {
  const refetch = vi.fn().mockResolvedValue(undefined);
  const hook = renderHook(({ data }) => useRunningTurn(data, refetch), {
    initialProps: { data: initial },
  });
  return { refetch, ...hook };
};

describe("useRunningTurn", () => {
  it("names the running turn and does not refetch by itself", () => {
    const { result, refetch } = mount(conv(ID));
    expect(result.current).toBe(ID);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(refetch).not.toHaveBeenCalled();
  });

  it("is null for a conversation that never reported an active turn", () => {
    const { result, refetch, rerender } = mount(conv(undefined));
    rerender({ data: conv(null) });
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(result.current).toBeNull();
    expect(refetch).not.toHaveBeenCalled();
  });

  it("when the field turns null and the row has no output, keeps the turn as running and refetches once after 2 s", async () => {
    const { result, refetch, rerender } = mount(conv(ID));
    rerender({ data: conv(null) });
    expect(result.current).toBe(ID);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1900);
    });
    expect(refetch).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(refetch).toHaveBeenCalledTimes(1);
    // The refetch landed and the row is still empty: the error state may show.
    expect(result.current).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("does not wait when the saved row is already there", () => {
    const { result, refetch, rerender } = mount(conv(ID));
    rerender({ data: conv(null, { output: "Done." }) });
    expect(result.current).toBeNull();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(refetch).not.toHaveBeenCalled();
  });

  it("does not wait for a failed or stopped row", () => {
    const { result, refetch, rerender } = mount(conv(ID));
    rerender({ data: conv(null, { metadata: { error: { code: "timeout" } } } as Partial<MessageType>) });
    expect(result.current).toBeNull();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(refetch).not.toHaveBeenCalled();
  });
});
