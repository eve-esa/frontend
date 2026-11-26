// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MessageType } from "@/types";
import { blankBuildTimeEnv } from "@/test-utils/runtimeConfigStub";

vi.mock("./MessageFooter", () => ({ MessageFooter: () => <div data-testid="message-footer-stub" /> }));
vi.mock("@/services/axios", () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

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

describe("message footer during a stream", () => {
  it("is not rendered while the message is the streaming target, even with interim text", async () => {
    blankBuildTimeEnv();
    const { Message } = await import("./Message");
    render(<Message message={turn("I'll look up the thresholds.")} isSending isLastMessage />);
    expect(screen.queryByTestId("message-footer-stub")).toBeNull();
  });

  it("is rendered once the stream ends", async () => {
    blankBuildTimeEnv();
    const { Message } = await import("./Message");
    const { rerender } = render(<Message message={turn("Done.")} isSending isLastMessage />);
    expect(screen.queryByTestId("message-footer-stub")).toBeNull();
    rerender(<Message message={turn("Done.")} isSending={false} isLastMessage />);
    expect(screen.getByTestId("message-footer-stub")).toBeTruthy();
  });
});
