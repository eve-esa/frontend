import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { MessageType } from "@/types";

vi.mock("./MessageFooter", () => ({ MessageFooter: () => null }));
vi.mock("@/services/axios", () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

import { Message } from "./Message";

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

const htmlFor = (
  overrides: Partial<MessageType>,
  isSending = true,
  isLastMessage = true,
) =>
  renderToStaticMarkup(
    <Message
      message={message(overrides)}
      isSending={isSending}
      isLastMessage={isLastMessage}
    />,
  );

describe("summarizing indicator on the in-progress message", () => {
  it("shows the wait line before any answer text", () => {
    const html = htmlFor({ summarizing: true });

    expect(html).toContain('data-testid="summarizing-indicator"');
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Summarizing earlier messages…");
    expect(html).not.toContain('data-testid="message-answer"');
    expect(html).not.toContain('data-slot="skeleton"');
  });

  it("hides the line once answer text exists", () => {
    const html = htmlFor({ summarizing: true, output: "The answer" });

    expect(html).not.toContain("Summarizing earlier messages…");
    expect(html).not.toContain('data-testid="summarizing-indicator"');
  });

  it("stays hidden when the turn is not the active stream", () => {
    expect(htmlFor({ summarizing: true }, false)).not.toContain(
      'data-testid="summarizing-indicator"',
    );
    expect(htmlFor({ summarizing: true }, true, false)).not.toContain(
      'data-testid="summarizing-indicator"',
    );
  });

  it("stays hidden when the flag is absent", () => {
    const html = htmlFor({});

    expect(html).not.toContain('data-testid="summarizing-indicator"');
    expect(html).toContain('data-slot="skeleton"');
  });
});
