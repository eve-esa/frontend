// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { blankBuildTimeEnv } from "@/test-utils/runtimeConfigStub";

/**
 * Chat after a reload mid-turn: the backend still generates the last row and
 * names it in `active_message_id`. The wiring between the conversation query,
 * the running turn, Retry and the composer, with the real composer.
 */

const ID = "691ca0e6a1b2c3d4e5f60718";

const get = vi.fn();
const stop = vi.fn();
const abort = vi.fn();

vi.setConfig({ testTimeout: 60_000 });

vi.mock("@/services/axios", () => ({
  default: { get: (...args: unknown[]) => get(...args), post: vi.fn() },
  handleResponseError: vi.fn(),
}));
vi.mock("@/services/streaming", () => ({ abortCurrentStream: () => abort() }));
vi.mock("@/services/stopConversation", () => ({
  stopConversation: (...args: unknown[]) => stop(...args),
}));
vi.mock("@/utilities/routes", () => ({ routes: { EMPTY_CHAT: { path: "/" } } }));
vi.mock("./MessageList", () => ({
  MessageList: ({
    isError,
    runningMessageId,
    messages,
  }: {
    isError: boolean;
    runningMessageId?: string | null;
    messages: { stopped?: boolean }[];
  }) => (
    <div
      data-testid="list"
      data-retry={String(isError)}
      data-running={runningMessageId ?? ""}
      data-stopped={String(Boolean(messages[messages.length - 1]?.stopped))}
    />
  ),
}));
vi.mock("./ChatHeader", () => ({ ChatHeader: () => null }));
vi.mock("./StopRequestWarningDialog", () => ({ StopRequestWarningDialog: () => null }));
vi.mock("./CustomModelsDialog", () => ({ CustomModelsDialog: () => null }));
vi.mock("./DynamicSidebarProvider", () => ({
  useSidebar: () => ({
    openDynamicSidebar: vi.fn(),
    setPendingConversation: vi.fn(),
    removePendingConversation: vi.fn(),
  }),
}));
vi.mock("@/hooks/useNavigationBlocker", () => ({
  useNavigationBlocker: () => ({ isModalOpen: false, handleConfirm: vi.fn(), handleCancel: vi.fn() }),
}));
vi.mock("@/hooks/useIsPhone", () => ({ useIsPhone: () => false }));
vi.mock("@/components/onboarding/TourContext", () => ({
  useTour: () => ({ isRunning: false, currentStep: 0, totalSteps: 0 }),
}));
vi.mock("@/services/useSendRequest", () => ({ useSendRequest: () => ({ mutate: vi.fn() }) }));
vi.mock("@/services/useRetry", () => ({ useRetry: () => ({ mutate: vi.fn() }) }));
vi.mock("@/services/useUploadImage", () => ({ useUploadImage: () => ({ mutateAsync: vi.fn() }) }));
vi.mock("@/services/useListModels", () => ({ useListModels: () => ({ data: undefined }) }));
vi.mock("@/services/useTokenUsage", () => ({
  useTokenUsage: () => ({ data: undefined }),
  prefetchTokenUsage: vi.fn(),
}));
vi.mock("@/components/ui/Dialog", () => {
  const Pass = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    Dialog: Pass,
    DialogTrigger: Pass,
    DialogContent: Pass,
    DialogHeader: Pass,
    DialogFooter: Pass,
    DialogClose: Pass,
    DialogTitle: Pass,
    DialogDescription: Pass,
  };
});

const body = (active: string | null, row: Record<string, unknown> = {}) => ({
  data: {
    id: "c1",
    name: "n",
    user_id: "u",
    messages: [{ id: ID, conversation_id: "c1", input: "q", output: "", ...row }],
    active_message_id: active,
  },
});

const tick = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

const list = () => screen.getByTestId("list");

beforeEach(() => {
  vi.useFakeTimers();
  // jsdom has no layout: the chat scrolls to the bottom on load.
  Element.prototype.scrollTo = vi.fn();
  get.mockReset();
  stop.mockReset();
  abort.mockReset();
  stop.mockResolvedValue({ status: "stopped", message_id: ID });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.resetModules();
});

const mount = async () => {
  blankBuildTimeEnv();
  const { Chat } = await import("./Chat");
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/chat/c1"]}>
        <Routes>
          <Route path="/chat/:conversationId" element={<Chat />} />
          <Route path="/" element={<div data-testid="empty-chat" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await tick(0);
  return client;
};

describe("Chat with a turn still running after a reload", () => {
  it("hides Retry, shows Stop and locks the composer", async () => {
    get.mockResolvedValue(body(ID));
    await mount();
    expect(list().dataset.running).toBe(ID);
    expect(list().dataset.retry).toBe("false");
    expect(screen.getByTestId("composer-stop")).toBeTruthy();
    expect(screen.queryByTestId("composer-send")).toBeNull();
  });

  it("Stop calls only the backend Stop and sticks while polls still name the turn", async () => {
    // The backend keeps reporting the turn (a Stop it lost, a dead worker's mapping).
    get.mockResolvedValue(body(ID));
    await mount();
    fireEvent.mouseDown(screen.getByTestId("composer-stop"));
    await tick(0);
    expect(stop).toHaveBeenCalledWith({ conversationId: "c1" });
    expect(abort).not.toHaveBeenCalled();
    expect(list().dataset.running).toBe("");
    expect(list().dataset.stopped).toBe("true");
    // Past the reconcile reads and several poll periods: still stopped, the
    // composer unlocked, no Retry, no Working.
    await tick(20_000);
    expect(list().dataset.running).toBe("");
    expect(list().dataset.stopped).toBe("true");
    expect(list().dataset.retry).toBe("false");
    expect(screen.getByTestId("composer-send")).toBeTruthy();
    expect(screen.queryByTestId("composer-stop")).toBeNull();
    // The row reads stopped: polling has ended.
    const calls = get.mock.calls.length;
    await tick(30_000);
    expect(get.mock.calls.length).toBe(calls);
  });

  it("stays on the conversation when one poll fails", async () => {
    get.mockResolvedValueOnce(body(ID)).mockRejectedValueOnce(new Error("502")).mockResolvedValue(body(ID));
    await mount();
    await tick(5100);
    expect(screen.queryByTestId("empty-chat")).toBeNull();
    expect(list().dataset.running).toBe(ID);
  });

  it("leaves for the empty chat when the conversation never loaded", async () => {
    get.mockRejectedValue(new Error("404"));
    await mount();
    await tick(0);
    expect(screen.getByTestId("empty-chat")).toBeTruthy();
  });

  it("keeps Send while a background read runs on a settled conversation", async () => {
    get.mockResolvedValueOnce(body(null, { output: "Done." })).mockReturnValue(new Promise(() => undefined));
    const client = await mount();
    expect(screen.getByTestId("composer-send")).toBeTruthy();
    void client.invalidateQueries({ queryKey: ["conversation", "c1"] });
    await tick(0);
    expect(client.isFetching()).toBe(1);
    expect(screen.getByTestId("composer-send")).toBeTruthy();
    expect(screen.queryByTestId("composer-stop")).toBeNull();
  });
});
