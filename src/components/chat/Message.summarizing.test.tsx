import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MessageType } from "@/types";
import { blankBuildTimeEnv } from "@/test-utils/runtimeConfigStub";

vi.mock("./MessageFooter", () => ({ MessageFooter: () => null }));
vi.mock("@/services/axios", () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const message = (overrides: Partial<MessageType> = {}): MessageType =>
  ({
    id: "temp-1",
    conversation_id: "conv-1",
    input: "hello",
    output: "",
    feedback: null,
    timestamp: new Date(),
    documents: [],
    request_input: { llm_type: "main" },
    ...overrides,
  }) as MessageType;

/**
 * Every flag at its code default, never from the machine (the compose
 * frontend sets VITE_FEATURE_AGENT_STEPS=true), plus `config` as served.
 */
const htmlFor = async (
  overrides: Partial<MessageType>,
  isSending = true,
  isLastMessage = true,
  config: Record<string, string> = {},
) => {
  blankBuildTimeEnv();
  vi.stubGlobal("window", {
    __EVE_CONFIG__: config,
    location: { origin: "http://localhost" },
  });
  const { Message } = await import("./Message");
  return renderToStaticMarkup(
    <Message
      message={message(overrides)}
      isSending={isSending}
      isLastMessage={isLastMessage}
    />,
  );
};

describe("summarizing indicator on the in-progress message", () => {
  // FEATURE_AGENT_STEPS is off by default: the wait has its own line, as
  // before (Message.statusLine.test.tsx covers the steps header).
  it("shows the wait line before any answer text", async () => {
    const html = await htmlFor({ summarizing: true });

    expect(html).toContain('data-testid="summarizing-indicator"');
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Summarizing earlier messages…");
    expect(html).not.toContain('data-testid="message-answer"');
    expect(html).not.toContain('data-slot="skeleton"');
  });

  it("hides the line once answer text exists", async () => {
    const html = await htmlFor({ summarizing: true, output: "The answer" });

    expect(html).not.toContain("Summarizing earlier messages…");
    expect(html).not.toContain('data-testid="summarizing-indicator"');
  });

  it("stays hidden when the turn is not the active stream", async () => {
    expect(await htmlFor({ summarizing: true }, false)).not.toContain(
      'data-testid="summarizing-indicator"',
    );
    expect(await htmlFor({ summarizing: true }, true, false)).not.toContain(
      'data-testid="summarizing-indicator"',
    );
  });

  it("stays hidden when the flag is absent", async () => {
    const html = await htmlFor({});

    expect(html).not.toContain('data-testid="summarizing-indicator"');
    expect(html).toContain('data-slot="skeleton"');
  });

  it("with FEATURE_AGENT_STEPS on, shows the wait inside the steps header instead", async () => {
    const html = await htmlFor({ summarizing: true }, true, true, { FEATURE_AGENT_STEPS: "true" });

    expect(html).not.toContain('data-testid="summarizing-indicator"');
    const block = html.slice(html.indexOf('data-testid="agent-steps"'));
    expect(html).toContain('data-testid="agent-steps"');
    expect(block).toMatch(/data-testid="agent-steps-working"[^>]*>Working</);
    expect(block).toMatch(/role="status" aria-live="polite"[^>]*>Summarizing earlier messages…</);
    expect(html).not.toContain('data-testid="message-answer"');
  });
});
