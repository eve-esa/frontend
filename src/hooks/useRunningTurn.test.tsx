// @vitest-environment jsdom
import { act, cleanup, render, renderHook } from "@testing-library/react";
import { useLayoutEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChaMessageType, MessageType } from "@/types";
import { SETTLE_REFETCH_MS, useRunningTurn } from "./useRunningTurn";

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

type Props = { data: ChaMessageType | undefined; conversationId?: string };

const mount = (initial: ChaMessageType | undefined) => {
  const refresh = vi.fn().mockResolvedValue(undefined);
  const hook = renderHook(
    ({ data, conversationId = "c1" }: Props) => useRunningTurn(data, conversationId, refresh),
    { initialProps: { data: initial } as Props },
  );
  return { refresh, ...hook };
};

const advance = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

describe("useRunningTurn", () => {
  it("names the running turn and does not refresh by itself", async () => {
    const { result, refresh } = mount(conv(ID));
    expect(result.current).toBe(ID);
    await advance(10_000);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("is null for a conversation that never reported an active turn", async () => {
    const { result, refresh, rerender } = mount(conv(undefined));
    rerender({ data: conv(null) });
    await advance(10_000);
    expect(result.current).toBeNull();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("when the field turns null and the row has no output, keeps the turn as running and refreshes once after 2 s", async () => {
    const { result, refresh, rerender } = mount(conv(ID));
    rerender({ data: conv(null) });
    expect(result.current).toBe(ID);
    await advance(SETTLE_REFETCH_MS - 100);
    expect(refresh).not.toHaveBeenCalled();
    await advance(200);
    expect(refresh).toHaveBeenCalledTimes(1);
    // The read landed and the row is still empty: the error state may show.
    expect(result.current).toBeNull();
    await advance(20_000);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("never commits a frame without the turn between the null field and the wait", () => {
    const committed: (string | null)[] = [];
    const refresh = vi.fn().mockResolvedValue(undefined);
    // A layout effect runs at commit, before any passive effect: what it
    // records is what the screen paints.
    const Probe = ({ data }: { data: ChaMessageType }) => {
      const id = useRunningTurn(data, "c1", refresh);
      useLayoutEffect(() => {
        committed.push(id);
      });
      return null;
    };
    const { rerender } = render(<Probe data={conv(ID)} />);
    rerender(<Probe data={conv(null)} />);
    expect(committed).toEqual([ID, ID]);
  });

  it("does not wait when the saved row is already there", async () => {
    const { result, refresh, rerender } = mount(conv(ID));
    rerender({ data: conv(null, { output: "Done." }) });
    expect(result.current).toBeNull();
    await advance(5000);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("does not wait for a failed or stopped row", async () => {
    const { result, refresh, rerender } = mount(conv(ID));
    rerender({ data: conv(null, { metadata: { error: { code: "timeout" } } } as Partial<MessageType>) });
    expect(result.current).toBeNull();
    await advance(5000);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("drops the wait and its timer on a conversation switch", async () => {
    const { result, refresh, rerender } = mount(conv(ID));
    rerender({ data: conv(null) });
    expect(result.current).toBe(ID);
    rerender({ data: undefined, conversationId: "c2" });
    expect(result.current).toBeNull();
    await advance(10_000);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("clears the timer on unmount", async () => {
    const { refresh, rerender, unmount } = mount(conv(ID));
    rerender({ data: conv(null) });
    unmount();
    await advance(10_000);
    expect(refresh).not.toHaveBeenCalled();
  });
});
