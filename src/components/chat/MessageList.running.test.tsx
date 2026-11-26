// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MessageType } from "@/types";

// Message stands in with the props MessageList hands it: the gate under test
// is MessageList's, not the row's own.
vi.mock("./Message", () => ({
  Message: ({ message, isRunning }: { message: MessageType; isRunning?: boolean }) => (
    <div data-testid="row" data-id={message.id} data-running={String(Boolean(isRunning))} />
  ),
}));
vi.mock("@/services/useCollectionCatalog", () => ({ useCollectionCatalog: () => null }));
vi.mock("@/services/useListModels", () => ({ useListModels: () => ({ data: undefined }) }));
vi.mock("./DynamicSidebarProvider", () => ({ useSidebar: () => ({ openDynamicSidebar: vi.fn() }) }));
vi.mock("@/services/axios", () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

import { MessageList } from "./MessageList";

afterEach(() => {
  cleanup();
});

const FIRST = "691ca0e6a1b2c3d4e5f60718";
const LAST = "691ca0f1a1b2c3d4e5f60719";

const row = (id: string): MessageType =>
  ({
    id,
    conversation_id: "conv-1",
    input: "q",
    output: "",
    feedback: null,
    timestamp: new Date(),
    documents: [],
    request_input: { llm_type: "main" },
  }) as MessageType;

const running = () =>
  screen.getAllByTestId("row").map((el) => [el.dataset.id, el.dataset.running]);

const mount = (runningMessageId: string) =>
  render(
    <MessageList
      messages={[row(FIRST), row(LAST)]}
      isSending={false}
      isError={false}
      runningMessageId={runningMessageId}
      onRetry={vi.fn()}
    />,
  );

describe("MessageList with a running turn", () => {
  it("hands the running flag to the last row", () => {
    mount(LAST);
    expect(running()).toEqual([
      [FIRST, "false"],
      [LAST, "true"],
    ]);
  });

  it("never hands it to an earlier row the id names", () => {
    mount(FIRST);
    expect(running()).toEqual([
      [FIRST, "false"],
      [LAST, "false"],
    ]);
  });
});
