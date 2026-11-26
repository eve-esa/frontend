// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MessageType } from "@/types";
import { blankBuildTimeEnv } from "@/test-utils/runtimeConfigStub";

vi.mock("./MessageFooter", () => ({ MessageFooter: () => null }));
vi.mock("./DynamicSidebarProvider", () => ({ useSidebar: () => ({ openDynamicSidebar: vi.fn() }) }));
vi.mock("@/services/useCollectionCatalog", () => ({ useCollectionCatalog: () => null }));
vi.mock("@/services/useListModels", () => ({ useListModels: () => ({ data: undefined }) }));
vi.mock("@/services/axios", () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

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

describe("MessageList with a running turn", () => {
  it("hands the running flag to the last row only, so no error text shows", async () => {
    blankBuildTimeEnv();
    vi.resetModules();
    const { MessageList } = await import("./MessageList");
    render(
      <MessageList
        messages={[row("691ca0e6a1b2c3d4e5f60718")]}
        isSending={false}
        isError={false}
        runningMessageId="691ca0e6a1b2c3d4e5f60718"
        onRetry={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("message-error")).toBeNull();
    expect(screen.getByTestId("message-loading")).toBeTruthy();
  });
});
