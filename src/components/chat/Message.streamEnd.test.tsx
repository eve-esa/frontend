// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MessageType } from "@/types";
import { blankBuildTimeEnv } from "@/test-utils/runtimeConfigStub";

vi.mock("./MessageFooter", () => ({ MessageFooter: () => null }));
vi.mock("@/services/axios", () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

const FULL =
  "Sentinel-1 flood mapping often uses a fixed threshold of -17 dB on VV backscatter. " +
  "Index based methods such as the Normalized Difference Sigma-Naught Index refine it [2].";

const turn = (output: string): MessageType =>
  ({
    id: "temp-1",
    conversation_id: "conv-1",
    input: "flood thresholds",
    output,
    feedback: null,
    timestamp: new Date(),
    documents: [],
    request_input: { llm_type: "main" },
  }) as MessageType;

describe("end of a streamed turn", () => {
  it("shows the whole answer once the stream ends, even when the typewriter timers stopped", async () => {
    blankBuildTimeEnv();
    const { Message } = await import("./Message");
    // Fake timers: the typewriter runs a little, then starves, as in a hidden
    // or busy tab.
    vi.useFakeTimers();
    const { rerender } = render(<Message message={turn(FULL.slice(0, 40))} isSending isLastMessage />);
    rerender(<Message message={turn(FULL)} isSending isLastMessage />);
    // The typewriter reveals a few characters, then its timers stop running.
    act(() => {
      vi.advanceTimersByTime(200);
    });
    // The stream ends: the mutation settles and the turn is no longer the target.
    rerender(<Message message={turn(FULL)} isSending={false} isLastMessage />);
    vi.useRealTimers();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    const answer = await screen.findByTestId("message-answer", {}, { timeout: 10000 });
    await vi.waitFor(() => expect(answer.textContent).toContain("refine it [2]."), { timeout: 10000 });
  });
});
