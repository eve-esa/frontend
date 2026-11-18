// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MessageType } from "@/types";
import { blankBuildTimeEnv } from "@/test-utils/runtimeConfigStub";

vi.mock("./MessageFooter", () => ({ MessageFooter: () => null }));
vi.mock("@/services/axios", () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

const citation = {
  id: "src_1",
  kind: "document",
  provider: "wiley",
  provider_label: "Wiley AI Gateway",
  visibility: "licensed",
  title: "Burn severity",
  n: 1,
  at: [5],
  origin: "model",
};

const turn = (overrides: Partial<MessageType> = {}): MessageType =>
  ({
    id: "temp-1",
    conversation_id: "conv-1",
    input: "hello",
    output: "",
    feedback: null,
    timestamp: new Date(),
    documents: [],
    request_input: { llm_type: "main" },
    tool_activity: [{ label: "Calling tool", id: "c1", tool: "eve_retrieval_retrieve", state: "done" }],
    ...overrides,
  }) as MessageType;

/** Flags through the build-time env: jsdom has a window without `__EVE_CONFIG__`. */
const loadMessage = async (citations: boolean) => {
  blankBuildTimeEnv();
  vi.stubEnv("VITE_FEATURE_AGENTIC_CHAT", "true");
  vi.stubEnv("VITE_FEATURE_AGENT_STEPS", "true");
  vi.stubEnv("VITE_FEATURE_INLINE_CITATIONS", citations ? "true" : "false");
  return (await import("./Message")).Message;
};

describe("Message with inline citations", () => {
  it("keeps the steps block and the answer mounted when the first citations arrive mid-stream", async () => {
    const Message = await loadMessage(true);
    // Not the streaming target: jsdom runs no animation frames, so the smooth
    // stream would show nothing. What changes between the renders is the same
    // as mid-stream: the first frame that carries citations.
    const { rerender } = render(<Message message={turn({ output: "Burn" })} isSending={false} isLastMessage />);
    const steps = screen.getByTestId("agent-steps");
    // The smooth stream types the first characters on the next frames.
    const answer = await screen.findByTestId("message-answer");
    rerender(
      <Message
        message={turn({ output: "Burn.[1] more", metadata: { citations: [citation] } as MessageType["metadata"] })}
        isSending={false}
        isLastMessage
      />,
    );
    expect(screen.getByTestId("agent-steps")).toBe(steps);
    expect(await screen.findByTestId("message-answer")).toBe(answer);
    // The renderer is a lazy chunk: under a full suite run it can take seconds.
    expect(await screen.findByTestId("citation-marker", {}, { timeout: 10000 })).toBeTruthy();
  });

  it("with the flag off ignores the lists: no marker, no sources list, the text as stored", async () => {
    const Message = await loadMessage(false);
    render(
      <Message
        message={turn({ id: "m1", output: "Burn.[1]", metadata: { citations: [citation] } as MessageType["metadata"] })}
        isSending={false}
        isLastMessage
      />,
    );
    expect(screen.queryByTestId("citation-marker")).toBeNull();
    expect(screen.queryByTestId("message-sources")).toBeNull();
    const answer = await screen.findByTestId("message-answer");
    await waitFor(() => expect(answer.textContent).toContain("Burn.[1]"), { timeout: 10000 });
  });
});
