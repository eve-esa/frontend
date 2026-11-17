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

const live = (overrides: Partial<MessageType> = {}): MessageType =>
  ({
    id: "temp-1",
    conversation_id: "conv-1",
    input: "hello",
    output: "",
    feedback: null,
    timestamp: new Date(),
    documents: [],
    request_input: { llm_type: "main" },
    pre_answer_notices: ["Thinking"],
    ...overrides,
  }) as MessageType;

const render = async (agentic: boolean, message: MessageType, agentSteps = true) => {
  blankBuildTimeEnv();
  vi.stubGlobal("window", {
    __EVE_CONFIG__: {
      FEATURE_AGENTIC_CHAT: agentic ? "true" : "false",
      FEATURE_AGENT_STEPS: agentSteps ? "true" : "false",
    },
    location: { origin: "http://localhost" },
  });
  const { Message } = await import("./Message");
  return renderToStaticMarkup(<Message message={message} isSending isLastMessage />);
};

describe("one status line on the streaming turn", () => {
  it("agentic: the steps header says Thinking… and the old notice is gone", async () => {
    const html = await render(true, live());
    expect(html).toContain('data-testid="agent-steps"');
    // The open header says Working; the live region announces Thinking….
    expect(html).toMatch(/data-testid="agent-steps-working"[^>]*>Working</);
    expect(html).not.toContain(">Thinking<");
    expect(html.match(/Thinking/g)).toHaveLength(1);
    expect(html).toMatch(/data-testid="agent-steps-announce" role="status" aria-live="polite"[^>]*>Thinking…</);
  });

  it("agentic: a running step replaces Thinking… in the header, with no second line", async () => {
    const html = await render(
      true,
      live({ tool_activity: [{ label: "Calling cdse", tool: "search", kind: "mcp", server: "cdse", state: "running" }] }),
    );
    // The row shows the step; the live region announces it.
    expect(html).toMatch(/data-testid="agent-steps-announce"[^>]*>Calling search in cdse, running</);
    expect(html).toContain('data-testid="agent-step"');
    expect(html).not.toContain("Thinking");
  });

  it("agentic with FEATURE_AGENT_STEPS off: the notice and the tool chips stay, no steps block", async () => {
    const html = await render(
      true,
      live({ tool_activity: [{ label: "Calling cdse", tool: "search", server: "cdse", state: "running" }] }),
      false,
    );
    expect(html).not.toContain('data-testid="agent-steps"');
    expect(html).toContain(">Thinking<");
    expect(html).toContain('data-testid="tool-chip"');
  });

  it("classic: the streamed notice stays and no steps block shows", async () => {
    const html = await render(false, live({ pre_answer_notices: ["Retrieving relevant documents"] }));
    expect(html).toContain("Retrieving relevant documents");
    expect(html).not.toContain('data-testid="agent-steps"');
  });
});
