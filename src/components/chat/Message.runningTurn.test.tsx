// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MessageType } from "@/types";
import { blankBuildTimeEnv } from "@/test-utils/runtimeConfigStub";

vi.mock("./MessageFooter", () => ({ MessageFooter: () => <div data-testid="message-footer-stub" /> }));
vi.mock("@/services/axios", () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

const SENT = new Date("2026-11-18T18:57:10Z").getTime();
// A stored id: its first four bytes are the creation second.
const ID = `${Math.floor(SENT / 1000).toString(16)}a1b2c3d4e5f60718`;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(SENT + 30_000);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const row = (): MessageType =>
  ({
    id: ID,
    conversation_id: "conv-1",
    input: "flood thresholds",
    output: "",
    feedback: null,
    timestamp: new Date(),
    documents: [],
    request_input: { llm_type: "main" },
  }) as MessageType;

const mount = async (agentSteps: boolean, props: { isRunning?: boolean } = { isRunning: true }) => {
  blankBuildTimeEnv();
  vi.resetModules();
  (window as unknown as { __EVE_CONFIG__: Record<string, string> }).__EVE_CONFIG__ = {
    FEATURE_AGENTIC_CHAT: "true",
    FEATURE_AGENT_STEPS: agentSteps ? "true" : "false",
  };
  const { Message } = await import("./Message");
  return render(<Message message={row()} isSending={false} isLastMessage {...props} />);
};

describe("a turn still running after a reload", () => {
  it("shows no error text and the steps block working, clock from the creation time", async () => {
    await mount(true);
    expect(screen.queryByTestId("message-error")).toBeNull();
    expect(screen.getByTestId("agent-steps-working")).toBeTruthy();
    expect(screen.getByTestId("agent-steps-clock").textContent).toBe("0:30");
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByTestId("agent-steps-clock").textContent).toBe("0:32");
    expect(screen.queryByTestId("message-footer-stub")).toBeNull();
  });

  it("with the steps flag off shows the loading state, not the error", async () => {
    await mount(false);
    expect(screen.queryByTestId("message-error")).toBeNull();
    expect(screen.getByTestId("message-loading")).toBeTruthy();
  });

  it("without the running flag the same row keeps today's error text", async () => {
    await mount(true, { isRunning: false });
    expect(screen.getByTestId("message-error")).toBeTruthy();
  });
});
